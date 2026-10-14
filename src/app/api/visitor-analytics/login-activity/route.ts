import { NextRequest, NextResponse } from "next/server";
import { isRoleAuthorizedForVisitorAnalytics } from "@/lib/visitorServer";
import { logSecurityAudit } from "@/lib/contractSecurity";
import { normalizeRole } from "@/lib/permissions";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import fs from "fs";
import path from "path";

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
        tab: "visitor-analytics-login-activity",
        reason: "Access denied by default: user is not Super Admin",
      });

      return NextResponse.json(
        { success: false, error: "You do not have access to that page" },
        { status: 403 }
      );
    }

    // Load login attempts
    let attempts: any[] = [];
    try {
      const db = await getDb();
      attempts = await db
        .collection(COLLECTIONS.LOGIN_ATTEMPTS)
        .find({})
        .sort({ attempted_at: -1 })
        .toArray();
    } catch {
      // Load from local store
      try {
        const storePath = path.join(process.cwd(), "src", "data", "visitor_analytics.json");
        if (fs.existsSync(storePath)) {
          const parsed = JSON.parse(fs.readFileSync(storePath, "utf-8"));
          attempts = parsed.loginAttempts || [];
        }
      } catch {}
    }

    // Filters
    const search = (url.searchParams.get("search") || "").toLowerCase().trim();
    const resultFilter = url.searchParams.get("result"); // "Success" | "Failed"

    let filtered = attempts;
    if (search) {
      filtered = filtered.filter(
        (a) =>
          (a.email || "").toLowerCase().includes(search) ||
          (a.ip || "").toLowerCase().includes(search) ||
          (a.device_id_hash || "").toLowerCase().includes(search)
      );
    }
    if (resultFilter && resultFilter !== "All") {
      filtered = filtered.filter((a) => a.result === resultFilter);
    }

    // Detect repeated failures (count failed attempts per email or IP)
    const failureCountMap: Record<string, number> = {};
    for (const a of attempts) {
      if (a.result === "Failed") {
        failureCountMap[a.email] = (failureCountMap[a.email] || 0) + 1;
        failureCountMap[a.ip] = (failureCountMap[a.ip] || 0) + 1;
      }
    }

    const enhanced = filtered.map((a) => {
      const emailFailures = failureCountMap[a.email] || 0;
      const ipFailures = failureCountMap[a.ip] || 0;
      const isRepeatedFailure = a.result === "Failed" && (emailFailures >= 3 || ipFailures >= 3);
      return {
        ...a,
        isRepeatedFailure,
        emailFailures,
        ipFailures,
      };
    });

    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "25", 10);
    const total = enhanced.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginated = enhanced.slice(offset, offset + limit);

    await logSecurityAudit({
      action: "LOGIN_ACTIVITY_VIEWED",
      user: qName || qUser || "Super Admin",
      role: roleCode,
      email: qEmail || "admin@bcfsl.org",
      details: { count: paginated.length, total },
    });

    return NextResponse.json({
      success: true,
      attempts: paginated,
      total,
      page,
      totalPages,
    });
  } catch (err: any) {
    console.error("[Login Activity API Error]", err);
    return NextResponse.json(
      { success: false, error: "Failed to load login activity" },
      { status: 500 }
    );
  }
}
