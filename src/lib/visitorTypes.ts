export type DeviceType = "Mobile" | "Tablet" | "Desktop" | "Bot";

export interface Visitor {
  id: string; // VIS-xxxx
  device_id_hash: string;
  fingerprint_hash?: string;
  first_seen: string;
  last_seen: string;
  visit_count: number;
  status: "Active" | "Blocked";
  linked_emails: string[];
  linked_ips: string[];
  is_bot: boolean;
  latest_ip?: string;
  latest_location?: string;
  latest_os?: string;
  latest_device_model?: string;
  latest_browser?: string;
  latest_name?: string;
  latest_email?: string;
}

export interface VisitorSession {
  id: string; // SES-xxxx
  visitor_id: string;
  device_id_hash: string;
  user_id: string | null;
  name: string; // "Anonymous" or user name
  email: string; // "Anonymous" or user email
  ip: string;
  country: string;
  region: string;
  city: string;
  isp: string;
  vpn_flag: boolean;
  os: string;
  os_version: string;
  device_type: DeviceType;
  device_model: string;
  browser: string;
  screen: string;
  language: string;
  timezone: string;
  referrer: string;
  started_at: string;
  ended_at: string;
  source: "Website" | "Hub";
  is_bot: boolean;
  pages_visited: string[];
}

export interface VisitorPageView {
  id: string;
  session_id: string;
  visitor_id: string;
  page: string;
  viewed_at: string;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ip: string;
  device_id_hash: string;
  device_model: string;
  os: string;
  browser: string;
  location: string;
  result: "Success" | "Failed";
  failure_reason: string | null; // "wrong password" | "account disabled" | "blocked" | "expired session" | "user not found"
  attempted_at: string;
}

export type BlockType = "Email" | "Device" | "IP";

export interface BlockedEntry {
  id: string; // BLK-xxxx
  type: BlockType;
  value: string; // email, or hashed device_id, or IP
  display_value: string; // human readable or masked
  fingerprint_hash?: string;
  reason_code:
    | "Suspicious activity"
    | "Repeated failed logins"
    | "Unauthorized access attempt"
    | "Abuse or spam"
    | "Security concern"
    | "Requested by management"
    | "Other";
  reason_text: string;
  blocked_by: {
    staffId: string;
    name: string;
    role: string;
  };
  blocked_at: string;
  expires_at: string | null; // null for Permanent, or ISO date
  status: "Active" | "Unblocked";
  unblocked_at?: string;
  unblocked_by?: {
    staffId: string;
    name: string;
    role: string;
  };
  unblock_reason?: string;
  blocked_attempts_count: number;
}

export interface BlockedAttempt {
  id: string;
  blocked_entry_id?: string;
  ip: string;
  device_id_hash: string;
  email_tried?: string;
  emailTried?: string;
  reason: string;
  attempted_at: string;
  location?: string;
}

export interface VisitorSettings {
  retention_months: number; // default 12
  notice_text: string;
  privacy_policy_url: string;
  alert_failed_login_threshold: number; // default 5
  alert_failed_login_window_mins: number; // default 10
  alert_recipients: string[];
  alert_in_app: boolean;
  alert_email_enabled: boolean;
  bot_filtering: boolean;
  ip_geolocation_provider: string;
  ip_geolocation_key: string;
}

export interface SecurityAlert {
  id: string;
  type: "new_country" | "failed_logins" | "blocked_attempt" | "impossible_travel";
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  timestamp: string;
  target?: string;
  ip?: string;
}

export interface DashboardMetrics {
  totalVisits: number;
  uniqueVisitors: number;
  newVisitors: number;
  returningVisitors: number;
  signedInVisitors: number;
  anonymousVisitors: number;
  activeNow: number;
  failedLoginsCount: number;
  blockedAttemptsCount: number;
  currentlyBlockedCount: number;
  botsFilteredCount: number;
  visitsOverTime: { date: string; visits: number; unique: number }[];
  visitorsByCountry: { country: string; city: string; count: number; percentage: number }[];
  visitorsByOS: { name: string; count: number; percentage: number }[];
  visitorsByDeviceType: { name: string; count: number; percentage: number }[];
  visitorsByBrowser: { name: string; count: number; percentage: number }[];
  topPages: { page: string; views: number; uniqueVisitors: number }[];
  topReferrers: { referrer: string; count: number }[];
  peakVisitingHours: { hour: number; count: number }[];
  failedLoginsOverTime: { date: string; count: number }[];
  topFailedIps: { ip: string; count: number; lastAttempt: string }[];
  topFailedEmails: { email: string; count: number; lastAttempt: string }[];
  recentVisitors: Visitor[];
  recentBlockedAttempts: BlockedAttempt[];
  alerts: SecurityAlert[];
}
