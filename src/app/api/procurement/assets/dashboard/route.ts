import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { type AssetRecord } from "@/lib/inventoryAssetTypes";
import { enforceProcurementAccess } from "@/lib/procurementAuth";

export async function GET(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "asset-management", "V");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<AssetRecord>(COLLECTIONS.ASSETS);
    const assets = await col.find({}).toArray();

    const totalAssets = assets.length;
    const totalOriginalCost = assets.reduce((sum, a) => sum + (a.assetCost || 0), 0);
    const totalAccumulatedDepreciation = assets.reduce((sum, a) => sum + (a.accumulatedDepreciation || 0), 0);
    const totalNetBookValue = assets.reduce((sum, a) => sum + (a.netBookValue || 0), 0);

    const statusCounts: Record<string, number> = {
      Active: 0,
      Assigned: 0,
      "In Storage": 0,
      "Under Maintenance": 0,
      Damaged: 0,
      Lost: 0,
      Stolen: 0,
      Disposed: 0,
      Transferred: 0,
      Retired: 0,
    };

    const categoryBreakdown: Record<string, { count: number; value: number }> = {};
    const departmentBreakdown: Record<string, { count: number; value: number }> = {};

    assets.forEach((a) => {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;

      const cat = a.category || "General Assets";
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, value: 0 };
      categoryBreakdown[cat].count += 1;
      categoryBreakdown[cat].value += a.assetCost || 0;

      const dept = a.department || "Operations";
      if (!departmentBreakdown[dept]) departmentBreakdown[dept] = { count: 0, value: 0 };
      departmentBreakdown[dept].count += 1;
      departmentBreakdown[dept].value += a.assetCost || 0;
    });

    return NextResponse.json({
      success: true,
      metrics: {
        totalAssets,
        totalAssetCost: totalOriginalCost,
        totalOriginalCost,
        totalAccumulatedDepreciation,
        totalNetBookValue,
        statusCounts,
      },
      categoryBreakdown,
      departmentBreakdown,
      permissions: {
        canView: true,
        canFull: auth.level === "F",
        level: auth.level,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/assets/dashboard] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load asset dashboard metrics" }, { status: 500 });
  }
}
