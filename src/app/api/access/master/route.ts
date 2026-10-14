import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { AccessGrant, AccessRequest, AccessRevocation, AccessRight } from "@/lib/accessTypes";
import { resolveUserProfile, RequestActorContext, getDepartmentDirectory } from "@/lib/accessServer";
import { normalizeRole, RoleCode, ACCESS_MATRIX } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { logSecurityAudit } from "@/lib/contractSecurity";

function extractActor(req: NextRequest): RequestActorContext {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");
  const nameHeader = req.headers.get("x-bcf-name");
  const deptHeader = req.headers.get("x-bcf-department");
  const empIdHeader = req.headers.get("x-bcf-employee-id");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;
  const qName = url.searchParams.get("name") || nameHeader;
  const qDept = url.searchParams.get("department") || deptHeader;
  const qEmpId = url.searchParams.get("employeeId") || empIdHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail, qDept);
  return {
    userId: qEmpId || qEmail || "staff@bcf-sl.org",
    username: qUser || "staff_user",
    email: qEmail || "staff@bcf-sl.org",
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Staff Member"),
    role: qRole || roleCode,
    roleCode,
    department: qDept || undefined,
    employeeId: qEmpId || undefined,
    staffId: qEmpId || undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = extractActor(req);
    const userProfile = await resolveUserProfile(actor);
    const effectiveActor: RequestActorContext = {
      ...actor,
      ...userProfile,
      roleCode: actor.roleCode,
    };

    // Strict access control: Super Admin (full), HR Director (view-only), IT Director (view-only), CEO (view-only)
    const allowedRoles: RoleCode[] = ["SA", "HR", "IT", "CEO"];
    if (!allowedRoles.includes(effectiveActor.roleCode)) {
      await logSecurityAudit({
        action: "ACCESS_MASTER_UNAUTHORIZED_VIEW_ATTEMPT",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: "access-master",
        itemTitle: "Access Master Register",
        reason: "Unauthorized role attempted to view Access Master register.",
      });

      return NextResponse.json(
        {
          error: "You do not have access to that page.",
          code: "ACCESS_DENIED",
        },
        { status: 403 }
      );
    }

    const grantsCol = await getCollection<AccessGrant>(COLLECTIONS.ACCESS_GRANTS);
    const requestsCol = await getCollection<AccessRequest>(COLLECTIONS.ACCESS_REQUESTS);
    const revCol = await getCollection<AccessRevocation>(COLLECTIONS.ACCESS_REVOCATIONS);
    const empCol = await getCollection(COLLECTIONS.EMPLOYEES);

    // Fetch all grants
    const allGrants = await grantsCol.find({}).sort({ grantedAt: -1 }).toArray();
    // Fetch all requests for approval trails
    const allRequests = await requestsCol.find({}).toArray();
    // Fetch revocations for detailed revoke info
    const allRevocations = await revCol.find({}).sort({ revoked_at: -1 }).toArray();
    // Fetch all employee records for rich metadata
    const allEmployees = await empCol.find({}).toArray();
    // Fetch department directory for authoritative director lookup
    const deptDir = await getDepartmentDirectory();

    // Map requests by ID for rapid lookup of approval chains
    const requestMap = new Map<string, AccessRequest>();
    for (const r of allRequests) {
      requestMap.set(r.id, r);
      if (r.requestNumber) requestMap.set(r.requestNumber, r);
    }

    // Map revocations by grantId or (staffId + tabId)
    const revocationMap = new Map<string, AccessRevocation>();
    for (const rev of allRevocations) {
      if (rev.grant_id) revocationMap.set(rev.grant_id, rev);
      if (rev.grantId) revocationMap.set(rev.grantId, rev);
      if (rev.staff_id && rev.tabId) {
        revocationMap.set(`${rev.staff_id}_${rev.tabId}`, rev);
      }
    }

    // Date references
    const now = new Date();
    const nowIso = now.toISOString();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Sensitive tabs catalog
    const sensitiveTabIds = new Set<string>([
      "payroll-schedule",
      "treasury-balance",
      "executive-analytics",
      "access-matrix",
      "audit-logs",
      "donor-inflow-ledger",
      "finance-approval",
      "ceo-authorisation",
      "cases-log",
      "disciplinary-log",
      "rfq-management",
      "invoice-matching",
    ]);

    // Calculate KPIs
    const uniqueStaffWithGrants = new Set(allGrants.map((g) => g.staffId || g.userId));
    const activeGrants = allGrants.filter((g) => g.status === "Active");
    const pendingRequestsCount = allRequests.filter((r) =>
      ["Pending Department Director", "Pending IT Director", "Pending Super Admin", "Granted (awaiting confirmation)"].includes(
        r.status
      )
    ).length;

    const expiringIn30DaysCount = allGrants.filter(
      (g) => g.status === "Active" && g.endDate && g.endDate >= nowIso && g.endDate <= thirtyDaysAhead
    ).length;

    const revokedThisMonthCount = allGrants.filter(
      (g) => g.status === "Revoked" && g.revokedAt && g.revokedAt >= startOfMonth
    ).length + allRevocations.filter((r) => r.revoked_at >= startOfMonth).length;

    const sensitiveTabGrantsCount = allGrants.filter(
      (g) => g.status === "Active" && sensitiveTabIds.has(g.tabId)
    ).length;

    const kpis = {
      totalStaffWithGrants: uniqueStaffWithGrants.size,
      activeGrantsCount: activeGrants.length,
      pendingRequestsCount,
      expiringIn30DaysCount,
      revokedThisMonthCount,
      sensitiveTabGrantsCount,
    };

    // Helper to get Director for a staff member
    const getDirectorForStaff = (emp: any, dept: string): string => {
      if (emp?.directReport || emp?.supervisor || emp?.director) {
        return emp.directReport || emp.supervisor || emp.director;
      }
      const dirs = deptDir.departmentDirectors[dept];
      if (dirs && dirs.length > 0) {
        return `${dirs[0].name} (${dirs[0].position})`;
      }
      return `${deptDir.fallbackDirector.name} (${deptDir.fallbackDirector.position})`;
    };

    // Helper to build Baseline Role-Based Matrix permissions
    const getRoleBasedBaselineAccess = (roleCode: RoleCode) => {
      const baseline: Array<{
        module: string;
        moduleSlug: string;
        tab: string;
        tabId: string;
        level: string;
        rights: AccessRight[];
      }> = [];

      for (const mod of MODULES) {
        const modPerms = ACCESS_MATRIX[mod.slug];
        if (!modPerms) continue;

        for (const sub of mod.subApps) {
          const perms = modPerms[sub.id];
          if (!perms) continue;

          let level = perms[roleCode] || "-";
          if (level === "-" && roleCode !== "ST") {
            const stLevel = perms["ST"] || "-";
            if (stLevel !== "-") level = stLevel;
          }

          if (level !== "-") {
            const rights: AccessRight[] = [];
            if (level === "F") rights.push("Read", "Write", "View", "Upload", "Download");
            else if (level === "OW") rights.push("Read", "Write", "View");
            else if (level === "V" || level === "O") rights.push("Read", "View");

            baseline.push({
              module: mod.label,
              moduleSlug: mod.slug,
              tab: sub.label,
              tabId: sub.id,
              level,
              rights,
            });
          }
        }
      }
      return baseline;
    };

    // Build View 1: By Staff (Aggregated per staff)
    const staffGrantsMap = new Map<string, AccessGrant[]>();
    for (const g of allGrants) {
      const key = g.staffId || g.userId || g.userEmail;
      if (!staffGrantsMap.has(key)) {
        staffGrantsMap.set(key, []);
      }
      staffGrantsMap.get(key)!.push(g);
    }

    const staffProfiles = Array.from(staffGrantsMap.entries()).map(([staffKey, grants]) => {
      const sampleGrant = grants[0];
      const empMatch: any = allEmployees.find(
        (e) =>
          e.employeeId === sampleGrant.staffId ||
          e.staffId === sampleGrant.staffId ||
          (e.email && e.email.toLowerCase() === sampleGrant.userEmail?.toLowerCase())
      );

      const staffId = empMatch?.employeeId || sampleGrant.staffId || staffKey;
      const staffName = empMatch?.fullName || empMatch?.name || sampleGrant.userName || "Staff Member";
      const department = empMatch?.department || sampleGrant.department || "Operations";
      const position = empMatch?.position || "Staff Officer";
      const email = empMatch?.email || sampleGrant.userEmail || "";
      const director = getDirectorForStaff(empMatch, department);
      const roleCode = normalizeRole(empMatch?.role, empMatch?.username, email);

      // Unique modules and tabs with active granted access
      const activeOrRecentGrants = grants;
      const activeOnlyGrants = grants.filter((g) => g.status === "Active");
      const modulesSet = new Set(activeOnlyGrants.map((g) => g.module));
      const tabsSet = new Set(activeOnlyGrants.map((g) => g.tab));

      // Aggregated rights set from active grants
      const rightsSet = new Set<AccessRight>();
      activeOnlyGrants.forEach((g) => {
        (g.rightsGranted || []).forEach((r) => rightsSet.add(r));
      });

      // Overall status
      const hasActive = activeOrRecentGrants.some((g) => g.status === "Active");
      const hasExpiringSoon = activeOrRecentGrants.some(
        (g) => g.status === "Active" && g.endDate && g.endDate <= thirtyDaysAhead && g.endDate >= nowIso
      );
      const overallStatus = hasExpiringSoon
        ? "Expiring soon"
        : hasActive
        ? "Active"
        : "Revoked";

      const lastGranted = activeOrRecentGrants
        .map((g) => g.grantedAt)
        .filter(Boolean)
        .sort()
        .pop() || sampleGrant.grantedAt;

      // Detailed grants with approval trail
      const detailedGrants = activeOrRecentGrants.map((g) => {
        const req = g.requestId ? requestMap.get(g.requestId) : null;
        const rev = revocationMap.get(g.id) || revocationMap.get(`${g.staffId}_${g.tabId}`);

        // Find approval stages from request steps
        let stage1Approval = req?.steps?.find(
          (s) => s.stage === 1 && (s.action === "Approved" || s.action === "Submitted")
        );
        let stage2Approval = req?.steps?.find((s) => s.stage === 2 && s.action === "Approved");
        let stage3Grant = req?.steps?.find((s) => s.stage === 3 && s.action === "Granted");

        return {
          id: g.id,
          requestId: g.requestId,
          requestNumber: g.requestNumber,
          module: g.module,
          moduleSlug: g.moduleSlug,
          tab: g.tab,
          tabId: g.tabId,
          rights: g.rightsGranted || [],
          status: g.status,
          isSensitive: sensitiveTabIds.has(g.tabId),
          grantedAt: g.grantedAt,
          acceptedAt: g.acceptedAt,
          endDate: g.endDate,
          isPermanent: !g.endDate,
          grantedBy: g.grantedByName || g.grantedBy || "Super Administrator",
          requesterName: req?.requesterName || sampleGrant.userName,
          approvalTrail: {
            requester: req?.requesterName || sampleGrant.userName,
            requestedAt: req?.createdAt || g.grantedAt,
            directorApproval: stage1Approval
              ? { name: stage1Approval.approverName, date: stage1Approval.actedAt, comment: stage1Approval.comment }
              : null,
            itDirectorApproval: stage2Approval
              ? { name: stage2Approval.approverName, date: stage2Approval.actedAt, comment: stage2Approval.comment }
              : null,
            superAdminGrant: stage3Grant
              ? { name: stage3Grant.approverName, date: stage3Grant.actedAt, comment: stage3Grant.comment }
              : { name: g.grantedByName || "Super Admin", date: g.grantedAt },
          },
          revocationDetails:
            g.status === "Revoked" || rev
              ? {
                  revokedBy: rev?.revoked_by || g.revokedBy || "Super Administrator",
                  revokedAt: rev?.revoked_at || g.revokedAt,
                  reasonCode: rev?.reason_code || g.revocationReason?.split(":")[0],
                  reasonText: rev?.reason_text || g.revocationReason,
                  rightsRemoved: rev?.rights_removed || g.rightsGranted,
                }
              : null,
        };
      });

      // Baseline matrix access
      const baselineAccess = getRoleBasedBaselineAccess(roleCode);

      return {
        staffId,
        staffName,
        email,
        department,
        position,
        director,
        roleCode,
        modulesCount: modulesSet.size,
        modulesList: Array.from(modulesSet),
        tabsCount: tabsSet.size,
        rightsSummary: Array.from(rightsSet),
        lastGranted,
        status: overallStatus,
        grants: detailedGrants,
        baselineAccess,
      };
    });

    // Build View 2: By Tab (All tabs with staff who have access)
    const tabRegister: Array<{
      module: string;
      moduleSlug: string;
      tab: string;
      tabId: string;
      isSensitive: boolean;
      staffList: Array<{
        grantId: string;
        staffId: string;
        staffName: string;
        staffEmail: string;
        department: string;
        position: string;
        rights: AccessRight[];
        grantedAt: string;
        endDate: string | null;
        isPermanent: boolean;
        status: string;
      }>;
    }> = [];

    for (const mod of MODULES) {
      for (const sub of mod.subApps) {
        const matchingGrants = allGrants.filter(
          (g) => g.status === "Active" && (g.tabId === sub.id || g.tab === sub.label) && g.moduleSlug === mod.slug
        );

        if (matchingGrants.length > 0) {
          tabRegister.push({
            module: mod.label,
            moduleSlug: mod.slug,
            tab: sub.label,
            tabId: sub.id,
            isSensitive: sensitiveTabIds.has(sub.id),
            staffList: matchingGrants.map((g) => ({
              grantId: g.id,
              staffId: g.staffId,
              staffName: g.userName,
              staffEmail: g.userEmail,
              department: g.department,
              position: "Staff",
              rights: g.rightsGranted || [],
              grantedAt: g.grantedAt,
              endDate: g.endDate || null,
              isPermanent: !g.endDate,
              status: g.status,
            })),
          });
        }
      }
    }

    // Build View 3: By Module (Counts table)
    const moduleCounts = MODULES.map((mod) => {
      const modGrants = allGrants.filter((g) => g.moduleSlug === mod.slug);
      const uniqueStaff = new Set(modGrants.map((g) => g.staffId || g.userId)).size;
      const activeCount = modGrants.filter((g) => g.status === "Active").length;
      const revokedCount = modGrants.filter((g) => g.status === "Revoked").length;

      const subAppStats = mod.subApps.map((sub) => {
        const subGrants = modGrants.filter((g) => g.tabId === sub.id || g.tab === sub.label);
        const subUniqueStaff = new Set(subGrants.map((g) => g.staffId || g.userId)).size;
        return {
          tabId: sub.id,
          tabName: sub.label,
          staffCount: subUniqueStaff,
          activeCount: subGrants.filter((g) => g.status === "Active").length,
          revokedCount: subGrants.filter((g) => g.status === "Revoked").length,
          isSensitive: sensitiveTabIds.has(sub.id),
        };
      });

      return {
        moduleName: mod.label,
        moduleSlug: mod.slug,
        totalStaffWithAccess: uniqueStaff,
        activeGrants: activeCount,
        revokedGrants: revokedCount,
        tabs: subAppStats,
      };
    });

    return NextResponse.json({
      success: true,
      role: effectiveActor.roleCode,
      isReadOnly: effectiveActor.roleCode !== "SA",
      kpis,
      staffProfiles,
      tabRegister,
      moduleCounts,
    });
  } catch (err: any) {
    console.error("Error generating Access Master register:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
