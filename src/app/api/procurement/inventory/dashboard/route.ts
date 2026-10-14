import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { type InventoryItem, type InventoryTransaction } from "@/lib/inventoryAssetTypes";
import { enforceProcurementAccess } from "@/lib/procurementAuth";

export async function GET(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "V");
    if (!auth.authorized) return auth.response;

    const itemsCol = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);
    const txnCol = await getCollection<InventoryTransaction>(COLLECTIONS.INVENTORY_TRANSACTIONS);

    const items = await itemsCol.find({}).toArray();
    const recentTxns = await txnCol.find({}).sort({ createdAt: -1 }).limit(10).toArray();

    const totalStockItems = items.length;
    const totalStockQuantity = items.reduce((sum, it) => sum + (it.currentBalance || 0), 0);
    const totalStockValue = items.reduce((sum, it) => sum + (it.totalValue || 0), 0);
    const lowStockItems = items.filter((it) => it.status === "Low Stock").length;
    const outOfStockItems = items.filter((it) => it.status === "Out of Stock" || it.currentBalance === 0).length;

    // Expiring items (within 60 days)
    const now = new Date();
    const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const expiringItems = items.filter((it) => {
      if (!it.expiryDate) return false;
      const exp = new Date(it.expiryDate);
      return exp >= now && exp <= sixtyDaysLater;
    }).length;

    // Items by warehouse
    const byWarehouse: Record<string, { count: number; value: number }> = {};
    items.forEach((it) => {
      const wh = it.warehouseName || "Central Warehouse";
      if (!byWarehouse[wh]) byWarehouse[wh] = { count: 0, value: 0 };
      byWarehouse[wh].count += it.currentBalance || 0;
      byWarehouse[wh].value += it.totalValue || 0;
    });

    // Items by programme
    const byProgramme: Record<string, { count: number; value: number }> = {};
    items.forEach((it) => {
      const prg = it.programmeName || "Institutional Stock";
      if (!byProgramme[prg]) byProgramme[prg] = { count: 0, value: 0 };
      byProgramme[prg].count += it.currentBalance || 0;
      byProgramme[prg].value += it.totalValue || 0;
    });

    return NextResponse.json({
      success: true,
      metrics: {
        totalStockItems,
        totalStockQuantity,
        totalStockValue,
        lowStockItems,
        outOfStockItems,
        expiringItems,
      },
      breakdowns: {
        byWarehouse,
        byProgramme,
      },
      recentTransactions: recentTxns,
      permissions: {
        canView: true,
        canFull: auth.level === "F",
        level: auth.level,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/inventory/dashboard] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load dashboard metrics" }, { status: 500 });
  }
}
