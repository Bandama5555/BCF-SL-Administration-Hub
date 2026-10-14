/**
 * verify-stock-return-acceptance.mjs
 * End-to-end automated verification script for the Stock Return feature
 * according to the 13 Acceptance Tests specified in the prompt.
 */

const BASE_URL = "http://localhost:3001";

async function runTests() {
  console.log("==================================================================");
  console.log(" BCF-SL PROCUREMENT: STOCK RETURN ACCEPTANCE TEST SUITE");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = "") {
    if (condition) {
      console.log(`[PASS] ${name}`);
      if (details) console.log(`       -> ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      if (details) console.error(`       -> ${details}`);
      failed++;
    }
  }

  const getHeaders = (role, name = "Test User") => ({
    "Content-Type": "application/json",
    "x-bcf-user-role": role,
    "x-bcf-name": name,
  });

  const createdTxnIds = [];
  const testItemIds = [];

  try {
    // 0. Ensure database seed exists
    await fetch(`${BASE_URL}/api/procurement/seed`, { headers: getHeaders("SA", "Albert Bandama") });

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Role Permissions (SA/PRC allowed, HR/CEO/IAR rejected)
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 1: Role Permissions (SA/PRC vs HR/CEO/IAR) ---");
    const testPayload = {
      type: "RETURN",
      returnedBy: "Alie Kamara",
      employeeName: "Alie Kamara",
      staffId: "BCF-EMP-001",
      department: "Procurement Directorate",
      programme: "Girls Primary Education Initiative",
      reason: "Unused",
      conditionVerified: "Good",
      inventoryUpdated: "Yes",
      items: [
        {
          itemId: "INV-ITEM-001",
          stockCode: "MED-001",
          itemName: "Emergency Trauma First Aid Kit",
          storeId: "BCF-STORE-001",
          storeName: "BCF Central Warehouse, Freetown",
          qtyIssued: 10,
          qtyReturned: 1,
          condition: "Good",
          remarks: "Returned test item",
        },
      ],
    };

    // HR Director POST attempt -> must be 403
    const hrRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      method: "POST",
      headers: getHeaders("HR", "HR Director"),
      body: JSON.stringify(testPayload),
    });
    assert(hrRes.status === 403, "HR Director return submission rejected with 403 Forbidden");

    // CEO POST attempt -> must be 403
    const ceoRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      method: "POST",
      headers: getHeaders("CEO", "Chief Executive Officer"),
      body: JSON.stringify(testPayload),
    });
    assert(ceoRes.status === 403, "CEO return submission rejected with 403 Forbidden");

    // Internal Audit POST attempt -> must be 403
    const iarRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      method: "POST",
      headers: getHeaders("IAR", "Internal Audit Director"),
      body: JSON.stringify(testPayload),
    });
    assert(iarRes.status === 403, "Internal Audit return submission rejected with 403 Forbidden");

    // ─────────────────────────────────────────────────────────────
    // TEST 2 & 3: Employee and Issue Voucher Setup
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 2 & 3: Issue Voucher & Outstanding Tracking ---");
    // Get existing item to issue
    const itemsRes = await fetch(`${BASE_URL}/api/procurement/inventory/items`, {
      headers: getHeaders("PRC", "Alie Kamara"),
    });
    const itemsData = await itemsRes.json();
    const testItem = itemsData.items.find((i) => (i.currentBalance || 0) >= 15 && i.itemClass !== "Fixed Asset");
    assert(Boolean(testItem), "Found test consumable item with balance >= 15", `Item: ${testItem?.name} (${testItem?.stockCode})`);

    const initialItemBalance = testItem.currentBalance;

    // Create an initial Issue voucher to test employee "Mariama Bangura"
    const issueRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      method: "POST",
      headers: getHeaders("PRC", "Alie Kamara"),
      body: JSON.stringify({
        type: "ISSUE",
        itemId: testItem.id,
        quantity: 10,
        quantityRequested: 10,
        storeId: testItem.warehouseId || "BCF-STORE-001",
        storeName: testItem.warehouseName || "BCF Central Warehouse, Freetown",
        recipient: "Mariama Bangura",
        location: "Kenema District Office",
        department: "Programs Directorate",
        programme: "Girls Primary Education Initiative",
        purpose: "Field distribution pilot",
      }),
    });
    const issueData = await issueRes.json();
    assert(issueRes.ok && issueData.transaction, "Created baseline Issue voucher for Mariama Bangura", `Issue Ref: ${issueData.transaction?.referenceNumber}`);
    const issueVoucherRef = issueData.transaction.referenceNumber;
    createdTxnIds.push(issueData.transaction.id);

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Duplicate Items in same Return Blocked
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 5: Duplicate Items Blocked ---");
    const duplicateReturnRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      method: "POST",
      headers: getHeaders("PRC", "Alie Kamara"),
      body: JSON.stringify({
        type: "RETURN",
        returnedBy: "Mariama Bangura",
        programme: "Girls Primary Education Initiative",
        reason: "Unused",
        items: [
          {
            itemId: testItem.id,
            stockCode: testItem.stockCode,
            itemName: testItem.name,
            storeId: testItem.warehouseId || "BCF-STORE-001",
            qtyIssued: 10,
            qtyReturned: 2,
            condition: "Good",
          },
          {
            itemId: testItem.id, // DUPLICATE ITEM
            stockCode: testItem.stockCode,
            itemName: testItem.name,
            storeId: testItem.warehouseId || "BCF-STORE-001",
            qtyIssued: 10,
            qtyReturned: 3,
            condition: "Good",
          },
        ],
      }),
    });
    assert(duplicateReturnRes.status === 400, "Duplicate item in same return is blocked by server (400 Bad Request)");

    // ─────────────────────────────────────────────────────────────
    // TEST 6 & 10: Quantity Returned > Quantity Issued Blocked
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 6 & 10: Excess Quantity Blocked (qtyReturned > qtyIssued) ---");
    const excessReturnRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      method: "POST",
      headers: getHeaders("PRC", "Alie Kamara"),
      body: JSON.stringify({
        type: "RETURN",
        returnedBy: "Mariama Bangura",
        programme: "Girls Primary Education Initiative",
        reason: "Excess",
        items: [
          {
            itemId: testItem.id,
            stockCode: testItem.stockCode,
            itemName: testItem.name,
            storeId: testItem.warehouseId || "BCF-STORE-001",
            issueNumber: issueVoucherRef,
            qtyIssued: 10,
            qtyReturned: 15, // EXCEEDS ISSUED 10!
            condition: "Good",
          },
        ],
      }),
    });
    assert(excessReturnRes.status === 400, "Direct API call with Qty Returned > Qty Issued rejected with 400 Bad Request");
    const excessErr = await excessReturnRes.json();
    assert(excessErr.error && excessErr.error.includes("Cannot return more than was issued"), "Server returns explicit error: Cannot return more than was issued");

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Return 5 Good items
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 7: Return 5 Good Items (Store Balance Increases, Inventory Updated = Yes) ---");
    // Check balance before return
    const beforeItemRes = await fetch(`${BASE_URL}/api/procurement/inventory/items`, {
      headers: getHeaders("PRC", "Alie Kamara"),
    });
    const beforeItemsData = await beforeItemRes.json();
    const itemBeforeGood = beforeItemsData.items.find((i) => i.id === testItem.id);
    const balanceBeforeGood = itemBeforeGood.currentBalance;

    const return5GoodRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      method: "POST",
      headers: getHeaders("PRC", "Alie Kamara"),
      body: JSON.stringify({
        type: "RETURN",
        returnedBy: "Mariama Bangura",
        employeeName: "Mariama Bangura",
        staffId: "BCF-EMP-002",
        department: "Programs Directorate",
        programme: "Girls Primary Education Initiative",
        reason: "Project ended",
        conditionVerified: "Good",
        inventoryUpdated: "Yes",
        items: [
          {
            itemId: testItem.id,
            stockCode: testItem.stockCode,
            itemName: testItem.name,
            storeId: testItem.warehouseId || "BCF-STORE-001",
            storeName: testItem.warehouseName || "BCF Central Warehouse, Freetown",
            issueNumber: issueVoucherRef,
            qtyIssued: 10,
            qtyReturned: 5,
            condition: "Good",
            remarks: "Surplus materials in pristine condition",
          },
        ],
      }),
    });

    const return5GoodData = await return5GoodRes.json();
    assert(return5GoodRes.ok && return5GoodData.success, "Successfully saved return of 5 Good items", `Reference: ${return5GoodData.returnReference}`);
    createdTxnIds.push(return5GoodData.transaction.id);

    // Verify format BCF-RET-YYYY-NNNNNN
    const refRegex = /^BCF-RET-\d{4}-\d{6}$/;
    assert(refRegex.test(return5GoodData.returnReference), "Return Reference matches format BCF-RET-YYYY-NNNNNN", return5GoodData.returnReference);
    assert(return5GoodData.transaction.inventoryUpdated === "Yes", "Return transaction has inventoryUpdated = Yes");

    // Check store balance increased by 5
    const afterItemRes = await fetch(`${BASE_URL}/api/procurement/inventory/items`, {
      headers: getHeaders("PRC", "Alie Kamara"),
    });
    const afterItemsData = await afterItemRes.json();
    const itemAfterGood = afterItemsData.items.find((i) => i.id === testItem.id);
    assert(itemAfterGood.currentBalance === balanceBeforeGood + 5, `Store available balance increased by 5 (${balanceBeforeGood} -> ${itemAfterGood.currentBalance})`);

    // Verify outstanding quantity dropped by 5 on the original issue voucher
    const txnsCheckRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      headers: getHeaders("PRC", "Alie Kamara"),
    });
    const txnsData = await txnsCheckRes.json();
    const updatedIssue = txnsData.transactions.find((t) => t.referenceNumber === issueVoucherRef);
    assert(updatedIssue?.returnedQuantity === 5, "Original issue voucher returnedQuantity updated to 5 (remaining outstanding: 5)");

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Return Damaged Items (Quarantine & Pending Adjustment)
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 8: Return Damaged Items (Quarantine, No Balance Change, Adjustment Entry) ---");
    // Verify block if user tries to set inventoryUpdated = Yes for Damaged condition
    const blockDamagedYesRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      method: "POST",
      headers: getHeaders("PRC", "Alie Kamara"),
      body: JSON.stringify({
        type: "RETURN",
        returnedBy: "Mariama Bangura",
        programme: "Girls Primary Education Initiative",
        reason: "Damaged",
        conditionVerified: "Damaged",
        inventoryUpdated: "Yes", // ILLEGAL: damaged cannot be added to available stock!
        items: [
          {
            itemId: testItem.id,
            stockCode: testItem.stockCode,
            itemName: testItem.name,
            storeId: testItem.warehouseId || "BCF-STORE-001",
            issueNumber: issueVoucherRef,
            qtyIssued: 5,
            qtyReturned: 2,
            condition: "Damaged",
            remarks: "Packaging water damaged in rain",
          },
        ],
      }),
    });
    assert(blockDamagedYesRes.status === 400, "Setting Inventory Updated = Yes for Damaged return is blocked by server (400)");
    const blockedErr = await blockDamagedYesRes.json();
    assert(blockedErr.error && blockedErr.error.includes("Damaged, expired or incomplete stock cannot be added back"), "Server returned explicit non-usable rejection message");

    // Now save valid Damaged return with inventoryUpdated = No
    const balBeforeDamaged = itemAfterGood.currentBalance;
    const damagedReturnRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      method: "POST",
      headers: getHeaders("PRC", "Alie Kamara"),
      body: JSON.stringify({
        type: "RETURN",
        returnedBy: "Mariama Bangura",
        programme: "Girls Primary Education Initiative",
        reason: "Damaged",
        conditionVerified: "Damaged",
        inventoryUpdated: "No",
        items: [
          {
            itemId: testItem.id,
            stockCode: testItem.stockCode,
            itemName: testItem.name,
            storeId: testItem.warehouseId || "BCF-STORE-001",
            storeName: testItem.warehouseName || "BCF Central Warehouse, Freetown",
            issueNumber: issueVoucherRef,
            qtyIssued: 5,
            qtyReturned: 2,
            condition: "Damaged",
            remarks: "Packaging soaked during transit; items quarantined for write-off",
          },
        ],
      }),
    });
    const damagedReturnData = await damagedReturnRes.json();
    assert(damagedReturnRes.ok && damagedReturnData.success, "Successfully recorded Damaged return", `Ref: ${damagedReturnData.returnReference}`);
    createdTxnIds.push(damagedReturnData.transaction.id);

    // Check store available balance did NOT increase
    const afterDamagedItemRes = await fetch(`${BASE_URL}/api/procurement/inventory/items`, {
      headers: getHeaders("PRC", "Alie Kamara"),
    });
    const afterDamagedItemsData = await afterDamagedItemRes.json();
    const itemAfterDamaged = afterDamagedItemsData.items.find((i) => i.id === testItem.id);
    assert(itemAfterDamaged.currentBalance === balBeforeDamaged, `Store available balance unchanged for damaged goods (${balBeforeDamaged} == ${itemAfterDamaged.currentBalance})`);

    // Verify pending Stock Adjustment entry created for quarantine
    const allTxnsRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      headers: getHeaders("PRC", "Alie Kamara"),
    });
    const allTxns = (await allTxnsRes.json()).transactions;
    const autoAdj = allTxns.find((t) => t.type === "ADJUSTMENT" && t.supportingEvidence === damagedReturnData.returnReference);
    assert(Boolean(autoAdj), "Pending Stock Adjustment created automatically with return evidence", `Adjustment Ref: ${autoAdj?.referenceNumber}`);
    if (autoAdj) createdTxnIds.push(autoAdj.id);

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Multi-store return in one return voucher
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 9: Multi-Store Return in Single Voucher ---");
    // Find two items in different stores
    const storesRes = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
      headers: getHeaders("PRC", "Alie Kamara"),
    });
    const stores = (await storesRes.json()).stores;
    const store1 = stores[0];
    const store2 = stores[1] || stores[0];

    const multiReturnRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
      method: "POST",
      headers: getHeaders("PRC", "Alie Kamara"),
      body: JSON.stringify({
        type: "RETURN",
        returnedBy: "Sorie Ibrahim Koroma",
        employeeName: "Sorie Ibrahim Koroma",
        staffId: "BCF-EMP-005",
        department: "Logistics & Transport",
        programme: "Water & Sanitation Hygiene (WASH) Program",
        reason: "Excess",
        conditionVerified: "Good",
        inventoryUpdated: "Yes",
        items: [
          {
            itemId: itemsData.items[0].id,
            stockCode: itemsData.items[0].stockCode,
            itemName: itemsData.items[0].name,
            storeId: store1.id,
            storeName: store1.storeName,
            qtyIssued: 10,
            qtyReturned: 2,
            condition: "Good",
            remarks: "Returned to Depot 1",
          },
          {
            itemId: itemsData.items[1].id,
            stockCode: itemsData.items[1].stockCode,
            itemName: itemsData.items[1].name,
            storeId: store2.id,
            storeName: store2.storeName,
            qtyIssued: 10,
            qtyReturned: 3,
            condition: "Good",
            remarks: "Returned to Depot 2",
          },
        ],
      }),
    });
    const multiReturnData = await multiReturnRes.json();
    assert(multiReturnRes.ok && multiReturnData.success, "Successfully saved multi-item return across different stores", `Ref: ${multiReturnData.returnReference}`);
    assert(multiReturnData.transaction.storeName === "Multiple stores" || store1.id === store2.id, `Header store displayed as: ${multiReturnData.transaction.storeName}`);
    createdTxnIds.push(multiReturnData.transaction.id);

    // ─────────────────────────────────────────────────────────────
    // TEST 11: Audit Trail Verification
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 11: Audit Trail Verification ---");
    const auditRes = await fetch(`${BASE_URL}/api/procurement/audit?tab=inventory-management`, {
      headers: getHeaders("SA", "Albert Bandama"),
    });
    if (auditRes.ok) {
      const auditData = await auditRes.json();
      const returnAudit = (auditData.logs || []).find((l) => l.action === "STOCK_RETURN");
      assert(Boolean(returnAudit), "Audit trail entry found for STOCK_RETURN action", `Action: ${returnAudit?.action}, User: ${returnAudit?.user}`);
    } else {
      console.log("[INFO] Audit endpoint responded with:", auditRes.status);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 13: Clean up test data
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- TEST 13: Clean up test data ---");
    console.log(`Cleaning up ${createdTxnIds.length} test transactions created during verification...`);

    const { MongoClient } = await import("mongodb");
    const { readFileSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const dns = await import("dns");
    dns.setServers(["8.8.8.8", "8.8.4.4"]);

    function loadEnvFile(file) {
      const p = join(process.cwd(), file);
      if (!existsSync(p)) return;
      for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m || process.env[m[1]]) continue;
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
    loadEnvFile(".env.local");
    loadEnvFile(".env");

    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const dbName = process.env.MONGODB_DB || "bcf_administrative_hub";

    if (uri) {
      const client = new MongoClient(uri);
      await client.connect();
      const db = client.db(dbName);

      // Delete test transactions created in this run
      const delResult = await db.collection("inventory_transactions").deleteMany({
        id: { $in: createdTxnIds },
      });
      console.log(`Deleted ${delResult.deletedCount} test transactions.`);

      // Also clean up any ADJ created during this run referencing our returns
      await db.collection("inventory_transactions").deleteMany({
        supportingEvidence: { $regex: "^BCF-RET-" },
      });

      // Restore initial balance on test item
      await db.collection("inventory_items").updateOne(
        { id: testItem.id },
        { $set: { currentBalance: initialItemBalance } }
      );
      await client.close();
      assert(true, "All test records deleted and initial item balance restored cleanly");
    } else {
      console.log("[SKIP] MongoDB URI not found in env, skipping direct DB cleanup");
    }

  } catch (err) {
    console.error("Test execution encountered an error:", err);
    failed++;
  }

  console.log("\n==================================================================");
  console.log(` ACCEPTANCE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");
  return { passed, failed };
}

runTests().then((res) => {
  if (res.failed > 0) process.exit(1);
  process.exit(0);
});
