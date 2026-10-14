import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import {
  AccessGrant,
  AccessRequest,
  AccessRequestStep,
  AccessRevocation,
  AccessRight,
  RevokeReasonCode,
  RevokeScope,
} from "@/lib/accessTypes";
import {
  resolveUserProfile,
  sendAccessNotification,
  RequestActorContext,
  canonicalizeDepartmentName,
} from "@/lib/accessServer";
import { normalizeRole, RoleCode, ACCESS_MATRIX } from "@/lib/permissions";
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

  const roleCode = normalizeRole(qRole, qUser, qEmail, qDept, qPos);
  return {
    userId: qEmpId || qEmail || "staff@bcf-sl.org",
    username: qUser || "staff_user",
    email: qEmail || "staff@bcf-sl.org",
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Staff Member"),
    role: qRole || roleCode,
    roleCode,
    department: qDept || undefined,
    position: qPos || undefined,
    employeeId: qEmpId || undefined,
    staffId: qEmpId || undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const actor = extractActor(req);
    const userProfile = await resolveUserProfile(actor);
    const effectiveActor: RequestActorContext = {
      ...actor,
      ...userProfile,
      roleCode: actor.roleCode,
    };

    // STRICT SERVER-SIDE ENFORCEMENT: Super Admin only
    if (effectiveActor.roleCode !== "SA") {
      await logSecurityAudit({
        action: "UNAUTHORIZED_REVOKE_ATTEMPT",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: "access-revoke",
        itemTitle: "Access Revoke Attempt",
        reason: "Unauthorized role attempted to execute access revocation.",
        details: { attemptedRole: effectiveActor.roleCode },
      });

      return NextResponse.json(
        {
          error: "You do not have access to that page.",
          code: "ACCESS_DENIED",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      isBulk,
      bulkItems, // Array of { staffId, grantId, tabId, moduleSlug }
      staffId,
      module: moduleName,
      moduleSlug,
      scope, // "Module" | "Tab" | "Rights"
      tab,
      tabId,
      rightsToRemove, // AccessRight[]
      reason_code,
      reason_text,
      effective_at, // ISO date or "Immediately"
    } = body;

    const reasonCode = (reason_code || body.reasonCode) as RevokeReasonCode;
    const reasonText = (reason_text || body.reasonText || "").trim();

    // Reason validation
    if (!reasonCode) {
      return NextResponse.json(
        { success: false, error: "A valid revocation reason is required." },
        { status: 400 }
      );
    }

    // "Misuse", "Security concern" and "Other" require details text
    if (
      ["Misuse", "Security concern", "Other"].includes(reasonCode) &&
      !reasonText
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Detailed explanation is strictly required when selecting '${reasonCode}'.`,
        },
        { status: 400 }
      );
    }

    const grantsCol = await getCollection<AccessGrant>(COLLECTIONS.ACCESS_GRANTS);
    const revCol = await getCollection<AccessRevocation>(COLLECTIONS.ACCESS_REVOCATIONS);
    const reqCol = await getCollection<AccessRequest>(COLLECTIONS.ACCESS_REQUESTS);
    const empCol = await getCollection(COLLECTIONS.EMPLOYEES);

    const nowIso = new Date().toISOString();
    const effectiveAtIso =
      !effective_at || effective_at === "Immediately"
        ? nowIso
        : new Date(effective_at).toISOString();

    // Helper to check baseline role permissions
    const isBaselineRoleAccess = (targetRole: RoleCode, modSlug: string, targetTabId?: string): boolean => {
      if (!modSlug || !targetTabId) return false;
      const modPerms = ACCESS_MATRIX[modSlug];
      if (modPerms && modPerms[targetTabId]) {
        const level = modPerms[targetTabId][targetRole];
        return level === "F" || level === "OW" || level === "V" || level === "O";
      }
      return false;
    };

    // Helper to notify IT Director
    const notifyItDirector = async (message: string, reqId?: string, reqNum?: string) => {
      try {
        const itDirectors = ["atoro@bcf-sl.org", "i.koroma@bcf-sl.org", "it@bcf-sl.org"];
        await sendAccessNotification({
          recipientEmails: itDirectors,
          actorEmail: effectiveActor.email,
          requestId: reqId || "SYS-REVOKE",
          requestNumber: reqNum || "BCF-REVOKE",
          title: "Security / Module Revocation Alert",
          message,
        });
      } catch (_) {}
    };

    // ─────────────────────────────────────────────────────────────────────────
    // CASE A: BULK REVOCATION (From Access Master By Tab)
    // ─────────────────────────────────────────────────────────────────────────
    if (isBulk && Array.isArray(bulkItems) && bulkItems.length > 0) {
      const bulkBatchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const revocationsCreated: AccessRevocation[] = [];
      let affectedStaffCount = 0;

      for (const item of bulkItems) {
        const targetStaffId = item.staffId;
        const targetGrantId = item.grantId;
        const targetTabId = item.tabId || tabId;
        const targetModSlug = item.moduleSlug || moduleSlug;

        // Rule: Super Admin cannot revoke their own access
        if (
          targetStaffId === effectiveActor.staffId ||
          targetStaffId === effectiveActor.employeeId ||
          (item.staffEmail && item.staffEmail.toLowerCase() === effectiveActor.email.toLowerCase())
        ) {
          continue; // Skip self
        }

        // Find grant by grantId, or by staffId + tabId / module
        let grantQuery: any = { status: "Active" };
        if (targetGrantId) {
          grantQuery = { id: targetGrantId, status: "Active" };
        } else if (targetStaffId && targetTabId) {
          grantQuery = {
            $or: [{ staffId: targetStaffId }, { userId: targetStaffId }],
            tabId: targetTabId,
            status: "Active",
          };
        } else if (targetStaffId && targetModSlug) {
          grantQuery = {
            $or: [{ staffId: targetStaffId }, { userId: targetStaffId }],
            moduleSlug: targetModSlug,
            status: "Active",
          };
        }

        const activeGrants = await grantsCol.find(grantQuery).toArray();
        if (activeGrants.length === 0) continue;

        affectedStaffCount++;

        for (const g of activeGrants) {
          // Mark grant as Revoked
          await grantsCol.updateOne(
            { id: g.id },
            {
              $set: {
                status: "Revoked",
                revokedAt: nowIso,
                revokedBy: effectiveActor.name,
                revocationReason: `${reasonCode}${reasonText ? `: ${reasonText}` : ""}`,
              },
            }
          );

          // Create AccessRevocation document
          const revDoc: AccessRevocation = {
            id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            grant_id: g.id,
            grantId: g.id,
            staff_id: g.staffId,
            staffId: g.staffId,
            staffName: g.userName,
            staffEmail: g.userEmail,
            department: g.department,
            module: g.module,
            moduleSlug: g.moduleSlug,
            tab: g.tab,
            tabId: g.tabId,
            rights_removed: g.rightsGranted || [],
            rightsRemoved: g.rightsGranted || [],
            scope: (scope as RevokeScope) || "Tab",
            reason_code: reasonCode,
            reasonCode: reasonCode,
            reason_text: reasonText,
            reasonText: reasonText,
            revoked_by: effectiveActor.name,
            revokedBy: effectiveActor.name,
            effective_at: effectiveAtIso,
            effectiveAt: effectiveAtIso,
            revoked_at: nowIso,
            revokedAt: nowIso,
            bulk_batch_id: bulkBatchId,
            bulkBatchId: bulkBatchId,
          };

          await revCol.insertOne(revDoc as any);
          revocationsCreated.push(revDoc);

          // Update linked request timeline
          if (g.requestId) {
            const step: AccessRequestStep = {
              id: `step_${Date.now()}_bulk_revoke`,
              requestId: g.requestId,
              stage: 3,
              stageName: "Super Admin Revocation",
              approverId: effectiveActor.staffId || "SA",
              approverName: effectiveActor.name,
              approverRole: "Super Administrator",
              approverEmail: effectiveActor.email,
              action: "Revoked",
              comment: `Bulk Revoked by Super Admin: ${reasonCode}. ${reasonText}`.trim(),
              actedAt: nowIso,
            };

            await reqCol.updateOne(
              { id: g.requestId },
              {
                $set: { status: "Revoked", revocationReason: `${reasonCode}: ${reasonText}`, updatedAt: nowIso },
                $push: { steps: step as any },
              }
            );
          }

          // In-app notifications
          const revokeMessage = `Your access to [${g.module} > ${g.tab}] has been revoked. Reason: ${reasonCode}${
            reasonText ? ` (${reasonText})` : ""
          }`;
          await sendAccessNotification({
            recipientEmails: [g.userEmail],
            actorEmail: effectiveActor.email,
            requestId: g.requestId || "REVOKE",
            requestNumber: g.requestNumber || "REVOKE",
            title: "Access Revoked",
            message: revokeMessage,
          });

          // Write audit log
          await logSecurityAudit({
            action: "ACCESS_REVOKED_BULK",
            user: effectiveActor.name,
            role: effectiveActor.roleCode,
            email: effectiveActor.email,
            itemId: g.id,
            itemTitle: `${g.module} > ${g.tab}`,
            reason: `${reasonCode}: ${reasonText}`,
            details: {
              staffId: g.staffId,
              staffEmail: g.userEmail,
              bulkBatchId,
              rightsRemoved: g.rightsGranted,
            },
          });
        }
      }

      // If Security reason or full module, notify IT Director
      if (reasonCode === "Security concern" || reasonCode === "Misuse" || scope === "Module") {
        await notifyItDirector(
          `Bulk Revoke Executed: ${revocationsCreated.length} grants across ${affectedStaffCount} staff members were revoked. Reason: ${reasonCode} - ${reasonText}`
        );
      }

      return NextResponse.json({
        success: true,
        message: `Bulk access revocation completed. ${revocationsCreated.length} permissions removed across ${affectedStaffCount} staff members.`,
        revocationsCount: revocationsCreated.length,
        affectedStaffCount,
        bulkBatchId,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE B: SINGLE / SELECTED / MODULE REVOCATION
    // ─────────────────────────────────────────────────────────────────────────
    if (!staffId) {
      return NextResponse.json(
        { success: false, error: "Staff member selection is required." },
        { status: 400 }
      );
    }

    // Rule: Super Admin cannot revoke their own access
    if (
      staffId === effectiveActor.staffId ||
      staffId === effectiveActor.employeeId ||
      staffId.toLowerCase() === effectiveActor.email.toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, error: "Super Admin cannot revoke their own access." },
        { status: 400 }
      );
    }

    // Lookup staff profile for director and baseline verification
    const targetEmp: any = await empCol.findOne({
      $or: [
        { employeeId: staffId },
        { staffId: staffId },
        { email: { $regex: `^${staffId}$`, $options: "i" } },
      ],
    });

    const targetStaffEmail = targetEmp?.email || body.staffEmail || "";
    const targetStaffName = targetEmp?.fullName || targetEmp?.name || body.staffName || "Staff Member";
    const targetDept = canonicalizeDepartmentName(targetEmp?.department || body.department);
    const targetPosition = targetEmp?.position || body.position || "Staff Officer";
    const targetRoleCode = normalizeRole(targetEmp?.role, targetEmp?.username, targetStaffEmail);

    // Rule: Log if revoking access for a role-based baseline user
    const hasBaseline = scope === "Tab" && tabId && isBaselineRoleAccess(targetRoleCode, moduleSlug || "", tabId);

    // Query active grants for this staff member
    let activeGrantsQuery: any = { status: "Active" };

    if (body.grantId) {
      activeGrantsQuery.id = body.grantId;
    } else if (Array.isArray(body.grantIds) && body.grantIds.length > 0) {
      activeGrantsQuery.id = { $in: body.grantIds };
    } else {
      const staffIdentifiers = [
        staffId,
        targetEmp?.employeeId,
        targetEmp?.staffId,
        body.staffEmail,
        targetStaffEmail,
        targetEmp?.email,
      ].filter(Boolean);

      activeGrantsQuery.$or = [
        { staffId: { $in: staffIdentifiers } },
        { userId: { $in: staffIdentifiers } },
        { userEmail: { $in: staffIdentifiers } },
        ...(targetStaffEmail ? [{ userEmail: { $regex: `^${targetStaffEmail}$`, $options: "i" } }] : []),
        ...(body.staffEmail ? [{ userEmail: { $regex: `^${body.staffEmail}$`, $options: "i" } }] : []),
      ];

      if (scope === "Module") {
        activeGrantsQuery.moduleSlug = { $regex: `^${moduleSlug || moduleName}$`, $options: "i" };
      } else if (scope === "Tab") {
        if (Array.isArray(body.selectedTabIds) && body.selectedTabIds.length > 0) {
          activeGrantsQuery.tabId = { $in: body.selectedTabIds };
        } else if (tabId) {
          activeGrantsQuery.tabId = tabId;
        }
      } else if (scope === "Rights") {
        if (tabId) {
          activeGrantsQuery.tabId = tabId;
        }
      }
    }

    const matchedGrants = await grantsCol.find(activeGrantsQuery).toArray();
    const revocationsRecorded: AccessRevocation[] = [];

    if (matchedGrants.length === 0) {
      // Even if no active grant was found in access_grants, record an explicit AccessRevocation
      // so this user is strictly denied access via RBAC and security audit is logged
      const revRecord: AccessRevocation = {
        id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        staff_id: targetEmp?.employeeId || targetEmp?.staffId || staffId,
        staffId: targetEmp?.employeeId || targetEmp?.staffId || staffId,
        staffName: targetStaffName,
        staffEmail: targetStaffEmail,
        department: targetDept,
        position: targetPosition,
        module: moduleName || moduleSlug || "Module",
        moduleSlug: moduleSlug || "module",
        tab: body.tab || tabId || "All Tabs",
        tabId: tabId || undefined,
        rights_removed: ["Read", "Write", "View", "Upload", "Download"],
        rightsRemoved: ["Read", "Write", "View", "Upload", "Download"],
        scope: (scope as RevokeScope) || "Tab",
        reason_code: reasonCode,
        reasonCode: reasonCode,
        reason_text: reasonText,
        reasonText: reasonText,
        revoked_by: effectiveActor.name,
        revokedBy: effectiveActor.name,
        effective_at: effectiveAtIso,
        effectiveAt: effectiveAtIso,
        revoked_at: nowIso,
        revokedAt: nowIso,
        bulk_batch_id: null,
      };

      await revCol.insertOne(revRecord as any);
      revocationsRecorded.push(revRecord);

      // Log Security Audit
      await logSecurityAudit({
        action: "ACCESS_GRANT_REVOKED",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: revRecord.id,
        itemTitle: `${revRecord.module} > ${revRecord.tab}`,
        reason: `${reasonCode}: ${reasonText}`,
        details: {
          staffId: revRecord.staffId,
          staffEmail: revRecord.staffEmail,
          scope,
          hasBaseline,
        },
      });

      // Send notification
      try {
        if (targetStaffEmail) {
          await sendAccessNotification({
            recipientEmails: [targetStaffEmail],
            actorEmail: effectiveActor.email,
            requestId: "REVOKE",
            requestNumber: "REVOKE",
            title: "Access Revoked",
            message: `Your access to [${revRecord.module} > ${revRecord.tab}] has been revoked. Reason: ${reasonCode}${reasonText ? ` (${reasonText})` : ""}`,
          });
        }
      } catch (_) {}
    } else {

    for (const grant of matchedGrants) {
      let finalRightsRemoved: AccessRight[] = grant.rightsGranted || [];
      let remainingRights: AccessRight[] = [];

      // If partial rights revocation (e.g. remove Write, keep Read)
      if (scope === "Rights" && Array.isArray(rightsToRemove) && rightsToRemove.length > 0) {
        finalRightsRemoved = rightsToRemove.filter((r) => (grant.rightsGranted || []).includes(r));
        remainingRights = (grant.rightsGranted || []).filter((r) => !rightsToRemove.includes(r));
      }

      if (remainingRights.length > 0) {
        // Partial revocation: Grant stays active but with reduced rights
        await grantsCol.updateOne(
          { id: grant.id },
          {
            $set: {
              rightsGranted: remainingRights,
              updatedAt: nowIso,
            },
          }
        );
      } else {
        // Full revocation of this grant: update this grant AND any duplicate grants for this staff + tab
        await grantsCol.updateMany(
          {
            $or: [
              { id: grant.id },
              {
                tabId: grant.tabId,
                $or: [
                  { staffId: grant.staffId },
                  { userId: grant.userId },
                  { userEmail: { $regex: `^${grant.userEmail}$`, $options: "i" } },
                ],
              },
            ],
          },
          {
            $set: {
              status: "Revoked",
              rightsGranted: [],
              revokedAt: nowIso,
              revokedBy: effectiveActor.name,
              revocationReason: `${reasonCode}${reasonText ? `: ${reasonText}` : ""}`,
            },
          }
        );
      }

      // Write record to access_revocations table
      const revRecord: AccessRevocation = {
        id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        grant_id: grant.id,
        grantId: grant.id,
        staff_id: grant.staffId,
        staffId: grant.staffId,
        staffName: grant.userName || targetStaffName,
        staffEmail: grant.userEmail || targetStaffEmail,
        department: grant.department || targetDept,
        position: targetPosition,
        module: grant.module,
        moduleSlug: grant.moduleSlug,
        tab: grant.tab,
        tabId: grant.tabId,
        rights_removed: finalRightsRemoved,
        rightsRemoved: finalRightsRemoved,
        scope: (scope as RevokeScope) || "Tab",
        reason_code: reasonCode,
        reasonCode: reasonCode,
        reason_text: reasonText,
        reasonText: reasonText,
        revoked_by: effectiveActor.name,
        revokedBy: effectiveActor.name,
        effective_at: effectiveAtIso,
        effectiveAt: effectiveAtIso,
        revoked_at: nowIso,
        revokedAt: nowIso,
        bulk_batch_id: null,
      };

      await revCol.insertOne(revRecord as any);
      revocationsRecorded.push(revRecord);

      // Append step to request timeline and update request items
      if (grant.requestId) {
        const step: AccessRequestStep = {
          id: `step_${Date.now()}_revoke`,
          requestId: grant.requestId,
          stage: 3,
          stageName: "Super Admin Revocation",
          approverId: effectiveActor.staffId || "SA",
          approverName: effectiveActor.name,
          approverRole: "Super Administrator",
          approverEmail: effectiveActor.email,
          action: "Revoked",
          comment: `Revoked by Super Admin: ${reasonCode}. ${reasonText}`.trim(),
          actedAt: nowIso,
        };

        // Update the specific item in the request's items array
        await reqCol.updateOne(
          { id: grant.requestId, "items.tabId": grant.tabId },
          {
            $set: {
              "items.$.rightsGranted": remainingRights,
              "items.$.status": remainingRights.length > 0 ? "Active" : "Revoked",
              "items.$.revoked": remainingRights.length === 0,
              updatedAt: nowIso,
            },
            $push: { steps: step as any },
          }
        );

        // Check if all items in this request are now revoked
        const parentReq = await reqCol.findOne({ id: grant.requestId });
        const hasActiveItems = (parentReq?.items || []).some(
          (item: any) =>
            !item.revoked &&
            item.status !== "Revoked" &&
            Array.isArray(item.rightsGranted) &&
            item.rightsGranted.length > 0
        );

        if (!hasActiveItems) {
          await reqCol.updateOne(
            { id: grant.requestId },
            {
              $set: {
                status: "Revoked",
                revocationReason: `${reasonCode}: ${reasonText}`,
                updatedAt: nowIso,
              },
            }
          );
        }
      }

      // Also mark any other access_requests for this user and tab as revoked so they cannot resurrect
      try {
        await reqCol.updateMany(
          {
            $or: [
              { requesterEmail: { $regex: `^${grant.userEmail}$`, $options: "i" } },
              { staffId: grant.staffId },
              { requesterId: grant.userId },
            ],
            "items.tabId": grant.tabId,
          },
          {
            $set: {
              "items.$.rightsGranted": remainingRights,
              "items.$.status": "Revoked",
              "items.$.revoked": true,
              updatedAt: nowIso,
            },
          }
        );
      } catch (_) {}

      // Notify Staff Member
      const notifyText =
        scope === "Rights" && remainingRights.length > 0
          ? `Your permissions on [${grant.module} > ${grant.tab}] were updated. Removed: ${finalRightsRemoved.join(", ")}. Remaining: ${remainingRights.join(", ")}. Reason: ${reasonCode}${reasonText ? ` (${reasonText})` : ""}`
          : `Your access to [${grant.module} > ${grant.tab}] has been revoked. Reason: ${reasonCode}${reasonText ? ` (${reasonText})` : ""}`;

      await sendAccessNotification({
        recipientEmails: [grant.userEmail],
        actorEmail: effectiveActor.email,
        requestId: grant.requestId || "REVOKE",
        requestNumber: grant.requestNumber || "REVOKE",
        title: "Access Revoked",
        message: notifyText,
      });

      // Notify Director
      if (body.directorEmail) {
        await sendAccessNotification({
          recipientEmails: [body.directorEmail],
          actorEmail: effectiveActor.email,
          requestId: grant.requestId || "REVOKE",
          requestNumber: grant.requestNumber || "REVOKE",
          title: "Staff Access Revoked Notice",
          message: `Access to [${grant.module} > ${grant.tab}] for ${targetStaffName} (${targetDept}) has been revoked by Super Admin. Reason: ${reasonCode}${reasonText ? ` (${reasonText})` : ""}`,
        });
      }

      // Log Security Audit
      await logSecurityAudit({
        action: "ACCESS_GRANT_REVOKED",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: grant.id,
        itemTitle: `${grant.module} > ${grant.tab}`,
        reason: `${reasonCode}: ${reasonText}`,
        details: {
          staffId: grant.staffId,
          staffEmail: grant.userEmail,
          scope,
          rightsRemoved: finalRightsRemoved,
          remainingRights,
        },
      });
    }
    }

    // Notify IT Director for a full module revoke or security reason
    if (scope === "Module" || reasonCode === "Security concern" || reasonCode === "Misuse") {
      await notifyItDirector(
        `Security Notice: Full Module/Security Revocation executed for ${targetStaffName} (${targetDept}) on module '${moduleName || moduleSlug}'. Reason: ${reasonCode} - ${reasonText}`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Access successfully revoked. Permissions have been removed immediately.`,
      revocationsCount: revocationsRecorded.length,
      revocations: revocationsRecorded,
    });
  } catch (err: any) {
    console.error("Error executing access revocation:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
