import { NextRequest, NextResponse } from "next/server";
import { resendPasswordResetOtp } from "@/lib/passwordResetServer";
import { extractClientIp } from "@/lib/geoDevice";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestId = (body.requestId || "").trim();

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "Reset session ID is required to resend verification code." },
        { status: 400 }
      );
    }

    const ip = extractClientIp(req.headers);
    const userAgent = req.headers.get("user-agent") || "Unknown Device / Browser";

    const result = await resendPasswordResetOtp({
      requestId,
      ip,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API] forgot-password/resend error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while resending the code." },
      { status: 500 }
    );
  }
}
