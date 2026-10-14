import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import {
  type InventoryItem,
  type InventoryTransaction,
  type AssetRecord,
  type ProcurementSettings,
  DEFAULT_PROCUREMENT_SETTINGS,
} from "@/lib/inventoryAssetTypes";
import {
  enforceProcurementAccess,
  logProcurementAudit,
  dispatchProcurementNotification,
} from "@/lib/procurementAuth";

export async function POST(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "F");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const grn = body.grn || body;
    const po = body.po || {};

    const rawItems = grn.itemsReceived || grn.lines || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { error: "Invalid GRN payload: itemsReceived or lines array is required." },
        { status: 400 }
      );
    }

    const grnNumber = grn.grnNumber || grn.id || `GRN-${Date.now()}`;
    const poNumber = po.poNumber || grn.poNumber || grn.poId || "PO-UNLINKED";
    const txnId = grn.txnId || po.txnId || `BCF-TXN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const supplierName = grn.supplierName || po.supplierName || "Accredited Supplier";
    const deliveryDate = grn.deliveryDate || new Date().toISOString().split("T")[0];
    const warehouseId = grn.warehouseId || "BCF-STORE-001";
    const warehouseName = grn.warehouseName || "BCF Central Warehouse, Freetown";

    // 1. Check Idempotency: avoid creating duplicate assets or double-adding stock
    const txnCol = await getCollection<InventoryTransaction>(COLLECTIONS.INVENTORY_TRANSACTIONS);
    const existingTxn = await txnCol.findOne({ referenceNumber: grnNumber, type: "RECEIPT" });
    const assetsCol = await getCollection<AssetRecord>(COLLECTIONS.ASSETS);
    const existingAssets = await assetsCol.find({ grnNumber }).toArray();

    if (existingTxn || existingAssets.length > 0) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: `GRN ${grnNumber} has already been routed and processed. Duplicates prevented.`,
        createdAssetsCount: existingAssets.length,
        inventoryReceiptTxnId: existingTxn?.id,
      });
    }

    // 2. Fetch Procurement Settings (capitalisation threshold)
    const settingsCol = await getCollection<ProcurementSettings>(COLLECTIONS.PROCUREMENT_SETTINGS);
    const settings = (await settingsCol.findOne({})) || DEFAULT_PROCUREMENT_SETTINGS;
    const capThreshold = settings.capitalisationThreshold || 5000;

    const itemsCol = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);
    const nowIso = new Date().toISOString();
    const year = new Date().getFullYear();

    const createdAssets: AssetRecord[] = [];
    const updatedInventoryItems: Array<{ stockCode: string; addedQty: number; newBalance: number }> = [];
    const pendingClassificationQueue: any[] = [];

    let currentAssetCount = await assetsCol.countDocuments();

    // 3. Process each line item on the GRN
    for (const line of rawItems) {
      const desc = (line.description || "").trim();
      const rawAccepted = line.quantityAccepted ?? line.acceptedQty ?? line.quantityReceived ?? line.receivedQty;
      const acceptedQty = Math.max(0, parseInt(rawAccepted) || 0);

      // Rule 6: A GRN line with rejected quantity adds ONLY the accepted quantity!
      if (acceptedQty <= 0) {
        continue;
      }

      const unitCost = Math.max(0, parseFloat(line.unitCost || line.cost || line.price) || 0);

      // Check if item exists in Inventory Master
      let matchedItem = await itemsCol.findOne({
        $or: [
          { stockCode: line.stockCode || "" },
          { name: { $regex: new RegExp(`^${desc}$`, "i") } },
          { description: { $regex: new RegExp(`^${desc}$`, "i") } },
        ],
      });

      // Classification determination:
      // - Consumable, Programme Material, Spare Part, Controlled Item -> Inventory
      // - Fixed Asset OR unitCost >= capitalisationThreshold -> Asset Management
      const isLaptopOrComputer = desc.toLowerCase().includes("laptop") || desc.toLowerCase().includes("computer") || desc.toLowerCase().includes("server");
      const isVehicle = desc.toLowerCase().includes("vehicle") || desc.toLowerCase().includes("cruiser") || desc.toLowerCase().includes("generator");
      const isSchoolBagOrBook = desc.toLowerCase().includes("school bag") || desc.toLowerCase().includes("book") || desc.toLowerCase().includes("paper");

      let isFixedAsset =
        matchedItem?.itemClass === "Fixed Asset" ||
        unitCost >= capThreshold ||
        isLaptopOrComputer ||
        isVehicle;

      // Force programme supplies like school bags to be inventory regardless of total line cost
      if (isSchoolBagOrBook || matchedItem?.itemClass === "Programme Material" || matchedItem?.itemClass === "Consumable") {
        isFixedAsset = false;
      }

      if (isFixedAsset) {
        // ─── ROUTE TO ASSET MANAGEMENT ───────────────────────────
        // Creates exactly acceptedQty individual asset records with unique tags!
        for (let i = 0; i < acceptedQty; i++) {
          currentAssetCount++;
          const seqNum = String(currentAssetCount).padStart(6, "0");
          const assetTag = `BCF-AST-${year}-${seqNum}`;

          const assetRecord: AssetRecord = {
            id: assetTag,
            assetTag,
            name: desc,
            category: isVehicle ? "Vehicles & Transport" : "IT Equipment & Technology",
            subcategory: isLaptopOrComputer ? "Laptops" : isVehicle ? "Operational Fleet" : "Capital Equipment",
            description: `${desc} — Intake via GRN #${grnNumber} (PO #${poNumber})`,
            brand: line.brand || (isLaptopOrComputer ? "Lenovo" : isVehicle ? "Toyota" : "Generic OEM"),
            model: line.model || "Official BCF-SL Deployment",
            serialNumber: line.serialNumbers && line.serialNumbers[i] ? line.serialNumbers[i] : `SN-${year}-${Math.floor(100000 + Math.random() * 900000)}`,
            barcode: assetTag,
            qrCodeData: `https://bcf-sl.org/asset/${assetTag}`,
            procurementId: grn.procurementId || po.procurementId,
            txnId,
            prNumber: po.prId || grn.prId,
            poNumber,
            grnNumber,
            supplier: supplierName,
            purchaseDate: deliveryDate,
            purchaseCost: unitCost || 15000,
            department: grn.department || po.department || "Operations",
            programme: grn.programme || po.programme,
            donor: grn.donor || po.donor,
            location: warehouseName,
            responsibleOfficer: grn.receivedBy || auth.user.name,
            assetCost: unitCost || 15000,
            currency: "NLe",
            acquisitionDate: deliveryDate,
            depreciationMethod: "Straight Line",
            usefulLife: isVehicle ? 5 : 3,
            residualValue: (unitCost || 15000) * 0.05,
            accumulatedDepreciation: 0,
            netBookValue: unitCost || 15000,
            status: "In Storage",
            assignments: [],
            transfers: [],
            maintenance: [],
            inspections: [],
            incidents: [],
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          createdAssets.push(assetRecord);
        }
      } else {
        // ─── ROUTE TO INVENTORY MANAGEMENT ───────────────────────
        let itemToUpdate: any = matchedItem;

        if (!itemToUpdate) {
          // Auto-register into Item Master
          const itemSeq = await itemsCol.countDocuments();
          const stockCode = `BCF-${desc.slice(0, 3).toUpperCase()}-${String(itemSeq + 1).padStart(4, "0")}`;
          const newItemId = `INV-ITEM-${Date.now().toString().slice(-6)}`;

          const newItem: InventoryItem = {
            id: newItemId,
            stockCode,
            name: desc,
            description: `${desc} — Registered via GRN #${grnNumber}`,
            category: "Programme Materials",
            subcategory: "General Supplies",
            brand: line.brand || "BCF Standard",
            model: line.model || "",
            sku: `SKU-${stockCode}`,
            unit: line.unit || "Unit",
            itemClass: "Programme Material",
            minStockLevel: 50,
            maxStockLevel: 1000,
            reorderLevel: 100,
            reorderQuantity: 200,
            currentBalance: acceptedQty,
            unitCost,
            totalValue: acceptedQty * unitCost,
            warehouseId,
            warehouseName,
            programmeName: grn.programme || po.programme,
            donorName: grn.donor || po.donor,
            status: "In Stock",
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          await itemsCol.insertOne(newItem as any);
          itemToUpdate = newItem;
        } else {
          // Increment existing inventory balance
          const previousBal = itemToUpdate.currentBalance || 0;
          const newBal = previousBal + acceptedQty;
          const newTotValue = newBal * (itemToUpdate.unitCost || unitCost);

          let newStatus: InventoryItem["status"] = "In Stock";
          if (newBal === 0) newStatus = "Out of Stock";
          else if (newBal <= itemToUpdate.reorderLevel) newStatus = "Low Stock";

          await itemsCol.updateOne(
            { id: itemToUpdate.id },
            {
              $set: {
                currentBalance: newBal,
                totalValue: newTotValue,
                status: newStatus,
                updatedAt: nowIso,
              },
            }
          );

          itemToUpdate = {
            ...itemToUpdate,
            currentBalance: newBal,
            totalValue: newTotValue,
            status: newStatus,
          };
        }

        const validItem: InventoryItem = itemToUpdate!;

        // Record RECEIPT transaction
        const receiptTxn: InventoryTransaction = {
          id: `INV-REC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          type: "RECEIPT",
          txnId,
          referenceNumber: grnNumber,
          date: deliveryDate,
          itemId: validItem.id,
          stockCode: validItem.stockCode,
          itemName: validItem.name,
          storeId: warehouseId,
          storeName: warehouseName,
          quantity: acceptedQty,
          previousBalance: (validItem.currentBalance || 0) - acceptedQty,
          newBalance: validItem.currentBalance || acceptedQty,
          unitCost: validItem.unitCost || unitCost,
          totalValue: acceptedQty * (validItem.unitCost || unitCost),
          status: "Completed",
          department: grn.department || po.department,
          programme: grn.programme || po.programme,
          donor: grn.donor || po.donor,
          requestedBy: {
            name: grn.receivedBy || auth.user.name,
            role: "PRC",
          },
          authorizedBy: auth.user.name,
          receivedBy: grn.receivedBy || "Storekeeper",
          remarks: `Delivery intake under GRN ${grnNumber} (PO ${poNumber}). Verified & accepted: ${acceptedQty}.`,
          createdAt: nowIso,
        };

        await txnCol.insertOne(receiptTxn as any);

        updatedInventoryItems.push({
          stockCode: validItem.stockCode,
          addedQty: acceptedQty,
          newBalance: validItem.currentBalance || acceptedQty,
        });
      }
    }

    // Insert any created asset records
    if (createdAssets.length > 0) {
      await assetsCol.insertMany(createdAssets as any);
    }

    // Audit trail
    await logProcurementAudit({
      action: "GRN_AUTOMATIC_ROUTING_PROCESSED",
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "inventory-management",
      recordId: grnNumber,
      txnId,
      details: {
        grnNumber,
        poNumber,
        assetsCreatedCount: createdAssets.length,
        inventoryItemsUpdatedCount: updatedInventoryItems.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `GRN ${grnNumber} processed: ${createdAssets.length} asset records created, ${updatedInventoryItems.length} inventory lines updated.`,
      grnNumber,
      txnId,
      createdAssets: createdAssets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name, serialNumber: a.serialNumber })),
      updatedInventoryItems,
    });
  } catch (err: any) {
    console.error("[POST /api/procurement/grn/process] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to route GRN items" }, { status: 500 });
  }
}
