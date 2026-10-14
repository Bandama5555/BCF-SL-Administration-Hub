import { NextRequest, NextResponse } from "next/server";
import {
  extractClientIp,
  recordVisitEvent,
  hashString,
} from "@/lib/visitorServer";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const ip = extractClientIp(req.headers);
    const userAgent = req.headers.get("user-agent") || "";

    // Read or create device cookie
    const cookieVal = req.cookies.get("bcf_vid")?.value;
    let isNewCookie = false;
    let rawDeviceId = cookieVal;
    if (!rawDeviceId || rawDeviceId.trim().length === 0) {
      rawDeviceId = (body.deviceId as string) || `dev_${randomUUID()}`;
      isNewCookie = true;
    }
    const finalDeviceId: string = rawDeviceId;

    const result = await recordVisitEvent({
      deviceId: finalDeviceId,
      fingerprint: body.fingerprint,
      page: body.page || "/",
      referrer: body.referrer || req.headers.get("referer") || "Direct",
      screen: body.screen || "1920x1080",
      language: body.language || req.headers.get("accept-language")?.split(",")[0] || "en-US",
      timezone: body.timezone || "Africa/Freetown",
      userAgent,
      ip,
      source: body.source === "Website" ? "Website" : "Hub",
      signedInUser: body.user || null,
      privacyAccepted: body.privacyAccepted ?? true,
    });

    if (result.isBlocked) {
      return NextResponse.json(
        {
          isBlocked: true,
          error: "Access to this site is restricted from this device. Contact the BCF-SL administrator if you think this is a mistake.",
        },
        { status: 403 }
      );
    }

    const res = NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      deviceIdHash: result.deviceIdHash,
    });

    // Set secure long-lived cookie if new
    if (isNewCookie) {
      res.cookies.set("bcf_vid", finalDeviceId, {
        path: "/",
        maxAge: 365 * 24 * 60 * 60, // 1 year
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: false, // Accessible to tracking script
      });
    }

    return res;
  } catch (err: any) {
    console.error("[Visitor Track Error]", err);
    return NextResponse.json({ success: false, error: "Tracking error" }, { status: 500 });
  }
}
