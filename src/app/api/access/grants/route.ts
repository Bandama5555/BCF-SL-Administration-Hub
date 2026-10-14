import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { AccessGrant, AccessRequest, AccessRequestStep, AccessRevocation } from "@/lib/accessTypes";
import { resolveUserProfile, sendAccessNotification, RequestActorContext } from "@/lib/accessServer";
import { normalizeRole, RoleCode } from "@/lib/permissions";
import { logSecurityAudit } from "@/lib/contractSecurity";

function extractActor(req: NextRequest): RequestActorContext {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");
  const nameHeader = req.headers.get("x-bcf-name");
  const empIdHeader = req.headers.get("x-bcf-employee-id");
  const deptHeader = req.headers.get("x-bcf-department");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;
  const qName = url.searchParams.get("name") || nameHeader;
  const qEmpId = url.searchParams.get("employeeId") || empIdHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail, deptHeader);
  return {
    userId: qEmpId || qEmail || "staff@bcf-sl.org",
    username: qUser || "staff_user",
    email: qEmail || "staff@bcf-sl.org",
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Staff Member"),
    role: qRole || roleCode,
    roleCode,
    employeeId: qEmpId || undefined,
    staffId: qEmpId || undefined,
    department: deptHeader || undefined,
  };
}

// GET /api/access/grants
export async function GET(req: NextRequest) {
  try {
    const actor = extractActor(req);
    const userProfile = await resolveUserProfile(actor);
    const effectiveActor: RequestActorContext = {
      ...actor,
      ...userProfile,
      roleCode: actor.roleCode,
    };

    const col = await getCollection<AccessGrant>(COLLECTIONS.ACCESS_GRANTS);

    // CRITICAL: Self-healing synchronization for past revocations
    // Any grant recorded in access_revocations MUST strictly have status: "Revoked" in access_grants
    try {
      const revCol = await getCollection(COLLECTIONS.ACCESS_REVOCATIONS);
      const allRevocations = await revCol.find({}).toArray();
      for (const rev of allRevocations) {
        const targetTabId = rev.tabId || rev.tab;
        const targetStaffId = rev.staff_id || rev.staffId;
        const targetStaffEmail = rev.staffEmail;

        const revFilter: any = {
          status: "Active",
          $or: [
            ...(rev.grant_id ? [{ id: rev.grant_id }] : []),
            ...(rev.grantId ? [{ id: rev.grantId }] : []),
            ...(targetTabId && targetStaffId
              ? [{ tabId: targetTabId, $or: [{ staffId: targetStaffId }, { userId: targetStaffId }] }]
              : []),
            ...(targetTabId && targetStaffEmail
              ? [{ tabId: targetTabId, userEmail: { $regex: `^${targetStaffEmail}$`, $options: "i" } }]
              : []),
          ],
        };

        if (revFilter.$or.length > 0) {
          await col.updateMany(revFilter, {
            $set: {
              status: "Revoked",
              rightsGranted: [],
              revokedAt: rev.revoked_at || new Date().toISOString(),
              revokedBy: rev.revoked_by || "Super Administrator",
              revocationReason: `${rev.reason_code || "Revoked"}: ${rev.reason_text || ""}`,
            },
          });
        }
      }
    } catch (_) {}

    // Auto-sync any active access requests that have granted items into access_grants
    // CRITICAL: NEVER overwrite or resurrect grants that have been revoked!
    try {
      const reqCol = await getCollection<AccessRequest>(COLLECTIONS.ACCESS_REQUESTS);
      const revCol = await getCollection(COLLECTIONS.ACCESS_REVOCATIONS);
      const activeRequests = await reqCol
        .find({
          status: { $in: ["Active", "Granted (awaiting confirmation)"] as any },
        })
        .toArray();

      for (const ar of activeRequests) {
        if (!Array.isArray(ar.items)) continue;
        for (const item of ar.items) {
          if ((item as any).revoked || (item as any).status === "Revoked") continue;
          const rights = item.rightsGranted && item.rightsGranted.length > 0 ? item.rightsGranted : [];
          if (rights.length === 0) continue;

          // Check if grant was already revoked in access_grants
          const existingGrant = await col.findOne({
            $or: [
              { requestId: ar.id, tabId: item.tabId },
              { staffId: ar.staffId, tabId: item.tabId },
              { userEmail: { $regex: `^${ar.requesterEmail}$`, $options: "i" }, tabId: item.tabId },
            ],
          });

          if (existingGrant && existingGrant.status === "Revoked") {
            continue; // PRESERVE REVOKED STATUS! DO NOT RESURRECT!
          }

          // Check if revocation record exists in access_revocations
          const hasRevocation = await revCol.findOne({
            $or: [
              { staff_id: ar.staffId, tabId: item.tabId },
              { staffEmail: { $regex: `^${ar.requesterEmail}$`, $options: "i" }, tabId: item.tabId },
              { grant_id: existingGrant?.id },
              { grantId: existingGrant?.id },
            ],
          });

          if (hasRevocation) {
            continue; // PRESERVE REVOCATION! DO NOT RESURRECT!
          }

          const grantDoc: AccessGrant = {
            id: existingGrant?.id || `grant_${ar.id}_${item.tabId}`,
            requestId: ar.id,
            requestNumber: ar.requestNumber,
            userId: ar.requesterId || ar.staffId,
            userEmail: ar.requesterEmail,
            userName: ar.requesterName,
            staffId: ar.staffId,
            department: ar.department,
            module: item.module,
            moduleSlug: item.moduleSlug,
            tab: item.tab,
            tabId: item.tabId,
            rightsGranted: rights,
            grantedBy: ar.grantedBy || "Super Administrator",
            grantedByName: ar.grantedBy || "Super Administrator",
            grantedAt: ar.grantedAt || ar.updatedAt || new Date().toISOString(),
            acceptedAt: ar.acceptedAt || ar.updatedAt || new Date().toISOString(),
            endDate: ar.endDate || null,
            status: "Active",
          };

          await col.updateOne(
            { requestId: ar.id, tabId: item.tabId, status: { $ne: "Revoked" } },
            { $set: grantDoc },
            { upsert: !existingGrant }
          );
        }
      }

      // Neutralize any active request items matching already-revoked grants
      const revokedGrants = await col.find({ status: "Revoked" }).toArray();
      for (const rg of revokedGrants) {
        await reqCol.updateMany(
          {
            $or: [
              { id: rg.requestId },
              { requesterEmail: { $regex: `^${rg.userEmail}$`, $options: "i" }, "items.tabId": rg.tabId },
              { staffId: rg.staffId, "items.tabId": rg.tabId },
            ],
            "items.tabId": rg.tabId,
          },
          {
            $set: {
              "items.$.rightsGranted": [],
              "items.$.status": "Revoked",
              "items.$.revoked": true,
            },
          }
        );
      }
    } catch (_) {}

    // Auto-expire any temporary grants past their end date
    const nowIso = new Date().toISOString();
    await col.updateMany(
      {
        status: "Active",
        endDate: { $ne: null, $lt: nowIso },
      },
      {
        $set: {
          status: "Expired",
        },
      }
    );

    const url = new URL(req.url);
    const userOnly = url.searchParams.get("userOnly") === "true";
    const qEmail = url.searchParams.get("email");
    const qStaffId = url.searchParams.get("staffId");

    let grants: AccessGrant[] = [];

    // Role-based visibility vs Personal user grants sync
    if (!userOnly && ["SA", "CEO", "IT", "HR"].includes(effectiveActor.roleCode)) {
      grants = await col.find({}).sort({ grantedAt: -1 }).toArray();
    } else {
      // Regular staff or user-specific grant sync
      const cleanEmail = (qEmail || effectiveActor.email || "").trim();
      const cleanStaffId = (qStaffId || effectiveActor.staffId || "").trim();
      const cleanUserId = (effectiveActor.userId || "").trim();
      const cleanUser = (effectiveActor.username || "").trim();

      grants = await col
        .find({
          $or: [
            ...(cleanEmail ? [{ userEmail: { $regex: `^${cleanEmail}$`, $options: "i" } }] : []),
            ...(cleanStaffId ? [{ staffId: { $regex: `^${cleanStaffId}$`, $options: "i" } }] : []),
            ...(cleanUserId ? [{ userId: { $regex: `^${cleanUserId}$`, $options: "i" } }] : []),
            ...(cleanUser ? [{ userName: { $regex: cleanUser, $options: "i" } }] : []),
          ],
        })
        .sort({ grantedAt: -1 })
        .toArray();
    }

    // Filters
    const filterStatus = url.searchParams.get("status");
    const filterModule = url.searchParams.get("module");
    const searchQuery = url.searchParams.get("q")?.toLowerCase();

    let filtered = grants;
    if (filterStatus) {
      filtered = filtered.filter((g) => g.status.toLowerCase() === filterStatus.toLowerCase());
    }
    if (filterModule) {
      filtered = filtered.filter(
        (g) => g.module.toLowerCase() === filterModule.toLowerCase() || g.moduleSlug === filterModule
      );
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (g) =>
          g.userName.toLowerCase().includes(searchQuery) ||
          g.userEmail.toLowerCase().includes(searchQuery) ||
          g.module.toLowerCase().includes(searchQuery) ||
          g.tab.toLowerCase().includes(searchQuery) ||
          g.requestNumber.toLowerCase().includes(searchQuery)
      );
    }

    let userRevocations: any[] = [];
    try {
      const cleanEmail = (qEmail || effectiveActor.email || "").trim();
      const cleanStaffId = (qStaffId || effectiveActor.staffId || "").trim();
      if (cleanEmail || cleanStaffId) {
        const revCol = await getCollection<AccessRevocation>(COLLECTIONS.ACCESS_REVOCATIONS);
        userRevocations = await revCol.find({
          $or: [
            ...(cleanEmail ? [{ staffEmail: { $regex: `^${cleanEmail}$`, $options: "i" } }] : []),
            ...(cleanStaffId ? [{ staff_id: cleanStaffId }, { staffId: cleanStaffId }] : []),
          ],
        }).toArray();
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      grants: filtered,
      revocations: userRevocations,
      count: filtered.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/access/grants (Revoke active grant)
export async function POST(req: NextRequest) {
  try {
    const actor = extractActor(req);
    const userProfile = await resolveUserProfile(actor);
    const effectiveActor: RequestActorContext = {
      ...actor,
      ...userProfile,
      roleCode: actor.roleCode,
    };

    // Strictly enforce Super Admin requirement
    if (effectiveActor.roleCode !== "SA") {
      return NextResponse.json(
        { success: false, error: "Only Super Admin can revoke active access grants." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { grantId, reason } = body;

    if (!grantId) {
      return NextResponse.json({ success: false, error: "Grant ID is required." }, { status: 400 });
    }

    const cleanReason = (reason || "").trim();
    if (!cleanReason) {
      return NextResponse.json(
        { success: false, error: "A revocation reason is required." },
        { status: 400 }
      );
    }

    const col = await getCollection<AccessGrant>(COLLECTIONS.ACCESS_GRANTS);
    const grant = await col.findOne({ id: grantId });

    if (!grant) {
      return NextResponse.json({ success: false, error: "Grant not found." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    // Revoke grant
    await col.updateOne(
      { id: grantId },
      {
        $set: {
          status: "Revoked",
          revokedAt: nowIso,
          revokedBy: effectiveActor.name,
          revocationReason: cleanReason,
        },
      }
    );

    // Update parent request status to Revoked and append timeline step
    const reqCol = await getCollection<AccessRequest>(COLLECTIONS.ACCESS_REQUESTS);
    if (grant.requestId) {
      const step: AccessRequestStep = {
        id: `step_${Date.now()}_revoke`,
        requestId: grant.requestId,
        stage: 3,
        stageName: "Super Admin Revocation",
        approverId: effectiveActor.staffId || effectiveActor.employeeId || "SA",
        approverName: effectiveActor.name,
        approverRole: "Super Administrator",
        approverEmail: effectiveActor.email,
        action: "Revoked",
        comment: `Revoked by Super Admin: ${cleanReason}`,
        actedAt: nowIso,
      };

      await reqCol.updateOne(
        { id: grant.requestId },
        {
          $set: {
            status: "Revoked",
            revocationReason: cleanReason,
            updatedAt: nowIso,
          },
          $push: { steps: step as any },
        }
      );
    }

    // Notify requester of revocation
    await sendAccessNotification({
      recipientEmails: [grant.userEmail],
      actorEmail: effectiveActor.email,
      requestId: grant.requestId,
      requestNumber: grant.requestNumber,
      title: "Access Revoked",
      message: `Your access to '${grant.tab}' (${grant.module}) has been revoked by Super Admin. Reason: ${cleanReason}`,
    });

    await logSecurityAudit({
      action: "ACCESS_GRANT_REVOKED",
      user: effectiveActor.name,
      role: effectiveActor.roleCode,
      email: effectiveActor.email,
      itemId: grant.id,
      itemTitle: `${grant.module} - ${grant.tab}`,
      reason: cleanReason,
      details: {
        granteeEmail: grant.userEmail,
        requestNumber: grant.requestNumber,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Access to '${grant.tab}' revoked successfully. Permissions removed immediately.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
