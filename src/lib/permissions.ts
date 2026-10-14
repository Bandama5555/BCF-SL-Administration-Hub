/**
 * permissions.ts — Central Role-Based Access Control (RBAC) Engine
 * Bandama Charity Foundation Sierra Leone (BCF-SL)
 *
 * Implements the official institutional Permission Matrix:
 * - Roles: ST, HR, SA, CEO, FIN, IAR, PRG, PRC, IT
 * - Levels: F (Full), V (View), O (Own, view), OW (Own, read & write), - (Deny)
 * - Rules: Deny by default, hide empty modules, route blocking & audit logging.
 */

import { MODULES, type Module, type SubApp } from "./modules";

export type RoleCode = "ST" | "HR" | "SA" | "CEO" | "FIN" | "IAR" | "PRG" | "PRC" | "IT";
export type PermissionLevel = "F" | "V" | "O" | "OW" | "-";

export const ROLE_DEFINITIONS: Record<RoleCode, { name: string; title: string; description: string }> = {
  SA: { name: "Super Admin", title: "Super Administrator", description: "Full system administration, user management, and security matrix control" },
  CEO: { name: "CEO", title: "Chief Executive Officer", description: "Executive oversight, cross-departmental view, and final authorizations" },
  HR: { name: "HR Director", title: "Human Resources Director", description: "Personnel governance, employee database, leave approvals, and onboarding" },
  FIN: { name: "Finance Director", title: "Finance & Accounts Director", description: "Fiscal management, treasury, bank ledgers, payroll, and fund disbursements" },
  IAR: { name: "Internal Audit Director", title: "Internal Audit & Risk Director", description: "Internal compliance, investigations, disciplinary oversight, and audit trails" },
  PRG: { name: "Programs Director", title: "Programs & Impact Director", description: "Community initiatives, project tracking, donors, and performance evaluation" },
  PRC: { name: "Procurement Director", title: "Procurement & Supply Chain Director", description: "Purchasing, tenders, supplier master, RFQs, and purchase orders" },
  IT: { name: "IT Director", title: "Information Technology Director", description: "Systems infrastructure, LMS course catalogue, and technical provisioning" },
  ST: { name: "Staff Member", title: "Staff Member / Frontline", description: "Self-service portal for personal payslips, leave, loan requests, and course learning" },
};

/**
 * Normalizes any role string, title, or username to standard RoleCode.
 * Default is 'ST' (Staff Member) for strict deny-by-default security.
 */
