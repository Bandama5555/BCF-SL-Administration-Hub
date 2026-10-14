import { NextRequest, NextResponse } from "next/server";
import { getDb, isPlaceholderUri, COLLECTIONS } from "@/lib/mongodb";
import { forwardToBackend } from "@/lib/backend";

export const dynamic = "force-dynamic";

// In-memory fallback cache when credentials are not yet configured in .env
const memoryStore: Record<string, any[]> = {};

export async function GET(req: NextRequest) {
  return forwardToBackend(req, "/api/db/sync", async () => {
    const { searchParams } = new URL(req.url);
    const collectionName = searchParams.get("collection");

    if (!collectionName) {
      return NextResponse.json(
        { success: false, error: "Missing required 'collection' parameter." },
        { status: 400 }
      );
    }

    if (isPlaceholderUri()) {
      const data = memoryStore[collectionName] || [];
      return NextResponse.json({
        success: true,
        source: "memory_fallback",
        message:
          "Using local fallback cache. Configure MONGO_URI in frontend/.env for live Atlas connection.",
        collection: collectionName,
        count: data.length,
        data,
      });
    }

    try {
      const db = await getDb();
      const collection = db.collection(collectionName);
      const docs = await collection.find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray();

      return NextResponse.json({
        success: true,
        source: "mongodb_atlas",
        collection: collectionName,
        count: docs.length,
        data: docs,
      });
    } catch (err: any) {
      console.warn(`Querying MongoDB collection ${collectionName} fallback:`, err.message);
      const data = memoryStore[collectionName] || [];
      return NextResponse.json({
        success: true,
        source: "memory_fallback_after_error",
        warning: `MongoDB Atlas connection error (${err.message}). Returning local memory store. Check frontend/.env credentials.`,
        collection: collectionName,
        count: data.length,
        data,
      });
    }
  });
}

export async function POST(req: NextRequest) {
  return forwardToBackend(req, "/api/db/sync", async () => {
    let body: any = null;
  try {
    body = await req.json();
    const { collection: collectionName, documents, keyField = "id", replace = false } = body;

    if (!collectionName || !Array.isArray(documents)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload: collection and documents array required." },
        { status: 400 }
      );
    }

    if (isPlaceholderUri()) {
      if (replace) {
        memoryStore[collectionName] = [...documents];
      } else {
        const existing = memoryStore[collectionName] || [];
        const map = new Map<string, Record<string, any>>();
        existing.forEach((d: Record<string, any>) => map.set(d[keyField] || d._id || JSON.stringify(d), d));
        documents.forEach((d: Record<string, any>) => map.set(d[keyField] || d._id || JSON.stringify(d), d));
        memoryStore[collectionName] = Array.from(map.values());
      }

      return NextResponse.json({
        success: true,
        source: "memory_fallback",
        message: "Documents saved to local fallback cache. Update frontend/.env with Atlas password for persistent storage.",
        collection: collectionName,
        syncedCount: documents.length,
        totalCount: (memoryStore[collectionName] || []).length,
      });
    }

    const db = await getDb();
    const collection = db.collection(collectionName);

    if (replace) {
      await collection.deleteMany({});
      if (documents.length > 0) {
        await collection.insertMany(documents);
      }
    } else {
      // Upsert each document
      for (const doc of documents) {
        const idVal = doc[keyField] || doc.employeeId || doc.accountId || doc._id;
        if (idVal) {
          const filter: any = {};
          if (doc[keyField]) filter[keyField] = doc[keyField];
          else if (doc.employeeId) filter.employeeId = doc.employeeId;
          else if (doc.accountId) filter.accountId = doc.accountId;
          else filter._id = doc._id;

          const { _id, ...cleanDoc } = doc;
          await collection.updateOne(filter, { $set: { ...cleanDoc, updatedAt: new Date().toISOString() } }, { upsert: true });
        } else {
          await collection.insertOne({ ...doc, createdAt: doc.createdAt || new Date().toISOString() });
        }
      }
    }

    const totalCount = await collection.countDocuments();

    return NextResponse.json({
      success: true,
      source: "mongodb_atlas",
      collection: collectionName,
      syncedCount: documents.length,
      totalCount,
    });
  } catch (err: any) {
    console.warn("MongoDB write fallback:", err.message);

    // Save to resilient fallback cache
    if (body && body.collection && Array.isArray(body.documents)) {
      const { collection: collectionName, documents, keyField = "id", replace = false } = body;
      if (replace) {
        memoryStore[collectionName] = [...documents];
      } else {
        const existing = memoryStore[collectionName] || [];
        const map = new Map<string, Record<string, any>>();
        existing.forEach((d: Record<string, any>) => map.set(d[keyField] || d._id || JSON.stringify(d), d));
        documents.forEach((d: Record<string, any>) => map.set(d[keyField] || d._id || JSON.stringify(d), d));
        memoryStore[collectionName] = Array.from(map.values());
      }

      return NextResponse.json({
        success: true,
        source: "memory_fallback_after_error",
        warning: `MongoDB Atlas connection error (${err.message}). Data saved to fallback memory store. Check frontend/.env credentials.`,
        collection: collectionName,
        syncedCount: documents.length,
        totalCount: (memoryStore[collectionName] || []).length,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to write to MongoDB.",
      },
      { status: 500 }
    );
  }
  });
}
