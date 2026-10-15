import { NextRequest, NextResponse } from "next/server";
import { adminRevokeUserLogin } from "@/lib/passwordResetServer";
import { normalizeRole } from "@/lib/permissions";
import { extractClientIp } from "@/lib/geoDevice";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function getAdminActor(req: NextRequest) {
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

  const tokenCookie = req.cookies.get("bcf_token")?.value;
  let cookieEmail = "";
  if (tokenCookie) {
    try {
      const decoded = atob(tokenCookie);
      cookieEmail = decoded.split(":")[0];
    } catch (_) {}
  }

  const effectiveEmail = qEmail || cookieEmail || "";
  const roleCode = normalizeRole(qRole, qUser, effectiveEmail, qDept, qPos);

  return {
    userId: qEmpId || effectiveEmail || "admin@bcfsl.org",
    username: qUser || "admin",
    email: effectiveEmail || "admin@bcfsl.org",
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Staff Member"),
    role: qRole || roleCode,
    roleCode,
    department: qDept || "Executive Management",
    position: qPos || "Super Administrator",
    employeeId: qEmpId || "BCF-PTE-2026-0001",
  };
}

export async function POST(req: NextRequest) {
  const actor = getAdminActor(req);
  const ip = extractClientIp(req.headers);
  const db = await getDb();
  const auditCol = db.collection("audit_logs");
  const now = new Date();

  // Enforce Super Admin only
  if (actor.roleCode !== "SA") {
    await auditCol.insertOne({
      auditId: `AUD-DENIED-${Date.now()}`,
      action: "Unauthorized Revoke Login Attempt",
      dateTime: now.toISOString(),
      module: "Security / Password Reset Admin",
      newValue: `Unauthorized role ${actor.roleCode} (${actor.email}) attempted to revoke login.`,
      result: "Denied",
      userId: actor.userId,
      employeeId: actor.employeeId,
      ipSession: ip,
      updatedAt: now.toISOString(),
    });

    return NextResponse.json(
      { success: false, error: "You do not have access to that page." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { userId, reasonCode, reasonText } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Target User ID is required." },
        { status: 400 }
      );
    }

    if (!reasonCode) {
      return NextResponse.json(
        { success: false, error: "A valid revocation reason code must be specified." },
        { status: 400 }
      );
    }

    const result = await adminRevokeUserLogin({
      userId,
      reasonCode,
      reasonText: reasonText || "Administrative intervention requested by Super Admin.",
      adminUser: {
        userId: actor.userId,
        name: actor.name,
        email: actor.email,
        role: "Super Admin",
      },
      ip,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API] admin/password-resets/revoke error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to execute administrative login revocation." },
      { status: 500 }
    );
  }
}
