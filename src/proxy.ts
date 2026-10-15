import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public path prefixes and assets that never require authentication
const PUBLIC_PREFIXES = [
  "/login",
  "/privacy",
  "/privacy-policy",
  "/website",
  "/_next",
  "/apps",
  "/api/auth",
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static assets and Next.js internal files
  const isStaticFile = STATIC_EXTENSIONS.some((ext) => pathname.toLowerCase().endsWith(ext));
  if (isStaticFile) {
    return NextResponse.next();
  }

  const token = request.cookies.get("bcf_token")?.value;

  // Helper to ensure any legacy visitor cookies are expired
  const cleanLegacyTrackingCookies = (response: NextResponse) => {
    if (request.cookies.has("bcf_vid")) {
      response.cookies.delete("bcf_vid");
    }
    if (request.cookies.has("bcf_device_id")) {
      response.cookies.delete("bcf_device_id");
    }
    return response;
  };

  // 2. Allow explicitly public prefixes
  const isPublicPrefix = PUBLIC_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?")
  );

  // 3. If accessing /login while already possessing a valid auth session, redirect to Hub
  if (pathname === "/login") {
    if (token && token.trim().length > 0) {
      return cleanLegacyTrackingCookies(NextResponse.redirect(new URL("/", request.url)));
    }
    return cleanLegacyTrackingCookies(NextResponse.next());
  }

  // If route is public, allow through
  if (isPublicPrefix) {
    return cleanLegacyTrackingCookies(NextResponse.next());
  }

  // 4. All other routes are STRICTLY PROTECTED: require valid bcf_token cookie
  if (!token || token.trim().length === 0) {
    const loginUrl = new URL("/login", request.url);
    if (pathname && pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return cleanLegacyTrackingCookies(NextResponse.redirect(loginUrl));
  }

  return cleanLegacyTrackingCookies(NextResponse.next());
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
