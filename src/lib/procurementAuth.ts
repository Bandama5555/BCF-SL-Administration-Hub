/**
 * procurementAuth.ts — Server-side Authorization, Audit Logging, and Notifications
 * for Inventory Management and Asset Management modules.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "./mongodb";
import { normalizeRole, type RoleCode } from "./permissions";
import {
  DEFAULT_PROCUREMENT_EXT_PERMISSIONS,
  type PermissionLevel,
  type ProcurementPermissionRow,
} from "./inventoryAssetTypes";

export interface AuthContext {
  roleCode: RoleCode;
  role: string;
  name: string;
  username: string;
  email: string;
  employeeId?: string;
}

/**
 * Extracts authenticated user context from request headers or query params
 */
export function extractProcurementUser(req: NextRequest): AuthContext {
  const roleHeader =
    req.headers.get("x-bcf-user-role") ||
    req.nextUrl.searchParams.get("role") ||
    req.headers.get("x-user-role") ||
    "ST";
  const username =
    req.headers.get("x-bcf-username") ||
    req.nextUrl.searchParams.get("user") ||
    req.headers.get("x-username") ||
    "guest";
  const email =
    req.headers.get("x-bcf-email") ||
    req.nextUrl.searchParams.get("email") ||
    req.headers.get("x-email") ||
    "";
  const name =
    req.headers.get("x-bcf-name") ||
    req.nextUrl.searchParams.get("name") ||
    username;
  const employeeId =
    req.headers.get("x-bcf-employee-id") ||
    req.nextUrl.searchParams.get("employeeId") ||
    undefined;

  const roleCode = normalizeRole(roleHeader, username, email);

  return {
    roleCode,
    role: roleHeader,
    name,
    username,
    email,
    employeeId,
  };
}

/**
 * Resolves permissions level dynamically from MongoDB permissions table,
 * falling back to institutional defaults.
 */
export async function getProcurementTabPermission(
  roleCode: RoleCode,
  tab: "inventory-management" | "asset-management"
): Promise<PermissionLevel> {
  try {
    const col = await getCollection<ProcurementPermissionRow>(COLLECTIONS.PROCUREMENT_PERMISSIONS);
    const row = await col.findOne({ role: roleCode, tab });
    if (row && (row.level === "F" || row.level === "V" || row.level === "-")) {
      return row.level;
    }
  } catch (err) {
    // MongoDB fallback
  }

  return DEFAULT_PROCUREMENT_EXT_PERMISSIONS[roleCode]?.[tab] || "-";
}

/**
 * Strict server-side access enforcement (deny by default):
 * - If user level is '-', returns 403 "You do not have access to that page." and logs FAILED_ACCESS_ATTEMPT
 * - If user level is 'V' and requiredLevel is 'F', returns 403 "Action restricted to Full access administrators."
 */
export async function enforceProcurementAccess(
  req: NextRequest,
  tab: "inventory-management" | "asset-management",
  requiredLevel: "V" | "F" = "V"
): Promise<
  | { authorized: true; user: AuthContext; level: PermissionLevel }
  | { authorized: false; response: NextResponse }
> {
  const user = extractProcurementUser(req);
  const level = await getProcurementTabPermission(user.roleCode, tab);

  // 1. Completely denied (hidden role: ST, FIN, PRG, IT, or custom deny)
  if (level === "-") {
    await logProcurementAudit({
      action: "FAILED_ACCESS_ATTEMPT",
      user: user.name,
      role: user.roleCode,
      email: user.email,
      tab,
      details: {
        method: req.method,
        url: req.nextUrl.pathname,
        reason: "Unauthorized direct access attempt by restricted role.",
      },
    });

    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "You do not have access to that page.",
          code: "ACCESS_DENIED",
          tab,
        },
        { status: 403 }
      ),
    };
  }

  // 2. View user attempting mutation (create, edit, delete, approve, etc.)
  if (requiredLevel === "F" && level !== "F") {
    await logProcurementAudit({
      action: "MUTATION_ACTION_DENIED",
      user: user.name,
      role: user.roleCode,
      email: user.email,
      tab,
      details: {
        method: req.method,
        url: req.nextUrl.pathname,
        reason: "View-only role attempted mutation or approval action.",
      },
    });

    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "You have view-only permissions for this section. Action not allowed.",
          code: "MUTATION_FORBIDDEN",
          tab,
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user, level };
}

/**
 * Records immutable security and operational audit trail entry into MongoDB
 */
export async function logProcurementAudit(params: {
  action: string;
  user: string;
  role: string;
  email?: string;
  tab: string;
  recordId?: string;
  txnId?: string;
  details?: Record<string, any>;
}) {
  try {
    const col = await getCollection(COLLECTIONS.AUDIT_LOGS);
    await col.insertOne({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action: params.action,
      user: params.user,
      role: params.role,
      email: params.email || "",
      module: "procurement",
      tab: params.tab,
      recordId: params.recordId || "",
      txnId: params.txnId || "",
      details: params.details || {},
      ip: "127.0.0.1",
    });
  } catch (err) {
    console.warn("[logProcurementAudit] Failed to log audit:", err);
  }
}

/**
 * Dispatches notifications to authorized governance roles only.
 * Rule: Never notifies roles that cannot view the related tab.
 */
export async function dispatchProcurementNotification(params: {
  title: string;
  message: string;
  type: "info" | "warning" | "alert" | "approval";
  targetRoles: RoleCode[]; // Only roles permitted to see this tab
  tab: "inventory-management" | "asset-management";
  itemId?: string;
  link?: string;
}) {
  try {
    const notifCol = await getCollection(COLLECTIONS.DOCUMENTS_NOTIFICATIONS);
    const nowIso = new Date().toISOString();

    const notifs = params.targetRoles.map((role) => ({
      id: `notif_prc_${Date.now()}_${role}_${Math.random().toString(36).substring(2, 6)}`,
      title: params.title,
      message: params.message,
      type: params.type,
      recipientRole: role,
      recipientUser: "",
      module: "procurement",
      tab: params.tab,
      itemId: params.itemId || "",
      link: params.link || `/procurement/${params.tab}`,
      read: false,
      createdAt: nowIso,
    }));

    if (notifs.length > 0) {
      await notifCol.insertMany(notifs as any);
    }
  } catch (err) {
    console.warn("[dispatchProcurementNotification] Failed to dispatch notifications:", err);
  }
}
