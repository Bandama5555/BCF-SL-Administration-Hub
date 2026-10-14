import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { type InventoryItem } from "@/lib/inventoryAssetTypes";
import {
  enforceProcurementAccess,
  logProcurementAudit,
  dispatchProcurementNotification,
} from "@/lib/procurementAuth";

export async function GET(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "V");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);

    const search = req.nextUrl.searchParams.get("search")?.toLowerCase().trim();
    const category = req.nextUrl.searchParams.get("category");
    const itemClass = req.nextUrl.searchParams.get("itemClass");
    const status = req.nextUrl.searchParams.get("status");
    const warehouseId = req.nextUrl.searchParams.get("warehouseId");

    const query: any = {};
    if (category && category !== "ALL") query.category = category;
    if (itemClass && itemClass !== "ALL") query.itemClass = itemClass;
    if (status && status !== "ALL") query.status = status;
    if (warehouseId && warehouseId !== "ALL") query.warehouseId = warehouseId;

    let items = await col.find(query).sort({ updatedAt: -1 }).toArray();

    if (search) {
      items = items.filter(
        (it) =>
          it.name.toLowerCase().includes(search) ||
          it.stockCode.toLowerCase().includes(search) ||
          (it.sku && it.sku.toLowerCase().includes(search)) ||
          (it.brand && it.brand.toLowerCase().includes(search)) ||
          (it.description && it.description.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      success: true,
      items,
      permissions: {
        canView: true,
        canFull: auth.level === "F",
        level: auth.level,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/inventory/items] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load inventory items" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "F");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const {
      name,
      stockCode,
      description,
      category,
      subcategory,
      brand,
      model,
      sku,
      unit,
      barcode,
      serialNumber,
      batchNumber,
      itemClass,
      minStockLevel,
      maxStockLevel,
      reorderLevel,
      reorderQuantity,
      currentBalance = 0,
      unitCost = 0,
      warehouseId,
      warehouseName,
      programmeId,
      programmeName,
      donorId,
      donorName,
      expiryDate,
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Item name is required." }, { status: 400 });
    }
    if (!stockCode || !String(stockCode).trim()) {
      return NextResponse.json({ error: "Stock code is required (e.g. BCF-ICT-0001)." }, { status: 400 });
    }
    if (!itemClass) {
      return NextResponse.json({ error: "Item classification is required." }, { status: 400 });
    }

    const col = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);

    // Check duplicate stock code
    const existing = await col.findOne({ stockCode: stockCode.trim() });
    if (existing) {
      return NextResponse.json({ error: `Stock code "${stockCode}" is already in use.` }, { status: 400 });
    }

    const parsedBalance = Math.max(0, parseFloat(currentBalance) || 0);
    const parsedUnitCost = Math.max(0, parseFloat(unitCost) || 0);
    const parsedMin = Math.max(0, parseFloat(minStockLevel) || 0);
    const parsedMax = Math.max(0, parseFloat(maxStockLevel) || 100);
    const parsedReorder = Math.max(0, parseFloat(reorderLevel) || 10);
    const parsedReorderQty = Math.max(0, parseFloat(reorderQuantity) || 20);

    let calculatedStatus: InventoryItem["status"] = "In Stock";
    if (parsedBalance === 0) {
      calculatedStatus = "Out of Stock";
    } else if (parsedBalance <= parsedReorder) {
      calculatedStatus = "Low Stock";
    }

    const nowIso = new Date().toISOString();
    const itemId = `INV-ITEM-${Date.now().toString().slice(-6)}`;

    const newItem: InventoryItem = {
      id: itemId,
      stockCode: stockCode.trim(),
      name: name.trim(),
      description: (description || "").trim(),
      category: category || "General Supplies",
      subcategory: subcategory || "",
      brand: brand || "",
      model: model || "",
      sku: sku || "",
      unit: unit || "Unit",
      barcode: barcode || "",
      serialNumber: serialNumber || undefined,
      batchNumber: batchNumber || undefined,
      itemClass,
      minStockLevel: parsedMin,
      maxStockLevel: parsedMax,
      reorderLevel: parsedReorder,
      reorderQuantity: parsedReorderQty,
      currentBalance: parsedBalance,
      unitCost: parsedUnitCost,
      totalValue: parsedBalance * parsedUnitCost,
      warehouseId: warehouseId || undefined,
      warehouseName: warehouseName || undefined,
      programmeId: programmeId || undefined,
      programmeName: programmeName || undefined,
      donorId: donorId || undefined,
      donorName: donorName || undefined,
      expiryDate: expiryDate || null,
      status: calculatedStatus,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await col.insertOne(newItem as any);

    // Audit trail
    await logProcurementAudit({
      action: "INVENTORY_ITEM_CREATED",
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "inventory-management",
      recordId: newItem.id,
      details: {
        stockCode: newItem.stockCode,
        name: newItem.name,
        itemClass: newItem.itemClass,
        currentBalance: newItem.currentBalance,
        status: newItem.status,
      },
    });

    // Alert notification if created at low or out of stock
    if (newItem.status === "Low Stock" || newItem.status === "Out of Stock") {
      await dispatchProcurementNotification({
        title: `${newItem.status.toUpperCase()}: ${newItem.name}`,
        message: `${newItem.name} (${newItem.stockCode}) balance is ${newItem.currentBalance} ${newItem.unit} (reorder point: ${newItem.reorderLevel}).`,
        type: newItem.status === "Out of Stock" ? "alert" : "warning",
        targetRoles: ["PRC", "SA"],
        tab: "inventory-management",
        itemId: newItem.id,
      });
    }

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/procurement/inventory/items] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to create inventory item" }, { status: 500 });
  }
}
