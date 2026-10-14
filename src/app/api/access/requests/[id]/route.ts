import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import {
  AccessRequest,
  AccessRequestStep,
  AccessGrant,
  AccessRight,
  ApprovalStage,
} from "@/lib/accessTypes";
import {
  resolveUserProfile,
  canActorViewRequest,
  canActorActOnRequest,
  sendAccessNotification,
  RequestActorContext,
} from "@/lib/accessServer";
import { ensureAccessCatalogueAndSettings } from "@/lib/accessCatalogueSeed";
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

// GET /api/access/requests/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = extractActor(req);
    const userProfile = await resolveUserProfile(actor);
    const effectiveActor = {
      ...actor,
      ...userProfile,
      roleCode: actor.roleCode,
    };

    const col = await getCollection<AccessRequest>(COLLECTIONS.ACCESS_REQUESTS);
    const request = await col.findOne({
      $or: [{ id }, { requestNumber: id }],
    });

    if (!request) {
      return NextResponse.json({ success: false, error: "Access request not found." }, { status: 404 });
    }

    // Strict Server-Side Check:
    // If user cannot view this request (e.g. Department Director looking at another dept or staff looking at another's):
    if (!canActorViewRequest(effectiveActor, request)) {
      await logSecurityAudit({
        action: "ACCESS_REQUEST_UNAUTHORIZED_VIEW_ATTEMPT",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: request.id,
        itemTitle: request.requestNumber,
        reason: "User does not have permission to view request from another department or user.",
        details: {
          requestId: request.id,
          requestNumber: request.requestNumber,
          requestDepartment: request.department,
          actorDepartment: effectiveActor.department,
        },
      });

      return NextResponse.json(
        {
          error: "You do not have access to that page.",
          code: "ACCESS_DENIED",
        },
        { status: 403 }
      );
    }

    // Record "Viewed by [name] at [date and time]" in history if actor is not the requester
    const isRequester = (request.requesterEmail || "").toLowerCase() === (effectiveActor.email || "").toLowerCase();
    if (!isRequester && ["SA", "IT", "HR", "CEO", "FIN", "PRC", "PRG", "IAR"].includes(effectiveActor.roleCode)) {
      const nowIso = new Date().toISOString();
      const viewStep: AccessRequestStep = {
        id: `step_view_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        requestId: request.id,
        stage: request.currentStage,
        stageName: `Stage ${request.currentStage} Review`,
        approverId: effectiveActor.staffId,
        approverName: effectiveActor.name,
        approverRole: effectiveActor.position || effectiveActor.role,
        approverEmail: effectiveActor.email,
        action: "Viewed",
        comment: `Viewed by ${effectiveActor.name} (${effectiveActor.position || effectiveActor.role}) at ${new Date().toLocaleString()}`,
        actedAt: nowIso,
      };

      // Check if last step was already a view by the same user within 2 minutes to prevent spam
      const lastStep = request.steps[request.steps.length - 1];
      const isDuplicateView =
        lastStep &&
        lastStep.action === "Viewed" &&
        lastStep.approverEmail === effectiveActor.email &&
        Date.now() - new Date(lastStep.actedAt).getTime() < 120000;

      if (!isDuplicateView) {
        await col.updateOne({ id: request.id }, { $push: { steps: viewStep as any }, $set: { updatedAt: nowIso } });
        request.steps.push(viewStep);
      }
    }

    return NextResponse.json({
      success: true,
      request,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH /api/access/requests/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = extractActor(req);
    const userProfile = await resolveUserProfile(actor);
    const effectiveActor = {
      ...actor,
      ...userProfile,
      roleCode: actor.roleCode,
    };

    const col = await getCollection<AccessRequest>(COLLECTIONS.ACCESS_REQUESTS);
    const request = await col.findOne({
      $or: [{ id }, { requestNumber: id }],
    });

    if (!request) {
      return NextResponse.json({ success: false, error: "Access request not found." }, { status: 404 });
    }

    const body = await req.json();
    const actionRaw = body.action; // "Approve" | "Reject" | "Grant" | "Confirm" | "Decline" | "Cancel"
    const comment = (body.comment || "").trim();
    const reason = (body.reason || "").trim();
    const nowIso = new Date().toISOString();

    if (!actionRaw) {
      return NextResponse.json({ success: false, error: "Action is required." }, { status: 400 });
    }

    // Capitalize action
    const action = (actionRaw.charAt(0).toUpperCase() + actionRaw.slice(1).toLowerCase()) as
      | "Approve"
      | "Reject"
      | "Grant"
      | "Confirm"
      | "Decline"
      | "Cancel";

    // Strict validation of actor eligibility & sequence
    const check = canActorActOnRequest(effectiveActor, request, action);
    if (!check.allowed) {
      await logSecurityAudit({
        action: "ACCESS_REQUEST_UNAUTHORIZED_ACTION",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: request.id,
        itemTitle: request.requestNumber,
        reason: check.reason,
        details: { action, currentStage: request.currentStage, status: request.status },
      });

      return NextResponse.json({ success: false, error: check.reason }, { status: 403 });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: CANCEL (Requester at Stage 1)
    // ─────────────────────────────────────────────────────────────
    if (action === "Cancel") {
      const step: AccessRequestStep = {
        id: `step_${Date.now()}_cancel`,
        requestId: request.id,
        stage: request.currentStage,
        stageName: "Cancelled by Requester",
        approverId: effectiveActor.staffId,
        approverName: effectiveActor.name,
        approverRole: effectiveActor.position,
        approverEmail: effectiveActor.email,
        action: "Cancelled",
        comment: reason || "Request cancelled by applicant.",
        actedAt: nowIso,
      };

      await col.updateOne(
        { id: request.id },
        {
          $set: {
            status: "Cancelled",
            cancelledReason: reason || "Cancelled by applicant",
            updatedAt: nowIso,
          },
          $push: { steps: step as any },
        }
      );

      await logSecurityAudit({
        action: "ACCESS_REQUEST_CANCELLED",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: request.id,
        itemTitle: request.requestNumber,
        reason,
      });

      return NextResponse.json({ success: true, message: "Request cancelled successfully." });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: REJECT (Any Stage Approver)
    // ─────────────────────────────────────────────────────────────
    if (action === "Reject") {
      if (!reason) {
        return NextResponse.json(
          { success: false, error: "A rejection reason is required." },
          { status: 400 }
        );
      }

      const step: AccessRequestStep = {
        id: `step_${Date.now()}_reject`,
        requestId: request.id,
        stage: request.currentStage,
        stageName: `Stage ${request.currentStage} Rejection`,
        approverId: effectiveActor.staffId,
        approverName: effectiveActor.name,
        approverRole: effectiveActor.position || effectiveActor.role,
        approverEmail: effectiveActor.email,
        action: "Rejected",
        comment: reason,
        actedAt: nowIso,
      };

      await col.updateOne(
        { id: request.id },
        {
          $set: {
            status: "Rejected",
            rejectionReason: reason,
            updatedAt: nowIso,
          },
          $push: { steps: step as any },
        }
      );

      // Notify requester with reason and rejecting stage
      await sendAccessNotification({
        recipientEmails: [request.requesterEmail],
        actorEmail: effectiveActor.email,
        requestId: request.id,
        requestNumber: request.requestNumber,
        title: "Access Request Rejected",
        message: `Your access request ${request.requestNumber} was rejected at Stage ${request.currentStage} by ${effectiveActor.name}. Reason: ${reason}`,
      });

      await logSecurityAudit({
        action: "ACCESS_REQUEST_REJECTED",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: request.id,
        itemTitle: request.requestNumber,
        reason,
        details: { stage: request.currentStage },
      });

      return NextResponse.json({ success: true, message: "Request rejected successfully." });
    }

    // ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────
    // ACTION: APPROVE (Stage 1 or Stage 2)
    // ─────────────────────────────────────────────────────────────
    if (action === "Approve") {
      const route = request.route || "A";
      const itDirectorMatch = SEED_TEST_USERS.find((u) => u.role === "IT");
      const itEmail = itDirectorMatch ? itDirectorMatch.email : "atoro@bcf-sl.org";
      const saEmail = "admin@bcfsl.org";

      // ─────────────────────────────────────────────────────────────
      // ROUTE B: Directors (2 stages)
      // Stage 1: IT Director approves -> moves to Stage 2 (Super Admin)
      // ─────────────────────────────────────────────────────────────
      if (route === "B" && request.currentStage === 1) {
        const step: AccessRequestStep = {
          id: `step_${Date.now()}_appr_b1`,
          requestId: request.id,
          stage: 1,
          stageName: "Stage 1: IT Director Approval",
          approverId: effectiveActor.staffId,
          approverName: effectiveActor.name,
          approverRole: effectiveActor.position || effectiveActor.role,
          approverEmail: effectiveActor.email,
          action: "Approved",
          comment: comment || "Approved by IT Director.",
          actedAt: nowIso,
        };

        await col.updateOne(
          { id: request.id },
          {
            $set: {
              status: "Pending Super Admin",
              currentStage: 2,
              currentApproverRole: "SA",
              updatedAt: nowIso,
            },
            $push: { steps: step as any },
          }
        );

        // Notifications for Route B Stage 1 approval:
        // Requester, Super Admin (action needed), Executive Management member (for information only)
        await sendAccessNotification({
          recipientEmails: [request.requesterEmail],
          actorEmail: effectiveActor.email,
          requestId: request.id,
          requestNumber: request.requestNumber,
          title: "Stage 1 Approved (IT Director)",
          message: `Your Director access request ${request.requestNumber} was approved by IT Director ${effectiveActor.name} and is now pending Super Admin final acceptance and grant.`,
        });

        await sendAccessNotification({
          recipientEmails: [saEmail],
          actorEmail: effectiveActor.email,
          requestId: request.id,
          requestNumber: request.requestNumber,
          title: "Action Required: Stage 2 Access Grant",
          message: `Director access request ${request.requestNumber} for ${request.requesterName} (${request.module}) has been approved by the IT Director and awaits final Super Admin acceptance and grant.`,
        });

        const execEmail = request.executiveManagementEmail || (request as any).executive_management_email;
        if (execEmail) {
          await sendAccessNotification({
            recipientEmails: [execEmail],
            actorEmail: effectiveActor.email,
            requestId: request.id,
            requestNumber: request.requestNumber,
            title: "For Information: Route B IT Approval",
            message: `Director access request ${request.requestNumber} for ${request.requesterName} was approved by the IT Director and is now pending Super Admin grant. (For information only)`,
          });
        }

        await logSecurityAudit({
          action: "ACCESS_REQUEST_ROUTE_B_STAGE1_APPROVED",
          user: effectiveActor.name,
          role: effectiveActor.roleCode,
          email: effectiveActor.email,
          itemId: request.id,
          itemTitle: request.requestNumber,
          reason: comment,
        });

        return NextResponse.json({ success: true, message: "Stage 1 approved. Request moved to Super Admin." });
      }

      // ─────────────────────────────────────────────────────────────
      // ROUTE A: Staff (3 stages)
      // Stage 1: Department Director approves -> moves to Stage 2 (IT Director)
      // ─────────────────────────────────────────────────────────────
      if (route === "A" && request.currentStage === 1) {
        const step: AccessRequestStep = {
          id: `step_${Date.now()}_appr1`,
          requestId: request.id,
          stage: 1,
          stageName: "Stage 1: Department Director Approval",
          approverId: effectiveActor.staffId,
          approverName: effectiveActor.name,
          approverRole: effectiveActor.position || effectiveActor.role,
          approverEmail: effectiveActor.email,
          action: "Approved",
          comment: comment || "Approved by Department Director.",
          actedAt: nowIso,
        };

        await col.updateOne(
          { id: request.id },
          {
            $set: {
              status: "Pending IT Director",
              currentStage: 2,
              currentApproverRole: "IT",
              updatedAt: nowIso,
            },
            $push: { steps: step as any },
          }
        );

        // Notify requester and IT Director
        await sendAccessNotification({
          recipientEmails: [request.requesterEmail],
          actorEmail: effectiveActor.email,
          requestId: request.id,
          requestNumber: request.requestNumber,
          title: "Stage 1 Approved",
          message: `Your access request ${request.requestNumber} was approved by Department Director ${effectiveActor.name} and is now pending IT Director approval.`,
        });

        await sendAccessNotification({
          recipientEmails: [itEmail],
          actorEmail: effectiveActor.email,
          requestId: request.id,
          requestNumber: request.requestNumber,
          title: "Action Required: Stage 2 IT Approval",
          message: `Access request ${request.requestNumber} for ${request.requesterName} has been approved at Stage 1 and awaits your IT Director approval.`,
        });

        await logSecurityAudit({
          action: "ACCESS_REQUEST_STAGE1_APPROVED",
          user: effectiveActor.name,
          role: effectiveActor.roleCode,
          email: effectiveActor.email,
          itemId: request.id,
          itemTitle: request.requestNumber,
          reason: comment,
        });

        return NextResponse.json({ success: true, message: "Stage 1 approved. Request moved to IT Director." });
      }

      // ─────────────────────────────────────────────────────────────
      // ROUTE A: Staff Stage 2 IT Director approves -> moves to Stage 3 (Super Admin)
      // ─────────────────────────────────────────────────────────────
      if (route === "A" && request.currentStage === 2) {
        const step: AccessRequestStep = {
          id: `step_${Date.now()}_appr2`,
          requestId: request.id,
          stage: 2,
          stageName: "Stage 2: IT Director Approval",
          approverId: effectiveActor.staffId,
          approverName: effectiveActor.name,
          approverRole: effectiveActor.position || effectiveActor.role,
          approverEmail: effectiveActor.email,
          action: "Approved",
          comment: comment || "Approved by IT Director.",
          actedAt: nowIso,
        };

        await col.updateOne(
          { id: request.id },
          {
            $set: {
              status: "Pending Super Admin",
              currentStage: 3,
              currentApproverRole: "SA",
              updatedAt: nowIso,
            },
            $push: { steps: step as any },
          }
        );

        // Notify requester and Super Admin
        await sendAccessNotification({
          recipientEmails: [request.requesterEmail],
          actorEmail: effectiveActor.email,
          requestId: request.id,
          requestNumber: request.requestNumber,
          title: "Stage 2 Approved",
          message: `Your access request ${request.requestNumber} was approved by IT Director ${effectiveActor.name} and is now pending Super Admin final acceptance and grant.`,
        });

        await sendAccessNotification({
          recipientEmails: [saEmail],
          actorEmail: effectiveActor.email,
          requestId: request.id,
          requestNumber: request.requestNumber,
          title: "Action Required: Stage 3 Access Grant",
          message: `Access request ${request.requestNumber} for ${request.requesterName} (${request.module}) has passed Stage 2 and awaits final Super Admin acceptance and rights granting.`,
        });

        await logSecurityAudit({
          action: "ACCESS_REQUEST_STAGE2_APPROVED",
          user: effectiveActor.name,
          role: effectiveActor.roleCode,
          email: effectiveActor.email,
          itemId: request.id,
          itemTitle: request.requestNumber,
          reason: comment,
        });

        return NextResponse.json({ success: true, message: "Stage 2 approved. Request moved to Super Admin." });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: GRANT (Super Admin final approval)
    // Route A: Stage 3; Route B: Stage 2; Route C: Stage 1
    // ─────────────────────────────────────────────────────────────
    if (action === "Grant") {
      const route = request.route || "A";
      const grantedItems = body.items || request.items;
      const reducedRightsReason = (body.reducedRightsReason || "").trim();
      const updatedEndDate = body.endDate || request.endDate;

      // Validate: Delete, approve, restore can never be granted!
      const allowedRights: AccessRight[] = ["Read", "Write", "View", "Upload", "Download"];
      let hasReduction = false;

      const finalItems = request.items.map((it) => {
        const matching = grantedItems.find((gi: any) => gi.tabId === it.tabId || gi.tab === it.tab);
        const rightsToGrant: AccessRight[] = matching && Array.isArray(matching.rightsGranted)
          ? matching.rightsGranted.filter((r: AccessRight) => allowedRights.includes(r))
          : it.rightsRequested;

        // Check if reduced
        if (rightsToGrant.length < it.rightsRequested.length) {
          hasReduction = true;
        }

        return {
          ...it,
          rightsGranted: rightsToGrant,
        };
      });

      if (hasReduction && !reducedRightsReason) {
        return NextResponse.json(
          {
            success: false,
            error: "A justification reason is required when granting reduced access rights.",
          },
          { status: 400 }
        );
      }

      const grantStage = request.currentStage;
      const grantStageName =
        route === "C"
          ? "Stage 1: Super Admin Acceptance & Grant"
          : route === "B"
          ? "Stage 2: Super Admin Acceptance & Grant"
          : "Stage 3: Super Admin Acceptance & Grant";

      const step: AccessRequestStep = {
        id: `step_${Date.now()}_grant`,
        requestId: request.id,
        stage: grantStage,
        stageName: grantStageName,
        approverId: effectiveActor.staffId,
        approverName: effectiveActor.name,
        approverRole: "Super Administrator",
        approverEmail: effectiveActor.email,
        action: "Granted",
        comment: comment || (hasReduction ? `Granted with reduced rights: ${reducedRightsReason}` : "Granted full requested rights."),
        actedAt: nowIso,
      };

      await col.updateOne(
        { id: request.id },
        {
          $set: {
            status: "Granted (awaiting confirmation)",
            items: finalItems,
            endDate: updatedEndDate,
            grantedBy: effectiveActor.name,
            grantedAt: nowIso,
            reducedRightsReason: hasReduction ? reducedRightsReason : null,
            updatedAt: nowIso,
          },
          $push: { steps: step as any },
        }
      );

      // 1b. Write active grants into access_grants collection
      const grantsCol = await getCollection<AccessGrant>(COLLECTIONS.ACCESS_GRANTS);
      const newGrants: AccessGrant[] = finalItems.map((it) => ({
        id: `grant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        requestId: request.id,
        requestNumber: request.requestNumber,
        userId: request.requesterId,
        userEmail: request.requesterEmail,
        userName: request.requesterName,
        staffId: request.staffId,
        department: request.department,
        module: it.module,
        moduleSlug: it.moduleSlug,
        tab: it.tab,
        tabId: it.tabId,
        rightsGranted: it.rightsGranted || it.rightsRequested,
        grantedBy: effectiveActor.name,
        grantedByName: effectiveActor.name,
        grantedAt: nowIso,
        acceptedAt: nowIso,
        endDate: updatedEndDate,
        status: "Active",
      }));

      for (const g of newGrants) {
        await grantsCol.updateOne(
          { requestId: request.id, tabId: g.tabId },
          { $set: g },
          { upsert: true }
        );
      }

      // Notify requester that access is granted and awaits confirmation
      await sendAccessNotification({
        recipientEmails: [request.requesterEmail],
        actorEmail: effectiveActor.email,
        requestId: request.id,
        requestNumber: request.requestNumber,
        title: "Access Granted - Action Needed",
        message: `Super Admin has granted your access request ${request.requestNumber}. The applicable tabs are now active and visible in your navigation. Please review and confirm your access in 'My Requests'.`,
      });

      // On Route B: Executive Management member notified for information only
      const execEmail = request.executiveManagementEmail || (request as any).executive_management_email;
      if (route === "B" && execEmail) {
        await sendAccessNotification({
          recipientEmails: [execEmail],
          actorEmail: effectiveActor.email,
          requestId: request.id,
          requestNumber: request.requestNumber,
          title: "For Information: Access Granted",
          message: `Access request ${request.requestNumber} for Director ${request.requesterName} has been granted by Super Admin and is awaiting requester confirmation. (For information only)`,
        });
      }

      await logSecurityAudit({
        action: "ACCESS_REQUEST_GRANTED_STAGE_FINALIZED",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: request.id,
        itemTitle: request.requestNumber,
        reason: reducedRightsReason || comment,
        details: { route, grantStage },
      });

      return NextResponse.json({
        success: true,
        message: "Access granted successfully. Applicable tabs are now visible and active for staff member.",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: CONFIRM (Requester confirms and accepts granted access)
    // ─────────────────────────────────────────────────────────────
    if (action === "Confirm") {
      const step: AccessRequestStep = {
        id: `step_${Date.now()}_accept`,
        requestId: request.id,
        stage: 3,
        stageName: "Staff Acceptance & Activation",
        approverId: effectiveActor.staffId,
        approverName: effectiveActor.name,
        approverRole: effectiveActor.position,
        approverEmail: effectiveActor.email,
        action: "Accepted",
        comment: "Staff member confirmed acceptance of access terms.",
        actedAt: nowIso,
      };

      // 1. Update request status to Active
      await col.updateOne(
        { id: request.id },
        {
          $set: {
            status: "Active",
            acceptedAt: nowIso,
            updatedAt: nowIso,
          },
          $push: { steps: step as any },
        }
      );

      // 2. Upsert grants as accepted and active in access_grants collection
      const grantsCol = await getCollection<AccessGrant>(COLLECTIONS.ACCESS_GRANTS);
      for (const item of request.items) {
        const rights = item.rightsGranted && item.rightsGranted.length > 0 ? item.rightsGranted : [];
        if (rights.length === 0) continue;

        const grantDoc: AccessGrant = {
          id: `grant_${request.id}_${item.tabId}`,
          requestId: request.id,
          requestNumber: request.requestNumber,
          userId: request.requesterId || request.staffId,
          userEmail: request.requesterEmail,
          userName: request.requesterName,
          staffId: request.staffId,
          department: request.department,
          module: item.module,
          moduleSlug: item.moduleSlug,
          tab: item.tab,
          tabId: item.tabId,
          rightsGranted: rights,
          grantedBy: request.grantedBy || "Super Administrator",
          grantedByName: request.grantedBy || "Super Administrator",
          grantedAt: request.grantedAt || nowIso,
          acceptedAt: nowIso,
          endDate: request.endDate,
          status: "Active",
        };

        await grantsCol.updateOne(
          { requestId: request.id, tabId: item.tabId },
          { $set: grantDoc },
          { upsert: true }
        );
      }

      // 3. Notify requester, Super Admin and IT Director
      const saEmail = "admin@bcfsl.org";
      const itDirectorMatch = SEED_TEST_USERS.find((u) => u.role === "IT");
      const itEmail = itDirectorMatch ? itDirectorMatch.email : "atoro@bcf-sl.org";

      await sendAccessNotification({
        recipientEmails: [request.requesterEmail, saEmail, itEmail],
        actorEmail: effectiveActor.email,
        requestId: request.id,
        requestNumber: request.requestNumber,
        title: "Access Confirmed & Active",
        message: `Access request ${request.requestNumber} for ${request.module} is now ACTIVE and available to ${request.requesterName}.`,
      });

      await logSecurityAudit({
        action: "ACCESS_REQUEST_CONFIRMED_AND_ACTIVATED",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: request.id,
        itemTitle: request.requestNumber,
        details: { grantedCount: request.items.length },
      });

      return NextResponse.json({
        success: true,
        message: "Access confirmed and activated! The granted tabs are now live.",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: DECLINE (Requester declines granted access)
    // ─────────────────────────────────────────────────────────────
    if (action === "Decline") {
      if (!reason) {
        return NextResponse.json(
          { success: false, error: "A reason is required to decline granted access." },
          { status: 400 }
        );
      }

      const step: AccessRequestStep = {
        id: `step_${Date.now()}_decline`,
        requestId: request.id,
        stage: 3,
        stageName: "Staff Declined",
        approverId: effectiveActor.staffId,
        approverName: effectiveActor.name,
        approverRole: effectiveActor.position,
        approverEmail: effectiveActor.email,
        action: "Declined",
        comment: reason,
        actedAt: nowIso,
      };

      await col.updateOne(
        { id: request.id },
        {
          $set: {
            status: "Declined",
            declinedReason: reason,
            updatedAt: nowIso,
          },
          $push: { steps: step as any },
        }
      );

      await logSecurityAudit({
        action: "ACCESS_REQUEST_DECLINED_BY_STAFF",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: request.id,
        itemTitle: request.requestNumber,
        reason,
      });

      return NextResponse.json({ success: true, message: "Granted access declined." });
    }

    return NextResponse.json({ success: false, error: "Unrecognized action." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
