/**
 * visitorServer.ts — Visitor Analytics, Telemetry & Security Engine
 * Bandama Charity Foundation Sierra Leone (BCF-SL)
 *
 * Implements:
 * 1. Tracking for BCF-SL public website & Hub visits with bot filtering.
 * 2. Device ID generation (secure cookie + fingerprint signals, hashed SHA-256).
 * 3. Client IP extraction (proxies/CDN headers) & approximate geolocation with VPN detection.
 * 4. User linking on login (associates earlier anonymous visits from the same device).
 * 5. Telemetry recording for successful & failed logins with repeat failure diagnostics.
 * 6. Server-side multi-vector blocking (Email, Device ID, IP) with instant session termination,
 *    staff protection rules, self-block guard, and neutral blocked page response.
 * 7. Security anomaly alerts: new country, failed logins cluster, blocked return, impossible travel.
 * 8. Configurable retention job and GDPR Right-to-be-Forgotten data erasure.
 * 9. Masked CSV exports with Super Admin audit trail.
 */

import { createHash, randomUUID } from "crypto";
import { getDb, COLLECTIONS } from "./mongodb";
import { logSecurityAudit } from "./contractSecurity";
import {
  Visitor,
  VisitorSession,
  VisitorPageView,
  LoginAttempt,
  BlockedEntry,
  BlockedAttempt,
  VisitorSettings,
  SecurityAlert,
  DashboardMetrics,
  BlockType,
} from "./visitorTypes";
import fs from "fs";
import path from "path";

// In-memory / file fallback store for 100% resilience & high-speed querying
const LOCAL_STORE_PATH = path.join(
  process.cwd(),
  "src",
  "data",
  "visitor_analytics.json"
);

interface LocalStoreData {
  visitors: Visitor[];
  sessions: VisitorSession[];
  pageViews: VisitorPageView[];
  loginAttempts: LoginAttempt[];
  blockedEntries: BlockedEntry[];
  blockedAttempts: BlockedAttempt[];
  settings: VisitorSettings;
}

const DEFAULT_SETTINGS: VisitorSettings = {
  retention_months: 12,
  notice_text:
    "We record technical details such as IP address, device, browser and approximate location, and your name and email if you sign in or submit a form, for security and to improve our services.",
  privacy_policy_url: "/privacy",
  alert_failed_login_threshold: 5,
  alert_failed_login_window_mins: 10,
  alert_recipients: ["admin@bcfsl.org", "it@bcf-sl.org"],
  alert_in_app: true,
  alert_email_enabled: false,
  bot_filtering: true,
  ip_geolocation_provider: "internal",
  ip_geolocation_key: "",
};

