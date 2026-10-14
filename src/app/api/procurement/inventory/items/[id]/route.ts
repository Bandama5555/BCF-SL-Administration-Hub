import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { type InventoryItem, type InventoryTransaction } from "@/lib/inventoryAssetTypes";
import {
  enforceProcurementAccess,
  logProcurementAudit,
  dispatchProcurementNotification,
} from "@/lib/procurementAuth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await enforceProcurementAccess(req, "inventory-management", "V");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);
    const item = await col.findOne({ $or: [{ id }, { stockCode: id }] });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Get movement transactions
    const txnCol = await getCollection<InventoryTransaction>(COLLECTIONS.INVENTORY_TRANSACTIONS);
    const transactions = await txnCol
      .find({ itemId: item.id })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ success: true, item, transactions });
  } catch (err: any) {
    console.error("[GET /api/procurement/inventory/items/:id] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load item" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await enforceProcurementAccess(req, "inventory-management", "F");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);
    const item = await col.findOne({ $or: [{ id }, { stockCode: id }] });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = await req.json();
    const updateFields: Partial<InventoryItem> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name) updateFields.name = String(body.name).trim();
    if (body.description !== undefined) updateFields.description = String(body.description).trim();
    if (body.category) updateFields.category = body.category;
    if (body.subcategory !== undefined) updateFields.subcategory = body.subcategory;
    if (body.brand !== undefined) updateFields.brand = body.brand;
    if (body.model !== undefined) updateFields.model = body.model;
    if (body.sku !== undefined) updateFields.sku = body.sku;
    if (body.unit) updateFields.unit = body.unit;
    if (body.barcode !== undefined) updateFields.barcode = body.barcode;
    if (body.itemClass) updateFields.itemClass = body.itemClass;
    if (body.minStockLevel !== undefined) updateFields.minStockLevel = parseFloat(body.minStockLevel) || 0;
    if (body.maxStockLevel !== undefined) updateFields.maxStockLevel = parseFloat(body.maxStockLevel) || 100;
    if (body.reorderLevel !== undefined) updateFields.reorderLevel = parseFloat(body.reorderLevel) || 10;
    if (body.reorderQuantity !== undefined) updateFields.reorderQuantity = parseFloat(body.reorderQuantity) || 20;
    if (body.unitCost !== undefined) updateFields.unitCost = parseFloat(body.unitCost) || 0;
    if (body.warehouseId !== undefined) updateFields.warehouseId = body.warehouseId;
    if (body.warehouseName !== undefined) updateFields.warehouseName = body.warehouseName;
    if (body.programmeId !== undefined) updateFields.programmeId = body.programmeId;
    if (body.programmeName !== undefined) updateFields.programmeName = body.programmeName;
    if (body.donorId !== undefined) updateFields.donorId = body.donorId;
    if (body.donorName !== undefined) updateFields.donorName = body.donorName;
    if (body.expiryDate !== undefined) updateFields.expiryDate = body.expiryDate;

    // Recalculate status & total value based on updated values
    const currentBal = item.currentBalance;
    const cost = updateFields.unitCost !== undefined ? updateFields.unitCost : item.unitCost;
    const reorder = updateFields.reorderLevel !== undefined ? updateFields.reorderLevel : item.reorderLevel;

    updateFields.totalValue = currentBal * cost;
    if (currentBal === 0) {
      updateFields.status = "Out of Stock";
    } else if (currentBal <= reorder) {
      updateFields.status = "Low Stock";
    } else {
      updateFields.status = "In Stock";
    }

    await col.updateOne({ id: item.id }, { $set: updateFields });
    const updated = await col.findOne({ id: item.id });

    await logProcurementAudit({
      action: "INVENTORY_ITEM_UPDATED",
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "inventory-management",
      recordId: item.id,
      details: updateFields,
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    console.error("[PUT /api/procurement/inventory/items/:id] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await enforceProcurementAccess(req, "inventory-management", "F");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);
    const item = await col.findOne({ $or: [{ id }, { stockCode: id }] });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Per Rule 5: Records are NEVER hard-deleted; status set to Discontinued
    await col.updateOne(
      { id: item.id },
      { $set: { status: "Discontinued", updatedAt: new Date().toISOString() } }
    );

    await logProcurementAudit({
      action: "INVENTORY_ITEM_DISCONTINUED",
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "inventory-management",
      recordId: item.id,
      details: { previousStatus: item.status, newStatus: "Discontinued" },
    });

    return NextResponse.json({
      success: true,
      message: `Item "${item.name}" marked as Discontinued. Full history preserved.`,
    });
  } catch (err: any) {
    console.error("[DELETE /api/procurement/inventory/items/:id] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to discontinue item" }, { status: 500 });
  }
}
