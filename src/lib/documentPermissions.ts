/**
 * documentPermissions.ts — Granular RBAC Action Engine for Documents & Policies Module
 * Bandama Charity Foundation Sierra Leone (BCF-SL)
 *
 * Implements the official institutional Permission Matrix:
 * - Roles: ST, HR, SA, CEO, IAR, PRG, FIN, PRC, IT
 * - Actions: V (view), D (download), U (upload), E (edit), X (delete), R (restore)
 * - Strict server-side and client-side enforcement (deny by default).
 */

import { type RoleCode } from "./permissions";

export type DocumentTab =
  | "documents"
  | "policies"
  | "proposals"
  | "projects"
  | "employee-contracts"
  | "deleted-items";

export type DocumentAction =
  | "view"
  | "download"
  | "upload"
  | "edit"
  | "delete"
  | "restore"
  | "viewDownloadHistory";

export interface DocumentActionPermissions {
  view: boolean;
  download: boolean;
  upload: boolean;
  edit: boolean;
  delete: boolean;
  restore?: boolean;
  viewDownloadHistory?: boolean;
  ownOnly?: boolean;
}

export interface DocumentPermissionRow {
  _id?: string;
  role: RoleCode;
  tab: DocumentTab;
  action: DocumentAction;
  allowed: boolean;
  ownOnly?: boolean;
  updatedAt?: string;
}

/**
 * Institutional Permissions Matrix for Documents & Policies
 * Strict institutional policy:
 * - Staff (ST): V, D on docs/policies; V, D (Own contract only) on employee-contracts.
 * - HR Director (HR): V, D, U, E, X across all tabs. Can view deleted log and download history.
 * - Super Admin (SA): V, D, U, E, X, R across all tabs. ONLY Super Admin can restore.
 * - CEO (CEO): V, D, U, E, X on employee-contracts; V, D, U, X on docs/policies/proposals/projects.
 * - Internal Audit & Risk (IAR): V, D across all tabs (read-only). Can view download history.
 * - Programs Director (PRG): V, D, U, X on docs/policies; V, D, U, E, X on proposals/projects. Employee-contracts hidden.
 * - Finance Director (FIN): V, D on docs/policies/proposals/projects. Employee-contracts and deleted log hidden.
 * - Procurement (PRC) & IT: Completely hidden / no access.
 */
