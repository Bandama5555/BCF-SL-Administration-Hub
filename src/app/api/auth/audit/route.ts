import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, user, role, path, details } = body;

    const db = await getDb();
    const auditCol = db.collection("audit_logs");

    const auditEntry = {
      auditId: `AUD-${Date.now().toString(36).toUpperCase()}`,
      action: action || "ACCESS_ATTEMPT",
      userId: user || "anonymous",
      role: role || "UNKNOWN",
      path: path || "/",
      dateTime: new Date().toISOString(),
      details: details || `Attempted navigation to ${path}`,
      result: action === "UNAUTHORIZED_ACCESS_BLOCKED" ? "Denied" : "Recorded",
      createdAt: new Date().toISOString(),
    };

    await auditCol.insertOne(auditEntry);

    return NextResponse.json({ success: true, data: auditEntry });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = await getDb();
    const logs = await db
      .collection("audit_logs")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({ success: true, data: logs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
