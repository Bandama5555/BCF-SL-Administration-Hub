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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = getAdminActor(req);
  const ip = extractClientIp(req.headers);
  const db = await getDb();
  const auditCol = db.collection("audit_logs");
  const now = new Date();

  // Enforce Super Admin only
  if (actor.roleCode !== "SA") {
    await auditCol.insertOne({
      auditId: `AUD-DENIED-${Date.now()}`,
      action: "Unauthorized Reset Detail View Attempt",
      dateTime: now.toISOString(),
      module: "Security / Password Reset Admin",
      newValue: `Unauthorized role ${actor.roleCode} (${actor.email}) attempted to view reset request detail.`,
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

  const { id: requestId } = await context.params;
  const reqCol = db.collection(COLLECTIONS.PASSWORD_RESET_REQUESTS);
  const eventCol = db.collection(COLLECTIONS.PASSWORD_RESET_EVENTS);
  const userCol = db.collection(COLLECTIONS.USER_ACCOUNTS);
  const revCol = db.collection(COLLECTIONS.LOGIN_REVOCATIONS);

  const reqDoc = await reqCol.findOne({
    $or: [{ id: requestId }, { request_number: requestId }],
  });

  if (!reqDoc) {
    return NextResponse.json(
      { success: false, error: "Password reset request record not found." },
      { status: 404 }
    );
  }

  // Fetch full timeline events
  const rawEvents = await eventCol
    .find({
      $or: [{ request_id: reqDoc.id }, { request_number: reqDoc.request_number }],
    })
    .sort({ at: 1 })
    .toArray();

  const events = rawEvents.map((evt) => ({
    id: evt.id,
    event: evt.event,
    at: evt.at,
    details: evt.details,
    ip: maskIp(evt.ip || "127.0.0.1"),
  }));

  // Fetch related audit logs
  const auditLogs = await auditCol
    .find({
      $or: [
        { userId: reqDoc.user_id },
        { employeeId: reqDoc.staff_id },
        { newValue: { $regex: reqDoc.request_number, $options: "i" } },
      ],
    })
    .sort({ dateTime: -1 })
    .limit(15)
    .toArray();

  // Fetch user account info & revocation status
  const userAccount = await userCol.findOne({
    $or: [{ userId: reqDoc.user_id }, { employeeId: reqDoc.staff_id }],
  });

  const revocationHistory = await revCol
    .find({ user_id: reqDoc.user_id })
    .sort({ revoked_at: -1 })
    .toArray();

  return NextResponse.json({
    success: true,
    request: {
      id: reqDoc.id,
      request_number: reqDoc.request_number,
      user_id: reqDoc.user_id,
      staff_name: reqDoc.staff_name,
      staff_id: reqDoc.staff_id,
      department: reqDoc.department,
      masked_email: maskEmail(reqDoc.email || ""),
      requested_at: reqDoc.requested_at,
      ip: maskIp(reqDoc.ip || "127.0.0.1"),
      country: reqDoc.country,
      city: reqDoc.city,
      os: reqDoc.os,
      device_model: reqDoc.device_model,
      browser: reqDoc.browser,
      otp_attempts: reqDoc.otp_attempts || 0,
      otp_verified_at: reqDoc.otp_verified_at,
      otp_expires_at: reqDoc.otp_expires_at,
      password_changed_at: reqDoc.password_changed_at,
      outcome: reqDoc.outcome,
      login_status: userAccount?.status || reqDoc.login_status || "Active",
      flags: reqDoc.flags || [],
      mustChangePassword: !!userAccount?.mustChangePassword,
    },
    events,
    auditLogs: auditLogs.map((a) => ({
      id: a.auditId,
      action: a.action,
      dateTime: a.dateTime,
      result: a.result,
      newValue: a.newValue,
    })),
    revocationHistory,
  });
}