export const DEFAULT_DOCUMENT_PERMISSIONS: Record<RoleCode, Record<DocumentTab, DocumentActionPermissions>> = {
  // Staff Member
  ST: {
    documents: { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    policies: { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    proposals: { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    projects: { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    "employee-contracts": { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false, ownOnly: true },
    "deleted-items": { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
  },

  // HR Director
  HR: {
    documents: { view: true, download: true, upload: true, edit: true, delete: true, restore: false, viewDownloadHistory: true },
    policies: { view: true, download: true, upload: true, edit: true, delete: true, restore: false, viewDownloadHistory: true },
    proposals: { view: true, download: true, upload: true, edit: true, delete: true, restore: false, viewDownloadHistory: true },
    projects: { view: true, download: true, upload: true, edit: true, delete: true, restore: false, viewDownloadHistory: true },
    "employee-contracts": { view: true, download: true, upload: true, edit: true, delete: true, restore: false, viewDownloadHistory: true, ownOnly: false },
    "deleted-items": { view: true, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: true },
  },

  // Super Administrator
  SA: {
    documents: { view: true, download: true, upload: true, edit: true, delete: true, restore: true, viewDownloadHistory: true },
    policies: { view: true, download: true, upload: true, edit: true, delete: true, restore: true, viewDownloadHistory: true },
    proposals: { view: true, download: true, upload: true, edit: true, delete: true, restore: true, viewDownloadHistory: true },
    projects: { view: true, download: true, upload: true, edit: true, delete: true, restore: true, viewDownloadHistory: true },
    "employee-contracts": { view: true, download: true, upload: true, edit: true, delete: true, restore: true, viewDownloadHistory: true, ownOnly: false },
    "deleted-items": { view: true, download: false, upload: false, edit: false, delete: false, restore: true, viewDownloadHistory: true },
  },

  // Chief Executive Officer
  CEO: {
    documents: { view: true, download: true, upload: true, edit: false, delete: true, restore: false, viewDownloadHistory: true },
    policies: { view: true, download: true, upload: true, edit: false, delete: true, restore: false, viewDownloadHistory: true },
    proposals: { view: true, download: true, upload: true, edit: false, delete: true, restore: false, viewDownloadHistory: true },
    projects: { view: true, download: true, upload: true, edit: false, delete: true, restore: false, viewDownloadHistory: true },
    "employee-contracts": { view: true, download: true, upload: true, edit: true, delete: true, restore: false, viewDownloadHistory: true, ownOnly: false },
    "deleted-items": { view: true, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: true },
  },

  // Internal Audit & Risk Director
  IAR: {
    documents: { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: true },
    policies: { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: true },
    proposals: { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: true },
    projects: { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: true },
    "employee-contracts": { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: true, ownOnly: false },
    "deleted-items": { view: true, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: true },
  },

  // Programs Director
  PRG: {
    documents: { view: true, download: true, upload: true, edit: false, delete: true, restore: false, viewDownloadHistory: true },
    policies: { view: true, download: true, upload: true, edit: false, delete: true, restore: false, viewDownloadHistory: true },
    proposals: { view: true, download: true, upload: true, edit: true, delete: true, restore: false, viewDownloadHistory: true },
    projects: { view: true, download: true, upload: true, edit: true, delete: true, restore: false, viewDownloadHistory: true },
    "employee-contracts": { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false, ownOnly: false },
    "deleted-items": { view: true, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: true },
  },

  // Finance Director
  FIN: {
    documents: { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    policies: { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    proposals: { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    projects: { view: true, download: true, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    "employee-contracts": { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false, ownOnly: false },
    "deleted-items": { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
  },

  // Procurement Director (No access)
  PRC: {
    documents: { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    policies: { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    proposals: { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    projects: { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    "employee-contracts": { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false, ownOnly: false },
    "deleted-items": { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
  },

  // IT Director (No access)
  IT: {
    documents: { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    policies: { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    proposals: { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    projects: { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
    "employee-contracts": { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false, ownOnly: false },
    "deleted-items": { view: false, download: false, upload: false, edit: false, delete: false, restore: false, viewDownloadHistory: false },
  },
};

/**
 * Checks whether a given role can perform an action in a tab.
 */
export function checkDocumentPermission(
  role: RoleCode,
  tab: DocumentTab,
  action: DocumentAction,
  customMatrix?: Record<RoleCode, Record<DocumentTab, DocumentActionPermissions>>
): boolean {
  const matrix = customMatrix || DEFAULT_DOCUMENT_PERMISSIONS;
  const roleRules = matrix[role];
  if (!roleRules) return false;

  const tabRules = roleRules[tab];
  if (!tabRules) return false;

  return !!tabRules[action];
}

/**
 * Returns whether an action is scoped to 'own record only' for a given role and tab.
 */
export function isActionOwnOnly(
  role: RoleCode,
  tab: DocumentTab,
  customMatrix?: Record<RoleCode, Record<DocumentTab, DocumentActionPermissions>>
): boolean {
  const matrix = customMatrix || DEFAULT_DOCUMENT_PERMISSIONS;
  const roleRules = matrix[role];
  if (!roleRules) return false;
  const tabRules = roleRules[tab];
  if (!tabRules) return false;
  return !!tabRules.ownOnly;
}

/**
 * Converts default matrix into permission table rows for DB storage/seeding.
 */
export function generateDefaultPermissionRows(): DocumentPermissionRow[] {
  const rows: DocumentPermissionRow[] = [];
  const actions: DocumentAction[] = [
    "view",
    "download",
    "upload",
    "edit",
    "delete",
    "restore",
    "viewDownloadHistory",
  ];

  for (const [role, tabs] of Object.entries(DEFAULT_DOCUMENT_PERMISSIONS)) {
    for (const [tab, perms] of Object.entries(tabs)) {
      for (const action of actions) {
        rows.push({
          role: role as RoleCode,
          tab: tab as DocumentTab,
          action,
          allowed: !!perms[action],
          ownOnly: action === "view" || action === "download" ? !!perms.ownOnly : false,
        });
      }
    }
  }
  return rows;
}

/**
 * Builds permission matrix from database rows.
 */
export function buildMatrixFromRows(
  rows: DocumentPermissionRow[]
): Record<RoleCode, Record<DocumentTab, DocumentActionPermissions>> {
  const matrix = JSON.parse(JSON.stringify(DEFAULT_DOCUMENT_PERMISSIONS));
  for (const row of rows) {
    if (matrix[row.role] && matrix[row.role][row.tab]) {
      matrix[row.role][row.tab][row.action] = row.allowed;
      if (row.ownOnly !== undefined && (row.action === "view" || row.action === "download")) {
        matrix[row.role][row.tab].ownOnly = row.ownOnly;
      }
    }
  }
  return matrix;
}

/**
 * Returns all accessible tabs for a given role in Documents & Policies.
 */
export function getAccessibleDocumentTabs(
  role: RoleCode,
  customMatrix?: Record<RoleCode, Record<DocumentTab, DocumentActionPermissions>>
): DocumentTab[] {
  const allTabs: DocumentTab[] = [
    "documents",
    "policies",
    "proposals",
    "projects",
    "employee-contracts",
    "deleted-items",
  ];
  return allTabs.filter((tab) => checkDocumentPermission(role, tab, "view", customMatrix));
}

/**
 * Validates upload file format and size
 */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

export const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "png", "jpg", "jpeg"];

export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
