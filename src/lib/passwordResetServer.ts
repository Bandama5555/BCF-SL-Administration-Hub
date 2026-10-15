/**
 * passwordResetServer.ts
 * Core Server Engine for BCF-SL Self-Service Password Reset (5-digit OTP)
 * and Administrative Login Revocation Governance.
 */

import { randomBytes, randomInt, createHmac, createHash } from "crypto";
import { getDb, COLLECTIONS } from "./mongodb";
import { sendMail } from "./mail";
import {
  PasswordResetRequest,
  PasswordResetEvent,
  LoginRevocation,
  PASSWORD_RESET_SETTINGS,
} from "./passwordResetTypes";
import {
  extractClientIp,
  resolveApproximateLocation,
  parseUserAgentDetails,
  maskEmail,
} from "./geoDevice";

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "password123!",
  "1234567890",
  "changeme",
  "welcome123",
  "bcfpassword",
  "freetown2026",
  "sierraleone",
  "administrator",
  "admin12345",
  "letmein123",
]);

function hashOtp(otp: string, salt: string): string {
  return createHmac("sha256", salt).update(otp.trim()).digest("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

function generateRequestNumber(counter: number): string {
  const year = new Date().getFullYear();
  return `BCF-PWR-${year}-${String(counter).padStart(6, "0")}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * STEP 1: Request Password Reset Code
 * Always returns a uniform message regardless of whether the account exists.
 */
export async function requestPasswordReset(params: {
  identifier: string;
  ip: string;
  userAgent: string;
  deviceId?: string;
}): Promise<{
  success: boolean;
  message: string;
  requestId?: string;
  maskedEmail?: string;
  resendCooldownSeconds?: number;
}> {
  const startTime = Date.now();
  const rawIdentifier = (params.identifier || "").trim().toLowerCase();
  const db = await getDb();
  const reqCol = db.collection(COLLECTIONS.PASSWORD_RESET_REQUESTS);
  const eventCol = db.collection(COLLECTIONS.PASSWORD_RESET_EVENTS);
  const auditCol = db.collection("audit_logs");

  const location = resolveApproximateLocation(params.ip);
  const device = parseUserAgentDetails(params.userAgent);
  const now = new Date();

  // Find user in user_accounts or employees
  const userAccounts = db.collection(COLLECTIONS.USER_ACCOUNTS);
  const employees = db.collection(COLLECTIONS.EMPLOYEES);

  let userDoc: any = await userAccounts.findOne({
    $or: [
      { username: { $regex: `^${rawIdentifier}$`, $options: "i" } },
      { email: { $regex: `^${rawIdentifier}$`, $options: "i" } },
      { employeeId: { $regex: `^${rawIdentifier}$`, $options: "i" } },
    ],
  });

  if (!userDoc) {
    userDoc = await employees.findOne({
      $or: [
        { username: { $regex: `^${rawIdentifier}$`, $options: "i" } },
        { email: { $regex: `^${rawIdentifier}$`, $options: "i" } },
        { employeeId: { $regex: `^${rawIdentifier}$`, $options: "i" } },
      ],
    });
  }

  // Uniform neutral response to prevent user enumeration
  const neutralResponse = {
    success: true,
    message: "If an account matches, a 5-digit code has been sent to the registered email.",
  };

  // If user does not exist: artificially delay to match processing time and return neutral
  if (!userDoc) {
    const elapsed = Date.now() - startTime;
    if (elapsed < 350) await sleep(350 - elapsed);
    return neutralResponse;
  }

  const userId = userDoc.userId || userDoc.employeeId || userDoc._id.toString();
  const staffId = userDoc.employeeId || userDoc.staffId || "BCF-STAFF";
  const staffName = userDoc.fullName || userDoc.name || rawIdentifier;
  const staffEmail = (userDoc.email || userDoc.workEmail || "").trim().toLowerCase();
  const department = userDoc.department || userDoc.dept || "General Administration";

  // If account has no valid email on file
  if (!staffEmail || !staffEmail.includes("@")) {
    await auditCol.insertOne({
      auditId: `AUD-PWR-${Date.now()}`,
      action: "Password Reset Blocked: Missing Email",
      dateTime: now.toISOString(),
      module: "Security / Password Reset",
      newValue: `Reset attempted for account ${userId} but no email on file.`,
      result: "Refused",
      userId,
      employeeId: staffId,
      ipSession: params.ip,
      updatedAt: now.toISOString(),
    });
    const elapsed = Date.now() - startTime;
    if (elapsed < 350) await sleep(350 - elapsed);
    return neutralResponse;
  }

  // Check if login is revoked or account is suspended
  const isRevoked =
    userDoc.status === "Suspended" ||
    userDoc.status === "SUSPENDED" ||
    userDoc.status === "Revoked" ||
    userDoc.status === "REVOKED" ||
    userDoc.accountStatus === "Suspended";

  if (isRevoked) {
    await auditCol.insertOne({
      auditId: `AUD-PWR-${Date.now()}`,
      action: "Password Reset Refused: Account Revoked/Suspended",
      dateTime: now.toISOString(),
      module: "Security / Password Reset",
      newValue: `Password reset refused for suspended/revoked account ${userId}`,
      result: "Refused",
      userId,
      employeeId: staffId,
      ipSession: params.ip,
      updatedAt: now.toISOString(),
    });
    const elapsed = Date.now() - startTime;
    if (elapsed < 350) await sleep(350 - elapsed);
    return neutralResponse;
  }

  // Rate Limiting: Max 3 codes per hour per account and per IP
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const recentAccountRequests = await reqCol.countDocuments({
    user_id: userId,
    requested_at: { $gte: oneHourAgo },
  });

  const recentIpRequests = await reqCol.countDocuments({
    ip: params.ip,
    requested_at: { $gte: oneHourAgo },
  });

  if (
    recentAccountRequests >= PASSWORD_RESET_SETTINGS.MAX_CODES_PER_HOUR ||
    recentIpRequests >= PASSWORD_RESET_SETTINGS.MAX_CODES_PER_HOUR * 3
  ) {
    await auditCol.insertOne({
      auditId: `AUD-PWR-${Date.now()}`,
      action: "Password Reset Rate Limited",
      dateTime: now.toISOString(),
      module: "Security / Password Reset",
      newValue: `Rate limit hit (Max ${PASSWORD_RESET_SETTINGS.MAX_CODES_PER_HOUR}/hr) for user ${userId} from IP ${params.ip}`,
      result: "Refused",
      userId,
      employeeId: staffId,
      ipSession: params.ip,
      updatedAt: now.toISOString(),
    });
    const elapsed = Date.now() - startTime;
    if (elapsed < 350) await sleep(350 - elapsed);
    return neutralResponse;
  }

  // Invalidate any active pending requests for this user
  await reqCol.updateMany(
    { user_id: userId, outcome: { $in: ["Pending", "Verified"] } },
    { $set: { outcome: "Cancelled", updated_at: now.toISOString() } }
  );

  // Generate 5-digit cryptographically secure OTP
  const otpNumber = randomInt(10000, 100000);
  const otpCode = String(otpNumber);
  const salt = randomBytes(16).toString("hex");
  const otpHash = hashOtp(otpCode, salt);

  const otpExpiresAt = new Date(
    now.getTime() + PASSWORD_RESET_SETTINGS.OTP_LIFETIME_MINUTES * 60 * 1000
  ).toISOString();

  // Suspicious flags evaluation
  const flags: string[] = [];
  const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const past24hCount = await reqCol.countDocuments({
    user_id: userId,
    requested_at: { $gte: past24h },
  });
  if (past24hCount >= 3) {
    flags.push("MULTIPLE_REQUESTS_24H");
  }

  if (location.country !== "Sierra Leone") {
    flags.push("UNUSUAL_COUNTRY");
  }

  // Check unique accounts from this IP
  const distinctAccountsFromIp = await reqCol.distinct("user_id", {
    ip: params.ip,
    requested_at: { $gte: past24h },
  });
  if (distinctAccountsFromIp.length >= 3) {
    flags.push("MULTIPLE_ACCOUNTS_SAME_IP");
  }

  // Sequential counter for Request Number
  const totalRequests = await reqCol.countDocuments();
  const requestNumber = generateRequestNumber(totalRequests + 1);

  const resetReqDoc: PasswordResetRequest = {
    id: `PWR-${randomBytes(8).toString("hex")}`,
    request_number: requestNumber,
    user_id: userId,
    identifier_entered: rawIdentifier,
    staff_name: staffName,
    staff_id: staffId,
    department,
    email: staffEmail,
    masked_email: maskEmail(staffEmail),
    requested_at: now.toISOString(),
    ip: params.ip,
    country: location.country,
    city: location.city,
    device_id_hash: params.deviceId ? hashToken(params.deviceId) : undefined,
    os: device.os,
    device_model: device.deviceModel,
    browser: device.browser,
    otp_hash: otpHash,
    otp_salt: salt,
    otp_expires_at: otpExpiresAt,
    otp_attempts: 0,
    outcome: "Pending",
    flags,
    login_status: "Active",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const insertResult = await reqCol.insertOne(resetReqDoc);
  const requestId = insertResult.insertedId.toString();

  // Record events
  await eventCol.insertMany([
    {
      id: `EVT-${randomBytes(6).toString("hex")}`,
      request_id: requestId,
      request_number: requestNumber,
      event: "Requested",
      at: now.toISOString(),
      details: { identifierEntered: rawIdentifier, flags },
      ip: params.ip,
      user_agent: params.userAgent,
    },
    {
      id: `EVT-${randomBytes(6).toString("hex")}`,
      request_id: requestId,
      request_number: requestNumber,
      event: "CodeSent",
      at: now.toISOString(),
      details: { sentToMasked: maskEmail(staffEmail), expiresAt: otpExpiresAt },
      ip: params.ip,
      user_agent: params.userAgent,
    },
  ]);

  // Send branded OTP Email
  const timeFormatted = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateFormatted = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const emailSubject = "BCF-SL Administration Hub: Security Verification Code";
  const emailHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #15803d 0%, #0f766e 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Bandama Charity Foundation Sierra Leone</h2>
        <p style="margin: 4px 0 0; font-size: 12px; color: #bbf7d0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Administration Hub Security Verification</p>
      </div>
      <div style="padding: 28px 24px; color: #1e293b;">
        <p style="margin-top: 0; font-size: 14px; line-height: 1.6;">Hello <strong>${staffName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Your BCF-SL password reset code is:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #0f766e; border-radius: 12px; padding: 14px 28px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f766e; font-family: monospace;">
            ${otpCode}
          </div>
        </div>
        <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
          It expires in <strong>10 minutes</strong>. If you did not request it, ignore this email and do not share the code. BCF-SL staff will never ask for it.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 11px; color: #64748b; line-height: 1.6;">
          <strong>Request Telemetry:</strong><br />
          • Timestamp: ${dateFormatted} at ${timeFormatted} UTC<br />
          • Approximate Location: ${location.city}, ${location.country}<br />
          • Device: ${device.os} · ${device.browser}
        </div>
      </div>
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8;">
        © ${now.getFullYear()} Bandama Charity Foundation Sierra Leone &bull; Official Administration Command Centre
      </div>
    </div>
  `;

  // Asynchronously dispatch email
  sendMail({
    to: staffEmail,
    subject: emailSubject,
    html: emailHtml,
    text: `Your BCF-SL password reset code is ${otpCode}. It expires in 10 minutes. If you did not request it, ignore this email. Requested on ${dateFormatted} at ${timeFormatted} from ${location.city}, ${location.country}.`,
  }).catch((err) => {
    console.warn("[PasswordReset] Email dispatch warning:", err);
  });

  // Audit log
  await auditCol.insertOne({
    auditId: `AUD-PWR-${Date.now()}`,
    action: "Password Reset Requested",
    dateTime: now.toISOString(),
    module: "Security / Password Reset",
    newValue: `OTP code issued for ${staffName} (${maskEmail(staffEmail)}) [Request: ${requestNumber}]`,
    result: "Successful",
    userId,
    employeeId: staffId,
    ipSession: params.ip,
    updatedAt: now.toISOString(),
  });

  return {
    success: true,
    message: neutralResponse.message,
    requestId,
    maskedEmail: maskEmail(staffEmail),
    resendCooldownSeconds: PASSWORD_RESET_SETTINGS.RESEND_DELAY_SECONDS,
  };
}

/**
 * STEP 2: Verify 5-Digit OTP Code
 */
export async function verifyPasswordResetOtp(params: {
  requestId: string;
  otp: string;
  ip: string;
  userAgent: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  resetToken?: string;
  expiresInSeconds?: number;
  remainingAttempts?: number;
}> {
  const { requestId, otp, ip, userAgent } = params;
  const db = await getDb();
  const reqCol = db.collection(COLLECTIONS.PASSWORD_RESET_REQUESTS);
  const eventCol = db.collection(COLLECTIONS.PASSWORD_RESET_EVENTS);
  const auditCol = db.collection("audit_logs");
  const now = new Date();

  const reqDoc = await reqCol.findOne({
    $or: [{ id: requestId }, { request_number: requestId }],
  });

  if (!reqDoc) {
    return { success: false, error: "Invalid or expired password reset session." };
  }

  // 1. Check if locked out due to >= 5 failed attempts
  if (reqDoc.outcome === "Locked" || reqDoc.otp_attempts >= PASSWORD_RESET_SETTINGS.MAX_WRONG_ATTEMPTS) {
    const lockedUntil = new Date(
      new Date(reqDoc.updated_at).getTime() + PASSWORD_RESET_SETTINGS.LOCKOUT_MINUTES * 60 * 1000
    );
    if (now < lockedUntil) {
      const minutesLeft = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
      return {
        success: false,
        error: `Account password reset is temporarily locked due to excessive failed attempts. Please try again in ${minutesLeft} minute(s) or contact Super Admin.`,
      };
    }
  }

  // 2. Check if code already expired
  if (new Date(reqDoc.otp_expires_at) < now) {
    await reqCol.updateOne({ _id: reqDoc._id }, { $set: { outcome: "Expired", updated_at: now.toISOString() } });
    await eventCol.insertOne({
      id: `EVT-${randomBytes(6).toString("hex")}`,
      request_id: reqDoc.id,
      request_number: reqDoc.request_number,
      event: "CodeFailed",
      at: now.toISOString(),
      details: { reason: "Code expired" },
      ip,
      user_agent: userAgent,
    });
    return { success: false, error: "This verification code has expired. Please request a new code." };
  }

  // 3. Verify OTP Hash
  const computedHash = hashOtp(otp, reqDoc.otp_salt);
  if (computedHash !== reqDoc.otp_hash) {
    const attempts = (reqDoc.otp_attempts || 0) + 1;
    const remaining = Math.max(0, PASSWORD_RESET_SETTINGS.MAX_WRONG_ATTEMPTS - attempts);

    if (attempts >= PASSWORD_RESET_SETTINGS.MAX_WRONG_ATTEMPTS) {
      // Lock account reset for 30 minutes
      await reqCol.updateOne(
        { _id: reqDoc._id },
        {
          $set: {
            otp_attempts: attempts,
            outcome: "Locked",
            updated_at: now.toISOString(),
          },
        }
      );
      await eventCol.insertOne({
        id: `EVT-${randomBytes(6).toString("hex")}`,
        request_id: reqDoc.id,
        request_number: reqDoc.request_number,
        event: "Locked",
        at: now.toISOString(),
        details: { attempts, lockoutMinutes: PASSWORD_RESET_SETTINGS.LOCKOUT_MINUTES },
        ip,
        user_agent: userAgent,
      });
      await auditCol.insertOne({
        auditId: `AUD-PWR-${Date.now()}`,
        action: "Password Reset Locked (5 Failed OTPs)",
        dateTime: now.toISOString(),
        module: "Security / Password Reset",
        newValue: `Request ${reqDoc.request_number} locked after 5 failed attempts`,
        result: "Locked",
        userId: reqDoc.user_id,
        employeeId: reqDoc.staff_id,
        ipSession: ip,
        updatedAt: now.toISOString(),
      });
      return {
        success: false,
        error: "Maximum failed attempts reached. Password reset locked for 30 minutes.",
        remainingAttempts: 0,
      };
    }

    await reqCol.updateOne(
      { _id: reqDoc._id },
      { $set: { otp_attempts: attempts, updated_at: now.toISOString() } }
    );
    await eventCol.insertOne({
      id: `EVT-${randomBytes(6).toString("hex")}`,
      request_id: reqDoc.id,
      request_number: reqDoc.request_number,
      event: "CodeFailed",
      at: now.toISOString(),
      details: { attempts, remaining },
      ip,
      user_agent: userAgent,
    });

    return {
      success: false,
      error: `Invalid code. ${remaining} attempt(s) remaining before account lockout.`,
      remainingAttempts: remaining,
    };
  }

  // 4. Success: Generate One-Time 15-minute Reset Token
  const resetToken = randomBytes(32).toString("hex");
  const resetTokenHash = hashToken(resetToken);
  const tokenExpiresAt = new Date(
    now.getTime() + PASSWORD_RESET_SETTINGS.TOKEN_LIFETIME_MINUTES * 60 * 1000
  ).toISOString();

  await reqCol.updateOne(
    { _id: reqDoc._id },
    {
      $set: {
        otp_verified_at: now.toISOString(),
        reset_token_hash: resetTokenHash,
        token_expires_at: tokenExpiresAt,
        outcome: "Verified",
        updated_at: now.toISOString(),
      },
    }
  );

  await eventCol.insertOne({
    id: `EVT-${randomBytes(6).toString("hex")}`,
    request_id: reqDoc.id,
    request_number: reqDoc.request_number,
    event: "CodeVerified",
    at: now.toISOString(),
    details: { tokenExpiresAt },
    ip,
    user_agent: userAgent,
  });

  return {
    success: true,
    message: "Code verified successfully.",
    resetToken,
    expiresInSeconds: PASSWORD_RESET_SETTINGS.TOKEN_LIFETIME_MINUTES * 60,
  };
}

/**
 * Resend Verification Code (with 60s delay and max 3 codes/hour enforcement)
 */
export async function resendPasswordResetOtp(params: {
  requestId: string;
  ip: string;
  userAgent: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  resendCooldownSeconds?: number;
}> {
  const { requestId, ip, userAgent } = params;
  const db = await getDb();
  const reqCol = db.collection(COLLECTIONS.PASSWORD_RESET_REQUESTS);
  const eventCol = db.collection(COLLECTIONS.PASSWORD_RESET_EVENTS);
  const now = new Date();

  const reqDoc = await reqCol.findOne({
    $or: [{ id: requestId }, { request_number: requestId }],
  });

  if (!reqDoc) {
    return { success: false, error: "Password reset request session not found." };
  }

  // Check 60-second cooldown
  const lastRequested = new Date(reqDoc.updated_at || reqDoc.requested_at);
  const secondsSinceLast = Math.floor((now.getTime() - lastRequested.getTime()) / 1000);
  if (secondsSinceLast < PASSWORD_RESET_SETTINGS.RESEND_DELAY_SECONDS) {
    const wait = PASSWORD_RESET_SETTINGS.RESEND_DELAY_SECONDS - secondsSinceLast;
    return {
      success: false,
      error: `Please wait ${wait} second(s) before requesting a new code.`,
      resendCooldownSeconds: wait,
    };
  }

  // Check 3 codes per hour rate limit
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const pastHourCount = await eventCol.countDocuments({
    request_id: reqDoc.id,
    event: "CodeSent",
    at: { $gte: oneHourAgo },
  });

  if (pastHourCount >= PASSWORD_RESET_SETTINGS.MAX_CODES_PER_HOUR) {
    return {
      success: false,
      error: "Maximum verification code requests reached for this hour (3 per hour).",
    };
  }

  // Generate new OTP
  const otpNumber = randomInt(10000, 100000);
  const otpCode = String(otpNumber);
  const salt = randomBytes(16).toString("hex");
  const otpHash = hashOtp(otpCode, salt);
  const otpExpiresAt = new Date(
    now.getTime() + PASSWORD_RESET_SETTINGS.OTP_LIFETIME_MINUTES * 60 * 1000
  ).toISOString();

  await reqCol.updateOne(
    { _id: reqDoc._id },
    {
      $set: {
        otp_hash: otpHash,
        otp_salt: salt,
        otp_expires_at: otpExpiresAt,
        otp_attempts: 0,
        outcome: "Pending",
        updated_at: now.toISOString(),
      },
    }
  );

  await eventCol.insertOne({
    id: `EVT-${randomBytes(6).toString("hex")}`,
    request_id: reqDoc.id,
    request_number: reqDoc.request_number,
    event: "CodeSent",
    at: now.toISOString(),
    details: { isResend: true, expiresAt: otpExpiresAt },
    ip,
    user_agent: userAgent,
  });

  // Dispatch Email
  sendMail({
    to: reqDoc.email,
    subject: "BCF-SL Administration Hub: New Verification Code",
    html: `
      <div style="font-family: sans-serif; padding: 24px; color: #1e293b;">
        <h2>BCF-SL Verification Code</h2>
        <p>Your new verification code is: <strong style="font-size: 24px; color: #0f766e; letter-spacing: 4px;">${otpCode}</strong></p>
        <p>It expires in 10 minutes. If you did not request this, please contact Super Admin immediately.</p>
      </div>
    `,
    text: `Your new BCF-SL verification code is ${otpCode}. Valid for 10 minutes.`,
  }).catch(() => {});

  return {
    success: true,
    message: "A new 5-digit verification code has been dispatched to your email.",
    resendCooldownSeconds: PASSWORD_RESET_SETTINGS.RESEND_DELAY_SECONDS,
  };
}

/**
 * STEP 3: Set New Password
 * Enforces strong password rules, history check, and session invalidation.
 */
export async function executePasswordReset(params: {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
  ip: string;
  userAgent: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const { resetToken, newPassword, confirmPassword, ip, userAgent } = params;
  const db = await getDb();
  const reqCol = db.collection(COLLECTIONS.PASSWORD_RESET_REQUESTS);
  const eventCol = db.collection(COLLECTIONS.PASSWORD_RESET_EVENTS);
  const userCol = db.collection(COLLECTIONS.USER_ACCOUNTS);
  const empCol = db.collection(COLLECTIONS.EMPLOYEES);
  const auditCol = db.collection("audit_logs");
  const now = new Date();

  if (!resetToken || !newPassword) {
    return { success: false, error: "Reset token and new password are required." };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "New passwords do not match." };
  }

  // 1. Validate Reset Token
  const tokenHash = hashToken(resetToken);
  const reqDoc = await reqCol.findOne({
    reset_token_hash: tokenHash,
    outcome: "Verified",
  });

  if (!reqDoc) {
    return { success: false, error: "Invalid or expired reset token. Please restart password reset." };
  }

  if (new Date(reqDoc.token_expires_at || 0) < now) {
    await reqCol.updateOne({ _id: reqDoc._id }, { $set: { outcome: "Expired", updated_at: now.toISOString() } });
    return { success: false, error: "Password reset session has expired (15-minute limit). Please start again." };
  }

  // 2. Fetch User Record
  let userRecord = await userCol.findOne({
    $or: [
      { userId: reqDoc.user_id },
      { employeeId: reqDoc.staff_id },
      { email: reqDoc.email },
    ],
  });

  if (!userRecord) {
    userRecord = await empCol.findOne({
      $or: [
        { employeeId: reqDoc.staff_id },
        { email: reqDoc.email },
      ],
    });
  }

  // 3. Password Complexity Policy Rules
  if (newPassword.length < PASSWORD_RESET_SETTINGS.MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      error: `Password must be at least ${PASSWORD_RESET_SETTINGS.MIN_PASSWORD_LENGTH} characters long.`,
    };
  }

  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return {
      success: false,
      error: "Password must contain an uppercase letter, lowercase letter, number, and special character.",
    };
  }

  // Check against staff name, email, or employee ID
  const lowerPass = newPassword.toLowerCase();
  const staffNameLower = (reqDoc.staff_name || "").toLowerCase();
  const emailLower = (reqDoc.email || "").toLowerCase();
  const staffIdLower = (reqDoc.staff_id || "").toLowerCase();

  if (
    (staffNameLower.length > 2 && lowerPass.includes(staffNameLower)) ||
    lowerPass.includes(emailLower.split("@")[0]) ||
    lowerPass.includes(staffIdLower)
  ) {
    return {
      success: false,
      error: "Password cannot contain your personal name, email username, or Staff ID.",
    };
  }

  if (COMMON_PASSWORDS.has(lowerPass)) {
    return {
      success: false,
      error: "Password is too common or easily guessable. Please choose a more complex phrase.",
    };
  }

  // History and Current Password Check
  if (userRecord) {
    if (userRecord.password === newPassword) {
      return {
        success: false,
        error: "New password cannot be the same as your current password.",
      };
    }
    const history: string[] = userRecord.passwordHistory || [];
    if (history.includes(newPassword)) {
      return {
        success: false,
        error: "You cannot reuse any of your last 5 passwords.",
      };
    }
  }

  // 4. Update Password & Session Invalidation
  const updatedHistory = userRecord?.password
    ? [userRecord.password, ...(userRecord.passwordHistory || [])].slice(0, PASSWORD_RESET_SETTINGS.PASSWORD_HISTORY_LIMIT)
    : [];

  const sessionVersion = Date.now();

  if (userRecord) {
    await userCol.updateOne(
      { _id: userRecord._id },
      {
        $set: {
          password: newPassword,
          passwordHistory: updatedHistory,
          passwordChangedAt: now.toISOString(),
          sessionVersion,
          mustChangePassword: false,
          status: "Active",
          updatedAt: now.toISOString(),
        },
      }
    );
    await empCol.updateOne(
      { email: reqDoc.email },
      {
        $set: {
          password: newPassword,
          accountStatus: "Active",
          updatedAt: now.toISOString(),
        },
      }
    );
  }

  // 5. Complete Request & Invalidate Reset Token
  await reqCol.updateOne(
    { _id: reqDoc._id },
    {
      $set: {
        password_changed_at: now.toISOString(),
        outcome: "Completed",
        reset_token_hash: undefined,
        updated_at: now.toISOString(),
      },
    }
  );

  // 6. Record Events & Invalidate Other Sessions
  await eventCol.insertMany([
    {
      id: `EVT-${randomBytes(6).toString("hex")}`,
      request_id: reqDoc.id,
      request_number: reqDoc.request_number,
      event: "PasswordChanged",
      at: now.toISOString(),
      details: { changedBy: "Self-Service Reset" },
      ip,
      user_agent: userAgent,
    },
    {
      id: `EVT-${randomBytes(6).toString("hex")}`,
      request_id: reqDoc.id,
      request_number: reqDoc.request_number,
      event: "SessionsEnded",
      at: now.toISOString(),
      details: { sessionVersionInvalidated: true },
      ip,
      user_agent: userAgent,
    },
  ]);

  // 7. Send Confirmation Email & In-App Alert
  const location = resolveApproximateLocation(ip);
  const device = parseUserAgentDetails(userAgent);
  const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  sendMail({
    to: reqDoc.email,
    subject: "BCF-SL Hub: Your Password Was Successfully Changed",
    html: `
      <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 520px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h3 style="color: #15803d; margin-top: 0;">Password Successfully Changed</h3>
        <p>Hello <strong>${reqDoc.staff_name}</strong>,</p>
        <p>Your BCF-SL Hub password was changed on <strong>${dateStr} at ${timeStr} UTC</strong> from <strong>${location.city}, ${location.country} (${device.os} · ${device.browser})</strong>.</p>
        <p style="color: #dc2626; font-weight: bold;">If this was not you, contact the administrator immediately at admin@bcfsl.org.</p>
      </div>
    `,
    text: `Your BCF-SL Hub password was changed on ${dateStr} at ${timeStr} UTC from ${location.city}, ${location.country}. If this was not you, contact administrator immediately.`,
  }).catch(() => {});

  // Audit Log Entry
  await auditCol.insertOne({
    auditId: `AUD-PWR-${Date.now()}`,
    action: "Password Reset Completed",
    dateTime: now.toISOString(),
    module: "Security / Password Reset",
    newValue: `Password changed successfully for ${reqDoc.staff_name} (${reqDoc.staff_id}) via verified OTP`,
    result: "Successful",
    userId: reqDoc.user_id,
    employeeId: reqDoc.staff_id,
    ipSession: ip,
    updatedAt: now.toISOString(),
  });

  return {
    success: true,
    message: "Password changed successfully. Please sign in with your new password.",
  };
}

/**
 * ADMIN: Revoke User Login
 * Immediately terminates active sessions, cancels pending OTPs, and alerts leadership.
 */
export async function adminRevokeUserLogin(params: {
  userId: string;
  reasonCode: LoginRevocation["reason_code"];
  reasonText: string;
  adminUser: { userId: string; name: string; email: string; role: string };
  ip: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const { userId, reasonCode, reasonText, adminUser, ip } = params;
  const db = await getDb();
  const userCol = db.collection(COLLECTIONS.USER_ACCOUNTS);
  const empCol = db.collection(COLLECTIONS.EMPLOYEES);
  const revCol = db.collection(COLLECTIONS.LOGIN_REVOCATIONS);
  const reqCol = db.collection(COLLECTIONS.PASSWORD_RESET_REQUESTS);
  const auditCol = db.collection("audit_logs");
  const now = new Date();

  // Self-protection guard
  if (
    userId === adminUser.userId ||
    userId === adminUser.email ||
    (adminUser.email && userId.toLowerCase() === adminUser.email.toLowerCase())
  ) {
    return { success: false, error: "Security rule: Super Admin cannot revoke their own login." };
  }

  // Protection for primary Super Admin
  if (userId === "USR-BCF-0001" || userId === "admin@bcfsl.org" || userId === "abandama") {
    return { success: false, error: "The primary Super Admin account cannot be revoked." };
  }

  // Find user
  let targetUser = await userCol.findOne({
    $or: [{ userId }, { employeeId: userId }, { email: userId }],
  });

  if (!targetUser) {
    targetUser = await empCol.findOne({
      $or: [{ employeeId: userId }, { email: userId }],
    });
  }

  if (!targetUser) {
    return { success: false, error: "Target user account not found." };
  }

  const staffName = targetUser.fullName || targetUser.name || "Staff Member";
  const staffEmail = targetUser.email || "";
  const staffId = targetUser.employeeId || userId;
  const department = targetUser.department || "General Administration";

  // Invalidate all sessions & mark status as Revoked
  await userCol.updateOne(
    { _id: targetUser._id },
    {
      $set: {
        status: "Revoked",
        suspendedReason: `Login revoked by Super Admin (${reasonCode}): ${reasonText}`,
        sessionVersion: Date.now(),
        updatedAt: now.toISOString(),
      },
    }
  );

  await empCol.updateOne(
    { email: staffEmail },
    {
      $set: {
        accountStatus: "Revoked",
        statusNotes: `Login revoked: ${reasonCode} - ${reasonText}`,
        updatedAt: now.toISOString(),
      },
    }
  );

  // Cancel any active reset requests
  await reqCol.updateMany(
    { user_id: userId, outcome: { $in: ["Pending", "Verified"] } },
    { $set: { outcome: "Cancelled", login_status: "Revoked", updated_at: now.toISOString() } }
  );

  // Store in login_revocations collection
  const revocationRecord: LoginRevocation = {
    id: `REV-${randomBytes(8).toString("hex")}`,
    user_id: userId,
    user_email: staffEmail,
    user_name: staffName,
    staff_id: staffId,
    department,
    reason_code: reasonCode,
    reason_text: reasonText,
    revoked_by: adminUser,
    revoked_at: now.toISOString(),
    status: "Active",
  };

  await revCol.insertOne(revocationRecord);

  // Notify Director, HR Director & IT Director
  const alertRecipients = ["jconteh@bcf-sl.org", "atoro@bcf-sl.org"];
  sendMail({
    to: alertRecipients,
    subject: `[BCF-SL SECURITY ALERT] Login Revoked for ${staffName} (${staffId})`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
        <h3 style="color: #b91c1c;">Administrative Login Revocation Enacted</h3>
        <p>Super Administrator <strong>${adminUser.name}</strong> has revoked login access for:</p>
        <ul>
          <li><strong>Staff:</strong> ${staffName} (${staffId})</li>
          <li><strong>Department:</strong> ${department}</li>
          <li><strong>Email:</strong> ${staffEmail}</li>
          <li><strong>Reason Category:</strong> ${reasonCode}</li>
          <li><strong>Details:</strong> ${reasonText}</li>
          <li><strong>Effective Timestamp:</strong> ${now.toISOString()}</li>
        </ul>
        <p>All active sessions and password reset tokens have been terminated immediately.</p>
      </div>
    `,
    text: `Login revoked for ${staffName} (${staffId}) by ${adminUser.name}. Reason: ${reasonCode} - ${reasonText}`,
  }).catch(() => {});

  // Immutable Audit Log Entry
  await auditCol.insertOne({
    auditId: `AUD-REV-${Date.now()}`,
    action: "User Login Revoked",
    dateTime: now.toISOString(),
    module: "Security / Login Revocations",
    newValue: `Revoked access for ${staffName} (${staffId}). Reason: ${reasonCode} - ${reasonText}`,
    previousValue: "Active",
    result: "Enacted",
    userId: adminUser.userId,
    employeeId: adminUser.email,
    ipSession: ip,
    updatedAt: now.toISOString(),
  });

  return {
    success: true,
    message: `Login access for ${staffName} has been revoked and all active sessions terminated.`,
  };
}

/**
 * ADMIN: Restore User Login
 * Restores access and flags account to force password change at next sign-in.
 */
export async function adminRestoreUserLogin(params: {
  userId: string;
  restoreReason: string;
  adminUser: { userId: string; name: string; email: string; role: string };
  ip: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const { userId, restoreReason, adminUser, ip } = params;
  const db = await getDb();
  const userCol = db.collection(COLLECTIONS.USER_ACCOUNTS);
  const empCol = db.collection(COLLECTIONS.EMPLOYEES);
  const revCol = db.collection(COLLECTIONS.LOGIN_REVOCATIONS);
  const auditCol = db.collection("audit_logs");
  const now = new Date();

  let targetUser = await userCol.findOne({
    $or: [{ userId }, { employeeId: userId }, { email: userId }],
  });

  if (!targetUser) {
    targetUser = await empCol.findOne({
      $or: [{ employeeId: userId }, { email: userId }],
    });
  }

  if (!targetUser) {
    return { success: false, error: "Target user account not found." };
  }

  const staffName = targetUser.fullName || targetUser.name || "Staff Member";
  const staffEmail = targetUser.email || "";
  const staffId = targetUser.employeeId || userId;

  // Reactivate account with forced password change
  await userCol.updateOne(
    { _id: targetUser._id },
    {
      $set: {
        status: "Active",
        mustChangePassword: true,
        suspendedReason: undefined,
        updatedAt: now.toISOString(),
      },
    }
  );

  await empCol.updateOne(
    { email: staffEmail },
    {
      $set: {
        accountStatus: "Active",
        statusNotes: `Restored by ${adminUser.name}: ${restoreReason}`,
        updatedAt: now.toISOString(),
      },
    }
  );

  // Update revocation history record
  await revCol.updateMany(
    { user_id: userId, status: "Active" },
    {
      $set: {
        status: "Restored",
        restored_by: adminUser,
        restored_at: now.toISOString(),
        restore_reason: restoreReason,
      },
    }
  );

  // Audit Log Entry
  await auditCol.insertOne({
    auditId: `AUD-RES-${Date.now()}`,
    action: "User Login Restored",
    dateTime: now.toISOString(),
    module: "Security / Login Revocations",
    newValue: `Login restored for ${staffName} (${staffId}) by ${adminUser.name}. Required password change enforced. Reason: ${restoreReason}`,
    previousValue: "Revoked",
    result: "Enacted",
    userId: adminUser.userId,
    employeeId: adminUser.email,
    ipSession: ip,
    updatedAt: now.toISOString(),
  });

  return {
    success: true,
    message: `Account for ${staffName} has been restored. Mandatory password change enforced on next login.`,
  };
}