export function normalizeRole(
  roleString?: string | null,
  username?: string | null,
  email?: string | null,
  department?: string | null,
  position?: string | null
): RoleCode {
  const u = (username || "").toLowerCase().trim();
  const em = (email || "").toLowerCase().trim();
  const r = (roleString || "").toLowerCase().trim();
  const dept = (department || "").toLowerCase().trim();
  const pos = (position || "").toLowerCase().trim();

  // 1. Check client-side stored session tokens if in browser
  let storedRole = "";
  let hasAdminSession = false;
  if (typeof window !== "undefined") {
    try {
      storedRole = (sessionStorage.getItem("bcf_user_role") || localStorage.getItem("bcf_user_role") || "").toLowerCase().trim();
      hasAdminSession =
        sessionStorage.getItem("bcf_admin_session") === "true" ||
        sessionStorage.getItem("bcf_admin_authenticated") === "true";
    } catch (_) {}
  }

  // Super Admin: match Super Administrator role, Admin, Administrator, or master admin accounts
  const isSuperAdminRole =
    r === "sa" ||
    r === "admin" ||
    r === "administrator" ||
    r === "super admin" ||
    r === "super administrator" ||
    r === "super_admin" ||
    r === "superadmin" ||
    r === "system administrator" ||
    r === "system admin" ||
    r === "system_admin" ||
    r.includes("admin") ||
    r.includes("superadmin") ||
    r.includes("super administrator") ||
    r.includes("system administrator") ||
    r.includes("administrator") ||
    storedRole === "super_admin" ||
    storedRole === "admin" ||
    storedRole === "sa" ||
    hasAdminSession;

  const isSuperAdminUser =
    u === "abandama" ||
    u === "admin" ||
    u === "superadmin" ||
    u === "administrator" ||
    u.startsWith("admin") ||
    u.includes("admin") ||
    em === "admin@bcfsl.org" ||
    em === "admin@bcf-sl.org" ||
    em === "albertjosephhassanbandama@gmail.com" ||
    em.startsWith("admin@") ||
    em.includes("admin@") ||
    em.includes("admin");

  if (isSuperAdminRole || isSuperAdminUser) {
    return "SA";
  }

  // CEO / Executive Officer
  if (
    r === "ceo" ||
    r === "chief executive officer" ||
    r.includes("chief executive") ||
    r.includes("executive officer") ||
    pos.includes("chief executive") ||
    pos.includes("ceo") ||
    dept.includes("executive") ||
    u === "ceo_user" ||
    u === "ceo" ||
    em.startsWith("ceo@")
  ) {
    return "CEO";
  }

  // HR Director
  if (
    r === "hr" ||
    r === "hr director" ||
    r === "human resources director" ||
    r.includes("hr director") ||
    r.includes("human resources director") ||
    ((r.includes("director") || pos.includes("director")) && (dept.includes("human") || dept.includes("hr"))) ||
    u === "hr_director" ||
    u === "hr" ||
    em.startsWith("hr@") ||
    em === "jconteh@bcf-sl.org"
  ) {
    return "HR";
  }

  // Finance Director
  if (
    r === "fin" ||
    r === "finance director" ||
    r.includes("finance director") ||
    ((r.includes("director") || pos.includes("director")) && dept.includes("finance")) ||
    u === "fin_director" ||
    u === "finance_director" ||
    em.startsWith("finance@") ||
    em === "mbangura@bcf-sl.org"
  ) {
    return "FIN";
  }

  // Internal Audit & Risk Director
  if (
    r === "iar" ||
    r === "internal audit director" ||
    r === "audit director" ||
    r.includes("audit & risk") ||
    r.includes("audit and risk") ||
    ((r.includes("director") || pos.includes("director")) && (dept.includes("audit") || dept.includes("risk"))) ||
    u === "iar_director" ||
    em.startsWith("audit@") ||
    em === "skamara@bcf-sl.org"
  ) {
    return "IAR";
  }

  // Programs Director
  if (
    r === "prg" ||
    r === "programs director" ||
    r === "program director" ||
    r.includes("programs director") ||
    ((r.includes("director") || pos.includes("director")) && dept.includes("program")) ||
    u === "prg_director" ||
    em.startsWith("programs@") ||
    em === "fsesay@bcf-sl.org"
  ) {
    return "PRG";
  }

  // Procurement Director
  if (
    r === "prc" ||
    r === "procurement director" ||
    r.includes("procurement director") ||
    ((r.includes("director") || pos.includes("director")) && dept.includes("procure")) ||
    u === "prc_director" ||
    em.startsWith("procurement@") ||
    em === "hkanu@bcf-sl.org"
  ) {
    return "PRC";
  }

  // IT Director
  if (
    r === "it" ||
    r === "it director" ||
    r === "information technology director" ||
    r.includes("it director") ||
    ((r.includes("director") || pos.includes("director")) && (dept.includes("information technology") || dept.includes("it"))) ||
    u === "it_director" ||
    u === "alexk" ||
    u.includes("alexk") ||
    em.startsWith("it@") ||
    em === "atoro@bcf-sl.org" ||
    em === "albertjosephbandama30@gmail.com"
  ) {
    return "IT";
  }

  // Default to ST (Staff Member) for strict deny-by-default security
  return "ST";
}

/**
 * Official BCF-SL Permission Matrix
 * Keyed by: moduleSlug -> subAppId -> RoleCode -> PermissionLevel
 */
