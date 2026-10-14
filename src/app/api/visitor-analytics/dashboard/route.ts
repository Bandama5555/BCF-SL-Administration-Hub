import { NextRequest, NextResponse } from "next/server";
import {
  getDashboardMetrics,
  isRoleAuthorizedForVisitorAnalytics,
} from "@/lib/visitorServer";
import { logSecurityAudit } from "@/lib/contractSecurity";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const roleHeader = req.headers.get("x-bcf-user-role");
    const userHeader = req.headers.get("x-bcf-username");
    const emailHeader = req.headers.get("x-bcf-email");
    const nameHeader = req.headers.get("x-bcf-name");

    const url = new URL(req.url);
    const qRole = url.searchParams.get("role") || roleHeader;
    const qUser = url.searchParams.get("user") || userHeader;
    const qEmail = url.searchParams.get("email") || emailHeader;
    const qName = url.searchParams.get("name") || nameHeader;

    const roleCode = normalizeRole(qRole, qUser, qEmail);
    const isAuthorized = await isRoleAuthorizedForVisitorAnalytics(roleCode);

    if (!isAuthorized) {
      // Log unauthorized attempt to audit trail
      await logSecurityAudit({
        action: "UNAUTHORIZED_ACCESS_ATTEMPT",
        user: qName || qUser || "Unknown",
        role: roleCode,
        email: qEmail || "Unknown",
        tab: "visitor-analytics-dashboard",
        reason: "Access denied by default: user is not Super Admin",
      });

      return NextResponse.json(
        { success: false, error: "You do not have access to that page" },
        { status: 403 }
      );
    }

    const range = (url.searchParams.get("range") || "30d") as any;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;
    const source = (url.searchParams.get("source") || "All") as any;

    const metrics = await getDashboardMetrics({
      range,
      startDate,
      endDate,
      source,
    });

    return NextResponse.json({ success: true, metrics });
  } catch (err: any) {
    console.error("[Visitor Dashboard API Error]", err);
    return NextResponse.json(
      { success: false, error: "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
