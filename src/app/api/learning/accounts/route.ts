import { NextRequest, NextResponse } from "next/server";
import { getDb, isPlaceholderUri, COLLECTIONS } from "@/lib/mongodb";
import { forwardToBackend } from "@/lib/backend";

export const dynamic = "force-dynamic";

// Standard seed accounts when database is initial
const SEED_ACCOUNTS = [
  {
    accountId: "ACC-000",
    employeeId: "BCF-PTE-2026-0001",
    employeeName: "Albert Joseph Bandama",
    employeePhone: "+232 76 123456",
    employeeEmail: "albertjosephhassanbandama@gmail.com",
    username: "abandama",
    password: "Password123!",
    department: "Executive Management",
    position: "Chief Executive Officer (CEO)",
    supervisor: "Board of Directors",
    isActive: true,
    quotaTier: 4,
    createdAt: "2026-01-01T08:00:00Z",
  },
  {
    accountId: "ACC-001",
    employeeId: "BCF-EMP-2027-0001",
    employeeName: "Sahr Emmanuel Bangura",
    employeePhone: "+232 76 123456",
    employeeEmail: "sahr.bangura@bcf.sl",
    username: "sbangura",
    password: "Password123!",
    department: "Programmes",
    position: "Programme Officer",
    supervisor: "Fatima Turay",
    isActive: true,
    quotaTier: 2,
    createdAt: "2026-06-01T08:00:00Z",
  },
  {
    accountId: "ACC-002",
    employeeId: "BCF-EMP-2027-0002",
    employeeName: "Aminata Sesay",
    employeePhone: "+232 78 654321",
    employeeEmail: "aminata.sesay@bcf.sl",
    username: "asesay",
    password: "Password123!",
    department: "ICT",
    position: "ICT Officer",
    supervisor: "Ibrahim Koroma",
    isActive: true,
    quotaTier: 2,
    createdAt: "2026-06-01T09:00:00Z",
  },
  {
    accountId: "ACC-003",
    employeeId: "BCF-EMP-2027-0003",
    employeeName: "Mohamed Kamara",
    employeePhone: "+232 77 987654",
    employeeEmail: "m.kamara@bcf.sl",
    username: "mkamara",
    password: "Password123!",
    department: "Finance",
    position: "Finance Officer",
    supervisor: "Ibrahim Koroma",
    isActive: true,
    quotaTier: 2,
    createdAt: "2026-06-02T10:00:00Z",
  },
  {
    accountId: "ACC-004",
    employeeId: "BCF-EMP-2027-0004",
    employeeName: "Fatima Turay",
    employeePhone: "+232 88 112233",
    employeeEmail: "f.turay@bcf.sl",
    username: "fturay",
    password: "Password123!",
    department: "Programmes",
    position: "Programmes Manager",
    supervisor: "Albert J. Bandama",
    isActive: true,
    quotaTier: 3,
    createdAt: "2026-06-03T11:00:00Z",
  },
];

let inMemoryAccounts = [...SEED_ACCOUNTS];

export async function GET(req: NextRequest) {
  return forwardToBackend(req, "/api/learning/accounts", async () => {
    if (isPlaceholderUri()) {
      return NextResponse.json({
        success: true,
        source: "memory_fallback",
        data: inMemoryAccounts,
        count: inMemoryAccounts.length,
      });
    }

    try {
      const db = await getDb();
      const col = db.collection(COLLECTIONS.LEARNING_ACCOUNTS);
      let accounts = await col.find({}).sort({ createdAt: 1 }).toArray();

      // Auto-seed if empty
      if (accounts.length === 0) {
        await col.insertMany(SEED_ACCOUNTS);
        accounts = await col.find({}).sort({ createdAt: 1 }).toArray();
      }

      return NextResponse.json({
        success: true,
        source: "mongodb_atlas",
        data: accounts,
        count: accounts.length,
      });
    } catch (err: any) {
      console.error("MongoDB GET learning/accounts error:", err);
      return NextResponse.json({
        success: true,
        source: "fallback_on_error",
        data: inMemoryAccounts,
        count: inMemoryAccounts.length,
        warning: err.message,
      });
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const isBatch = Array.isArray(body);
    const items = isBatch ? body : [body];

    if (isPlaceholderUri()) {
      for (const item of items) {
        const idx = inMemoryAccounts.findIndex(
          (a) =>
            a.accountId === item.accountId ||
            a.employeeId === item.employeeId ||
            (item.username && a.username.toLowerCase() === item.username.toLowerCase())
        );
        const record = {
          ...item,
          accountId: item.accountId || `ACC-${Date.now().toString(36).toUpperCase()}`,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) inMemoryAccounts[idx] = { ...inMemoryAccounts[idx], ...record };
        else inMemoryAccounts.push(record);
      }
      return NextResponse.json({
        success: true,
        source: "memory_fallback",
        count: items.length,
        data: isBatch ? items : items[0],
      });
    }

    const db = await getDb();
    const col = db.collection(COLLECTIONS.LEARNING_ACCOUNTS);

    for (const item of items) {
      const filter: any = {};
      if (item.accountId) filter.accountId = item.accountId;
      else if (item.employeeId) filter.employeeId = item.employeeId;
      else if (item.username) filter.username = item.username.toLowerCase();

      const { _id, ...cleanItem } = item;
      await col.updateOne(
        filter,
        {
          $set: {
            ...cleanItem,
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: {
            accountId: item.accountId || `ACC-${Date.now().toString(36).toUpperCase()}`,
            createdAt: item.createdAt || new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({
      success: true,
      source: "mongodb_atlas",
      count: items.length,
      message: `Successfully saved ${items.length} account(s) to MongoDB Atlas.`,
    });
  } catch (err: any) {
    console.error("MongoDB POST learning/accounts error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Missing id parameter." }, { status: 400 });

    if (isPlaceholderUri()) {
      inMemoryAccounts = inMemoryAccounts.filter((a) => a.accountId !== id && a.employeeId !== id);
      return NextResponse.json({ success: true, source: "memory_fallback" });
    }

    const db = await getDb();
    const col = db.collection(COLLECTIONS.LEARNING_ACCOUNTS);
    await col.deleteOne({ $or: [{ accountId: id }, { employeeId: id }] });

    return NextResponse.json({ success: true, source: "mongodb_atlas" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