export const ACCESS_MATRIX: Record<string, Record<string, Record<RoleCode, PermissionLevel>>> = {
  // ─── Super Admin Module (Exclusive to Super Admin & Executive Leadership) ─
  "super-admin": {
    "executive-analytics": { SA: "F", CEO: "F", HR: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "V", IT: "F", ST: "-" },
    "login-creation": { SA: "F", CEO: "F", HR: "F", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "F", ST: "-" },
    "account-management": { SA: "F", CEO: "F", HR: "F", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "F", ST: "-" },
    "access-matrix": { SA: "F", CEO: "F", HR: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "F", ST: "-" },
    "audit-logs": { SA: "F", CEO: "F", HR: "V", FIN: "V", IAR: "F", PRG: "-", PRC: "-", IT: "F", ST: "-" },
  },

  // ─── Visitor Analytics Module (Exclusive to Super Admin) ───────────────────
  "visitor-analytics": {
    "dashboard": { SA: "F", CEO: "-", HR: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-", ST: "-" },
    "visitors": { SA: "F", CEO: "-", HR: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-", ST: "-" },
    "login-activity": { SA: "F", CEO: "-", HR: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-", ST: "-" },
    "blocked-visitors": { SA: "F", CEO: "-", HR: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-", ST: "-" },
    "settings": { SA: "F", CEO: "-", HR: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-", ST: "-" },
  },

  // ─── Employee Module ────────────────────────────────────────────────────────
  "employees": {
    "staff-directory": { ST: "V", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "V", IT: "V" },
    "employee-profile": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "-", PRC: "-", IT: "-" },
    "register-staff": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "staff-analytics": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "V" },
    "organogram": { ST: "V", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "V", IT: "V" },
  },

  // ─── Donors Module ──────────────────────────────────────────────────────────
  "donors": {
    "donors-directory": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
    "donor-dossier": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
    "log-donation": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
    "giving-analytics": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
  },

  // ─── Beneficiaries Module ───────────────────────────────────────────────────
  "beneficiaries": {
    "beneficiaries-log": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
    "beneficiaries-analytics": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
  },

  // ─── Finance Module ─────────────────────────────────────────────────────────
  "finance": {
    "donor-inflow-ledger": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
    "programme-budgets": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
    "treasury-balance": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
    "payroll-schedule": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "-", PRC: "-", IT: "-" },
    "payslip-self-service": { ST: "O", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "O", PRC: "O", IT: "O" },
    "loan-register": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "end-of-service": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
  },

  // ─── Loans Module ───────────────────────────────────────────────────────────
  "loans": {
    "loan-application": { ST: "OW", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "OW", PRC: "OW", IT: "OW" },
    "hr-approval": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "finance-approval": { ST: "-", HR: "-", SA: "F", CEO: "V", FIN: "F", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "ceo-authorisation": { ST: "-", HR: "-", SA: "F", CEO: "F", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "hr-disbursement-voucher": { ST: "-", HR: "F", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "finance-disbursement-release": { ST: "-", HR: "F", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "tracking-repayment": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "F", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "payroll-integration": { ST: "-", HR: "V", SA: "F", CEO: "V", FIN: "F", IAR: "V", PRG: "-", PRC: "-", IT: "-" },
  },

  // ─── Leave Management Module ────────────────────────────────────────────────
  "leave": {
    "leave-dashboard": { ST: "O", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "O", PRC: "O", IT: "O" },
    "leave-application": { ST: "OW", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "OW", PRC: "OW", IT: "OW" },
    "hr-review": { ST: "-", HR: "F", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "foms-audit": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "F", IAR: "V", PRG: "-", PRC: "-", IT: "-" },
  },

  // ─── Partnerships Module ────────────────────────────────────────────────────
  "partnerships": {
    "partners-directory": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
    "deal-pipeline": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
    "partner-profile": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
    "partnership-analytics": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
  },

  // ─── Procurement Module ─────────────────────────────────────────────────────
  "procurement": {
    "purchase-requisition": { ST: "OW", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "OW", PRC: "F", IT: "OW" },
    "supplier-management": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "-", PRC: "F", IT: "-" },
    "rfq-management": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "-", PRC: "F", IT: "-" },
    "purchase-order": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "-", PRC: "F", IT: "-" },
    "goods-received-note": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "-", PRC: "F", IT: "-" },
    "invoice-matching": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "-", PRC: "F", IT: "-" },
    "transaction-audit-trail": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "-", PRC: "F", IT: "-" },
    "partnership-management": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "F", IT: "-" },
    "procurement-dashboard": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "F", IT: "-" },
    "procurement-data": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "F", IT: "-" },
    "procurement-data-management": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "F", IT: "-" },
    "inventory-management": { ST: "-", HR: "V", SA: "F", CEO: "V", FIN: "-", IAR: "V", PRG: "-", PRC: "F", IT: "-" },
    "asset-management": { ST: "-", HR: "V", SA: "F", CEO: "V", FIN: "-", IAR: "V", PRG: "-", PRC: "F", IT: "-" },
  },

  // ─── Programs Module ────────────────────────────────────────────────────────
  "programs": {
    "programs-database": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "F", PRC: "F", IT: "-" },
    "programme-financials": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "F", IT: "-" },
    "financial-ledger": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "F", IT: "-" },
    "donors-partners": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "F", IT: "-" },
    "performance-evaluation": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "V", IT: "-" },
  },

  // ─── Learning Module ────────────────────────────────────────────────────────
  "learning": {
    "course-allocation": { ST: "OW", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "V", IT: "F" },
    "learning-grades": { ST: "O", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "F", IT: "O" },
    "certificates": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "learning-certificates": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "staff-login": { ST: "V", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "V", IT: "F" },
    "login": { ST: "V", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "V", IT: "F" },
    "account-creation": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "accounts": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "learning-dashboard": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "dashboard": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "analytics": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
  },

  // ─── Discipline Module ──────────────────────────────────────────────────────
  "discipline": {
    "committee-log": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "F", PRG: "-", PRC: "-", IT: "-" },
    "registration-log": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "F", PRG: "-", PRC: "-", IT: "-" },
    "committee-profile": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "F", PRG: "-", PRC: "-", IT: "-" },
    "disciplinary-log": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "V", PRG: "-", PRC: "-", IT: "-" },
    "cases-log": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "V", PRG: "-", PRC: "-", IT: "-" },
    "disciplinary-profile": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "F", PRG: "-", PRC: "-", IT: "-" },
    "committee-detail": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "F", PRG: "-", PRC: "-", IT: "-" },
    "accused-profile": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "F", PRG: "-", PRC: "-", IT: "-" },
    "suspect-profile": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "F", PRG: "-", PRC: "-", IT: "-" },
    "investigation-cases": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "F", PRG: "-", PRC: "-", IT: "-" },
    "case-register": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "-", IAR: "F", PRG: "-", PRC: "-", IT: "-" },
  },

  // ─── Documents & Policies Module ───────────────────────────────────────────
  "documents-policies": {
    "documents": { ST: "V", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "V", IT: "V" },
    "policies": { ST: "V", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "V", PRC: "V", IT: "V" },
    "proposals": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "F", PRC: "-", IT: "-" },
    "projects": { ST: "-", HR: "F", SA: "F", CEO: "V", FIN: "V", IAR: "V", PRG: "F", PRC: "-", IT: "-" },
    "employee-contracts": { ST: "O", HR: "F", SA: "F", CEO: "F", FIN: "O", IAR: "V", PRG: "O", PRC: "O", IT: "O" },
    "deleted-items": { ST: "-", HR: "V", SA: "F", CEO: "V", FIN: "-", IAR: "V", PRG: "V", PRC: "-", IT: "-" },
  },

  // ─── Access Module (Unified - Positioned 2nd in Sidebar) ───────────────────
  "access": {
    "access-application": { ST: "F", HR: "F", SA: "F", CEO: "F", FIN: "F", IAR: "F", PRG: "F", PRC: "F", IT: "F" },
    "my-requests": { ST: "F", HR: "F", SA: "F", CEO: "F", FIN: "F", IAR: "F", PRG: "F", PRC: "F", IT: "F" },
    "notifications": { ST: "F", HR: "F", SA: "F", CEO: "F", FIN: "F", IAR: "F", PRG: "F", PRC: "F", IT: "F" },
    "access-approval": { ST: "-", HR: "V", SA: "F", CEO: "F", FIN: "F", IAR: "F", PRG: "F", PRC: "F", IT: "F" },
    "access-acceptance": { ST: "-", HR: "V", SA: "F", CEO: "V", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "V" },
    "access-revoke": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "access-master": { ST: "-", HR: "V", SA: "F", CEO: "V", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "V" },
  },

  // ─── Legacy Access Aliases for Backward Compatibility ──────────────────────
  "access-request": {
    "access-application": { ST: "F", HR: "F", SA: "F", CEO: "F", FIN: "F", IAR: "F", PRG: "F", PRC: "F", IT: "F" },
    "my-requests": { ST: "F", HR: "F", SA: "F", CEO: "F", FIN: "F", IAR: "F", PRG: "F", PRC: "F", IT: "F" },
    "notifications": { ST: "F", HR: "F", SA: "F", CEO: "F", FIN: "F", IAR: "F", PRG: "F", PRC: "F", IT: "F" },
  },
  "access-approval": {
    "access-approval": { ST: "-", HR: "V", SA: "F", CEO: "F", FIN: "F", IAR: "F", PRG: "F", PRC: "F", IT: "F" },
    "access-acceptance": { ST: "-", HR: "V", SA: "F", CEO: "V", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "V" },
    "access-revoke": { ST: "-", HR: "-", SA: "F", CEO: "-", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "-" },
    "access-master": { ST: "-", HR: "V", SA: "F", CEO: "V", FIN: "-", IAR: "-", PRG: "-", PRC: "-", IT: "V" },
  },
};

