import { NextRequest, NextResponse } from "next/server";
import {
  getVisitorSettings,
  updateVisitorSettings,
  runRetentionCleanup,
  deletePersonVisitorRecord,
  isRoleAuthorizedForVisitorAnalytics,
} from "@/lib/visitorServer";
import { logSecurityAudit } from "@/lib/contractSecurity";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function getActor(req: NextRequest) {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");
  const nameHeader = req.headers.get("x-bcf-name");
  const empIdHeader = req.headers.get("x-bcf-employee-id");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;
  const qName = url.searchParams.get("name") || nameHeader;
  const qEmpId = url.searchParams.get("employeeId") || empIdHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail);
  return {
    staffId: qEmpId || (roleCode === "SA" ? "BCF-PTE-2026-0001" : "BCF-ST-001"),
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Administrator"),
    role: roleCode,
    email: qEmail || "admin@bcfsl.org",
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = getActor(req);
    const isAuthorized = await isRoleAuthorizedForVisitorAnalytics(actor.role);

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "You do not have access to that page" }, { status: 403 });
    }

    const settings = await getVisitorSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = getActor(req);
    const isAuthorized = await isRoleAuthorizedForVisitorAnalytics(actor.role);

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "You do not have access to that page" }, { status: 403 });
    }

    const body = await req.json();
    const updated = await updateVisitorSettings(body, actor);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "Failed to update settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = getActor(req);
    const isAuthorized = await isRoleAuthorizedForVisitorAnalytics(actor.role);

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "You do not have access to that page" }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action;

    if (action === "cleanup") {
      const months = body.months ? parseInt(body.months, 10) : undefined;
      const result = await runRetentionCleanup(months);
      await logSecurityAudit({
        action: "VISITOR_RETENTION_CLEANUP_RUN",
        user: actor.name,
        role: actor.role,
        email: actor.email,
        details: result,
      });
      return NextResponse.json({
        success: true,
        message: `Retention job finished: ${result.deletedSessions} expired sessions removed, ${result.anonymizedVisitors} stale visitor records anonymized.`,
        result,
      });
    }

    if (action === "delete-person") {
      const { identifier, reason } = body;
      if (!identifier || !reason) {
        return NextResponse.json(
          { success: false, error: "Target email/device and justification reason are required." },
          { status: 400 }
        );
      }
      const result = await deletePersonVisitorRecord({ identifier, reason, actor });
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("[Settings POST Error]", err);
    return NextResponse.json({ success: false, error: "Action failed" }, { status: 500 });
  }
}
