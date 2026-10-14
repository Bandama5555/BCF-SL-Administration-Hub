import { NextRequest, NextResponse } from "next/server";
import {
  exportVisitorsCsv,
  exportLoginAttemptsCsv,
  isRoleAuthorizedForVisitorAnalytics,
} from "@/lib/visitorServer";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ success: false, error: "You do not have access to that page" }, { status: 403 });
    }

    const body = await req.json();
    const type = body.type || "visitors"; // "visitors" | "login-activity"
    const masked = body.masked !== false; // default true
    const reason = body.reason || "";

    if (!masked && (!reason || !reason.trim())) {
      return NextResponse.json(
        { success: false, error: "Full unmasked export requires a documented justification reason." },
        { status: 400 }
      );
    }

    const actor = {
      name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Administrator"),
      role: roleCode,
      email: qEmail || "admin@bcfsl.org",
    };

    let csv = "";
    let filename = "";

    if (type === "login-activity") {
      csv = await exportLoginAttemptsCsv({ masked, reason, actor });
      filename = `BCF_Login_Activity_${masked ? "Masked" : "Full"}_${new Date().toISOString().split("T")[0]}.csv`;
    } else {
      csv = await exportVisitorsCsv({ masked, reason, actor });
      filename = `BCF_Visitor_Registry_${masked ? "Masked" : "Full"}_${new Date().toISOString().split("T")[0]}.csv`;
    }

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[Export API Error]", err);
    return NextResponse.json({ success: false, error: "Export failed" }, { status: 500 });
  }
}
