/**
 * passwordResetTypes.ts
 * Types and schema definitions for BCF-SL Self-Service Password Reset
 * and Administrative Login Revocation Governance.
 */

export type ResetOutcome =
  | "Pending"
  | "Verified"
  | "Completed"
  | "Abandoned"
  | "Expired"
  | "Locked"
  | "Cancelled";

export type ResetEventType =
  | "Requested"
  | "CodeSent"
  | "CodeVerified"
  | "CodeFailed"
  | "Locked"
  | "PasswordChanged"
  | "SessionsEnded"
  | "ConfirmationSent"
  | "Cancelled";

export interface PasswordResetRequest {
  id: string; // Mongo ObjectId string or unique ID
  request_number: string; // BCF-PWR-YYYY-NNNNNN
  user_id: string;
  identifier_entered: string;
  staff_name: string;
  staff_id: string;
  department: string;
  email: string; // stored recipient email
  masked_email: string; // e.g. a***@bcfsl.org
  requested_at: string; // ISO
  ip: string;
  country: string;
  city: string;
  device_id_hash?: string;
  os: string;
  device_model: string;
  browser: string;
  otp_hash: string;
  otp_salt: string;
  otp_expires_at: string; // ISO
  otp_attempts: number;
  otp_verified_at?: string; // ISO
  reset_token_hash?: string;
  token_expires_at?: string; // ISO
  password_changed_at?: string; // ISO
  outcome: ResetOutcome;
  flags: string[]; // e.g. ["MULTIPLE_REQUESTS_24H", "LOCATION_ANOMALY"]
  login_status: "Active" | "Revoked" | "Suspended";
  created_at: string;
  updated_at: string;
}

export interface PasswordResetEvent {
  id: string;
  request_id: string;
  request_number: string;
  event: ResetEventType;
  at: string; // ISO
  details: Record<string, any>;
  ip?: string;
  user_agent?: string;
}

export interface LoginRevocation {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  staff_id: string;
  department: string;
  request_id?: string;
  reason_code:
    | "Suspicious reset"
    | "Account takeover suspected"
    | "Unusual location"
    | "User reported"
    | "Left organisation"
    | "Other";
  reason_text: string;
  revoked_by: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  revoked_at: string; // ISO
  restored_by?: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  restored_at?: string; // ISO
  restore_reason?: string;
  status: "Active" | "Restored";
}

export const PASSWORD_RESET_SETTINGS = {
  OTP_LENGTH: 5,
  OTP_LIFETIME_MINUTES: 10,
  RESEND_DELAY_SECONDS: 60,
  MAX_CODES_PER_HOUR: 3,
  MAX_WRONG_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 30,
  TOKEN_LIFETIME_MINUTES: 15,
  MIN_PASSWORD_LENGTH: 10,
  PASSWORD_HISTORY_LIMIT: 5,
};
