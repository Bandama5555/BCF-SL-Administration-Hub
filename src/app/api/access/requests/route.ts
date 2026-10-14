import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import {
  AccessRequest,
  AccessRequestItem,
  AccessRequestStep,
  AccessRight,
} from "@/lib/accessTypes";
import {
  resolveUserProfile,
  findDepartmentDirector,
  findDepartmentDirectors,
  generateRequestNumber,
  getUserExistingTabRights,
  sendAccessNotification,
  canActorViewRequest,
  normalizeDepartmentName,
  RequestActorContext,
  determineApplicantRoute,
  getExecutiveManagementMembers,
} from "@/lib/accessServer";
import { ensureAccessCatalogueAndSettings, SENSITIVE_TABS } from "@/lib/accessCatalogueSeed";
import { normalizeRole, RoleCode, SEED_TEST_USERS } from "@/lib/permissions";
import { logSecurityAudit } from "@/lib/contractSecurity";

function extractActor(req: NextRequest): RequestActorContext {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");
  const nameHeader = req.headers.get("x-bcf-name");
  const deptHeader = req.headers.get("x-bcf-department");
  const empIdHeader = req.headers.get("x-bcf-employee-id");
  const posHeader = req.headers.get("x-bcf-position");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;
  const qName = url.searchParams.get("name") || nameHeader;
  const qDept = url.searchParams.get("department") || deptHeader;
  const qEmpId = url.searchParams.get("employeeId") || empIdHeader;
  const qPos = url.searchParams.get("position") || posHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail);
  return {
    userId: qEmail || "staff@bcf-sl.org",
    username: qUser || "staff_user",
    email: qEmail || "staff@bcf-sl.org",
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Staff Member"),
    role: qRole || roleCode,
    roleCode,
    department: qDept || undefined,
    position: qPos || undefined,
    employeeId: qEmpId || undefined,
  };
}

