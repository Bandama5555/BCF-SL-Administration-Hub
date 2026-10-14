import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import {
  type InventoryItem,
  type InventoryTransaction,
  type AdjustmentType,
} from "@/lib/inventoryAssetTypes";
import {
  enforceProcurementAccess,
  logProcurementAudit,
  dispatchProcurementNotification,
} from "@/lib/procurementAuth";

export async function GET(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "V");
    if (!auth.authorized) return auth.response;

    const col = await getCollection<InventoryTransaction>(COLLECTIONS.INVENTORY_TRANSACTIONS);

    const type = req.nextUrl.searchParams.get("type");
    const itemId = req.nextUrl.searchParams.get("itemId");
    const storeId = req.nextUrl.searchParams.get("storeId");

    const query: any = {};
    if (type && type !== "ALL") query.type = type;
    if (itemId) query.itemId = itemId;
    if (storeId && storeId !== "ALL") query.storeId = storeId;

    const transactions = await col.find(query).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      transactions,
      permissions: {
        canView: true,
        canFull: auth.level === "F",
        level: auth.level,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/procurement/inventory/transactions] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load transactions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "F");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const {
      type, // 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'RETURN' | 'ADJUSTMENT' | 'STOCK_COUNT'
      itemId,
      quantity,
      storeId,
      referenceNumber,
      department,
      programme,
      donor,
      beneficiary,
      recipient,
      purpose,
      sourceStoreId,
      destStoreId,
      destStoreName,
      adjustmentType,
      reason,
      supportingEvidence,
      requestedByName,
      approvedByName,
      condition,
      remarks,
    } = body;

    if (!type) {
      return NextResponse.json({ error: "Transaction type is required." }, { status: 400 });
    }

    const itemsCol = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);
    const txnCol = await getCollection<InventoryTransaction>(COLLECTIONS.INVENTORY_TRANSACTIONS);
    const nowIso = new Date().toISOString();
    const todayIso = nowIso.split("T")[0];

    // ─────────────────────────────────────────────────────────────
    //  SPECIALIZED HANDLER: STOCK RECEIPT (MANUAL & MULTI-ITEM)
    // ─────────────────────────────────────────────────────────────
    if (type === "RECEIPT") {
      // 1. Role enforcement: Only Super Admin and Procurement Director
      if (auth.user.roleCode !== "SA" && auth.user.roleCode !== "PRC") {
        return NextResponse.json(
          { error: "Only Super Admin and Procurement Director can record stock receipts." },
          { status: 403 }
        );
      }

      // 2. Date Received validation: defaults to today, cannot be in future
      const receiptDate = (body.dateReceived || body.date || todayIso).trim();
      if (!receiptDate) {
        return NextResponse.json({ error: "Date Received is required." }, { status: 400 });
      }
      if (receiptDate > todayIso) {
        return NextResponse.json({ error: "Date Received cannot be in the future." }, { status: 400 });
      }

      // 3. Warehouse / Store validation
      const storeId = (body.storeId || "").trim();
      const storeName = (body.storeName || "").trim() || "BCF Central Warehouse, Freetown";
      if (!storeId) {
        return NextResponse.json({ error: "Store / Facility Name is required." }, { status: 400 });
      }

      // 4. Source & Details validation
      const source = (body.source || "GRN").trim();
      if (source === "Local Purchase") {
        if (!body.supplier || !body.supplier.trim()) {
          return NextResponse.json({ error: "Supplier is required for Local Purchase." }, { status: 400 });
        }
        if (!body.invoiceNumber || !body.invoiceNumber.trim()) {
          return NextResponse.json({ error: "Invoice/Receipt Number is required for Local Purchase." }, { status: 400 });
        }
      } else if (source === "Humanitarian Consignment") {
        if (!body.donor || !body.donor.trim()) {
          return NextResponse.json({ error: "Donor / Source Organisation is required for Humanitarian Consignment." }, { status: 400 });
        }
        if (!body.consignmentNumber && !body.waybillNumber) {
          return NextResponse.json({ error: "Consignment or Waybill Number is required for Humanitarian Consignment." }, { status: 400 });
        }
      }

      // 5. Reference Number generation / GRN
      let finalRef = (body.referenceNumber || body.grnNumber || "").trim();
      const year = new Date().getFullYear();
      if (!finalRef || finalRef === "No GRN") {
        const countRcv = await txnCol.countDocuments({ type: "RECEIPT" });
        finalRef = `BCF-RCV-${year}-${String(countRcv + 1).padStart(6, "0")}`;
      }

      // 6. Normalize Item Rows
      let rawItems = Array.isArray(body.items) && body.items.length > 0 ? body.items : [];
      if (rawItems.length === 0 && body.itemId) {
        rawItems = [{
          itemId: body.itemId,
          stockCode: body.stockCode,
          itemName: body.itemName,
          quantityReceived: body.quantityReceived !== undefined ? body.quantityReceived : body.quantity,
          quantityRejected: body.quantityRejected || 0,
          condition: body.condition || "Good",
          batchNumber: body.batchNumber,
          expiryDate: body.expiryDate,
          unitCost: body.unitCost,
          totalValue: body.totalValue,
          remarks: body.remarks,
          orderedQuantity: body.orderedQuantity,
          alreadyReceivedQuantity: body.alreadyReceivedQuantity,
          outstandingQuantity: body.outstandingQuantity,
        }];
      }

      if (rawItems.length === 0) {
        return NextResponse.json({ error: "At least one item line must be provided for stock receipt." }, { status: 400 });
      }

      // Duplicate item row check for same store
      const seenItems = new Set<string>();
      for (const r of rawItems) {
        const itemKey = (r.itemId || r.stockCode || "").trim();
        if (!itemKey) {
          return NextResponse.json({ error: "Please select an item for all rows." }, { status: 400 });
        }
        const key = `${itemKey}__${r.storeId || storeId}`;
        if (seenItems.has(key)) {
          return NextResponse.json(
            { error: "The same item cannot be added twice for the same store in one receipt." },
            { status: 400 }
          );
        }
        seenItems.add(key);
      }

      // 7. Load Settings for approval limit & tolerance
      const settingsCol = await getCollection<any>(COLLECTIONS.PROCUREMENT_SETTINGS);
      const settings = (await settingsCol.findOne({})) || {};
      const tolerancePercent = parseFloat(settings.receiptTolerancePercent) || 0;
      const approvalLimit = parseFloat(settings.localPurchaseApprovalLimit) || 10000;

      // Calculate total receipt value to check local purchase threshold
      let totalReceiptValue = 0;
      for (const r of rawItems) {
        const qRcv = parseFloat(r.quantityReceived ?? r.quantity) || 0;
        const uCost = parseFloat(r.unitCost) || 0;
        totalReceiptValue += qRcv * uCost;
      }

      const isPendingApproval = source === "Local Purchase" && totalReceiptValue > approvalLimit;

      // 8. Process each item: validation, DB item lookup, fixed-asset check, duplicate GRN line check
      const processedTransactions: InventoryTransaction[] = [];
      const createdAdjustments: any[] = [];

      for (let i = 0; i < rawItems.length; i++) {
        const r = rawItems[i];
        const dbItem = await itemsCol.findOne({
          $or: [
            { id: r.itemId },
            { stockCode: r.itemId },
            { stockCode: r.stockCode },
            { name: r.itemName }
          ]
        });

        if (!dbItem) {
          return NextResponse.json({ error: `Item not found in Inventory Master: ${r.itemName || r.itemId}` }, { status: 404 });
        }

        // Fixed-asset check
        if (dbItem.itemClass === "Fixed Asset" || dbItem.category === "Fixed Assets" || dbItem.isFixedAsset) {
          return NextResponse.json({ error: "This is a fixed asset. Use Asset Management." }, { status: 400 });
        }

        const qReceived = parseFloat(r.quantityReceived ?? r.quantity) || 0;
        if (qReceived <= 0) {
          return NextResponse.json({ error: `Qty Received must be greater than zero for ${dbItem.name}.` }, { status: 400 });
        }

        // Outstanding quantity check
        if (source === "GRN" && r.outstandingQuantity !== undefined && r.outstandingQuantity !== null) {
          const outstanding = parseFloat(r.outstandingQuantity);
          const maxAllowed = outstanding * (1 + tolerancePercent / 100);
          if (qReceived > maxAllowed) {
            return NextResponse.json(
              { error: `Qty Received (${qReceived}) cannot exceed outstanding quantity (${outstanding}) for ${dbItem.name}.` },
              { status: 400 }
            );
          }
        }

        // Idempotency / No duplicates on same GRN line
        if (source === "GRN" && finalRef) {
          const existingGrnRow = await txnCol.findOne({
            type: "RECEIPT",
            referenceNumber: finalRef,
            itemId: dbItem.id,
            status: { $ne: "Reversed" },
          });
          if (existingGrnRow) {
            return NextResponse.json(
              { error: `This GRN line for ${dbItem.name} has already been received (Receipt: ${finalRef}). Duplicate receipt blocked.`, code: "DUPLICATE_RECEIPT_LINE" },
              { status: 400 }
            );
          }
        }

        // Batch / Lot Number and Expiry Date requirement
        const isPerishableOrBatch =
          dbItem.isPerishable ||
          dbItem.isBatchTracked ||
          (dbItem as any).batchTracked ||
          dbItem.category === "Pharmaceuticals & Medical" ||
          dbItem.category === "Food & Nutrition";

        if (isPerishableOrBatch) {
          if (!r.batchNumber || !r.batchNumber.trim() || !r.expiryDate || !r.expiryDate.trim()) {
            return NextResponse.json(
              { error: `Batch / Lot Number and Expiry Date are required for batch-tracked or perishable item: ${dbItem.name}.` },
              { status: 400 }
            );
          }
        }

        const qRejected = Math.max(0, parseFloat(r.quantityRejected) || 0);
        const acceptedQty = Math.max(0, qReceived - qRejected);
        const condition = r.condition || "Good";

        // Remarks requirement
        if (r.orderedQuantity && qReceived !== parseFloat(r.orderedQuantity) && !r.remarks && !body.remarks) {
          return NextResponse.json(
            { error: `Remarks are required when Qty Received differs from ordered quantity for ${dbItem.name}.` },
            { status: 400 }
          );
        }
        if (condition !== "Good" && !r.remarks && !body.remarks) {
          return NextResponse.json(
            { error: `Remarks are required when condition is ${condition} for ${dbItem.name}.` },
            { status: 400 }
          );
        }

        const unitCost = parseFloat(r.unitCost) || dbItem.unitCost || 0;
        const previousBalance = dbItem.currentBalance || 0;
        let finalNewBalance = previousBalance;

        // Stock Update: If not pending approval and condition is Good, atomically increment stock
        if (!isPendingApproval) {
          if (condition === "Good") {
            const updateResult = await itemsCol.findOneAndUpdate(
              { _id: dbItem._id },
              {
                $inc: {
                  currentBalance: acceptedQty,
                  totalValue: acceptedQty * unitCost,
                },
                $set: { updatedAt: nowIso },
              },
              { returnDocument: "after" }
            );

            if (updateResult) {
              finalNewBalance = updateResult.currentBalance;
              const newSt: InventoryItem["status"] =
                finalNewBalance === 0 ? "Out of Stock" : (finalNewBalance <= (updateResult.reorderLevel || 10) ? "Low Stock" : "In Stock");
              await itemsCol.updateOne({ _id: updateResult._id }, { $set: { status: newSt } });
            } else {
              finalNewBalance = previousBalance + acceptedQty;
            }
          } else {
            // Damaged / Incomplete items do NOT enter available stock!
            finalNewBalance = previousBalance;

            // Create pending stock adjustment
            const adjTxn: InventoryTransaction = {
              id: `INV-ADJ-${Date.now()}-${i + 1}`,
              type: "ADJUSTMENT",
              referenceNumber: `ADJ-${year}-${Math.floor(1000 + Math.random() * 9000)}`,
              date: receiptDate,
              itemId: dbItem.id,
              stockCode: dbItem.stockCode,
              itemName: dbItem.name,
              storeId,
              storeName,
              quantity: acceptedQty > 0 ? acceptedQty : qReceived,
              previousBalance,
              newBalance: previousBalance,
              unitCost,
              totalValue: (acceptedQty > 0 ? acceptedQty : qReceived) * unitCost,
              adjustmentType: condition === "Damaged" ? "Damage" : "Loss",
              reason: `Quarantine stock from Receipt ${finalRef}: ${r.remarks || body.remarks || "Item received damaged/incomplete"}`,
              supportingEvidence: finalRef,
              status: "Pending Approval",
              requestedBy: {
                name: auth.user.name,
                role: auth.user.roleCode,
                email: auth.user.email,
              },
              remarks: `Quarantined non-usable stock from receipt ${finalRef}. Condition: ${condition}.`,
              createdAt: nowIso,
            };
            await txnCol.insertOne(adjTxn as any);
            createdAdjustments.push(adjTxn);
          }
        } else {
          // Local purchase pending approval: available balance does not change yet, but transaction shows preview
          finalNewBalance = previousBalance + (condition === "Good" ? acceptedQty : 0);
        }

        const receiptTxn: InventoryTransaction = {
          id: `INV-RCV-${Date.now()}-${i + 1}`,
          type: "RECEIPT",
          referenceNumber: finalRef,
          date: receiptDate,
          itemId: dbItem.id,
          stockCode: dbItem.stockCode,
          itemName: dbItem.name,
          storeId,
          storeName,
          quantity: acceptedQty,
          quantityReceived: qReceived,
          quantityRejected: qRejected,
          acceptedQuantity: acceptedQty,
          condition,
          previousBalance,
          newBalance: finalNewBalance,
          unitCost,
          totalValue: acceptedQty * unitCost,
          status: isPendingApproval ? "Pending Approval" : "Completed",
          source,
          poNumber: body.poNumber || "",
          supplier: body.supplier || "",
          donor: body.donor || "",
          donorOwned: source === "Humanitarian Consignment",
          consignmentNumber: body.consignmentNumber || body.waybillNumber || "",
          invoiceNumber: body.invoiceNumber || "",
          batchNumber: r.batchNumber || "",
          expiryDate: r.expiryDate || "",
          programme: body.programme || "",
          receivedBy: {
            name: auth.user.name,
            role: auth.user.roleCode,
            email: auth.user.email,
            position: auth.user.roleCode === "PRC" ? "Procurement Director" : "Super Administrator",
          },
          requestedBy: {
            name: auth.user.name,
            role: auth.user.roleCode,
            email: auth.user.email,
          },
          remarks: r.remarks || body.remarks || "",
          createdAt: nowIso,
        };

        await txnCol.insertOne(receiptTxn as any);
        processedTransactions.push(receiptTxn);
      }

      // Audit Trail
      await logProcurementAudit({
        action: "STOCK_RECEIPT",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "inventory-management",
        recordId: finalRef,
        details: {
          referenceNumber: finalRef,
          source,
          storeId,
          storeName,
          itemsCount: rawItems.length,
          status: isPendingApproval ? "Pending Approval" : "Completed",
          totalValue: totalReceiptValue,
        },
      });

      // Notification
      await dispatchProcurementNotification({
        title: isPendingApproval
          ? `PENDING APPROVAL: Local Purchase Receipt ${finalRef}`
          : `STOCK RECEIPT: ${finalRef} (${processedTransactions.length} items)`,
        message: isPendingApproval
          ? `Receipt ${finalRef} of total value NLe ${totalReceiptValue.toLocaleString()} recorded by ${auth.user.name} requires second-user approval.`
          : `Stock receipt ${finalRef} recorded by ${auth.user.name} into ${storeName}.`,
        type: isPendingApproval ? "warning" : "info",
        targetRoles: ["CEO", "PRC", "SA"],
        tab: "inventory-management",
        itemId: finalRef,
      });

      return NextResponse.json({
        success: true,
        referenceNumber: finalRef,
        transactions: processedTransactions,
        pendingApproval: isPendingApproval,
        adjustments: createdAdjustments,
      });
    }

    // ─────────────────────────────────────────────────────────────
    //  SPECIALIZED HANDLER: MULTI-ITEM STOCK RETURN
    // ─────────────────────────────────────────────────────────────
    if (type === "RETURN") {
      // 1. Role enforcement: Only Super Admin and Procurement Director
      if (auth.user.roleCode !== "SA" && auth.user.roleCode !== "PRC") {
        return NextResponse.json(
          { error: "Only Super Admin and Procurement Director can submit stock returns." },
          { status: 403 }
        );
      }

      const {
        returnedBy,
        employeeName,
        staffId,
        isNonStaff,
        department,
        contact,
        programme,
        reason,
        reasonDetails,
        conditionVerified = "Good",
        inventoryUpdated = "Yes",
        items: rawItems,
      } = body;

      const returner = (returnedBy || employeeName || "").trim();
      if (!returner) {
        return NextResponse.json({ error: "Returned By / Employee Name is required." }, { status: 400 });
      }
      if (!programme || !programme.trim()) {
        return NextResponse.json({ error: "Programme / Project is required." }, { status: 400 });
      }
      if (!reason) {
        return NextResponse.json({ error: "Reason for Return is required." }, { status: 400 });
      }
      if (reason === "Other" && (!reasonDetails || !reasonDetails.trim())) {
        return NextResponse.json({ error: "Details are required when 'Other' reason is chosen." }, { status: 400 });
      }
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return NextResponse.json({ error: "At least one item must be added for stock return." }, { status: 400 });
      }

      // Check for duplicate items
      const itemSet = new Set<string>();
      for (const r of rawItems) {
        if (!r.itemId) {
          return NextResponse.json({ error: "Please select an item for all rows." }, { status: 400 });
        }
        if (itemSet.has(r.itemId)) {
          return NextResponse.json({ error: `The same item cannot be selected twice in the same return (${r.itemName || r.stockCode}).` }, { status: 400 });
        }
        itemSet.add(r.itemId);
      }

      // Non-usable condition check (Section 7 Rule 4)
      if (conditionVerified !== "Good" && inventoryUpdated === "Yes") {
        return NextResponse.json(
          { error: "Damaged, expired or incomplete stock cannot be added back to available stock." },
          { status: 400 }
        );
      }

      // Generate Reference: BCF-RET-YYYY-NNNNNN
      const year = new Date().getFullYear();
      const prefix = `BCF-RET-${year}-`;
      const count = await txnCol.countDocuments({ referenceNumber: { $regex: `^${prefix}` } });
      let seqNum = count + 1;
      let returnRef = `${prefix}${String(seqNum).padStart(6, "0")}`;
      while (await txnCol.findOne({ referenceNumber: returnRef })) {
        seqNum++;
        returnRef = `${prefix}${String(seqNum).padStart(6, "0")}`;
      }

      const processedItems: any[] = [];
      let totalReturnedUnits = 0;
      let totalReturnedValue = 0;
      const uniqueStoreNames = new Set<string>();

      // Process each return row
      for (let i = 0; i < rawItems.length; i++) {
        const r = rawItems[i];
        const qReturned = parseFloat(r.qtyReturned) || 0;
        if (qReturned <= 0) {
          return NextResponse.json({ error: `Row ${i + 1}: Quantity returned must be greater than zero.` }, { status: 400 });
        }
        const qIssued = parseFloat(r.qtyIssued) || 0;
        if (qIssued > 0 && qReturned > qIssued) {
          return NextResponse.json({ error: `Row ${i + 1} (${r.itemName}): Cannot return more than was issued (Max: ${qIssued}).` }, { status: 400 });
        }

        if (r.issueNumber) {
          const origIssue = await txnCol.findOne({ referenceNumber: r.issueNumber });
          if (origIssue) {
            const origQty = origIssue.quantity || 0;
            const prevRet = origIssue.returnedQuantity || 0;
            const maxAllowable = Math.max(0, origQty - prevRet);
            if (qReturned > maxAllowable) {
              return NextResponse.json(
                { error: `Row ${i + 1} (${r.itemName}): Cannot return more than was issued. Outstanding quantity on ${r.issueNumber} is ${maxAllowable}.` },
                { status: 400 }
              );
            }
          }
        }

        if (r.condition === "Damaged" && (!r.remarks || !r.remarks.trim())) {
          return NextResponse.json({ error: `Row ${i + 1} (${r.itemName}): Remarks are required when condition is Damaged.` }, { status: 400 });
        }

        const dbItem = await itemsCol.findOne({
          $or: [{ id: r.itemId }, { stockCode: r.stockCode }],
        });
        if (!dbItem) {
          return NextResponse.json({ error: `Row ${i + 1}: Item not found in Item Master.` }, { status: 404 });
        }

        if (dbItem.itemClass === "Fixed Asset") {
          return NextResponse.json({ error: `Row ${i + 1} (${dbItem.name}): This is a fixed asset. Use Asset Management > Assignment.` }, { status: 400 });
        }

        const uCost = dbItem.unitCost || parseFloat(r.unitCost) || 0;
        const storeId = r.storeId || dbItem.warehouseId || "BCF-STORE-001";
        const storeName = r.storeName || dbItem.warehouseName || "BCF Central Warehouse, Freetown";
        uniqueStoreNames.add(storeName);

        // Inventory update rule:
        // Only added to available balance if Condition Verified is Good AND row condition is Good AND inventoryUpdated is Yes!
        const isRowGood = conditionVerified === "Good" && r.condition === "Good";
        const willUpdateInventory = isRowGood && inventoryUpdated === "Yes";

        if (willUpdateInventory) {
          await itemsCol.updateOne(
            {
              $and: [
                { $or: [{ id: dbItem.id }, { stockCode: dbItem.stockCode }] },
                {
                  $or: [
                    { warehouseId: storeId },
                    { warehouseName: storeName },
                    ...(storeId === "BCF-STORE-001" ? [{ warehouseId: { $in: [null, "", "Central", "BCF-STORE-001"] } }] : [])
                  ]
                }
              ]
            },
            {
              $inc: { currentBalance: qReturned, totalValue: qReturned * uCost },
              $set: { updatedAt: nowIso }
            }
          );

          // Update status
          const refreshed = await itemsCol.findOne({ _id: dbItem._id });
          if (refreshed) {
            const newBal = refreshed.currentBalance || 0;
            let newSt: InventoryItem["status"] = "In Stock";
            if (newBal === 0) newSt = "Out of Stock";
            else if (newBal <= refreshed.reorderLevel) newSt = "Low Stock";
            await itemsCol.updateOne({ _id: refreshed._id }, { $set: { status: newSt } });
          }
        } else {
          // Damaged/Quarantine: create pending Stock Adjustment
          const adjTxn: InventoryTransaction = {
            id: `INV-ADJ-${Date.now()}-${i + 1}`,
            type: "ADJUSTMENT",
            referenceNumber: `ADJ-${year}-${Math.floor(1000 + Math.random() * 9000)}`,
            date: todayIso,
            itemId: dbItem.id,
            stockCode: dbItem.stockCode,
            itemName: dbItem.name,
            storeId,
            storeName,
            quantity: qReturned,
            previousBalance: dbItem.currentBalance,
            newBalance: dbItem.currentBalance,
            unitCost: uCost,
            totalValue: qReturned * uCost,
            adjustmentType: r.condition === "Damaged" ? "Damage" : "Loss",
            reason: `Quarantine stock from Return ${returnRef}: ${r.remarks || "Item returned in non-usable/quarantine condition"}`,
            supportingEvidence: returnRef,
            status: "Pending Approval",
            requestedBy: {
              name: auth.user.name,
              role: auth.user.roleCode,
              email: auth.user.email,
            },
            remarks: `Quarantined stock returned by ${returner}. Original Issue: ${r.issueNumber || "N/A"}.`,
            createdAt: nowIso,
          };
          await txnCol.insertOne(adjTxn as any);
        }

        // Link and reduce outstanding quantity on original issue voucher if issueNumber exists
        if (r.issueNumber) {
          await txnCol.updateOne(
            { referenceNumber: r.issueNumber },
            { $inc: { returnedQuantity: qReturned } }
          );
        }

        totalReturnedUnits += qReturned;
        totalReturnedValue += qReturned * uCost;

        processedItems.push({
          itemIndex: i + 1,
          itemId: dbItem.id,
          itemName: dbItem.name,
          stockCode: dbItem.stockCode,
          storeId,
          storeName,
          issueNumber: r.issueNumber || undefined,
          qtyIssued: qIssued,
          qtyReturned: qReturned,
          unit: dbItem.unit || r.unit || "Units",
          unitCost: uCost,
          totalValue: qReturned * uCost,
          condition: r.condition || "Good",
          remarks: r.remarks || "",
          inventoryUpdated: willUpdateInventory,
        });
      }

      const storeHeaderName = uniqueStoreNames.size === 1 ? Array.from(uniqueStoreNames)[0] : "Multiple stores";
      const anyInventoryUpdated = processedItems.some((it) => it.inventoryUpdated);

      const newReturnTxn: InventoryTransaction = {
        id: `INV-TXN-${Date.now()}`,
        type: "RETURN",
        referenceNumber: returnRef,
        date: todayIso,
        itemId: processedItems[0].itemId,
        stockCode: processedItems[0].stockCode,
        itemName: processedItems.length === 1 ? processedItems[0].itemName : `${processedItems[0].itemName} (+${processedItems.length - 1} more items)`,
        storeId: processedItems[0].storeId,
        storeName: storeHeaderName,
        quantity: totalReturnedUnits,
        previousBalance: 0,
        newBalance: totalReturnedUnits,
        unitCost: processedItems[0].unitCost,
        totalValue: totalReturnedValue,
        status: "Completed",
        employeeName: returner,
        staffId: isNonStaff ? "N/A" : (staffId || "N/A"),
        isNonStaff: Boolean(isNonStaff),
        contact: contact || "",
        department: isNonStaff ? "N/A" : (department || "N/A"),
        programme: programme || "",
        reason: reason || "Unused",
        reasonDetails: reasonDetails || "",
        conditionVerified: conditionVerified || "Good",
        inventoryUpdated: anyInventoryUpdated ? "Yes" : "No",
        returnItems: processedItems,
        requestedBy: {
          name: returner,
          role: isNonStaff ? "Non-Staff" : "Staff",
        },
        receivedBy: {
          name: auth.user.name,
          role: auth.user.roleCode,
          email: auth.user.email,
          position: auth.user.roleCode === "PRC" ? "Procurement Director" : "Super Administrator",
        },
        dateReceived: todayIso,
        createdAt: nowIso,
      };

      await txnCol.insertOne(newReturnTxn as any);

      // Audit Trail
      await logProcurementAudit({
        action: "STOCK_RETURN",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "inventory-management",
        recordId: newReturnTxn.id,
        details: {
          referenceNumber: returnRef,
          returnedBy: returner,
          staffId: isNonStaff ? "N/A" : staffId,
          department,
          programme,
          store: storeHeaderName,
          itemsCount: processedItems.length,
          totalQuantity: totalReturnedUnits,
          conditionVerified,
          inventoryUpdated: newReturnTxn.inventoryUpdated,
          receivedBy: auth.user.name,
          items: processedItems.map((r) => ({
            stockCode: r.stockCode,
            qtyReturned: r.qtyReturned,
            condition: r.condition,
            store: r.storeName,
            inventoryUpdated: r.inventoryUpdated,
          })),
        },
      });

      // Notification
      await dispatchProcurementNotification({
        title: `STOCK RETURN: ${returnRef} (${processedItems.length} items)`,
        message: `Stock return ${returnRef} received by ${auth.user.name} from ${returner} (${processedItems.length} items returned).`,
        type: "info",
        targetRoles: ["CEO", "PRC", "SA"],
        tab: "inventory-management",
        itemId: newReturnTxn.id,
      });

      return NextResponse.json({
        success: true,
        transaction: newReturnTxn,
        returnReference: returnRef,
      });
    }

    if (!itemId) {
      return NextResponse.json({ error: "Item ID is required." }, { status: 400 });
    }

    const item = await itemsCol.findOne({ $or: [{ id: itemId }, { stockCode: itemId }] });
    if (!item) {
      return NextResponse.json({ error: "Item not found in Inventory Master." }, { status: 404 });
    }

    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) {
      return NextResponse.json({ error: "Quantity must be greater than zero." }, { status: 400 });
    }

    const txnId = `INV-TXN-${Date.now()}`;
    const previousBalance = item.currentBalance;
    let newBalance = previousBalance;
    let finalDestStoreName = destStoreName;

    // ─────────────────────────────────────────────────────────────
    //  HANDLE TRANSACTION TYPES
    // ─────────────────────────────────────────────────────────────

    if (type === "RECEIPT") {
      // Stock Receipt: adds accepted quantity to inventory
      newBalance = previousBalance + qty;
    } else if (type === "ISSUE") {
      // 1. Strict Role Authorization check: Only Super Admin and Procurement Director
      if (auth.user.roleCode !== "SA" && auth.user.roleCode !== "PRC") {
        return NextResponse.json(
          { error: "Only Super Admin and Procurement Director can process Stock Issue Vouchers." },
          { status: 403 }
        );
      }

      // 2. Fixed Asset Guard
      if (item.itemClass === "Fixed Asset") {
        return NextResponse.json(
          { error: "This item is classed as a Fixed Asset. Use Asset Management > Assignment." },
          { status: 400 }
        );
      }

      // 3. Requested Quantity validation
      const qtyRequested = parseFloat(body.quantityRequested) || qty;
      if (qtyRequested <= 0) {
        return NextResponse.json(
          { error: "Quantity requested must be greater than zero." },
          { status: 400 }
        );
      }
      if (qty > qtyRequested) {
        return NextResponse.json(
          { error: `Issue Quantity (${qty}) cannot exceed Requested Quantity (${qtyRequested}).` },
          { status: 400 }
        );
      }

      // 4. Recipient & Location checks
      if (!body.recipient || !body.recipient.trim()) {
        return NextResponse.json(
          { error: "Recipient / Beneficiary is required." },
          { status: 400 }
        );
      }
      if (!body.location || !body.location.trim()) {
        return NextResponse.json(
          { error: "Location / Office Address is required." },
          { status: 400 }
        );
      }

      // 5. Store / Facility validation
      if (storeId && item.warehouseId && item.warehouseId !== storeId && storeId !== "BCF-STORE-001") {
        return NextResponse.json(
          { error: `Item is not available in the selected Store / Facility (${storeId}).` },
          { status: 400 }
        );
      }

      // 6. Atomic MongoDB Test-and-Set Lock: Prevents double-spend and concurrent oversell
      const updateResult = await itemsCol.findOneAndUpdate(
        {
          _id: item._id,
          currentBalance: { $gte: qty },
        },
        {
          $inc: { currentBalance: -qty },
          $set: { updatedAt: nowIso },
        },
        { returnDocument: "after" }
      );

      if (!updateResult) {
        const freshItem = await itemsCol.findOne({ _id: item._id });
        const avail = freshItem?.currentBalance || 0;
        return NextResponse.json(
          {
            error: `Cannot issue stock: available balance in ${body.storeName || item.warehouseName || storeId || "store"} is ${avail} ${item.unit}, which is less than requested issue quantity (${qty} ${item.unit}). Issue blocked.`,
            code: "INSUFFICIENT_STOCK",
            availableBalance: avail,
          },
          { status: 400 }
        );
      }

      newBalance = updateResult.currentBalance;
    } else if (type === "TRANSFER") {
      // Stock Transfer between stores
      if (qty > previousBalance) {
        return NextResponse.json(
          {
            error: `Transfer quantity (${qty}) exceeds available store stock (${previousBalance}).`,
            code: "INSUFFICIENT_STOCK",
          },
          { status: 400 }
        );
      }
      if (!destStoreId) {
        return NextResponse.json(
          { error: "Destination store / warehouse is required for stock transfer." },
          { status: 400 }
        );
      }
      const actualSourceStore = sourceStoreId || item.warehouseId || "BCF-STORE-001";
      if (actualSourceStore === destStoreId) {
        return NextResponse.json(
          { error: "Source store and destination store must be different." },
          { status: 400 }
        );
      }

      newBalance = previousBalance - qty;

      // Transfer stock to destination store: Update existing or create item in destination warehouse
      const storesCol = await getCollection<any>(COLLECTIONS.INVENTORY_STORES);
      const destStore = await storesCol.findOne({ id: destStoreId });
      finalDestStoreName = destStoreName || destStore?.storeName || destStoreId;

      const destItem = await itemsCol.findOne({
        stockCode: item.stockCode,
        $or: [
          { warehouseId: destStoreId },
          { warehouseName: finalDestStoreName }
        ]
      });

      if (destItem) {
        const destNewBal = (destItem.currentBalance || 0) + qty;
        let destStatus: InventoryItem["status"] = "In Stock";
        if (destNewBal === 0) destStatus = "Out of Stock";
        else if (destNewBal <= (destItem.reorderLevel || 10)) destStatus = "Low Stock";

        await itemsCol.updateOne(
          { id: destItem.id },
          {
            $set: {
              currentBalance: destNewBal,
              totalValue: destNewBal * destItem.unitCost,
              status: destStatus,
              warehouseId: destStoreId,
              warehouseName: finalDestStoreName,
              updatedAt: nowIso,
            },
          }
        );
      } else {
        const totalItemDocs = await itemsCol.countDocuments();
        const newDestItemId = `INV-ITEM-${String(totalItemDocs + 1).padStart(4, "0")}`;
        const newDestItem: InventoryItem = {
          ...item,
          id: newDestItemId,
          warehouseId: destStoreId,
          warehouseName: finalDestStoreName,
          currentBalance: qty,
          totalValue: qty * item.unitCost,
          status: qty <= item.reorderLevel ? "Low Stock" : "In Stock",
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        delete (newDestItem as any)._id;
        await itemsCol.insertOne(newDestItem as any);
      }
    } else if (type === "RETURN") {
      // Stock Return: returned goods replenish balance
      newBalance = previousBalance + qty;
    } else if (type === "ADJUSTMENT") {
      // Stock Adjustment:
      // Mandatory Rule: "The requester and approver must be different users."
      const requester = (requestedByName || auth.user.name).trim().toLowerCase();
      const approver = (approvedByName || "").trim().toLowerCase();

      if (!approver) {
        return NextResponse.json(
          { error: "Approved by name is mandatory for stock adjustment approval." },
          { status: 400 }
        );
      }

      if (requester === approver) {
        return NextResponse.json(
          {
            error: "Requester and approver must be different users for stock adjustment.",
            code: "DUAL_AUTHORIZATION_REQUIRED",
          },
          { status: 400 }
        );
      }

      const adjType = (adjustmentType as AdjustmentType) || "Damage";
      // Decreasing adjustment vs increasing
      if (["Damage", "Loss", "Theft", "Expired"].includes(adjType)) {
        if (qty > previousBalance) {
          return NextResponse.json(
            { error: `Adjustment loss quantity (${qty}) exceeds available stock (${previousBalance}).` },
            { status: 400 }
          );
        }
        newBalance = previousBalance - qty;
      } else {
        // Counting Error, Return, Donation etc can increase or decrease
        newBalance = body.newQuantity !== undefined ? parseFloat(body.newQuantity) : previousBalance + qty;
      }
    } else if (type === "STOCK_COUNT") {
      // Physical Count variance reconciliation
      newBalance = qty;
    }

    // Determine new item status
    let newStatus: InventoryItem["status"] = "In Stock";
    if (newBalance === 0) {
      newStatus = "Out of Stock";
    } else if (newBalance <= item.reorderLevel) {
      newStatus = "Low Stock";
    }

    // Update Item Master record
    await itemsCol.updateOne(
      { id: item.id },
      {
        $set: {
          currentBalance: newBalance,
          totalValue: newBalance * item.unitCost,
          status: newStatus,
          updatedAt: nowIso,
        },
      }
    );

    // Create Transaction Record
    const isPartial = type === "ISSUE" && qty < (parseFloat(body.quantityRequested) || qty);
    const remainingQuantity = type === "ISSUE" ? Math.max(0, (parseFloat(body.quantityRequested) || qty) - qty) : 0;
    const properRecipient = (body.recipient || body.beneficiary || "").trim().replace(/\b\w/g, (c: string) => c.toUpperCase());
    const properLocation = (body.location || "").trim();

    const refNum =
      referenceNumber ||
      (type === "ISSUE"
        ? `ISV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
        : `${type.slice(0, 3)}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);

    const newTxn: InventoryTransaction = {
      id: txnId,
      type,
      referenceNumber: refNum,
      date: body.date || nowIso.split("T")[0],
      itemId: item.id,
      stockCode: item.stockCode,
      itemName: item.name,
      storeId: storeId || item.warehouseId || "BCF-STORE-001",
      storeName: body.storeName || item.warehouseName || "BCF Central Warehouse, Freetown",
      quantity: qty,
      quantityRequested: type === "ISSUE" ? (parseFloat(body.quantityRequested) || qty) : undefined,
      isPartial: type === "ISSUE" ? isPartial : undefined,
      remainingQuantity: type === "ISSUE" ? remainingQuantity : undefined,
      previousBalance,
      newBalance,
      unitCost: item.unitCost,
      totalValue: qty * item.unitCost,
      status: "Completed",
      department,
      programme,
      donor,
      beneficiary: properRecipient,
      recipient: properRecipient,
      location: properLocation,
      purpose,
      sourceStoreId: sourceStoreId || item.warehouseId || "BCF-STORE-001",
      sourceStoreName: body.sourceStoreName || item.warehouseName || "BCF Central Warehouse, Freetown",
      destStoreId,
      destStoreName: type === "TRANSFER" ? (finalDestStoreName || destStoreName) : destStoreName,
      condition,
      adjustmentType,
      reason,
      supportingEvidence,
      requestedBy: {
        name: requestedByName || auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
      },
      approvedBy: approvedByName
        ? {
            name: approvedByName,
            role: "PRC",
          }
        : undefined,
      issuedBy: {
        name: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        title: auth.user.roleCode === "PRC" ? "Procurement Director" : "Super Administrator",
      },
      issuedAt: nowIso,
      authorizedBy: auth.user.name,
      remarks:
        remarks ||
        (type === "ISSUE" && isPartial
          ? `Partial issue voucher: ${qty}/${parseFloat(body.quantityRequested) || qty} ${item.unit}. Pending balance: ${remainingQuantity} ${item.unit}.`
          : undefined),
      createdAt: nowIso,
    };

    await txnCol.insertOne(newTxn as any);

    // Audit Trail: Records old and new quantity, store, item, recipient, and user!
    await logProcurementAudit({
      action: `STOCK_${type}`,
      user: auth.user.name,
      role: auth.user.roleCode,
      email: auth.user.email,
      tab: "inventory-management",
      recordId: item.id,
      details: {
        txnId: newTxn.id,
        referenceNumber: newTxn.referenceNumber,
        stockCode: item.stockCode,
        itemName: item.name,
        storeId: newTxn.storeId,
        storeName: newTxn.storeName,
        oldQuantity: previousBalance,
        quantityMoved: qty,
        quantityRequested: newTxn.quantityRequested,
        quantityIssued: qty,
        remainingQuantity: newTxn.remainingQuantity,
        isPartial: newTxn.isPartial,
        newQuantity: newBalance,
        type,
        recipient: newTxn.recipient,
        location: newTxn.location,
        issuedBy: `${auth.user.name} (${auth.user.roleCode})`,
        adjustmentType,
        requester: newTxn.requestedBy.name,
        approver: newTxn.approvedBy?.name,
      },
    });

    // Notifications:
    // 1. Low stock / Out of stock alert to PRC & SA
    if (newStatus === "Low Stock" || newStatus === "Out of Stock") {
      await dispatchProcurementNotification({
        title: `STOCK ALERT: ${item.name} (${newStatus.toUpperCase()})`,
        message: `Current stock balance is now ${newBalance} ${item.unit} (reorder point is ${item.reorderLevel}). Action required.`,
        type: newStatus === "Out of Stock" ? "alert" : "warning",
        targetRoles: ["PRC", "SA"],
        tab: "inventory-management",
        itemId: item.id,
      });
    }

    // 2. Adjustments approved -> notify Internal Audit & Risk Director (IAR)!
    if (type === "ADJUSTMENT") {
      await dispatchProcurementNotification({
        title: `AUDIT NOTIFICATION: Stock Adjustment Approved (${item.stockCode})`,
        message: `Adjustment of ${qty} ${item.unit} (${adjustmentType}) approved by ${approvedByName}. Previous: ${previousBalance}, New: ${newBalance}.`,
        type: "info",
        targetRoles: ["IAR", "PRC", "SA"],
        tab: "inventory-management",
        itemId: item.id,
      });
    }

    // 3. Stock Issue notification
    if (type === "ISSUE") {
      await dispatchProcurementNotification({
        title: `STOCK ISSUE VOUCHER: ${refNum} (${item.name})`,
        message: `${qty} ${item.unit} issued to ${properRecipient} at ${properLocation || "Site"}. Store: ${newTxn.storeName}. Remaining balance: ${newBalance} ${item.unit}.`,
        type: "info",
        targetRoles: ["CEO", "PRC", "SA"],
        tab: "inventory-management",
        itemId: item.id,
      });
    }

    // 4. Stock Transfer notification to CEO, Procurement & Super Admin
    if (type === "TRANSFER") {
      await dispatchProcurementNotification({
        title: `STOCK TRANSFER: ${qty} ${item.unit} of ${item.name}`,
        message: `${qty} ${item.unit} of ${item.name} (${item.stockCode}) successfully transferred from ${newTxn.sourceStoreName || newTxn.sourceStoreId} to ${newTxn.destStoreName || newTxn.destStoreId}. Ref: ${refNum}.`,
        type: "info",
        targetRoles: ["CEO", "PRC", "SA"],
        tab: "inventory-management",
        itemId: item.id,
      });
    }

    return NextResponse.json({
      success: true,
      transaction: newTxn,
      item: {
        id: item.id,
        stockCode: item.stockCode,
        previousBalance,
        newBalance,
        status: newStatus,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/procurement/inventory/transactions] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to process transaction" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "F");
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { action, referenceNumber, receiptId, reason, approverName, remarks } = body;

    const itemsCol = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);
    const txnCol = await getCollection<InventoryTransaction>(COLLECTIONS.INVENTORY_TRANSACTIONS);
    const nowIso = new Date().toISOString();
    const todayIso = nowIso.split("T")[0];

    // ─────────────────────────────────────────────────────────────
    //  APPROVE RECEIPT (Dual-user authorization for Local Purchases)
    // ─────────────────────────────────────────────────────────────
    if (action === "APPROVE_RECEIPT") {
      if (auth.user.roleCode !== "SA" && auth.user.roleCode !== "PRC") {
        return NextResponse.json(
          { error: "Only Super Admin and Procurement Director can approve stock receipts." },
          { status: 403 }
        );
      }

      const query: any = { type: "RECEIPT" };
      if (receiptId) query.id = receiptId;
      else if (referenceNumber) query.referenceNumber = referenceNumber;
      else return NextResponse.json({ error: "Receipt ID or Reference Number is required." }, { status: 400 });

      const txns = await txnCol.find(query).toArray();
      if (!txns.length) {
        return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
      }

      // Check submitter cannot approve own receipt
      for (const t of txns) {
        const creatorName = (t.requestedBy?.name || t.receivedBy?.name || "").toLowerCase();
        const currentName = (auth.user.name || "").toLowerCase();
        if (creatorName && currentName && creatorName === currentName) {
          return NextResponse.json(
            { error: "The person who recorded the receipt cannot approve their own receipt (dual authorization required)." },
            { status: 400 }
          );
        }
      }

      // Process approval: increment stock for Good condition items
      for (const t of txns) {
        if (t.status === "Pending Approval") {
          let updatedBal = t.previousBalance;
          if (t.condition === "Good" && t.quantity > 0) {
            const updated = await itemsCol.findOneAndUpdate(
              { $or: [{ id: t.itemId }, { stockCode: t.stockCode }] },
              {
                $inc: {
                  currentBalance: t.quantity,
                  totalValue: t.quantity * (t.unitCost || 0),
                },
                $set: { updatedAt: nowIso },
              },
              { returnDocument: "after" }
            );
            if (updated) {
              updatedBal = updated.currentBalance;
              const newSt: InventoryItem["status"] =
                updatedBal === 0 ? "Out of Stock" : (updatedBal <= (updated.reorderLevel || 10) ? "Low Stock" : "In Stock");
              await itemsCol.updateOne({ _id: updated._id }, { $set: { status: newSt } });
            } else {
              updatedBal = (t.previousBalance || 0) + t.quantity;
            }
          }

          await txnCol.updateOne(
            { id: t.id },
            {
              $set: {
                status: "Completed",
                newBalance: updatedBal,
                approvedBy: {
                  name: auth.user.name,
                  role: auth.user.roleCode,
                  email: auth.user.email,
                },
                approvedAt: nowIso,
                remarks: remarks ? `${t.remarks || ""} | Approved: ${remarks}` : t.remarks,
              },
            }
          );
        }
      }

      await logProcurementAudit({
        action: "RECEIPT_APPROVED",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "inventory-management",
        recordId: referenceNumber || receiptId,
        details: { referenceNumber, approver: auth.user.name, remarks },
      });

      return NextResponse.json({ success: true, message: "Receipt approved and stock balance updated." });
    }

    // ─────────────────────────────────────────────────────────────
    //  REJECT RECEIPT
    // ─────────────────────────────────────────────────────────────
    if (action === "REJECT_RECEIPT") {
      if (auth.user.roleCode !== "SA" && auth.user.roleCode !== "PRC") {
        return NextResponse.json(
          { error: "Only Super Admin and Procurement Director can reject stock receipts." },
          { status: 403 }
        );
      }

      if (!reason || !reason.trim()) {
        return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });
      }

      const query: any = { type: "RECEIPT" };
      if (receiptId) query.id = receiptId;
      else if (referenceNumber) query.referenceNumber = referenceNumber;
      else return NextResponse.json({ error: "Receipt ID or Reference Number is required." }, { status: 400 });

      await txnCol.updateMany(query, {
        $set: {
          status: "Rejected",
          rejectionReason: reason,
          rejectedBy: {
            name: auth.user.name,
            role: auth.user.roleCode,
            email: auth.user.email,
          },
          rejectedAt: nowIso,
        },
      });

      return NextResponse.json({ success: true, message: "Receipt rejected." });
    }

    // ─────────────────────────────────────────────────────────────
    //  REVERSE RECEIPT (Shows as Reversed with negative entry)
    // ─────────────────────────────────────────────────────────────
    if (action === "REVERSE_RECEIPT") {
      if (auth.user.roleCode !== "SA" && auth.user.roleCode !== "PRC") {
        return NextResponse.json(
          { error: "Only Super Admin and Procurement Director can reverse stock receipts." },
          { status: 403 }
        );
      }

      if (!reason || !reason.trim()) {
        return NextResponse.json({ error: "Reversal reason is required." }, { status: 400 });
      }

      const query: any = { type: "RECEIPT" };
      if (receiptId) query.id = receiptId;
      else if (referenceNumber) query.referenceNumber = referenceNumber;
      else return NextResponse.json({ error: "Receipt ID or Reference Number is required." }, { status: 400 });

      const txns = await txnCol.find(query).toArray();
      if (!txns.length) {
        return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
      }

      const createdReversals: InventoryTransaction[] = [];

      for (const t of txns) {
        if (t.status === "Reversed") continue;

        let postReversalBal = t.newBalance;
        // If stock was originally added (status Completed and condition Good and quantity > 0), decrement stock
        if (t.status === "Completed" && t.condition === "Good" && t.quantity > 0) {
          const freshItem = await itemsCol.findOne({ id: t.itemId });
          const curBal = freshItem?.currentBalance || 0;
          const updated = await itemsCol.findOneAndUpdate(
            { id: t.itemId },
            {
              $inc: {
                currentBalance: -t.quantity,
                totalValue: -(t.quantity * (t.unitCost || 0)),
              },
              $set: { updatedAt: nowIso },
            },
            { returnDocument: "after" }
          );

          if (updated) {
            postReversalBal = updated.currentBalance;
            const newSt: InventoryItem["status"] =
              postReversalBal === 0 ? "Out of Stock" : (postReversalBal <= (updated.reorderLevel || 10) ? "Low Stock" : "In Stock");
            await itemsCol.updateOne({ _id: updated._id }, { $set: { status: newSt } });
          } else {
            postReversalBal = curBal - t.quantity;
          }
        }

        // Mark original as Reversed
        await txnCol.updateOne(
          { id: t.id },
          {
            $set: {
              status: "Reversed",
              reversedAt: nowIso,
              reversedBy: auth.user.name,
              reversalReason: reason,
              reversalApprover: approverName || auth.user.name,
            },
          }
        );

        // Create reversal transaction entry with negative quantity
        const revTxn: InventoryTransaction = {
          id: `INV-REV-${Date.now()}-${t.id}`,
          type: "RECEIPT",
          referenceNumber: `${t.referenceNumber}-REV`,
          date: todayIso,
          itemId: t.itemId,
          stockCode: t.stockCode,
          itemName: t.itemName,
          storeId: t.storeId,
          storeName: t.storeName,
          quantity: -t.quantity, // Negative entry!
          quantityReceived: -(t.quantityReceived ?? t.quantity),
          quantityRejected: 0,
          acceptedQuantity: -(t.acceptedQuantity ?? t.quantity),
          condition: t.condition,
          previousBalance: t.newBalance,
          newBalance: postReversalBal,
          unitCost: t.unitCost,
          totalValue: -(t.quantity * t.unitCost),
          status: "Reversed",
          source: t.source,
          receivedBy: t.receivedBy,
          requestedBy: t.requestedBy,
          remarks: `Reversal of receipt ${t.referenceNumber}: ${reason}. Approved by ${approverName || auth.user.name}.`,
          createdAt: nowIso,
        };

        await txnCol.insertOne(revTxn as any);
        createdReversals.push(revTxn);
      }

      await logProcurementAudit({
        action: "RECEIPT_REVERSED",
        user: auth.user.name,
        role: auth.user.roleCode,
        email: auth.user.email,
        tab: "inventory-management",
        recordId: referenceNumber || receiptId,
        details: { referenceNumber, reason, approver: approverName || auth.user.name },
      });

      return NextResponse.json({
        success: true,
        message: "Receipt reversed successfully.",
        reversals: createdReversals,
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err: any) {
    console.error("[PATCH /api/procurement/inventory/transactions] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await enforceProcurementAccess(req, "inventory-management", "F");
    if (!auth.authorized) return auth.response;

    if (auth.user.roleCode !== "SA" && auth.user.roleCode !== "PRC") {
      return NextResponse.json({ error: "Only Super Admin and Procurement Director can delete test records." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const ref = req.nextUrl.searchParams.get("referenceNumber") || body.referenceNumber;
    const isTest = req.nextUrl.searchParams.get("test") === "true" || body.test === true;
    const ids = body.ids || (body.id ? [body.id] : []);

    const txnCol = await getCollection<InventoryTransaction>(COLLECTIONS.INVENTORY_TRANSACTIONS);
    const itemsCol = await getCollection<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS);

    const filter: any = {};
    if (ref) filter.referenceNumber = { $regex: new RegExp(ref, "i") };
    else if (ids.length) filter.id = { $in: ids };
    else if (isTest) filter.referenceNumber = { $regex: /TEST|BCF-RCV|GRN-2026/i };
    else return NextResponse.json({ error: "Reference number or test flag is required for deletion." }, { status: 400 });

    // Find and revert balance if necessary
    const matchingTxns = await txnCol.find(filter).toArray();
    for (const t of matchingTxns) {
      if (t.type === "RECEIPT" && t.status === "Completed" && t.quantity > 0 && t.condition === "Good") {
        await itemsCol.updateOne(
          { id: t.itemId },
          {
            $inc: {
              currentBalance: -t.quantity,
              totalValue: -(t.quantity * (t.unitCost || 0)),
            },
          }
        );
      }
    }

    const result = await txnCol.deleteMany(filter);
    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (err: any) {
    console.error("[DELETE /api/procurement/inventory/transactions] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete test records" }, { status: 500 });
  }
}
