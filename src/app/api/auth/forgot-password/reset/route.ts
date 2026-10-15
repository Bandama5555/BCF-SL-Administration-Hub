import { NextRequest, NextResponse } from "next/server";
import { executePasswordReset } from "@/lib/passwordResetServer";
import { extractClientIp } from "@/lib/geoDevice";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const resetToken = (body.resetToken || "").trim();
    const newPassword = (body.newPassword || "").trim();
    const confirmPassword = (body.confirmPassword || "").trim();

    if (!resetToken) {
      return NextResponse.json(
        { success: false, error: "One-time password reset token is required." },
        { status: 400 }
      );
    }

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: "New password and password confirmation are required." },
        { status: 400 }
      );
    }

    const ip = extractClientIp(req.headers);
    const userAgent = req.headers.get("user-agent") || "Unknown Device / Browser";

    const result = await executePasswordReset({
      resetToken,
      newPassword,
      confirmPassword,
      ip,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API] forgot-password/reset error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset password. Please start over." },
      { status: 500 }
    );
  }
}
