import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkBlockStatus } from "./lib/visitorServer";

// Public path prefixes and assets that never require authentication
const PUBLIC_PREFIXES = [
  "/login",
  "/privacy",
  "/privacy-policy",
  "/website",
  "/_next",
  "/apps",
  "/api/auth",
  "/api/visitor-analytics/track",
  "/api/analytics/collect",
  "/api",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/bcf-logo.jpg",
  "/bcf_official_logo.png",
];

const STATIC_EXTENSIONS = [
  ".html",
  ".htm",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".ico",
  ".webp",
  ".css",
  ".js",
  ".map",
  ".woff",
  ".woff2",
  ".ttf",
  ".json",
  ".csv",
];

const RESTRICTED_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Access Restricted — BCF-SL</title>
</head>
<body style="margin:0;padding:24px;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#f8fafc;">
  <div style="max-width:440px;width:100%;text-align:center;background:#1e293b;padding:36px 28px;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.4);border:1px solid #334155;">
    <div style="width:48px;height:48px;margin:0 auto 16px;border-radius:50%;background:#ef444420;color:#ef4444;display:flex;align-items:center;justify-content:center;font-size:24px;">&#9888;</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 12px;color:#f8fafc;">Access Restricted</h1>
    <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0 0 24px;">Access to this site is restricted from this device. Contact the BCF-SL administrator if you think this is a mistake.</p>
    <div style="font-size:11px;color:#64748b;border-top:1px solid #334155;padding-top:16px;">Bandama Charity Foundation Sierra Leone &bull; Security Gateway</div>
  </div>
</body>
</html>`;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static assets and Next.js internal files
  const isStaticFile = STATIC_EXTENSIONS.some((ext) => pathname.toLowerCase().endsWith(ext));
  if (isStaticFile) {
    return NextResponse.next();
  }

  // 1b. Real-Time Server Blocklist Enforcement on ALL requests
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || "127.0.0.1";
  const deviceId =
    request.cookies.get("bcf_vid")?.value ||
    request.cookies.get("bcf_device_id")?.value;
  const token = request.cookies.get("bcf_token")?.value;

  let sessionEmail = "";
  if (token) {
    try {
      const decoded = atob(token);
      sessionEmail = decoded.split(":")[0];
    } catch (_) {}
  }

  try {
    const blockCheck = await checkBlockStatus({
      ip: clientIp,
      deviceId,
      email: sessionEmail,
    });

    if (blockCheck.blocked) {
      const res = new NextResponse(RESTRICTED_PAGE_HTML, {
        status: 403,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
      // End active session immediately
      res.cookies.delete("bcf_token");
      return res;
    }
  } catch (_) {}

  // 2. Allow explicitly public prefixes
  const isPublicPrefix = PUBLIC_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?")
  );

  // 3. If accessing /login while already possessing a valid auth session, redirect to Hub
  if (pathname === "/login") {
    if (token && token.trim().length > 0) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // If route is public, allow through
  if (isPublicPrefix) {
    return NextResponse.next();
  }

  // 4. All other routes are STRICTLY PROTECTED: require valid bcf_token cookie
  if (!token || token.trim().length === 0) {
    const loginUrl = new URL("/login", request.url);
    if (pathname && pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - apps (embedded HTML apps in public/apps)
     */
    "/((?!_next/static|_next/image|favicon.ico|apps).*)",
  ],
};