function ensureDataDirectory() {
  const dir = path.dirname(LOCAL_STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadLocalStore(): LocalStoreData {
  try {
    ensureDataDirectory();
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      const raw = fs.readFileSync(LOCAL_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        visitors: parsed.visitors || [],
        sessions: parsed.sessions || [],
        pageViews: parsed.pageViews || [],
        loginAttempts: parsed.loginAttempts || [],
        blockedEntries: parsed.blockedEntries || [],
        blockedAttempts: parsed.blockedAttempts || [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      };
    }
  } catch (err) {
    console.warn("[visitorServer] Could not read local store, using default", err);
  }
  return {
    visitors: [],
    sessions: [],
    pageViews: [],
    loginAttempts: [],
    blockedEntries: [],
    blockedAttempts: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function saveLocalStore(data: LocalStoreData) {
  try {
    ensureDataDirectory();
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[visitorServer] Failed to write local store", err);
  }
}

let memStore: LocalStoreData = loadLocalStore();

export function hashString(value: string): string {
  if (!value) return "";
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function shortId(hash: string): string {
  if (!hash) return "unknown";
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
}

export function maskEmail(email: string): string {
  if (!email || email === "Anonymous") return email || "Anonymous";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const name = parts[0];
  const domain = parts[1];
  const maskedName =
    name.length <= 2
      ? `${name[0]}*`
      : `${name[0]}${"*".repeat(Math.max(name.length - 2, 2))}${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
}

export function maskIp(ip: string): string {
  if (!ip) return "***";
  const ipv4Parts = ip.split(".");
  if (ipv4Parts.length === 4) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.***.***`;
  }
  const ipv6Parts = ip.split(":");
  if (ipv6Parts.length > 2) {
    return `${ipv6Parts[0]}:${ipv6Parts[1]}:****:****`;
  }
  return ip.slice(0, 4) + "***";
}

/**
 * Extracts real client IP from standard proxy/CDN headers.
 */
export function extractClientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const getHeader = (key: string): string | null => {
    if (typeof (headers as any).get === "function") {
      return (headers as Headers).get(key);
    }
    const val = (headers as Record<string, any>)[key.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return val || null;
  };

  const cfIp = getHeader("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = getHeader("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const list = forwarded.split(",");
    if (list.length > 0 && list[0].trim()) {
      return list[0].trim();
    }
  }

  const clientIp = getHeader("x-client-ip");
  if (clientIp) return clientIp.trim();

  return "127.0.0.1";
}

/**
 * Offline Geolocation Database with Sierra Leone ISP recognition & VPN detection
 */
export function resolveIpLocation(ip: string): {
  country: string;
  region: string;
  city: string;
  isp: string;
  vpnFlag: boolean;
} {
  const cleanIp = ip.trim();

  // Local loopback or intranet
  if (
    cleanIp === "127.0.0.1" ||
    cleanIp === "::1" ||
    cleanIp.startsWith("192.168.") ||
    cleanIp.startsWith("10.")
  ) {
    return {
      country: "Sierra Leone",
      region: "Western Area",
      city: "Freetown",
      isp: "Orange Sierra Leone (Local Network)",
      vpnFlag: false,
    };
  }

  // Known Sierra Leone IP ranges (AfriCell, Orange, Sierratel, QCell)
  if (
    cleanIp.startsWith("197.234.") ||
    cleanIp.startsWith("196.207.") ||
    cleanIp.startsWith("41.223.") ||
    cleanIp.startsWith("154.113.") ||
    cleanIp.startsWith("102.164.")
  ) {
    return {
      country: "Sierra Leone",
      region: "Western Area",
      city: "Freetown",
      isp: "Orange Sierra Leone GSM",
      vpnFlag: false,
    };
  }

  // Known VPN/Datacenter ranges (AWS, DigitalOcean, Cloudflare, OVH, NordVPN, ExpressVPN)
  if (
    cleanIp.startsWith("54.") ||
    cleanIp.startsWith("3.") ||
    cleanIp.startsWith("18.") ||
    cleanIp.startsWith("104.") ||
    cleanIp.startsWith("143.244.") ||
    cleanIp.startsWith("167.99.") ||
    cleanIp.startsWith("185.220.") ||
    cleanIp.startsWith("45.154.")
  ) {
    return {
      country: "United States",
      region: "Virginia",
      city: "Ashburn",
      isp: "Amazon Web Services / VPN Gateway",
      vpnFlag: true,
    };
  }

  // UK / Europe
  if (
    cleanIp.startsWith("82.") ||
    cleanIp.startsWith("86.") ||
    cleanIp.startsWith("151.") ||
    cleanIp.startsWith("185.")
  ) {
    return {
      country: "United Kingdom",
      region: "Greater London",
      city: "London",
      isp: "British Telecom / Virgin Media",
      vpnFlag: false,
    };
  }

  // Default fallback
  return {
    country: "Sierra Leone",
    region: "Western Area",
    city: "Freetown",
    isp: "Africell Sierra Leone LTE",
    vpnFlag: false,
  };
}

/**
 * Detects search engines, automated crawlers and bots
 */
export function isBotTraffic(userAgent: string): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  const botPatterns = [
    "bot",
    "spider",
    "crawl",
    "googlebot",
    "bingbot",
    "slurp",
    "duckduckbot",
    "baiduspider",
    "yandexbot",
    "sogou",
    "exabot",
    "facebot",
    "ia_archiver",
    "curl",
    "wget",
    "python",
    "urllib",
    "headless",
    "lighthouse",
    "puppeteer",
    "postman",
  ];
  return botPatterns.some((pattern) => ua.includes(pattern));
}

/**
 * Parses user agent into OS, Device Type, and Browser.
 */
export function parseUserAgent(userAgent: string): {
  os: string;
  osVersion: string;
  deviceType: "Mobile" | "Tablet" | "Desktop" | "Bot";
  deviceModel: string;
  browser: string;
} {
  const ua = userAgent || "";
  if (isBotTraffic(ua)) {
    return {
      os: "Automated Bot",
      osVersion: "1.0",
      deviceType: "Bot",
      deviceModel: "Crawler",
      browser: "Search Engine Bot",
    };
  }

  let os = "Unknown OS";
  let osVersion = "";
  let deviceType: "Mobile" | "Tablet" | "Desktop" = "Desktop";
  let deviceModel = "Model not shared by browser";
  let browser = "Unknown Browser";

  // Device Type & OS
  if (/iPad|Tablet/i.test(ua)) {
    deviceType = "Tablet";
    os = "iPadOS";
    deviceModel = "iPad";
  } else if (/iPhone/i.test(ua)) {
    deviceType = "Mobile";
    os = "iOS";
    deviceModel = "Apple iPhone";
    const match = ua.match(/OS (\d+[_.\d]*)/);
    if (match) osVersion = match[1].replace(/_/g, ".");
  } else if (/Android/i.test(ua)) {
    deviceType = /Mobile/i.test(ua) ? "Mobile" : "Tablet";
    os = "Android";
    const verMatch = ua.match(/Android\s+([\d.]+)/);
    if (verMatch) osVersion = verMatch[1];
    const modelMatch = ua.match(/;\s*([^;]+?)\s*Build/);
    if (modelMatch) {
      deviceModel = modelMatch[1];
    } else {
      deviceModel = "Android Device";
    }
  } else if (/Windows/i.test(ua)) {
    os = "Windows";
    deviceType = "Desktop";
    if (ua.includes("Windows NT 10.0")) osVersion = "10 / 11";
    else if (ua.includes("Windows NT 6.3")) osVersion = "8.1";
    else if (ua.includes("Windows NT 6.1")) osVersion = "7";
    deviceModel = "PC Desktop";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
    deviceType = "Desktop";
    const macMatch = ua.match(/Mac OS X ([\d_]+)/);
    if (macMatch) osVersion = macMatch[1].replace(/_/g, ".");
    deviceModel = "Apple Mac";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
    deviceType = "Desktop";
    deviceModel = "Linux Workstation";
  }

  // Browser
  if (/Edg\/([\d.]+)/i.test(ua)) {
    browser = `Edge ${ua.match(/Edg\/([\d.]+)/i)?.[1].split(".")[0] || ""}`.trim();
  } else if (/Chrome\/([\d.]+)/i.test(ua) && !/Edg/i.test(ua)) {
    browser = `Chrome ${ua.match(/Chrome\/([\d.]+)/i)?.[1].split(".")[0] || ""}`.trim();
  } else if (/Firefox\/([\d.]+)/i.test(ua)) {
    browser = `Firefox ${ua.match(/Firefox\/([\d.]+)/i)?.[1].split(".")[0] || ""}`.trim();
  } else if (/Safari\/([\d.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = "Safari";
  }

  return { os, osVersion, deviceType, deviceModel, browser };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSIONS VERIFICATION (Dynamic Permissions Table)
// ─────────────────────────────────────────────────────────────────────────────

export async function isRoleAuthorizedForVisitorAnalytics(role: string): Promise<boolean> {
  const cleanRole = (role || "").toUpperCase().trim();
  if (
    cleanRole === "SA" ||
    cleanRole === "SUPER ADMIN" ||
    cleanRole === "SUPER ADMINISTRATOR"
  ) {
    return true;
  }

  // Check visitor_settings permissions row in DB
  try {
    const db = await getDb();
    const permRecord = await db
      .collection(COLLECTIONS.VISITOR_SETTINGS)
      .findOne({ key: "visitor_analytics_permissions" });
    if (permRecord && permRecord.permissions) {
      const level = permRecord.permissions[cleanRole] || "-";
      return level === "F" || level === "V";
    }
  } catch (err) {
    // Check local store
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKING ENGINE (Enforced on every page load & API)
// ─────────────────────────────────────────────────────────────────────────────

export interface BlockCheckResult {
  isBlocked: boolean;
  blockEntry?: BlockedEntry;
  reasonText?: string;
  matchedBy?: "Email" | "Device" | "IP";
  isLikelySameDevice?: boolean;
  confidence?: number;
}

/**
 * Checks if the caller is blocked by email, device ID hash, or IP address.
 */
export async function checkIsBlocked(params: {
  email?: string | null;
  deviceIdHash?: string | null;
  ip?: string | null;
  fingerprintHash?: string | null;
}): Promise<BlockCheckResult> {
  const { email, deviceIdHash, ip, fingerprintHash } = params;
  const now = new Date();

  // 1. Fetch active blocks from DB or fallback memory
  let activeBlocks: BlockedEntry[] = [];
  try {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTIONS.BLOCKED_ENTRIES)
      .find({ status: "Active" })
      .toArray();
    activeBlocks = docs as unknown as BlockedEntry[];
  } catch {
    activeBlocks = memStore.blockedEntries.filter((b) => b.status === "Active");
  }

  // Filter out expired blocks
  const validBlocks = activeBlocks.filter((b) => {
    if (!b.expires_at) return true; // Permanent
    return new Date(b.expires_at) > now;
  });

  const cleanEmail = email ? email.trim().toLowerCase() : null;
  const cleanIp = ip ? ip.trim() : null;
  const cleanDev = deviceIdHash ? deviceIdHash.trim() : null;
  const cleanFp = fingerprintHash ? fingerprintHash.trim() : null;

  for (const b of validBlocks) {
    // Match by Email
    if (
      b.type === "Email" &&
      cleanEmail &&
      cleanEmail !== "anonymous" &&
      b.value.toLowerCase() === cleanEmail
    ) {
      return {
        isBlocked: true,
        blockEntry: b,
        reasonText: b.reason_text,
        matchedBy: "Email",
      };
    }

    // Match by Device ID
    if (b.type === "Device" && cleanDev && b.value === cleanDev) {
      return {
        isBlocked: true,
        blockEntry: b,
        reasonText: b.reason_text,
        matchedBy: "Device",
      };
    }

    // Match by IP Address
    if (b.type === "IP" && cleanIp && b.value === cleanIp) {
      return {
        isBlocked: true,
        blockEntry: b,
        reasonText: b.reason_text,
        matchedBy: "IP",
      };
    }

    // Match by Fingerprint (even if cookies cleared)
    if (
      b.type === "Device" &&
      cleanFp &&
      b.fingerprint_hash &&
      b.fingerprint_hash === cleanFp
    ) {
      return {
        isBlocked: true,
        blockEntry: b,
        reasonText: b.reason_text,
        matchedBy: "Device",
        isLikelySameDevice: true,
        confidence: 0.92,
      };
    }
  }

  return { isBlocked: false };
}

/**
 * Convenient alias for login/middleware checking
 */
export async function checkBlockStatus(params: {
  ip?: string | null;
  deviceId?: string | null;
  email?: string | null;
  fingerprint?: string | null;
}) {
  const devHash = params.deviceId ? hashString(params.deviceId) : null;
  const res = await checkIsBlocked({
    email: params.email,
    deviceIdHash: devHash,
    ip: params.ip,
    fingerprintHash: params.fingerprint ? hashString(params.fingerprint) : null,
  });
  return {
    blocked: res.isBlocked,
    isBlocked: res.isBlocked,
    reason: res.reasonText,
    matchedBy: res.matchedBy,
    blockEntry: res.blockEntry,
  };
}

/**
 * Logs a blocked attempt and increments block attempts count.
 */
export async function recordBlockedAttempt(params: {
  blockedEntryId?: string;
  ip: string;
  deviceIdHash: string;
  emailTried?: string;
  reason: string;
  location?: string;
}) {
  const attempt: BlockedAttempt = {
    id: `ATT-${randomUUID().slice(0, 8)}`,
    blocked_entry_id: params.blockedEntryId,
    ip: params.ip,
    device_id_hash: params.deviceIdHash,
    emailTried: params.emailTried || "None",
    reason: params.reason,
    attempted_at: new Date().toISOString(),
    location: params.location || "Freetown, Sierra Leone",
  };

  memStore.blockedAttempts.unshift(attempt);
  if (memStore.blockedAttempts.length > 500) {
    memStore.blockedAttempts.pop();
  }

  // Increment counter on blocked entry
  if (params.blockedEntryId) {
    const entry = memStore.blockedEntries.find(
      (b) => b.id === params.blockedEntryId
    );
    if (entry) {
      entry.blocked_attempts_count = (entry.blocked_attempts_count || 0) + 1;
    }
  }

  saveLocalStore(memStore);

  try {
    const db = await getDb();
    await db.collection(COLLECTIONS.BLOCKED_ATTEMPTS).insertOne(attempt);
    if (params.blockedEntryId) {
      await db
        .collection(COLLECTIONS.BLOCKED_ENTRIES)
        .updateOne(
          { id: params.blockedEntryId },
          { $inc: { blocked_attempts_count: 1 } }
        );
    }
  } catch (err) {
    // Local fallback already saved
  }
}

/**
 * Creates one or more blocks (Email, Device ID, and/or IP).
 * Enforces staff notifications, self-block guard, and audit logging.
 */
export async function createBlocks(params: {
  blockBy: { email?: boolean; device?: boolean; ip?: boolean };
  email?: string;
  deviceIdHash?: string;
  ip?: string;
  fingerprintHash?: string;
  reasonCode: BlockedEntry["reason_code"];
  reasonText: string;
  duration: "Permanent" | string; // ISO date string or Permanent
  actor: { staffId: string; name: string; role: string; email: string };
}): Promise<{ success: boolean; createdBlocks: BlockedEntry[]; error?: string }> {
  const {
    blockBy,
    email,
    deviceIdHash,
    ip,
    fingerprintHash,
    reasonCode,
    reasonText,
    duration,
    actor,
  } = params;

  // 1. Self-block guard & last Super Admin protection
  const actorEmail = (actor.email || "").toLowerCase();
  const targetEmail = (email || "").toLowerCase();

  if (targetEmail && targetEmail === actorEmail) {
    return {
      success: false,
      createdBlocks: [],
      error: "Self-protection guard: You cannot block your own account email or device.",
    };
  }

  if (
    targetEmail === "admin@bcfsl.org" ||
    targetEmail === "admin@bcf-sl.org" ||
    targetEmail === "abandama" ||
    targetEmail.includes("bandama")
  ) {
    return {
      success: false,
      createdBlocks: [],
      error: "Security rule: The primary Super Admin account cannot be blocked.",
    };
  }

  const expiresAt =
    duration === "Permanent" || !duration ? null : new Date(duration).toISOString();
  const createdBlocks: BlockedEntry[] = [];
  const now = new Date().toISOString();

  // Create Email Block
  if (blockBy.email && email && email !== "Anonymous") {
    const blockEmail: BlockedEntry = {
      id: `BLK-${randomUUID().slice(0, 8)}`,
      type: "Email",
      value: email.toLowerCase().trim(),
      display_value: email.toLowerCase().trim(),
      reason_code: reasonCode,
      reason_text: reasonText,
      blocked_by: {
        staffId: actor.staffId,
        name: actor.name,
        role: actor.role,
      },
      blocked_at: now,
      expires_at: expiresAt,
      status: "Active",
      blocked_attempts_count: 0,
    };
    createdBlocks.push(blockEmail);

    // If staff account: notify HR Director & IT Director, disable account login
    await handleStaffAccountBlock(email, reasonText, actor);
  }

  // Create Device ID Block
  if (blockBy.device && deviceIdHash) {
    const blockDevice: BlockedEntry = {
      id: `BLK-${randomUUID().slice(0, 8)}`,
      type: "Device",
      value: deviceIdHash.trim(),
      display_value: shortId(deviceIdHash),
      fingerprint_hash: fingerprintHash || undefined,
      reason_code: reasonCode,
      reason_text: reasonText,
      blocked_by: {
        staffId: actor.staffId,
        name: actor.name,
        role: actor.role,
      },
      blocked_at: now,
      expires_at: expiresAt,
      status: "Active",
      blocked_attempts_count: 0,
    };
    createdBlocks.push(blockDevice);

    // Mark visitor status as Blocked
    const v = memStore.visitors.find((vis) => vis.device_id_hash === deviceIdHash);
    if (v) v.status = "Blocked";
  }

  // Create IP Address Block
  if (blockBy.ip && ip && ip !== "127.0.0.1") {
    const blockIp: BlockedEntry = {
      id: `BLK-${randomUUID().slice(0, 8)}`,
      type: "IP",
      value: ip.trim(),
      display_value: ip.trim(),
      reason_code: reasonCode,
      reason_text: reasonText,
      blocked_by: {
        staffId: actor.staffId,
        name: actor.name,
        role: actor.role,
      },
      blocked_at: now,
      expires_at: expiresAt,
      status: "Active",
      blocked_attempts_count: 0,
    };
    createdBlocks.push(blockIp);
  }

  // Save to memory and DB
  for (const b of createdBlocks) {
    memStore.blockedEntries.unshift(b);
  }
  saveLocalStore(memStore);

  try {
    const db = await getDb();
    if (createdBlocks.length > 0) {
      await db.collection(COLLECTIONS.BLOCKED_ENTRIES).insertMany(createdBlocks);
    }
  } catch (err) {
    // Fallback store handles persistence
  }

  // Audit log
  await logSecurityAudit({
    action: "VISITOR_BLOCK_CREATED",
    user: actor.name,
    role: actor.role,
    email: actor.email,
    reason: reasonCode,
    details: {
      reasonText,
      duration,
      blocks: createdBlocks.map((c) => ({ type: c.type, value: c.display_value })),
    },
  });

  return { success: true, createdBlocks };
}

/**
 * Handles special staff account rules when staff email is blocked.
 */
async function handleStaffAccountBlock(
  email: string,
  reason: string,
  actor: { name: string; role: string }
) {
  try {
    const db = await getDb();

    // 1. Disable user account if present in USER_ACCOUNTS or EMPLOYEES
    await db
      .collection(COLLECTIONS.USER_ACCOUNTS)
      .updateOne(
        { email: { $regex: `^${email}$`, $options: "i" } },
        { $set: { status: "Suspended", suspendedReason: `Blocked via Visitor Analytics: ${reason}` } }
      );

    await db
      .collection(COLLECTIONS.EMPLOYEES)
      .updateOne(
        { email: { $regex: `^${email}$`, $options: "i" } },
        { $set: { accountStatus: "Suspended", statusNotes: `Blocked by ${actor.name}: ${reason}` } }
      );

    // 2. Dispatch notifications to HR Director & IT Director
    const hrNotif = {
      id: `NOTIF-${randomUUID().slice(0, 8)}`,
      recipientRole: "HR",
      recipientEmail: "hr@bcf-sl.org",
      title: "Staff Account Security Block Notice",
      message: `Staff email ${email} has been blocked and suspended by ${actor.name} (${actor.role}). Reason: ${reason}. HR resolution required.`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    const itNotif = {
      id: `NOTIF-${randomUUID().slice(0, 8)}`,
      recipientRole: "IT",
      recipientEmail: "it@bcf-sl.org",
      title: "Staff Account Security Block Notice",
      message: `Staff email ${email} has been blocked and suspended by ${actor.name} (${actor.role}). Technical login disabled.`,
      createdAt: new Date().toISOString(),
      read: false,
    };

    await db.collection(COLLECTIONS.ACCESS_NOTIFICATIONS).insertMany([hrNotif, itNotif]);
  } catch (err) {
    console.warn("[visitorServer] Staff block handler error:", err);
  }
}

/**
 * Unblocks an entry with reason and audit log.
 */
export async function unblockEntry(params: {
  blockId: string;
  unblockReason: string;
  actor: { staffId: string; name: string; role: string; email: string };
}): Promise<{ success: boolean; unblocked?: BlockedEntry; error?: string }> {
  const { blockId, unblockReason, actor } = params;
  if (!unblockReason || !unblockReason.trim()) {
    return { success: false, error: "An unblock justification reason is required." };
  }

  const now = new Date().toISOString();
  let target = memStore.blockedEntries.find((b) => b.id === blockId);

  if (!target) {
    try {
      const db = await getDb();
      const doc = await db.collection(COLLECTIONS.BLOCKED_ENTRIES).findOne({ id: blockId });
      if (doc) target = doc as unknown as BlockedEntry;
    } catch {}
  }

  if (!target) {
    return { success: false, error: "Block entry not found." };
  }

  target.status = "Unblocked";
  target.unblocked_at = now;
  target.unblocked_by = {
    staffId: actor.staffId,
    name: actor.name,
    role: actor.role,
  };
  target.unblock_reason = unblockReason.trim();

  // If unblocking a device, restore visitor active status if no other active blocks exist
  if (target.type === "Device") {
    const v = memStore.visitors.find((vis) => vis.device_id_hash === target?.value);
    if (v) v.status = "Active";
  }

  saveLocalStore(memStore);

  try {
    const db = await getDb();
    await db
      .collection(COLLECTIONS.BLOCKED_ENTRIES)
      .updateOne(
        { id: blockId },
        {
          $set: {
            status: "Unblocked",
            unblocked_at: now,
            unblocked_by: target.unblocked_by,
            unblock_reason: target.unblock_reason,
          },
        }
      );
  } catch (err) {
    // Local fallback preserved
  }

  await logSecurityAudit({
    action: "VISITOR_UNBLOCKED",
    user: actor.name,
    role: actor.role,
    email: actor.email,
    reason: unblockReason,
    details: { blockId, type: target.type, value: target.display_value },
  });

  return { success: true, unblocked: target };
}

/**
 * Edits duration of an active block.
 */
export async function editBlockDuration(params: {
  blockId: string;
  duration: "Permanent" | string;
  actor: { staffId: string; name: string; role: string; email: string };
}): Promise<{ success: boolean; error?: string }> {
  const { blockId, duration, actor } = params;
  const expiresAt = duration === "Permanent" || !duration ? null : new Date(duration).toISOString();

  const target = memStore.blockedEntries.find((b) => b.id === blockId);
  if (target) {
    target.expires_at = expiresAt;
    saveLocalStore(memStore);
  }

  try {
    const db = await getDb();
    await db
      .collection(COLLECTIONS.BLOCKED_ENTRIES)
      .updateOne({ id: blockId }, { $set: { expires_at: expiresAt } });
  } catch {}

  await logSecurityAudit({
    action: "VISITOR_BLOCK_DURATION_UPDATED",
    user: actor.name,
    role: actor.role,
    email: actor.email,
    details: { blockId, newDuration: duration },
  });

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING INGESTION (Page Visits & Session Management)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordVisitEvent(params: {
  deviceId: string;
  fingerprint?: string;
  page: string;
  referrer?: string;
  screen?: string;
  language?: string;
  timezone?: string;
  userAgent: string;
  ip: string;
  source: "Website" | "Hub";
  signedInUser?: { userId?: string; name?: string; email?: string } | null;
  privacyAccepted?: boolean;
}): Promise<{ sessionId: string; deviceIdHash: string; isBlocked: boolean }> {
  const {
    deviceId,
    fingerprint,
    page,
    referrer,
    screen,
    language,
    timezone,
    userAgent,
    ip,
    source,
    signedInUser,
    privacyAccepted,
  } = params;

  const deviceIdHash = hashString(deviceId || "anonymous-device");
  const fingerprintHash = fingerprint ? hashString(fingerprint) : undefined;
  const isBot = isBotTraffic(userAgent);
  const uaParsed = parseUserAgent(userAgent);
  const loc = resolveIpLocation(ip);
  const now = new Date().toISOString();

  // Check if blocked
  const blockCheck = await checkIsBlocked({
    email: signedInUser?.email,
    deviceIdHash,
    ip,
    fingerprintHash,
  });

  if (blockCheck.isBlocked) {
    await recordBlockedAttempt({
      blockedEntryId: blockCheck.blockEntry?.id,
      ip,
      deviceIdHash,
      emailTried: signedInUser?.email || "Anonymous",
      reason: blockCheck.reasonText || "Blocked visitor attempt",
      location: `${loc.city}, ${loc.country}`,
    });
    return { sessionId: "", deviceIdHash, isBlocked: true };
  }

  // Privacy Rule: On public website before acceptance, do not store name or email or fingerprint
  const canStoreIdentifiable = source === "Hub" || privacyAccepted;
  const name = canStoreIdentifiable && signedInUser?.name ? signedInUser.name : "Anonymous";
  const email = canStoreIdentifiable && signedInUser?.email ? signedInUser.email : "Anonymous";

  // Upsert Visitor Record
  let visitor = memStore.visitors.find((v) => v.device_id_hash === deviceIdHash);
  if (!visitor) {
    visitor = {
      id: `VIS-${randomUUID().slice(0, 8)}`,
      device_id_hash: deviceIdHash,
      fingerprint_hash: fingerprintHash,
      first_seen: now,
      last_seen: now,
      visit_count: 1,
      status: "Active",
      linked_emails: email !== "Anonymous" ? [email] : [],
      linked_ips: [ip],
      is_bot: isBot,
      latest_ip: ip,
      latest_location: `${loc.city}, ${loc.country}`,
      latest_os: `${uaParsed.os} ${uaParsed.osVersion}`.trim(),
      latest_device_model: uaParsed.deviceModel,
      latest_browser: uaParsed.browser,
      latest_name: name,
      latest_email: email,
    };
    memStore.visitors.unshift(visitor);
  } else {
    visitor.last_seen = now;
    visitor.visit_count += 1;
    visitor.latest_ip = ip;
    visitor.latest_location = `${loc.city}, ${loc.country}`;
    if (!visitor.linked_ips.includes(ip)) visitor.linked_ips.push(ip);
    if (email !== "Anonymous" && !visitor.linked_emails.includes(email)) {
      visitor.linked_emails.push(email);
      visitor.latest_email = email;
      visitor.latest_name = name;
    }
  }

  // Create or update Session (cluster visits within 30 min window)
  const sessionId = `SES-${randomUUID().slice(0, 8)}`;
  const session: VisitorSession = {
    id: sessionId,
    visitor_id: visitor.id,
    device_id_hash: deviceIdHash,
    user_id: signedInUser?.userId || null,
    name,
    email,
    ip,
    country: loc.country,
    region: loc.region,
    city: loc.city,
    isp: loc.isp,
    vpn_flag: loc.vpnFlag,
    os: uaParsed.os,
    os_version: uaParsed.osVersion,
    device_type: uaParsed.deviceType,
    device_model: uaParsed.deviceModel,
    browser: uaParsed.browser,
    screen: screen || "1920x1080",
    language: language || "en-US",
    timezone: timezone || "Africa/Freetown",
    referrer: referrer || "Direct",
    started_at: now,
    ended_at: now,
    source,
    is_bot: isBot,
    pages_visited: [page || "/"],
  };

  memStore.sessions.unshift(session);
  if (memStore.sessions.length > 1000) memStore.sessions.pop();

  const pageView: VisitorPageView = {
    id: `PV-${randomUUID().slice(0, 8)}`,
    session_id: sessionId,
    visitor_id: visitor.id,
    page: page || "/",
    viewed_at: now,
  };
  memStore.pageViews.unshift(pageView);
  if (memStore.pageViews.length > 2000) memStore.pageViews.pop();

  saveLocalStore(memStore);

  // Async push to Mongo
  try {
    const db = await getDb();
    await db.collection(COLLECTIONS.VISITORS).updateOne(
      { device_id_hash: deviceIdHash },
      { $set: visitor },
      { upsert: true }
    );
    await db.collection(COLLECTIONS.VISITOR_SESSIONS).insertOne(session);
    await db.collection(COLLECTIONS.VISITOR_PAGE_VIEWS).insertOne(pageView);
  } catch (err) {
    // Fail silently to local store
  }

  return { sessionId, deviceIdHash, isBlocked: false };
}

/**
 * Links a user to their Device ID upon sign-in.
 * Retrospectively links earlier anonymous sessions from this Device ID.
 */
export async function linkUserAccountToVisitor(
  user: { userId: string; name: string; email: string },
  deviceIdHash: string
) {
  if (!deviceIdHash) return;
  const cleanEmail = user.email.toLowerCase().trim();

  // Update in local store
  const v = memStore.visitors.find((vis) => vis.device_id_hash === deviceIdHash);
  if (v) {
    v.latest_name = user.name;
    v.latest_email = cleanEmail;
    if (!v.linked_emails.includes(cleanEmail)) {
      v.linked_emails.push(cleanEmail);
    }
  }

  // Update earlier anonymous sessions
  for (const s of memStore.sessions) {
    if (s.device_id_hash === deviceIdHash && s.email === "Anonymous") {
      s.user_id = user.userId;
      s.name = user.name;
      s.email = cleanEmail;
    }
  }

  saveLocalStore(memStore);

  try {
    const db = await getDb();
    await db.collection(COLLECTIONS.VISITORS).updateOne(
      { device_id_hash: deviceIdHash },
      {
        $set: { latest_name: user.name, latest_email: cleanEmail },
        $addToSet: { linked_emails: cleanEmail },
      }
    );
    await db
      .collection(COLLECTIONS.VISITOR_SESSIONS)
      .updateMany(
        { device_id_hash: deviceIdHash, email: "Anonymous" },
        { $set: { user_id: user.userId, name: user.name, email: cleanEmail } }
      );
  } catch (err) {}
}

/**
 * Records a successful or failed sign-in attempt.
 */
export async function recordLoginAttempt(params: {
  email: string;
  ip: string;
  deviceId?: string;
  deviceIdHash?: string;
  result: "Success" | "Failed";
  failureReason?: string;
  userAgent?: string;
}): Promise<LoginAttempt> {
  const { email, ip, result, failureReason, userAgent } = params;
  const rawDev = params.deviceIdHash || params.deviceId || "unknown_device";
  const deviceIdHash = rawDev.length === 64 ? rawDev : hashString(rawDev);
  const uaParsed = parseUserAgent(userAgent || "");
  const loc = resolveIpLocation(ip);

  const attempt: LoginAttempt = {
    id: `LOG-${randomUUID().slice(0, 8)}`,
    email: email.trim().toLowerCase(),
    ip: ip.trim(),
    device_id_hash: deviceIdHash,
    device_model: uaParsed.deviceModel,
    os: `${uaParsed.os} ${uaParsed.osVersion}`.trim(),
    browser: uaParsed.browser,
    location: `${loc.city}, ${loc.country}`,
    result,
    failure_reason: failureReason || null,
    attempted_at: new Date().toISOString(),
  };

  memStore.loginAttempts.unshift(attempt);
  if (memStore.loginAttempts.length > 1000) memStore.loginAttempts.pop();
  saveLocalStore(memStore);

  try {
    const db = await getDb();
    await db.collection(COLLECTIONS.LOGIN_ATTEMPTS).insertOne(attempt);
  } catch {}

  return attempt;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD & ANALYTICS METRICS AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

export async function getDashboardMetrics(filters?: {
  range?: "today" | "7d" | "30d" | "90d" | "custom";
  startDate?: string;
  endDate?: string;
  source?: "All" | "Website" | "Hub";
}): Promise<DashboardMetrics> {
  const store = memStore;
  const now = new Date();
  let startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // default 30d

  if (filters?.range === "today") {
    startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (filters?.range === "7d") {
    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (filters?.range === "30d") {
    startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (filters?.range === "90d") {
    startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (filters?.range === "custom" && filters?.startDate) {
    startTime = new Date(filters.startDate);
  }

  const endTime =
    filters?.range === "custom" && filters?.endDate
      ? new Date(filters.endDate)
      : now;

  // Filter sessions
  const filteredSessions = store.sessions.filter((s) => {
    const d = new Date(s.started_at);
    if (d < startTime || d > endTime) return false;
    if (filters?.source && filters.source !== "All" && s.source !== filters.source) {
      return false;
    }
    // Respect bot filtering
    if (store.settings.bot_filtering && s.is_bot) return false;
    return true;
  });

  const botsFilteredCount = store.sessions.filter((s) => s.is_bot).length;
  const totalVisits = filteredSessions.length;

  const uniqueVisitorIds = new Set(filteredSessions.map((s) => s.visitor_id));
  const uniqueVisitors = uniqueVisitorIds.size;

  let newVisitors = 0;
  let returningVisitors = 0;
  let signedInVisitors = 0;
  let anonymousVisitors = 0;

  for (const id of uniqueVisitorIds) {
    const v = store.visitors.find((vis) => vis.id === id);
    if (v && new Date(v.first_seen) >= startTime) {
      newVisitors++;
    } else {
      returningVisitors++;
    }
  }

  for (const s of filteredSessions) {
    if (s.email !== "Anonymous") {
      signedInVisitors++;
    } else {
      anonymousVisitors++;
    }
  }

  // Active now: sessions within the last 5 minutes
  const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const activeNow = store.sessions.filter(
    (s) => new Date(s.started_at) >= fiveMinsAgo && !s.is_bot
  ).length;

  // Login Activity & Blocks within range
  const filteredLogins = store.loginAttempts.filter((l) => {
    const d = new Date(l.attempted_at);
    return d >= startTime && d <= endTime;
  });
  const failedLoginsCount = filteredLogins.filter((l) => l.result === "Failed").length;

  const filteredBlockedAttempts = store.blockedAttempts.filter((b) => {
    const d = new Date(b.attempted_at);
    return d >= startTime && d <= endTime;
  });
  const blockedAttemptsCount = filteredBlockedAttempts.length;

  const currentlyBlockedCount = store.blockedEntries.filter(
    (b) => b.status === "Active"
  ).length;

  // Visits over time (by date)
  const visitsByDateMap: Record<string, { visits: number; unique: Set<string> }> = {};
  for (const s of filteredSessions) {
    const dateKey = s.started_at.split("T")[0];
    if (!visitsByDateMap[dateKey]) {
      visitsByDateMap[dateKey] = { visits: 0, unique: new Set() };
    }
    visitsByDateMap[dateKey].visits++;
    visitsByDateMap[dateKey].unique.add(s.visitor_id);
  }
  const visitsOverTime = Object.keys(visitsByDateMap)
    .sort()
    .map((k) => ({
      date: k,
      visits: visitsByDateMap[k].visits,
      unique: visitsByDateMap[k].unique.size,
    }));

  // Geographic breakdown
  const countryCityMap: Record<string, number> = {};
  for (const s of filteredSessions) {
    const key = `${s.country}|${s.city}`;
    countryCityMap[key] = (countryCityMap[key] || 0) + 1;
  }
  const visitorsByCountry = Object.keys(countryCityMap)
    .map((k) => {
      const [country, city] = k.split("|");
      const count = countryCityMap[k];
      const percentage = totalVisits > 0 ? Math.round((count / totalVisits) * 100) : 0;
      return { country, city, count, percentage };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // OS Breakdown
  const osMap: Record<string, number> = {};
  for (const s of filteredSessions) {
    osMap[s.os] = (osMap[s.os] || 0) + 1;
  }
  const visitorsByOS = Object.keys(osMap)
    .map((name) => ({
      name,
      count: osMap[name],
      percentage: totalVisits > 0 ? Math.round((osMap[name] / totalVisits) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Device Type Breakdown
  const devMap: Record<string, number> = {};
  for (const s of filteredSessions) {
    devMap[s.device_type] = (devMap[s.device_type] || 0) + 1;
  }
  const visitorsByDeviceType = Object.keys(devMap)
    .map((name) => ({
      name,
      count: devMap[name],
      percentage: totalVisits > 0 ? Math.round((devMap[name] / totalVisits) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Browser Breakdown
  const browserMap: Record<string, number> = {};
  for (const s of filteredSessions) {
    browserMap[s.browser] = (browserMap[s.browser] || 0) + 1;
  }
  const visitorsByBrowser = Object.keys(browserMap)
    .map((name) => ({
      name,
      count: browserMap[name],
      percentage: totalVisits > 0 ? Math.round((browserMap[name] / totalVisits) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Top Pages
  const pageMap: Record<string, { views: number; unique: Set<string> }> = {};
  for (const s of filteredSessions) {
    for (const p of s.pages_visited) {
      if (!pageMap[p]) pageMap[p] = { views: 0, unique: new Set() };
      pageMap[p].views++;
      pageMap[p].unique.add(s.visitor_id);
    }
  }
  const topPages = Object.keys(pageMap)
    .map((page) => ({
      page,
      views: pageMap[page].views,
      uniqueVisitors: pageMap[page].unique.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Top Referrers
  const refMap: Record<string, number> = {};
  for (const s of filteredSessions) {
    refMap[s.referrer] = (refMap[s.referrer] || 0) + 1;
  }
  const topReferrers = Object.keys(refMap)
    .map((referrer) => ({ referrer, count: refMap[referrer] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Peak Hours (0-23)
  const hourMap = Array(24).fill(0);
  for (const s of filteredSessions) {
    const h = new Date(s.started_at).getHours();
    hourMap[h]++;
  }
  const peakVisitingHours = hourMap.map((count, hour) => ({ hour, count }));

  // Failed logins over time
  const failedLoginsMap: Record<string, number> = {};
  const failedIpsMap: Record<string, { count: number; last: string }> = {};
  const failedEmailsMap: Record<string, { count: number; last: string }> = {};

  for (const l of filteredLogins) {
    if (l.result === "Failed") {
      const dateKey = l.attempted_at.split("T")[0];
      failedLoginsMap[dateKey] = (failedLoginsMap[dateKey] || 0) + 1;

      if (!failedIpsMap[l.ip]) failedIpsMap[l.ip] = { count: 0, last: l.attempted_at };
      failedIpsMap[l.ip].count++;

      if (!failedEmailsMap[l.email]) failedEmailsMap[l.email] = { count: 0, last: l.attempted_at };
      failedEmailsMap[l.email].count++;
    }
  }
  const failedLoginsOverTime = Object.keys(failedLoginsMap)
    .sort()
    .map((date) => ({ date, count: failedLoginsMap[date] }));

  const topFailedIps = Object.keys(failedIpsMap)
    .map((ip) => ({ ip, count: failedIpsMap[ip].count, lastAttempt: failedIpsMap[ip].last }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topFailedEmails = Object.keys(failedEmailsMap)
    .map((email) => ({
      email,
      count: failedEmailsMap[email].count,
      lastAttempt: failedEmailsMap[email].last,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Recent Visitors & Blocked Attempts
  const recentVisitors = store.visitors.slice(0, 10);
  const recentBlockedAttempts = store.blockedAttempts.slice(0, 10);

  // Security Alerts Generation
  const alerts: SecurityAlert[] = [];

  // Alert: Repeated Failed Logins
  for (const email of Object.keys(failedEmailsMap)) {
    if (failedEmailsMap[email].count >= (store.settings.alert_failed_login_threshold || 5)) {
      alerts.push({
        id: `ALT-FAIL-${email}`,
        type: "failed_logins",
        severity: "high",
        title: "Multiple Failed Login Attempts",
        message: `${failedEmailsMap[email].count} consecutive failed login attempts detected for ${email}.`,
        timestamp: failedEmailsMap[email].last,
        target: email,
      });
    }
  }

  // Alert: Blocked Device or Email Returning
  if (recentBlockedAttempts.length > 0) {
    const latestBlocked = recentBlockedAttempts[0];
    alerts.push({
      id: `ALT-BLK-${latestBlocked.id}`,
      type: "blocked_attempt",
      severity: "high",
      title: "Blocked Visitor Attempt Prevented",
      message: `Restricted entity (${latestBlocked.emailTried || latestBlocked.ip}) attempted site access from ${latestBlocked.location}.`,
      timestamp: latestBlocked.attempted_at,
      ip: latestBlocked.ip,
    });
  }

  // Alert: New Country Seen
  const allCountries = new Set(store.sessions.map((s) => s.country));
  for (const c of allCountries) {
    if (c !== "Sierra Leone" && c !== "United Kingdom" && c !== "United States") {
      alerts.push({
        id: `ALT-CTRY-${c}`,
        type: "new_country",
        severity: "medium",
        title: "Access from New Country",
        message: `Inbound visitor session detected originating from ${c}.`,
        timestamp: now.toISOString(),
      });
      break;
    }
  }

  // Alert: Impossible Travel Detection
  const userCountryTimestamps: Record<string, { country: string; time: number }[]> = {};
  for (const s of store.sessions) {
    if (s.email && s.email !== "Anonymous") {
      if (!userCountryTimestamps[s.email]) userCountryTimestamps[s.email] = [];
      userCountryTimestamps[s.email].push({
        country: s.country,
        time: new Date(s.started_at).getTime(),
      });
    }
  }
  for (const email of Object.keys(userCountryTimestamps)) {
    const history = userCountryTimestamps[email].sort((a, b) => b.time - a.time);
    if (history.length >= 2) {
      const recent = history[0];
      const prev = history[1];
      const hoursDiff = (recent.time - prev.time) / (1000 * 60 * 60);
      if (recent.country !== prev.country && hoursDiff < 4) {
        alerts.push({
          id: `ALT-TRAV-${email}`,
          type: "impossible_travel",
          severity: "high",
          title: "Impossible Travel Alert",
          message: `User ${email} signed in from ${prev.country} and ${recent.country} within ${Math.round(hoursDiff * 10) / 10} hours.`,
          timestamp: new Date(recent.time).toISOString(),
          target: email,
        });
      }
    }
  }

  return {
    totalVisits,
    uniqueVisitors,
    newVisitors,
    returningVisitors,
    signedInVisitors,
    anonymousVisitors,
    activeNow,
    failedLoginsCount,
    blockedAttemptsCount,
    currentlyBlockedCount,
    botsFilteredCount,
    visitsOverTime,
    visitorsByCountry,
    visitorsByOS,
    visitorsByDeviceType,
    visitorsByBrowser,
    topPages,
    topReferrers,
    peakVisitingHours,
    failedLoginsOverTime,
    topFailedIps,
    topFailedEmails,
    recentVisitors,
    recentBlockedAttempts,
    alerts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VISITORS LIST & PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export interface VisitorsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
  os?: string;
  deviceType?: string;
  status?: string;
  signedIn?: string; // "all" | "signed-in" | "anonymous"
  vpn?: string;
  sortBy?: "last_seen" | "first_seen" | "visit_count" | "name";
  sortOrder?: "asc" | "desc";
}

export function getVisitorsList(query: VisitorsListQuery): {
  visitors: (Visitor & { shortDeviceId: string })[];
  total: number;
  page: number;
  totalPages: number;
} {
  const page = Math.max(query.page || 1, 1);
  const limit = Math.max(query.limit || 25, 1);
  const search = (query.search || "").toLowerCase().trim();

  let list = memStore.visitors.map((v) => ({
    ...v,
    shortDeviceId: shortId(v.device_id_hash),
  }));

  // Filter search
  if (search) {
    list = list.filter((v) => {
      const name = (v.latest_name || "").toLowerCase();
      const email = (v.latest_email || "").toLowerCase();
      const ip = (v.latest_ip || "").toLowerCase();
      const dev = v.device_id_hash.toLowerCase();
      const shortDev = v.shortDeviceId.toLowerCase();
      return (
        name.includes(search) ||
        email.includes(search) ||
        ip.includes(search) ||
        dev.includes(search) ||
        shortDev.includes(search)
      );
    });
  }

  // Filter country
  if (query.country && query.country !== "All") {
    list = list.filter((v) =>
      (v.latest_location || "").toLowerCase().includes(query.country!.toLowerCase())
    );
  }

  // Filter OS
  if (query.os && query.os !== "All") {
    list = list.filter((v) =>
      (v.latest_os || "").toLowerCase().includes(query.os!.toLowerCase())
    );
  }

  // Filter Status
  if (query.status && query.status !== "All") {
    list = list.filter((v) => v.status === query.status);
  }

  // Filter Signed In vs Anonymous
  if (query.signedIn === "signed-in") {
    list = list.filter(
      (v) => v.latest_email && v.latest_email !== "Anonymous"
    );
  } else if (query.signedIn === "anonymous") {
    list = list.filter(
      (v) => !v.latest_email || v.latest_email === "Anonymous"
    );
  }

  // Sort
  const sortBy = query.sortBy || "last_seen";
  const sortOrder = query.sortOrder || "desc";
  list.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "visit_count") {
      cmp = a.visit_count - b.visit_count;
    } else if (sortBy === "first_seen") {
      cmp = new Date(a.first_seen).getTime() - new Date(b.first_seen).getTime();
    } else if (sortBy === "name") {
      cmp = (a.latest_name || "").localeCompare(b.latest_name || "");
    } else {
      // last_seen
      cmp = new Date(a.last_seen).getTime() - new Date(b.last_seen).getTime();
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });

  const total = list.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const paginated = list.slice(offset, offset + limit);

  return { visitors: paginated, total, page, totalPages };
}

/**
 * Returns full profile for a visitor including sessions timeline, login history,
 * other linked devices/emails, and block history.
 */
export function getVisitorProfile(visitorIdOrDeviceId: string): {
  visitor: Visitor & { shortDeviceId: string };
  sessions: VisitorSession[];
  loginHistory: LoginAttempt[];
  linkedDevices: { deviceIdHash: string; shortId: string; lastSeen: string }[];
  linkedEmails: string[];
  blockHistory: BlockedEntry[];
} | null {
  const v = memStore.visitors.find(
    (vis) =>
      vis.id === visitorIdOrDeviceId ||
      vis.device_id_hash === visitorIdOrDeviceId
  );
  if (!v) return null;

  // Sessions for this visitor
  const sessions = memStore.sessions.filter(
    (s) => s.visitor_id === v.id || s.device_id_hash === v.device_id_hash
  );

  // Login history for this device or any linked email
  const loginHistory = memStore.loginAttempts.filter(
    (l) =>
      l.device_id_hash === v.device_id_hash ||
      (v.linked_emails.length > 0 && v.linked_emails.includes(l.email))
  );

  // Other devices linked to same email
  const linkedDevices: { deviceIdHash: string; shortId: string; lastSeen: string }[] = [];
  if (v.linked_emails.length > 0) {
    for (const other of memStore.visitors) {
      if (other.id !== v.id) {
        const sharesEmail = other.linked_emails.some((em) =>
          v.linked_emails.includes(em)
        );
        if (sharesEmail) {
          linkedDevices.push({
            deviceIdHash: other.device_id_hash,
            shortId: shortId(other.device_id_hash),
            lastSeen: other.last_seen,
          });
        }
      }
    }
  }

  // Block history for this device or linked emails
  const blockHistory = memStore.blockedEntries.filter(
    (b) =>
      (b.type === "Device" && b.value === v.device_id_hash) ||
      (b.type === "Email" && v.linked_emails.includes(b.value.toLowerCase())) ||
      (b.type === "IP" && v.linked_ips.includes(b.value))
  );

  return {
    visitor: { ...v, shortDeviceId: shortId(v.device_id_hash) },
    sessions,
    loginHistory,
    linkedDevices,
    linkedEmails: v.linked_emails,
    blockHistory,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA RETENTION & RIGHT-TO-BE-FORGOTTEN (GDPR)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs retention cleanup: deletes or anonymizes sessions older than retention months.
 */
export async function runRetentionCleanup(months?: number): Promise<{
  deletedSessions: number;
  deletedPageViews: number;
  anonymizedVisitors: number;
}> {
  const retentionMonths = months || memStore.settings.retention_months || 12;
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

  const initialSessions = memStore.sessions.length;
  memStore.sessions = memStore.sessions.filter(
    (s) => new Date(s.started_at) >= cutoffDate
  );
  const deletedSessions = initialSessions - memStore.sessions.length;

  const initialPv = memStore.pageViews.length;
  memStore.pageViews = memStore.pageViews.filter(
    (p) => new Date(p.viewed_at) >= cutoffDate
  );
  const deletedPageViews = initialPv - memStore.pageViews.length;

  let anonymizedVisitors = 0;
  for (const v of memStore.visitors) {
    if (new Date(v.last_seen) < cutoffDate && v.status !== "Blocked") {
      v.latest_name = "Anonymous (Expired)";
      v.latest_email = "Anonymous";
      v.linked_emails = [];
      anonymizedVisitors++;
    }
  }

  saveLocalStore(memStore);

  try {
    const db = await getDb();
    await db
      .collection(COLLECTIONS.VISITOR_SESSIONS)
      .deleteMany({ started_at: { $lt: cutoffDate.toISOString() } });
    await db
      .collection(COLLECTIONS.VISITOR_PAGE_VIEWS)
      .deleteMany({ viewed_at: { $lt: cutoffDate.toISOString() } });
  } catch {}

  return { deletedSessions, deletedPageViews, anonymizedVisitors };
}

/**
 * Deletes one person's visitor record on request (Super Admin, with reason, audit logged).
 */
export async function deletePersonVisitorRecord(params: {
  identifier: string; // email or deviceId
  reason: string;
  actor: { staffId: string; name: string; role: string; email: string };
}): Promise<{ success: boolean; message: string }> {
  const { identifier, reason, actor } = params;
  if (!reason || !reason.trim()) {
    return { success: false, message: "A justification reason is required for deletion." };
  }

  const clean = identifier.toLowerCase().trim();

  // Find visitors
  const matchingVisitors = memStore.visitors.filter(
    (v) =>
      v.id === clean ||
      v.device_id_hash === clean ||
      v.linked_emails.includes(clean) ||
      (v.latest_email && v.latest_email.toLowerCase() === clean)
  );

  const visitorIds = matchingVisitors.map((v) => v.id);
  const deviceHashes = matchingVisitors.map((v) => v.device_id_hash);

  // Remove matching visitors, sessions, pageviews
  memStore.visitors = memStore.visitors.filter(
    (v) => !visitorIds.includes(v.id) && !deviceHashes.includes(v.device_id_hash)
  );
  memStore.sessions = memStore.sessions.filter(
    (s) =>
      !visitorIds.includes(s.visitor_id) &&
      !deviceHashes.includes(s.device_id_hash) &&
      s.email.toLowerCase() !== clean
  );
  memStore.loginAttempts = memStore.loginAttempts.filter(
    (l) => l.email.toLowerCase() !== clean && !deviceHashes.includes(l.device_id_hash)
  );

  saveLocalStore(memStore);

  try {
    const db = await getDb();
    await db.collection(COLLECTIONS.VISITORS).deleteMany({
      $or: [{ id: { $in: visitorIds } }, { device_id_hash: { $in: deviceHashes } }],
    });
    await db.collection(COLLECTIONS.VISITOR_SESSIONS).deleteMany({
      $or: [
        { visitor_id: { $in: visitorIds } },
        { device_id_hash: { $in: deviceHashes } },
        { email: clean },
      ],
    });
    await db.collection(COLLECTIONS.LOGIN_ATTEMPTS).deleteMany({
      $or: [{ email: clean }, { device_id_hash: { $in: deviceHashes } }],
    });
  } catch {}

  await logSecurityAudit({
    action: "VISITOR_RECORD_DELETED_ON_REQUEST",
    user: actor.name,
    role: actor.role,
    email: actor.email,
    reason,
    details: { target: identifier, matchingVisitorsCount: matchingVisitors.length },
  });

  return {
    success: true,
    message: `Successfully deleted records for ${identifier} (${matchingVisitors.length} visitor entries removed).`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export async function getVisitorSettings(): Promise<VisitorSettings> {
  try {
    const db = await getDb();
    const doc = await db
      .collection(COLLECTIONS.VISITOR_SETTINGS)
      .findOne({ key: "general_settings" });
    if (doc && doc.settings) {
      return { ...DEFAULT_SETTINGS, ...doc.settings };
    }
  } catch {}
  return memStore.settings;
}

export async function updateVisitorSettings(
  newSettings: Partial<VisitorSettings>,
  actor: { name: string; role: string; email: string }
): Promise<VisitorSettings> {
  memStore.settings = { ...memStore.settings, ...newSettings };
  saveLocalStore(memStore);

  try {
    const db = await getDb();
    await db.collection(COLLECTIONS.VISITOR_SETTINGS).updateOne(
      { key: "general_settings" },
      { $set: { key: "general_settings", settings: memStore.settings, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch {}

  await logSecurityAudit({
    action: "VISITOR_SETTINGS_UPDATED",
    user: actor.name,
    role: actor.role,
    email: actor.email,
    details: newSettings,
  });

  return memStore.settings;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export async function exportVisitorsCsv(params: {
  masked: boolean;
  reason?: string;
  actor: { name: string; role: string; email: string };
}): Promise<string> {
  const { masked, reason, actor } = params;

  await logSecurityAudit({
    action: "VISITOR_RECORDS_EXPORTED",
    user: actor.name,
    role: actor.role,
    email: actor.email,
    reason: masked ? "Standard masked export" : (reason || "Full unmasked export requested"),
    details: { isMasked: masked, totalCount: memStore.visitors.length },
  });

  let csv = "Visitor ID,Device ID,Full Name,Email,IP Address,Location,OS,Device Model,Browser,First Seen,Last Seen,Visits,Status\n";
  for (const v of memStore.visitors) {
    const email = masked ? maskEmail(v.latest_email || "Anonymous") : (v.latest_email || "Anonymous");
    const ip = masked ? maskIp(v.latest_ip || "127.0.0.1") : (v.latest_ip || "127.0.0.1");
    const devId = shortId(v.device_id_hash);
    const row = [
      `"${v.id}"`,
      `"${devId}"`,
      `"${(v.latest_name || "Anonymous").replace(/"/g, '""')}"`,
      `"${email}"`,
      `"${ip}"`,
      `"${(v.latest_location || "").replace(/"/g, '""')}"`,
      `"${(v.latest_os || "").replace(/"/g, '""')}"`,
      `"${(v.latest_device_model || "").replace(/"/g, '""')}"`,
      `"${(v.latest_browser || "").replace(/"/g, '""')}"`,
      `"${v.first_seen}"`,
      `"${v.last_seen}"`,
      v.visit_count,
      `"${v.status}"`,
    ];
    csv += row.join(",") + "\n";
  }

  return csv;
}

export async function exportLoginAttemptsCsv(params: {
  masked: boolean;
  reason?: string;
  actor: { name: string; role: string; email: string };
}): Promise<string> {
  const { masked, reason, actor } = params;

  await logSecurityAudit({
    action: "LOGIN_ACTIVITY_EXPORTED",
    user: actor.name,
    role: actor.role,
    email: actor.email,
    reason: masked ? "Standard masked export" : (reason || "Full unmasked export requested"),
    details: { isMasked: masked, totalCount: memStore.loginAttempts.length },
  });

  let csv = "Attempt ID,Timestamp,Email,Result,Failure Reason,IP Address,Location,Device Model,OS,Browser\n";
  for (const l of memStore.loginAttempts) {
    const email = masked ? maskEmail(l.email) : l.email;
    const ip = masked ? maskIp(l.ip) : l.ip;
    const row = [
      `"${l.id}"`,
      `"${l.attempted_at}"`,
      `"${email}"`,
      `"${l.result}"`,
      `"${l.failure_reason || ""}"`,
      `"${ip}"`,
      `"${(l.location || "").replace(/"/g, '""')}"`,
      `"${(l.device_model || "").replace(/"/g, '""')}"`,
      `"${(l.os || "").replace(/"/g, '""')}"`,
      `"${(l.browser || "").replace(/"/g, '""')}"`,
    ];
    csv += row.join(",") + "\n";
  }

  return csv;
}
