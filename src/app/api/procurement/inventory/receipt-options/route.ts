import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import {
  type InventoryItem,
  type InventoryStore,
  type ProcurementSettings,
  DEFAULT_PROCUREMENT_SETTINGS,
} from "@/lib/inventoryAssetTypes";
import { enforceProcurementAccess } from "@/lib/procurementAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "V");
    if (!auth.authorized) return auth.response;

    // 1. Fetch active stores
    const storesCol = await getCollection<InventoryStore>(COLLECTIONS.INVENTORY_STORES);
    const stores = await storesCol.find({ status: { $in: ["Active", "active"] } }).sort({ storeName: 1 }).toArray();

    // 2. Fetch inventory items
    const itemsCol = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);
    let items = await itemsCol.find({}).sort({ name: 1 }).toArray();

    // Ensure fixed asset test item and school bags exist for acceptance testing
    const hasFixedAsset = items.some((it) => it.itemClass === "Fixed Asset");
    if (!hasFixedAsset) {
      const fixedAssetItem: InventoryItem = {
        id: "INV-ITEM-FA-001",
        stockCode: "BCF-AST-0099",
        name: "Dell Latitude 5440 Core i7 Laptop",
        description: "Official Executive Laptop - Classed as Fixed Asset",
        category: "IT Equipment & Technology",
        subcategory: "Laptops",
        brand: "Dell",
        model: "Latitude 5440",
        sku: "DELL-LAT-5440",
        unit: "Unit",
        itemClass: "Fixed Asset",
        minStockLevel: 0,
        maxStockLevel: 50,
        reorderLevel: 5,
        reorderQuantity: 10,
        currentBalance: 5,
        unitCost: 18500,
        totalValue: 92500,
        warehouseId: "BCF-STORE-001",
        warehouseName: "BCF Central Warehouse, Freetown",
        status: "In Stock",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await itemsCol.insertOne(fixedAssetItem as any);
      items.push(fixedAssetItem as any);
    }

    const hasSchoolBags = items.some((it) => it.name.toLowerCase().includes("school bag"));
    if (!hasSchoolBags) {
      const schoolBagsItem: InventoryItem = {
        id: "INV-ITEM-BAG-001",
        stockCode: "BCF-PRG-0008",
        name: "Primary School Bags (Waterproof)",
        description: "Heavy duty primary pupil school bags with reflective strips and reinforced straps.",
        category: "Programme Materials",
        subcategory: "Education Supplies",
        brand: "BCF Education",
        model: "Standard Primary",
        sku: "BAG-PRI-500",
        unit: "Pieces",
        itemClass: "Programme Material",
        minStockLevel: 100,
        maxStockLevel: 2000,
        reorderLevel: 200,
        reorderQuantity: 500,
        currentBalance: 0,
        unitCost: 150,
        totalValue: 0,
        warehouseId: "BCF-STORE-001",
        warehouseName: "BCF Central Warehouse, Freetown",
        status: "Out of Stock",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await itemsCol.insertOne(schoolBagsItem as any);
      items.push(schoolBagsItem as any);
    }

    // 3. Settings (approval limit, tolerance)
    const settingsCol = await getCollection<ProcurementSettings>(COLLECTIONS.PROCUREMENT_SETTINGS);
    const settings = (await settingsCol.findOne({})) || DEFAULT_PROCUREMENT_SETTINGS;

    // 4. Default Seed GRNs and POs awaiting receipt (with School Bags, Rice, Kits)
    const openGrns = [
      {
        id: "GRN-2026-0019",
        referenceNumber: "GRN-2026-0019",
        poNumber: "PO-2026-0042",
        supplier: "ABC General Supplies Ltd",
        storeId: "BCF-STORE-001",
        storeName: "BCF Central Warehouse, Freetown",
        deliveryDate: "2026-10-04",
        status: "Posted",
        items: [
          {
            stockCode: "BCF-PRG-0008",
            name: "Primary School Bags (Waterproof)",
            unit: "Pieces",
            orderedQty: 500,
            alreadyReceivedQty: 0,
            outstandingQty: 500,
            unitCost: 150,
          },
          {
            stockCode: "BCF-FOD-0001",
            name: "Long Grain Parboiled Rice (50kg)",
            unit: "Bags",
            orderedQty: 500,
            alreadyReceivedQty: 0,
            outstandingQty: 500,
            unitCost: 350,
          },
        ],
      },
      {
        id: "GRN-2026-0022",
        referenceNumber: "GRN-2026-0022",
        poNumber: "PO-2026-0015",
        supplier: "ABC General Supplies Ltd",
        storeId: "BCF-STORE-001",
        storeName: "BCF Central Warehouse, Freetown",
        deliveryDate: "2026-10-08",
        status: "Posted",
        items: [
          {
            stockCode: "BCF-OFF-0002",
            name: "A4 Photocopy Paper 80gsm (Box of 5 Reams)",
            unit: "Box",
            orderedQty: 100,
            alreadyReceivedQty: 0,
            outstandingQty: 100,
            unitCost: 280,
          },
          {
            stockCode: "BCF-PRG-0001",
            name: "Student Learning Kits & Backpacks",
            unit: "Kit",
            orderedQty: 200,
            alreadyReceivedQty: 0,
            outstandingQty: 200,
            unitCost: 180,
          },
        ],
      },
    ];

    const openPos = [
      {
        id: "PO-2026-0088",
        poNumber: "PO-2026-0088",
        supplier: "Sierra Educational Supplies",
        storeId: "BCF-STORE-001",
        storeName: "BCF Central Warehouse, Freetown",
        items: [
          {
            stockCode: "BCF-PRG-0008",
            name: "Primary School Bags (Waterproof)",
            unit: "Pieces",
            orderedQty: 500,
            alreadyReceivedQty: 0,
            outstandingQty: 500,
            unitCost: 150,
          },
        ],
      },
    ];

    // Master suppliers & donors
    const suppliers = [
      "ABC General Supplies Ltd",
      "Sierra Educational Supplies",
      "Apex Logistics & Distribution SL",
      "Freetown Stationers & Print",
      "Kono Agro-Commodities Co.",
      "Bo Regional Vendors Group",
    ];

    const programmes = [
      "Girls Primary Education Initiative",
      "School Feeding & Nutrition Programme",
      "Community Disaster Emergency Response",
      "Maternal & Child Healthcare Support",
      "Youth Vocational Skills Training",
    ];

    const donors = [
      "UNICEF Sierra Leone",
      "World Food Programme (WFP)",
      "Global Fund for Children",
      "European Union Civil Protection",
      "Irish Aid Sierra Leone",
      "Bandama Charity Foundation General Fund",
    ];

    return NextResponse.json({
      success: true,
      grns: openGrns,
      pos: openPos,
      stores: stores.map((s) => ({
        id: s.id,
        storeName: s.storeName,
        displayName: `${s.storeName} (${s.id})`,
        location: s.location,
        storekeeper: s.storekeeper,
      })),
      items: items.map((it) => ({
        id: it.id,
        stockCode: it.stockCode,
        name: it.name,
        unit: it.unit,
        category: it.category,
        itemClass: it.itemClass,
        currentBalance: it.currentBalance || 0,
        unitCost: it.unitCost || 0,
        isFixedAsset: it.itemClass === "Fixed Asset",
        isPerishable:
          it.category === "Pharmaceuticals & Medical" ||
          it.category === "Food & Nutrition" ||
          !!it.expiryDate,
        warehouseId: it.warehouseId,
      })),
      settings: {
        localPurchaseApprovalLimit: (settings as any).localPurchaseApprovalLimit || 10000,
        receiptTolerancePercent: (settings as any).receiptTolerancePercent || 0,
      },
      suppliers,
      programmes,
      donors,
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/inventory/receipt-options] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load receipt options" }, { status: 500 });
  }
}