// GET /api/access/requests
export async function GET(req: NextRequest) {
  try {
    const actor = extractActor(req);
    const userProfile = await resolveUserProfile(actor);
    const effectiveActor: RequestActorContext = {
      ...actor,
      ...userProfile,
      roleCode: actor.roleCode,
    };

    const col = await getCollection<AccessRequest>(COLLECTIONS.ACCESS_REQUESTS);
    const allRequests = await col.find({}).sort({ createdAt: -1 }).toArray();

    // Filter requests according to role and department visibility
    const visibleRequests = allRequests.filter((request) =>
      canActorViewRequest(effectiveActor, request)
    );

    // Apply URL query filters if present (status, department, module, search)
    const url = new URL(req.url);
    const filterStatus = url.searchParams.get("status");
    const filterDept = url.searchParams.get("department");
    const filterModule = url.searchParams.get("module");
    const searchQuery = url.searchParams.get("q")?.toLowerCase();

    let filtered = visibleRequests;

    if (filterStatus) {
      filtered = filtered.filter((r) => r.status.toLowerCase() === filterStatus.toLowerCase());
    }
    if (filterDept) {
      filtered = filtered.filter(
        (r) => normalizeDepartmentName(r.department) === normalizeDepartmentName(filterDept)
      );
    }
    if (filterModule) {
      filtered = filtered.filter(
        (r) => r.module.toLowerCase() === filterModule.toLowerCase() || r.moduleSlug === filterModule
      );
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.requestNumber.toLowerCase().includes(searchQuery) ||
          r.requesterName.toLowerCase().includes(searchQuery) ||
          r.department.toLowerCase().includes(searchQuery) ||
          r.module.toLowerCase().includes(searchQuery) ||
          r.items.some((it) => it.tab.toLowerCase().includes(searchQuery))
      );
    }

    return NextResponse.json({
      success: true,
      requests: filtered,
      count: filtered.length,
      userRole: effectiveActor.roleCode,
      userDepartment: effectiveActor.department,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/access/requests (New Access Application)
export async function POST(req: NextRequest) {
  try {
    const actor = extractActor(req);
    const userProfile = await resolveUserProfile(actor);
    const { settings } = await ensureAccessCatalogueAndSettings();

    const body = await req.json();
    const {
      module,
      moduleSlug,
      tabs, // Array of { tab: string; tabId: string }
      rightsRequested, // Array of AccessRight
      durationType,
      endDate,
      justification,
      document,
    } = body;

    // 1. Basic validation
    if (!module || !tabs || !Array.isArray(tabs) || tabs.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please select a module and at least one tab." },
        { status: 400 }
      );
    }

    if (!rightsRequested || !Array.isArray(rightsRequested) || rightsRequested.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please select at least one access right (Read, Write, View, Upload, Download)." },
        { status: 400 }
      );
    }

    // 1b. Department validation: selected department must match applicant's department in Staff Directory
    const selectedDept = body.department || userProfile.department;
    if (
      body.department &&
      normalizeDepartmentName(body.department) !== normalizeDepartmentName(userProfile.department)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This is not your department. Contact HR to update your record.",
        },
        { status: 400 }
      );
    }

    // 2. Strict right verification: Delete, approve, restore are never allowed!
    const allowedRights: AccessRight[] = ["Read", "Write", "View", "Upload", "Download"];
    const invalidRights = rightsRequested.filter((r: any) => !allowedRights.includes(r));
    if (invalidRights.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Delete, approve and restore actions can never be requested or granted through this module.",
        },
        { status: 400 }
      );
    }

    if (!durationType || (durationType !== "Permanent" && durationType !== "Temporary")) {
      return NextResponse.json(
        { success: false, error: "Please specify a valid duration type (Permanent or Temporary)." },
        { status: 400 }
      );
    }

    if (durationType === "Temporary" && !endDate) {
      return NextResponse.json(
        { success: false, error: "End date is required for temporary access requests." },
        { status: 400 }
      );
    }

    // 3. Sensitive tabs and justification validation
    let hasSensitiveTab = false;
    for (const t of tabs) {
      if (SENSITIVE_TABS.has(t.tab)) {
        hasSensitiveTab = true;
        break;
      }
    }

    const cleanJustification = (justification || "").trim();
    if (!cleanJustification) {
      return NextResponse.json(
        { success: false, error: "Justification is required." },
        { status: 400 }
      );
    }

    if (hasSensitiveTab && cleanJustification.length < 50) {
      return NextResponse.json(
        {
          success: false,
          error: `Sensitive tabs require a comprehensive justification of at least 50 characters (currently ${cleanJustification.length} characters).`,
        },
        { status: 400 }
      );
    }

    // 4. Duplicate pending check: Same user cannot apply for same tab and rights while another application is pending
    const col = await getCollection<AccessRequest>(COLLECTIONS.ACCESS_REQUESTS);
    const pendingStatuses = [
      "Pending Department Director",
      "Pending IT Director",
      "Pending Super Admin",
      "Granted (awaiting confirmation)",
    ];

    const pendingRequests = await col
      .find({
        requesterEmail: userProfile.email.toLowerCase().trim(),
        status: { $in: pendingStatuses as any },
      })
      .toArray();

    for (const pending of pendingRequests) {
      for (const reqItem of pending.items) {
        for (const newTab of tabs) {
          if (reqItem.tabId === newTab.tabId || reqItem.tab === newTab.tab) {
            // Check if rights overlap
            const overlappingRights = (rightsRequested as AccessRight[]).filter((r) =>
              reqItem.rightsRequested.includes(r)
            );
            if (overlappingRights.length > 0) {
              return NextResponse.json(
                {
                  success: false,
                  error: `A pending application (${pending.requestNumber}) for tab '${newTab.tab}' is already awaiting approval. Duplicate applications are blocked.`,
                },
                { status: 409 }
              );
            }
          }
        }
      }
    }

    // 5. Existing rights check: If user already has requested rights, block duplicate
    for (const t of tabs) {
      const existing = await getUserExistingTabRights(
        userProfile.roleCode,
        userProfile.email,
        moduleSlug || module.toLowerCase().replace(/\s+/g, "-"),
        t.tabId
      );
      const duplicateRights = (rightsRequested as AccessRight[]).filter((r) =>
        existing.includes(r)
      );
      if (duplicateRights.length === (rightsRequested as AccessRight[]).length && existing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `You already have this access for tab '${t.tab}'. Duplicate request blocked.`,
          },
          { status: 400 }
        );
      }
    }

    // 6. Generate Request Number
    const requestNumber = await generateRequestNumber();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    // 7. Determine route strictly on server from applicant's role in the Staff Directory
    // Route cannot be chosen or overridden on the form or API.
    const routeInfo = determineApplicantRoute(userProfile);
    const { route, routeName, totalStages, initialStatus, initialStage, routeNote } = routeInfo;

    const itDirectorMatch = SEED_TEST_USERS.find((u) => u.role === "IT");
    const itEmail = itDirectorMatch ? itDirectorMatch.email : "atoro@bcf-sl.org";
    const saEmail = "admin@bcfsl.org";

    let assignedDirectorId = "";
    let assignedDirectorName = "";
    let assignedDirectorEmail = "";
    let assignedDirectorPosition = "";
    let directorAssignedBy: "system" | "fallback" | "applicant choice" = "system";
    let directorFlaggedToAdmin = false;

    let executiveManagementId = "";
    let executiveManagementName = "";
    let executiveManagementEmail = "";
    let executiveManagementPosition = "";

    const { directors, fallbackDirector, hasNoDirector, allDirectors } = await findDepartmentDirectors(
      userProfile.department,
      settings
    );

    if (route === "C") {
      // ─────────────────────────────────────────────────────────────
      // Route C: IT Director (1 stage)
      // ─────────────────────────────────────────────────────────────
      assignedDirectorName = "Not required (full access)";
      assignedDirectorPosition = "N/A";
      directorAssignedBy = "system";
    } else if (route === "B") {
      // ─────────────────────────────────────────────────────────────
      // Route B: Directors (2 stages)
      // Executive Management member is automatically named for information only.
      // ─────────────────────────────────────────────────────────────
      const execMembers = await getExecutiveManagementMembers(
        userProfile.staffId || userProfile.email
      );

      // Check if user selected one or if there is an executive member
      const chosenExec =
        (body.executiveManagementId || body.executive_management_id || body.directorId) &&
        execMembers.find(
          (m) =>
            m.id === (body.executiveManagementId || body.executive_management_id || body.directorId) ||
            m.email.toLowerCase() === (body.executiveManagementEmail || body.directorEmail || "").toLowerCase()
        );

      const targetExec = chosenExec || (execMembers.length > 0 ? execMembers[0] : null);

      if (targetExec) {
        executiveManagementId = targetExec.id;
        executiveManagementName = targetExec.name;
        executiveManagementEmail = targetExec.email;
        executiveManagementPosition = targetExec.position;
        assignedDirectorId = targetExec.id;
        assignedDirectorName = targetExec.name;
        assignedDirectorEmail = targetExec.email;
        assignedDirectorPosition = targetExec.position;
        directorAssignedBy = chosenExec ? "applicant choice" : "system";
      } else {
        executiveManagementName = "Not required";
        assignedDirectorName = "Not required";
        directorAssignedBy = "system";
      }
    } else {
      // ─────────────────────────────────────────────────────────────
      // Route A: Staff (3 stages)
      // ─────────────────────────────────────────────────────────────
      const chosen =
        (body.directorId || body.directorEmail) &&
        ((allDirectors || []).find(
          (d: any) =>
            d.id === body.directorId ||
            (body.directorEmail && d.email.toLowerCase() === body.directorEmail.toLowerCase())
        ) ||
          directors.find(
            (d: any) =>
              d.id === body.directorId ||
              (body.directorEmail && d.email.toLowerCase() === body.directorEmail.toLowerCase())
          ));

      // Nobody can approve their own request
      const isSelfApproval =
        chosen &&
        (chosen.email.toLowerCase().trim() === userProfile.email.toLowerCase().trim() ||
          (userProfile.staffId && chosen.id === userProfile.staffId));

      if (chosen && !isSelfApproval) {
        assignedDirectorId = chosen.id;
        assignedDirectorName = chosen.name;
        assignedDirectorEmail = chosen.email;
        assignedDirectorPosition = chosen.position;
        directorAssignedBy = "applicant choice";
        directorFlaggedToAdmin = false;
      } else if (hasNoDirector || directors.length === 0) {
        // Department has no Director -> route to CEO fallback & flag to Super Admin
        assignedDirectorId = fallbackDirector.id;
        assignedDirectorName = fallbackDirector.name;
        assignedDirectorEmail = fallbackDirector.email;
        assignedDirectorPosition = fallbackDirector.position;
        directorAssignedBy = "fallback";
        directorFlaggedToAdmin = true;
      } else {
        const d = directors[0];
        assignedDirectorId = d.id;
        assignedDirectorName = d.name;
        assignedDirectorEmail = d.email;
        assignedDirectorPosition = d.position;
        directorAssignedBy = "system";
        directorFlaggedToAdmin = false;
      }
    }

    // 8. Build request items and initial step
    const items: AccessRequestItem[] = tabs.map((t: any) => ({
      tab: t.tab,
      tabId: t.tabId,
      module,
      moduleSlug: moduleSlug || module.toLowerCase().replace(/\s+/g, "-"),
      sensitive: SENSITIVE_TABS.has(t.tab),
      rightsRequested: rightsRequested as AccessRight[],
    }));

    let initialComment = "";
    if (route === "C") {
      initialComment = "Application submitted directly to Super Admin for Stage 1 grant (Route C: IT Director).";
    } else if (route === "B") {
      initialComment = `Application submitted by Director. Routed to IT Director for Stage 1 approval (Executive Management member ${executiveManagementName} informed for info only).`;
    } else {
      initialComment = `Application submitted and routed to Department Director ${assignedDirectorName} (${assignedDirectorPosition}).`;
    }

    const initialStep: AccessRequestStep = {
      id: `step_${Date.now()}_1`,
      requestId,
      stage: 0,
      stageName: "Stage 0: Application Submission",
      approverId: userProfile.staffId,
      approverName: userProfile.name,
      approverRole: userProfile.position || userProfile.role,
      approverEmail: userProfile.email,
      action: "Submitted",
      comment: initialComment,
      actedAt: nowIso,
    };

    const newRequest: AccessRequest = {
      id: requestId,
      requestNumber,
      requesterId: userProfile.staffId,
      requesterName: userProfile.name,
      requesterEmail: userProfile.email.toLowerCase().trim(),
      requesterRole: userProfile.role,
      staffId: userProfile.staffId,
      departmentId: body.departmentId || userProfile.department.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      department: userProfile.department,
      position: userProfile.position,
      route,
      routeName,
      routeNote,
      totalStages,
      executive_management_id: executiveManagementId || undefined,
      executiveManagementId: executiveManagementId || undefined,
      executiveManagementName: executiveManagementName || undefined,
      executiveManagementEmail: executiveManagementEmail || undefined,
      executiveManagementPosition: executiveManagementPosition || undefined,
      directorId: assignedDirectorId || undefined,
      directorName: assignedDirectorName || undefined,
      directorEmail: assignedDirectorEmail || undefined,
      directorPosition: assignedDirectorPosition || undefined,
      directorAssignedBy,
      directorFlaggedToAdmin,
      module,
      moduleSlug: moduleSlug || module.toLowerCase().replace(/\s+/g, "-"),
      durationType,
      endDate: durationType === "Temporary" ? endDate : null,
      justification: cleanJustification,
      document: document || null,
      hasSensitiveTab,
      items,
      status: initialStatus,
      currentStage: initialStage,
      currentApproverRole: routeInfo.initialApproverRole,
      currentApproverDepartment: route === "A" ? userProfile.department : undefined,
      steps: [initialStep],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await col.insertOne(newRequest as any);

    // 9. Send notifications according to route matrix
    const tabSummary = items.map((i) => i.tab).join(", ");

    if (route === "C") {
      // IT Director application submitted:
      // Requester (confirmation), Super Admin (action needed)
      await sendAccessNotification({
        recipientEmails: [userProfile.email],
        actorEmail: userProfile.email,
        requestId,
        requestNumber,
        title: "Access Application Submitted",
        message: `Your access request ${requestNumber} for ${module} has been submitted directly to Super Admin for final approval (Route C).`,
      });

      await sendAccessNotification({
        recipientEmails: [saEmail],
        actorEmail: userProfile.email,
        requestId,
        requestNumber,
        title: "Action Required: Access Approval",
        message: `IT Director ${userProfile.name} has submitted access request ${requestNumber} for ${module} > ${tabSummary}. Final Super Admin grant required.`,
      });
    } else if (route === "B") {
      // Director application submitted:
      // Requester (confirmation), IT Director (action needed), named Executive Management member (for information only)
      await sendAccessNotification({
        recipientEmails: [userProfile.email],
        actorEmail: userProfile.email,
        requestId,
        requestNumber,
        title: "Access Application Submitted",
        message: `Your access request ${requestNumber} for ${module} has been submitted to the IT Director for Stage 1 approval (Route B). Executive Management is informed.`,
      });

      await sendAccessNotification({
        recipientEmails: [itEmail],
        actorEmail: userProfile.email,
        requestId,
        requestNumber,
        title: "Action Required: Director Access Approval",
        message: `Access request from Director ${userProfile.name}, ${userProfile.department}, for ${module} > ${tabSummary} awaits your IT Director approval.`,
      });

      if (executiveManagementEmail) {
        await sendAccessNotification({
          recipientEmails: [executiveManagementEmail],
          actorEmail: userProfile.email,
          requestId,
          requestNumber,
          title: "For Information: Director Access Application",
          message: `Director ${userProfile.name} (${userProfile.department}) has submitted access request ${requestNumber} for ${module} > ${tabSummary}. Routed to IT Director for Stage 1 approval. (For information only)`,
        });
      }
    } else {
      // Staff application submitted:
      // Requester (confirmation), named Department Director (action needed)
      await sendAccessNotification({
        recipientEmails: [userProfile.email],
        actorEmail: userProfile.email,
        requestId,
        requestNumber,
        title: "Access Application Submitted",
        message: `Your access request ${requestNumber} for ${module} has been submitted and sent to ${assignedDirectorName} for approval (Route A).`,
      });

      if (assignedDirectorEmail) {
        await sendAccessNotification({
          recipientEmails: [assignedDirectorEmail],
          actorEmail: userProfile.email,
          requestId,
          requestNumber,
          title: "Action Required: Access Approval",
          message: `Access request from ${userProfile.name}, ${userProfile.department}, for ${module} > ${tabSummary}`,
        });
      }

      if (directorFlaggedToAdmin) {
        await sendAccessNotification({
          recipientEmails: [saEmail],
          actorEmail: "system",
          requestId,
          requestNumber,
          title: "Access Request: No Department Director Assigned",
          message: `Access request ${requestNumber} from ${userProfile.name} (${userProfile.department}) has no Director assigned. Routed to CEO fallback (${assignedDirectorName}) and flagged for Admin attention.`,
        });
      }
    }

    // Log security audit
    await logSecurityAudit({
      action: "ACCESS_APPLICATION_SUBMITTED",
      user: userProfile.name,
      role: userProfile.role,
      email: userProfile.email,
      itemId: requestId,
      itemTitle: requestNumber,
      tab: tabSummary,
      reason: cleanJustification,
      details: {
        requestNumber,
        module,
        route,
        routeName,
        itemsCount: items.length,
        hasSensitiveTab,
        currentStage: initialStage,
        directorName: assignedDirectorName,
        executiveManagementName: executiveManagementName || undefined,
        directorAssignedBy,
        directorFlaggedToAdmin,
      },
    });

    return NextResponse.json({
      success: true,
      requestNumber,
      request: newRequest,
      message: `Access application ${requestNumber} (${routeName}) submitted successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
