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

  // Check auth cookie as fallback
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
      action: "Unauthorized Reset Admin Tab Access Attempt",
      dateTime: now.toISOString(),
      module: "Security / Password Reset Admin",
      newValue: `Unauthorized role ${actor.roleCode} (${actor.email}) attempted access to Reset Password administration tab.`,
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

  const url = new URL(req.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const outcome = url.searchParams.get("outcome") || "ALL";
  const department = url.searchParams.get("department") || "ALL";
  const flagged = url.searchParams.get("flagged");
  const loginStatus = url.searchParams.get("loginStatus") || "ALL";
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
  const skip = (page - 1) * limit;

  const reqCol = db.collection(COLLECTIONS.PASSWORD_RESET_REQUESTS);
  const revCol = db.collection(COLLECTIONS.LOGIN_REVOCATIONS);
  const userCol = db.collection(COLLECTIONS.USER_ACCOUNTS);

  // 1. Compute Dashboard Cards Metrics
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    todayCount,
    sevenDaysCount,
    thirtyDaysCount,
    completedCount,
    abandonedExpiredCount,
    lockedCount,
    repeatedRequestsCount,
    revokedCount,
  ] = await Promise.all([
    reqCol.countDocuments({ requested_at: { $gte: todayStart } }),
    reqCol.countDocuments({ requested_at: { $gte: sevenDaysAgo } }),
    reqCol.countDocuments({ requested_at: { $gte: thirtyDaysAgo } }),
    reqCol.countDocuments({ outcome: "Completed" }),
    reqCol.countDocuments({ outcome: { $in: ["Expired", "Cancelled", "Abandoned"] } }),
    reqCol.countDocuments({ outcome: "Locked" }),
    reqCol.countDocuments({ flags: "MULTIPLE_REQUESTS_24H" }),
    revCol.countDocuments({ status: "Active" }),
  ]);

  const metrics = {
    requestsToday: todayCount,
    requests7Days: sevenDaysCount,
    requests30Days: thirtyDaysCount,
    completedResets: completedCount,
    abandonedOrExpired: abandonedExpiredCount,
    lockedFailedOtp: lockedCount,
    repeatedRequests: repeatedRequestsCount,
    loginsRevoked: revokedCount,
  };

  // 2. Build Filter Query for Requests Table
  const filter: any = {};

  if (outcome !== "ALL") {
    filter.outcome = outcome;
  }

  if (department !== "ALL") {
    filter.department = department;
  }

  if (flagged === "true") {
    filter.flags = { $exists: true, $not: { $size: 0 } };
  } else if (flagged === "false") {
    filter.$or = [{ flags: { $exists: false } }, { flags: { $size: 0 } }];
  }

  if (loginStatus !== "ALL") {
    filter.login_status = loginStatus;
  }

  if (dateFrom || dateTo) {
    filter.requested_at = {};
    if (dateFrom) filter.requested_at.$gte = new Date(dateFrom).toISOString();
    if (dateTo) {
      const dTo = new Date(dateTo);
      dTo.setHours(23, 59, 59, 999);
      filter.requested_at.$lte = dTo.toISOString();
    }
  }

  if (search) {
    filter.$or = [
      { request_number: { $regex: search, $options: "i" } },
      { staff_name: { $regex: search, $options: "i" } },
      { staff_id: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { ip: { $regex: search, $options: "i" } },
      { department: { $regex: search, $options: "i" } },
    ];
  }

  // Fetch paginated requests
  const total = await reqCol.countDocuments(filter);
  const rawRequests = await reqCol
    .find(filter)
    .sort({ requested_at: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  // Cross-reference current user login status
  const userIds = rawRequests.map((r) => r.user_id).filter(Boolean);
  const userDocs = await userCol.find({ userId: { $in: userIds } }).toArray();
  const userStatusMap = new Map<string, string>();
  userDocs.forEach((u) => {
    userStatusMap.set(u.userId, u.status || "Active");
  });

  const requests = rawRequests.map((doc: any) => {
    const currentStatus = userStatusMap.get(doc.user_id) || doc.login_status || "Active";
    return {
      id: doc.id || doc._id.toString(),
      request_number: doc.request_number || "BCF-PWR-2026-000000",
      user_id: doc.user_id,
      staff_name: doc.staff_name || "Unknown Staff",
      staff_id: doc.staff_id || "BCF-STAFF",
      department: doc.department || "General Administration",
      email: maskEmail(doc.email || ""),
      full_email_unmasked: undefined, // Never expose unmasked email
      requested_at: doc.requested_at,
      ip: maskIp(doc.ip || "127.0.0.1"),
      country: doc.country || "Sierra Leone",
      city: doc.city || "Freetown",
      os: doc.os || "Unknown OS",
      device_model: doc.device_model || "Desktop / Workstation",
      browser: doc.browser || "Browser",
      otp_attempts: doc.otp_attempts || 0,
      otp_verified_at: doc.otp_verified_at,
      otp_expires_at: doc.otp_expires_at,
      otp_status: doc.otp_verified_at
        ? "Verified"
        : doc.outcome === "Locked"
        ? `Failed (${doc.otp_attempts || 0} attempts)`
        : new Date(doc.otp_expires_at) < now
        ? "Expired"
        : "Sent",
      password_changed: !!doc.password_changed_at,
      password_changed_at: doc.password_changed_at,
      outcome: doc.outcome || "Pending",
      login_status: currentStatus,
      flags: doc.flags || [],
      is_suspicious: Array.isArray(doc.flags) && doc.flags.length > 0,
      created_at: doc.created_at,
    };
  });

  // Distinct departments for filter dropdown
  const departments = await reqCol.distinct("department");

  return NextResponse.json({
    success: true,
    metrics,
    requests,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    departments: departments.filter(Boolean),
  });
}
