import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { normalizeRole } from "@/lib/permissions";
import { extractClientIp, maskEmail, maskIp } from "@/lib/geoDevice";

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

export async function GET(req: NextRequest) {
  const actor = getAdminActor(req);
  const ip = extractClientIp(req.headers);
  const db = await getDb();
  const auditCol = db.collection("audit_logs");
  const now = new Date();

  // Enforce Super Admin only
  if (actor.roleCode !== "SA") {
    await auditCol.insertOne({
      auditId: `AUD-DENIED-${Date.now()}`,
      action: "Unauthorized CSV Export Attempt",
      dateTime: now.toISOString(),
      module: "Security / Password Reset Admin",
      newValue: `Unauthorized role ${actor.roleCode} (${actor.email}) attempted to export password reset requests.`,
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

  const reqCol = db.collection(COLLECTIONS.PASSWORD_RESET_REQUESTS);
  const requests = await reqCol.find({}).sort({ requested_at: -1 }).toArray();

  // CSV generation with emails and IPs masked by default
  const headers = [
    "Request ID",
    "Staff Name",
    "Staff ID",
    "Department",
    "Masked Email",
    "Requested At (UTC)",
    "Masked IP",
    "Location",
    "Device / OS",
    "Browser",
    "OTP Attempts",
    "OTP Status",
    "Password Changed",
    "Password Changed At",
    "Outcome",
    "Login Status",
    "Suspicious Flags",
  ];

  const rows = requests.map((r: any) => [
    `"${r.request_number || ""}"`,
    `"${(r.staff_name || "").replace(/"/g, '""')}"`,
    `"${r.staff_id || ""}"`,
    `"${(r.department || "").replace(/"/g, '""')}"`,
    `"${maskEmail(r.email || "")}"`,
    `"${r.requested_at || ""}"`,
    `"${maskIp(r.ip || "127.0.0.1")}"`,
    `"${(r.city || "")}, ${(r.country || "")}"`,
    `"${r.os || ""} - ${r.device_model || ""}"`,
    `"${r.browser || ""}"`,
    r.otp_attempts || 0,
    `"${r.otp_verified_at ? "Verified" : r.outcome === "Locked" ? "Locked (Failed)" : "Sent"}"`,
    r.password_changed_at ? "Yes" : "No",
    `"${r.password_changed_at || "N/A"}"`,
    `"${r.outcome || "Pending"}"`,
    `"${r.login_status || "Active"}"`,
    `"${(r.flags || []).join("; ")}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

  // Log export in immutable audit trail
  await auditCol.insertOne({
    auditId: `AUD-EXP-${Date.now()}`,
    action: "Password Reset Records CSV Exported",
    dateTime: now.toISOString(),
    module: "Security / Password Reset Admin",
    newValue: `Super Admin ${actor.name} exported ${requests.length} password reset request records (Emails & IPs Masked).`,
    result: "Exported",
    userId: actor.userId,
    employeeId: actor.employeeId,
    ipSession: ip,
    updatedAt: now.toISOString(),
  });

  const filename = `BCF_SL_Password_Resets_${now.toISOString().split("T")[0]}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
