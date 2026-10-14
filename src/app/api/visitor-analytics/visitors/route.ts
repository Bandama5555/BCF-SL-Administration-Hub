import { NextRequest, NextResponse } from "next/server";
import {
  getVisitorsList,
  getVisitorProfile,
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
      await logSecurityAudit({
        action: "UNAUTHORIZED_ACCESS_ATTEMPT",
        user: qName || qUser || "Unknown",
        role: roleCode,
        email: qEmail || "Unknown",
        tab: "visitor-analytics-visitors",
        reason: "Access denied by default: user is not Super Admin",
      });

      return NextResponse.json(
        { success: false, error: "You do not have access to that page" },
        { status: 403 }
      );
    }

    // Detail profile request
    const detailId = url.searchParams.get("id");
    if (detailId) {
      const profile = getVisitorProfile(detailId);
      if (!profile) {
        return NextResponse.json({ success: false, error: "Visitor profile not found" }, { status: 404 });
      }

      // Audit view of visitor profile
      await logSecurityAudit({
        action: "VISITOR_PROFILE_VIEWED",
        user: qName || qUser || "Super Admin",
        role: roleCode,
        email: qEmail || "admin@bcfsl.org",
        itemId: detailId,
        details: { visitorId: profile.visitor.id, name: profile.visitor.latest_name },
      });

      return NextResponse.json({ success: true, profile });
    }

    // List query
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "25", 10);
    const search = url.searchParams.get("search") || undefined;
    const country = url.searchParams.get("country") || undefined;
    const os = url.searchParams.get("os") || undefined;
    const deviceType = url.searchParams.get("deviceType") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const signedIn = url.searchParams.get("signedIn") || undefined;
    const sortBy = (url.searchParams.get("sortBy") as any) || "last_seen";
    const sortOrder = (url.searchParams.get("sortOrder") as any) || "desc";

    const result = getVisitorsList({
      page,
      limit,
      search,
      country,
      os,
      deviceType,
      status,
      signedIn,
      sortBy,
      sortOrder,
    });

    // Audit view of visitor list
    await logSecurityAudit({
      action: "VISITOR_DIRECTORY_ACCESSED",
      user: qName || qUser || "Super Admin",
      role: roleCode,
      email: qEmail || "admin@bcfsl.org",
      details: { page, limit, search, count: result.visitors.length },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[Visitor List API Error]", err);
    return NextResponse.json(
      { success: false, error: "Failed to load visitors" },
      { status: 500 }
    );
  }
}
