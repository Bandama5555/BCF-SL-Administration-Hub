import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { AccessRevocation } from "@/lib/accessTypes";
import { resolveUserProfile, RequestActorContext } from "@/lib/accessServer";
import { normalizeRole } from "@/lib/permissions";
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

    // Strict Super Admin Access
    if (effectiveActor.roleCode !== "SA") {
      await logSecurityAudit({
        action: "UNAUTHORIZED_REVOCATIONS_VIEW_ATTEMPT",
        user: effectiveActor.name,
        role: effectiveActor.roleCode,
        email: effectiveActor.email,
        itemId: "access-revocations",
        itemTitle: "Access Revocations History",
        reason: "Non-Super Admin role attempted to view revocation history log.",
      });

      return NextResponse.json(
        {
          error: "You do not have access to that page.",
          code: "ACCESS_DENIED",
        },
        { status: 403 }
      );
    }

    const col = await getCollection<AccessRevocation>(COLLECTIONS.ACCESS_REVOCATIONS);

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.toLowerCase().trim();
    const moduleFilter = url.searchParams.get("module")?.toLowerCase().trim();
    const reasonFilter = url.searchParams.get("reason")?.trim();
    const staffFilter = url.searchParams.get("staff")?.toLowerCase().trim();
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    let query: any = {};

    if (reasonFilter) {
      query.reason_code = reasonFilter;
    }

    const allRevocations = await col.find(query).sort({ revoked_at: -1 }).toArray();

    // In-memory robust filtering for text & dates
    let filtered = allRevocations;

    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.staff_id?.toLowerCase().includes(q) ||
          r.staffName?.toLowerCase().includes(q) ||
          r.staffEmail?.toLowerCase().includes(q) ||
          r.module?.toLowerCase().includes(q) ||
          r.tab?.toLowerCase().includes(q) ||
          r.reason_code?.toLowerCase().includes(q) ||
          r.reason_text?.toLowerCase().includes(q) ||
          r.revoked_by?.toLowerCase().includes(q)
      );
    }

    if (moduleFilter) {
      filtered = filtered.filter(
        (r) =>
          r.module?.toLowerCase() === moduleFilter ||
          r.moduleSlug?.toLowerCase() === moduleFilter
      );
    }

    if (staffFilter) {
      filtered = filtered.filter(
        (r) =>
          r.staff_id?.toLowerCase().includes(staffFilter) ||
          r.staffName?.toLowerCase().includes(staffFilter) ||
          r.staffEmail?.toLowerCase().includes(staffFilter)
      );
    }

    if (startDate) {
      filtered = filtered.filter((r) => r.revoked_at >= startDate);
    }

    if (endDate) {
      const endOfDay = `${endDate}T23:59:59.999Z`;
      filtered = filtered.filter((r) => r.revoked_at <= endOfDay);
    }

    return NextResponse.json({
      success: true,
      revocations: filtered,
      count: filtered.length,
    });
  } catch (err: any) {
    console.error("Error retrieving revocation history:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