/**
 * Returns true if the permission level allows viewing/opening the page.
 */
export function isLevelAccessible(level: PermissionLevel): boolean {
  return level === "F" || level === "V" || level === "O" || level === "OW";
}

/**
 * Gets exact permission level for a given role and subapp.
 */
export function getSubAppPermission(role: RoleCode, moduleSlug: string, subAppId: string): PermissionLevel {
  // Super Admin always has Full access everywhere
  if (role === "SA") return "F";

  const modulePerms = ACCESS_MATRIX[moduleSlug];
  if (!modulePerms) return "-";

  const subAppPerms = modulePerms[subAppId];
  if (!subAppPerms) return "-";

  const rolePerm = subAppPerms[role] || "-";

  // Core Rule: All Directors & Leadership (CEO, HR, FIN, PRC, PRG, IAR, IT)
  // are also Foundation staff members and automatically inherit Staff ('ST') baseline self-service rights!
  if (rolePerm === "-" && role !== "ST") {
    const staffPerm = subAppPerms["ST"] || "-";
    if (staffPerm === "V" || staffPerm === "O" || staffPerm === "OW" || staffPerm === "F") {
      return staffPerm;
    }
  }

  return rolePerm;
}

/**
 * Checks if a user has access to a specific subapp (including dynamically granted access).
 */
