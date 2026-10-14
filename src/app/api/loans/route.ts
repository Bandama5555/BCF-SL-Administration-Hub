import { NextRequest, NextResponse } from "next/server";
import { getDb, isPlaceholderUri, COLLECTIONS } from "@/lib/mongodb";
import { forwardToBackend } from "@/lib/backend";

export const dynamic = "force-dynamic";

const inMemoryLoans: any[] = [];

export async function GET(req: NextRequest) {
  return forwardToBackend(req, "/api/loans", async () => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");

    if (isPlaceholderUri()) {
      let list = inMemoryLoans;
      if (status) list = list.filter((l) => l.status === status);
      if (employeeId) list = list.filter((l) => l.employeeId === employeeId);
      return NextResponse.json({
        success: true,
        source: "memory_fallback",
        data: list,
        count: list.length,
      });
    }

    try {
      const db = await getDb();
      const col = db.collection(COLLECTIONS.STAFF_LOANS);
      const filter: any = {};
      if (status) filter.status = status;
      if (employeeId) filter.employeeId = employeeId;

      const data = await col.find(filter).sort({ submissionDate: -1, createdAt: -1 }).toArray();

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
        data: inMemoryLoans,
        count: inMemoryLoans.length,
        warning: err.message,
      });
    }
  });
}

export async function POST(req: NextRequest) {
  return forwardToBackend(req, "/api/loans", async () => {
    try {
      const body = await req.json();
      const isBatch = Array.isArray(body);
      const items = isBatch ? body : [body];

      if (isPlaceholderUri()) {
        for (const item of items) {
          const id = item.loanId || item.id || `LN-${Date.now().toString(36).toUpperCase()}`;
          const record = { ...item, loanId: id, updatedAt: new Date().toISOString() };
        const idx = inMemoryLoans.findIndex((l) => l.loanId === id || l.id === id);
        if (idx >= 0) inMemoryLoans[idx] = record;
        else inMemoryLoans.push(record);
      }
      return NextResponse.json({ success: true, source: "memory_fallback", count: items.length });
    }

    const db = await getDb();
    const col = db.collection(COLLECTIONS.STAFF_LOANS);

    for (const item of items) {
      const id = item.loanId || item.id || `LN-${Date.now().toString(36).toUpperCase()}`;
      const { _id, ...clean } = item;
      await col.updateOne(
        { $or: [{ loanId: id }, { id }] },
        {
          $set: {
            ...clean,
            loanId: id,
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: {
            createdAt: clean.createdAt || new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({
      success: true,
      source: "mongodb_atlas",
      count: items.length,
      message: `Synced ${items.length} loan record(s) to MongoDB Atlas.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
  });
}
