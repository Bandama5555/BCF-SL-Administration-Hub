import { NextRequest, NextResponse } from "next/server";

/**
 * BCF-SL Backend Bridge & Proxy Service
 *
 * Connects the Next.js Frontend (Port 3000/3001) to the Express Backend (Port 5000).
 * Handles request forwarding, header sanitization, query strings, and resilient fallbacks.
 */

export const BACKEND_URL =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV !== "production" && !process.env.VERCEL
    ? process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"
    : "");

export function isExternalBackendConfigured(): boolean {
  if (!BACKEND_URL) return false;
  const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  if (isProd && (BACKEND_URL.includes("localhost") || BACKEND_URL.includes("127.0.0.1"))) {
    return false;
  }
  return true;
}

/**
 * Forwards an incoming Next.js API request to the standalone Express Backend.
 *
 * @param req The Next.js NextRequest or standard Request
 * @param backendPath The target path on Express (e.g. "/api/employees" or "/health")
 * @param fallback Optional fallback handler to execute if Express is unreachable
 */
export async function forwardToBackend(
  req: NextRequest | Request,
  backendPath: string,
  fallback?: () => Promise<Response>
): Promise<Response> {
  // If no external Express backend is configured or running standalone in production/Vercel,
  // immediately execute the local Next.js handler (which writes directly to MongoDB Atlas).
  if (!isExternalBackendConfigured()) {
    if (fallback) {
      return await fallback();
    }
    return NextResponse.json(
      { success: false, error: "No external backend service configured." },
      { status: 503 }
    );
  }

  const targetUrl = new URL(
    backendPath.startsWith("/") ? backendPath : `/${backendPath}`,
    BACKEND_URL
  );

  // Preserve query parameters from the original request
  if (req.url) {
    try {
      const originalUrl = new URL(req.url);
      originalUrl.searchParams.forEach((val, key) => {
        targetUrl.searchParams.set(key, val);
      });
    } catch {
      // Ignore URL parsing errors
    }
  }

  // Clone headers and add forwarding context
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    // Skip hop-by-hop headers
    if (!["host", "connection", "keep-alive"].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.set("x-forwarded-host", req.headers.get("host") || "localhost:3000");
  headers.set("x-forwarded-proto", "http");

  let body: BodyInit | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await req.arrayBuffer();
    } catch {
      body = null;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const backendRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    backendRes.headers.forEach((val, key) => {
      responseHeaders.set(key, val);
    });
    responseHeaders.set("X-Backend-Connected", "true");
    responseHeaders.set("X-Backend-Origin", BACKEND_URL);

    const responseBody = await backendRes.arrayBuffer();

    return new Response(responseBody, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[Backend-Bridge] Express backend unreachable at ${BACKEND_URL}${backendPath}: ${errorMsg}`
    );

    if (fallback) {
      console.info("[Backend-Bridge] Executing local Next.js fallback handler...");
      return await fallback();
    }

    return NextResponse.json(
      {
        success: false,
        error: `Express backend service unreachable at ${BACKEND_URL}`,
        details: errorMsg,
        target: targetUrl.toString(),
      },
      { status: 502 }
    );
  }
}

/**
 * Check if the Express backend service is reachable and healthy
 */
export async function checkBackendHealth(): Promise<{
  available: boolean;
  url: string;
  data?: any;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return { available: true, url: BACKEND_URL, data };
    }
    return {
      available: false,
      url: BACKEND_URL,
      error: `Backend responded with HTTP ${res.status}`,
    };
  } catch (err: unknown) {
    return {
      available: false,
      url: BACKEND_URL,
      error: err instanceof Error ? err.message : "Connection refused",
    };
  }
}
