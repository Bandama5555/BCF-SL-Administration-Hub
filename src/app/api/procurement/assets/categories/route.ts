import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import {
  type CategoryRegisterItem,
  DEFAULT_ASSET_CATEGORIES,
  type AssetRecord,
} from "@/lib/inventoryAssetTypes";
import {
  enforceProcurementAccess,
  logProcurementAudit,
} from "@/lib/procurementAuth";

export async function GET(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "asset-management", "V");
    if (!auth.authorized) return auth.response;

    const catCol = await getCollection<CategoryRegisterItem>(COLLECTIONS.ASSET_CATEGORIES);
    const customCats = await catCol.find({}).toArray();

    // Merge default categories with custom/persisted categories
    const categoryMap = new Map<string, CategoryRegisterItem>();
    DEFAULT_ASSET_CATEGORIES.forEach((c) => categoryMap.set(c.name.toLowerCase().trim(), { ...c }));
    customCats.forEach((c: any) => {
      const key = (c.name || "").toLowerCase().trim();
      if (key) categoryMap.set(key, { ...categoryMap.get(key), ...c });
    });

    const categories = Array.from(categoryMap.values());

    return NextResponse.json({
      success: true,
      categories,
      permissions: {
        canView: true,
        canFull: auth.level === "F",
        level: auth.level,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/assets/categories] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load asset categories" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "asset-management", "F");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const {
      code,
      name,
      classification = "Tangible Fixed Asset",
      glAccountCode,
      subcategories = [],
      usefulLifeYears = 5,
      depreciationMethod = "Straight Line",
      annualDepreciationRate = 20,
      residualPercentage = 5,
      responsibleDepartment = "Procurement & Asset Unit",
      description = "",
      status = "Active",
      icon = "category",
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    }

    const catCol = await getCollection<CategoryRegisterItem>(COLLECTIONS.ASSET_CATEGORIES);
    const existing = await catCol.findOne({
      $or: [
        { code: code ? code.trim() : undefined },
        { name: name.trim() },
      ],
    });

    const now = new Date().toISOString();
    const finalCode = (code || `CAT-${name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`).trim();

    const categoryDoc: CategoryRegisterItem = {
      id: existing?.id || finalCode,
      code: finalCode,
      name: name.trim(),
      icon: icon || "category",
      classification,
      glAccountCode: glAccountCode || "1590 - Fixed Assets",
      subcategories: Array.isArray(subcategories)
        ? subcategories
        : String(subcategories)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
      usefulLifeYears: Number(usefulLifeYears) || 5,
      depreciationMethod,
      annualDepreciationRate: Number(annualDepreciationRate) || (usefulLifeYears ? +(100 / usefulLifeYears).toFixed(1) : 20),
      residualPercentage: Number(residualPercentage) || 5,
      responsibleDepartment: responsibleDepartment || "Administration & Logistics",
      description: description || "",
      status: status || "Active",
      updatedAt: now,
      createdAt: existing?.createdAt || now,
    };

    if (existing) {
      await catCol.updateOne(
        { _id: (existing as any)._id },
        { $set: categoryDoc }
      );
    } else {
      await catCol.insertOne(categoryDoc as any);
    }

    await logProcurementAudit({
      action: existing ? "ASSET_CATEGORY_UPDATED" : "ASSET_CATEGORY_CREATED",
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "asset-management",
      recordId: finalCode,
      details: categoryDoc,
    });

    return NextResponse.json({
      success: true,
      category: categoryDoc,
      message: existing ? "Category policy updated successfully" : "New asset category created successfully",
    });
  } catch (err: any) {
    console.error("[POST /api/procurement/assets/categories] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save category" },
      { status: 500 }
    );
  }
}