export function hasSubAppAccess(role: RoleCode, moduleSlug: string, subAppId: string): boolean {
  // Super Admin always has full access
  if (role === "SA") return true;

  // 1. Strict Revocation Enforcement: Active revocations override baseline role matrix & grants!
  if (typeof window !== "undefined") {
    try {
      const rawRevs = sessionStorage.getItem("bcf_user_revocations") || localStorage.getItem("bcf_user_revocations");
      if (rawRevs) {
        const revs = JSON.parse(rawRevs);
        if (Array.isArray(revs)) {
          const isRevoked = revs.some((r: any) => {
            const matchesMod = (r.moduleSlug && r.moduleSlug.toLowerCase() === moduleSlug.toLowerCase()) ||
                               (r.module && r.module.toLowerCase() === moduleSlug.toLowerCase());
            if (matchesMod && (r.scope === "Module" || !r.tabId || r.tabId === subAppId)) {
              return true;
            }
            if (r.tabId && r.tabId.toLowerCase() === subAppId.toLowerCase()) {
              return true;
            }
            return false;
          });
          if (isRevoked) {
            return false;
          }
        }
      }
    } catch (_) {}
  }

  // 2. Check baseline role matrix permissions
  const level = getSubAppPermission(role, moduleSlug, subAppId);
  if (isLevelAccessible(level)) return true;

  // 3. Check client-side active granted permissions cache
  if (typeof window !== "undefined") {
    try {
      const rawGrants = sessionStorage.getItem("bcf_user_grants") || localStorage.getItem("bcf_user_grants");
      if (rawGrants) {
        const grants = JSON.parse(rawGrants);
        if (
          Array.isArray(grants) &&
          grants.some((g: any) => g.moduleSlug === moduleSlug && g.tabId === subAppId)
        ) {
          return true;
        }
      }
    } catch (_) {}
  }

  return false;
}

/**
 * Checks if a user has access to at least one subapp in a module.
 */
