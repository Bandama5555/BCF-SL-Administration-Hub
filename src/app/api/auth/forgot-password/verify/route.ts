import { NextRequest, NextResponse } from "next/server";
import { verifyPasswordResetOtp } from "@/lib/passwordResetServer";
import { extractClientIp } from "@/lib/geoDevice";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestId = (body.requestId || "").trim();
    const otp = (body.otp || "").trim();

    if (!requestId || !otp) {
      return NextResponse.json(
        { success: false, error: "Reset request ID and 5-digit verification code are required." },
        { status: 400 }
      );
    }

    if (!/^\d{5}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "The verification code must be exactly 5 digits." },
        { status: 400 }
      );
    }

    const ip = extractClientIp(req.headers);
    const userAgent = req.headers.get("user-agent") || "Unknown Device / Browser";

    const result = await verifyPasswordResetOtp({
      requestId,
      otp,
      ip,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API] forgot-password/verify error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify security code. Please try again." },
      { status: 500 }
    );
  }
}
