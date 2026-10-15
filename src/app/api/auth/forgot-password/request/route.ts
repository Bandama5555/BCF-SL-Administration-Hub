import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/passwordResetServer";
import { extractClientIp } from "@/lib/geoDevice";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = (body.identifier || body.username || body.email || "").trim();
    const deviceId = body.deviceId || "";

    const ip = extractClientIp(req.headers);
    const userAgent = req.headers.get("user-agent") || "Unknown Device / Browser";

    const result = await requestPasswordReset({
      identifier,
      ip,
      userAgent,
      deviceId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API] forgot-password/request error:", error);
    // Return neutral response even on unhandled error to prevent timing attack or info leak
    return NextResponse.json({
      success: true,
      message: "If an account matches, a 5-digit code has been sent to the registered email.",
    });
  }
}