export function hasModuleAccess(role: RoleCode, moduleSlug: string): boolean {
  if (role === "SA") return true;

  const mod = MODULES.find((m) => m.slug === moduleSlug);
  if (!mod) return false;

  return mod.subApps.some((sub) => hasSubAppAccess(role, moduleSlug, sub.id));
}

/**
 * Returns only modules that have at least one accessible sub-app for this role.
 * Empty modules are completely hidden per Core Rule #3.
 */
export function getAccessibleModules(role: RoleCode): Module[] {
  if (role === "SA") {
    return MODULES.map((mod) => ({
      ...mod,
      subApps: mod.subApps.filter((sub) => !sub.hidden),
    }));
  }

  return MODULES.filter((mod) => hasModuleAccess(role, mod.slug)).map((mod) => ({
    ...mod,
    subApps: mod.subApps.filter((sub) => !sub.hidden && hasSubAppAccess(role, mod.slug, sub.id)),
  }));
}

/**
 * Returns accessible sub-apps for a specific module and role.
 */
export function getAccessibleSubApps(role: RoleCode, moduleSlug: string): SubApp[] {
  const mod = MODULES.find((m) => m.slug === moduleSlug);
  if (!mod) return [];

  if (role === "SA") return mod.subApps.filter((sub) => !sub.hidden);

  return mod.subApps.filter((sub) => !sub.hidden && hasSubAppAccess(role, moduleSlug, sub.id));
}

/**
 * Computes the landing page for a role after login.
 * Per Core Rule #4: opens the user's first accessible page or dashboard.
 */
export function getRoleLandingPage(role: RoleCode): string {
  // Super Admin lands on executive overview
  if (role === "SA") return "/";

  const accessibleModules = getAccessibleModules(role);
  if (accessibleModules.length === 0) return "/login";

  // For regular staff, landing on dashboard or first accessible subapp
  return "/";
}

/**
 * Standard Seed Test Users for Instant RBAC Verification
 */
export const SEED_TEST_USERS = [
  { role: "SA", username: "admin", email: "admin@bcfsl.org", fullName: "Albert Joseph Bandama", position: "Super Administrator", department: "Executive Management", password: "ChangeMe123!" },
  { role: "CEO", username: "ceo_user", email: "ceo@bcf-sl.org", fullName: "Dr. Alimamy Koroma", position: "Chief Executive Officer", department: "Executive Management", password: "BCF@2026" },
  { role: "HR", username: "hr_director", email: "jconteh@bcf-sl.org", fullName: "Joseph Conteh", position: "Human Resources Director", department: "Human Resources Management Department", password: "BCF@2026" },
  { role: "FIN", username: "fin_director", email: "mbangura@bcf-sl.org", fullName: "Mohamed Bangura", position: "Finance Director", department: "Finance Department", password: "BCF@2026" },
  { role: "PRC", username: "prc_director", email: "hkanu@bcf-sl.org", fullName: "Hassan Kanu", position: "Procurement Director", department: "Procurement Department", password: "BCF@2026" },
  { role: "PRG", username: "prg_director", email: "fsesay@bcf-sl.org", fullName: "Fatmata Sesay", position: "Programs Director", department: "Programs Department", password: "BCF@2026" },
  { role: "IAR", username: "iar_director", email: "skamara@bcf-sl.org", fullName: "Samuel Kamara", position: "Internal Audit & Risk Director", department: "Internal Risk & Audits Department", password: "BCF@2026" },
  { role: "IT", username: "it_director", email: "atoro@bcf-sl.org", fullName: "Augustine Toro", position: "IT Director", department: "Information Technology (IT) Department", password: "BCF@2026" },
  { role: "ST", username: "staff_user", email: "staff@bcf-sl.org", fullName: "Mabinty Mustapha", position: "Community Field Officer", department: "Programs Department", password: "BCF@2026", employeeId: "BCF-ST-001" },
  { role: "ST", username: "staff_user_b", email: "staff_b@bcf-sl.org", fullName: "Alpha Kamara", position: "Field Logistics Assistant", department: "Logistics Department", password: "BCF@2026", employeeId: "BCF-ST-002" },
  { role: "ST", username: "fin_staff_user", email: "fin_staff@bcf-sl.org", fullName: "Mariama Jalloh", position: "Accounts Assistant", department: "Finance Department", password: "BCF@2026", employeeId: "BCF-FIN-009" },
];
