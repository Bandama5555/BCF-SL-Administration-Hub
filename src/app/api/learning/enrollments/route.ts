import { NextRequest, NextResponse } from "next/server";
import { getDb, isPlaceholderUri, COLLECTIONS } from "@/lib/mongodb";
import { forwardToBackend } from "@/lib/backend";

export const dynamic = "force-dynamic";

const inMemoryEnrollments: any[] = [];

export async function GET(req: NextRequest) {
  return forwardToBackend(req, "/api/learning/enrollments", async () => {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const semesterId = searchParams.get("semesterId");

    if (isPlaceholderUri()) {
      let res = [...inMemoryEnrollments];
      if (employeeId) res = res.filter((e) => e.employeeId === employeeId);
      if (semesterId) res = res.filter((e) => e.semesterId === semesterId);
      return NextResponse.json({
        success: true,
        source: "memory_fallback",
        data: res,
        count: res.length,
      });
    }

    try {
      const db = await getDb();
      const col = db.collection(COLLECTIONS.LEARNING_ENROLLMENTS);
      const filter: any = {};
      if (employeeId) filter.employeeId = employeeId;
      if (semesterId) filter.semesterId = semesterId;

      const data = await col.find(filter).sort({ requestedAt: -1 }).toArray();

      return NextResponse.json({
        success: true,
        source: "mongodb_atlas",
        data,
        count: data.length,
      });
    } catch (err: any) {
      return NextResponse.json({
        success: true,
        source: "fallback_on_error",
        data: inMemoryEnrollments,
        count: inMemoryEnrollments.length,
        warning: err.message,
      });
    }
  });
}

export async function POST(req: NextRequest) {
  return forwardToBackend(req, "/api/learning/enrollments", async () => {
    try {
      const body = await req.json();
      const isBatch = Array.isArray(body);
      const items = isBatch ? body : [body];

      if (isPlaceholderUri()) {
        for (const item of items) {
          const id = item.id || `ENR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          const record = { ...item, id, updatedAt: new Date().toISOString() };
        const idx = inMemoryEnrollments.findIndex((e) => e.id === id);
        if (idx >= 0) inMemoryEnrollments[idx] = record;
        else inMemoryEnrollments.push(record);
      }
      return NextResponse.json({
        success: true,
        source: "memory_fallback",
        count: items.length,
      });
    }

    const db = await getDb();
    const col = db.collection(COLLECTIONS.LEARNING_ENROLLMENTS);

    for (const item of items) {
      const id = item.id || `ENR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const { _id, ...clean } = item;
      await col.updateOne(
        { id },
        {
          $set: {
            ...clean,
            id,
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: {
            requestedAt: clean.requestedAt || new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({
      success: true,
      source: "mongodb_atlas",
      count: items.length,
      message: `Synced ${items.length} enrollment(s) to MongoDB Atlas.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
  });
}
