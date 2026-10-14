import { NextResponse } from "next/server";
import { checkMongoHealth } from "@/lib/mongodb";
import { checkBackendHealth, BACKEND_URL } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Probe the standalone Express backend first
    const backendProbe = await checkBackendHealth();

    if (backendProbe.available && backendProbe.data) {
      const bData = backendProbe.data;
      const dbInfo = bData.database || {};

      return NextResponse.json({
        success: dbInfo.connected ?? true,
        connected: dbInfo.connected ?? true,
        status: dbInfo.status || "connected",
        database: dbInfo.database || "bcf_administrative_hub",
        cluster: dbInfo.cluster || "administrativehub.e9xkgcl.mongodb.net",
        sanitizedUri: dbInfo.sanitizedUri || "mongodb+srv://****@administrativehub.e9xkgcl.mongodb.net",
        latencyMs: dbInfo.latencyMs,
        collections: dbInfo.collections || [],
        totalDocuments: dbInfo.totalDocuments || 0,
        backendService: {
          connected: true,
          status: bData.status || "HEALTHY",
          service: bData.service || "BCF-SL Administration Hub Express API",
          version: bData.version || "1.0.0",
          url: BACKEND_URL,
          uptimeSeconds: bData.uptimeSeconds,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Fallback to local MongoDB driver probe if Express is unavailable
    const localReport = await checkMongoHealth();
    return NextResponse.json({
      success: localReport.connected,
      ...localReport,
      backendService: {
        connected: false,
        status: "offline",
        url: BACKEND_URL,
        error: backendProbe.error || "Express server offline",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to inspect health";
    return NextResponse.json(
      {
        success: false,
        connected: false,
        status: "disconnected",
        backendService: {
          connected: false,
          status: "error",
          url: BACKEND_URL,
        },
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
