// Verification script for Inter-Warehouse Stock Transfers
const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

async function run() {
  console.log("=== Testing Stock Transfer API & Workflow ===");
  const headers = {
    "Content-Type": "application/json",
    "x-bcf-user-role": "PRC",
    "x-bcf-name": "Procurement Officer",
  };

  // 1. Fetch stores
  const storesRes = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, { headers });
  const storesData = await storesRes.json();
  const stores = storesData.stores || [];
  console.log(`Found ${stores.length} stores.`);
  if (stores.length < 2) {
    console.error("Need at least 2 stores to test transfer.");
    process.exit(1);
  }

  const srcStore = stores[0];
  const destStore = stores[1];
  console.log(`Source Store: ${srcStore.id} (${srcStore.storeName})`);
  console.log(`Destination Store: ${destStore.id} (${destStore.storeName})`);

  // 2. Fetch items
  const itemsRes = await fetch(`${BASE_URL}/api/procurement/inventory/items`, { headers });
  const itemsData = await itemsRes.json();
  const items = itemsData.items || [];
  console.log(`Found ${items.length} total inventory items.`);

  // Find an item in srcStore with positive balance
  const sourceItem = items.find(
    (it) =>
      (it.warehouseId === srcStore.id ||
        it.warehouseName === srcStore.storeName ||
        (srcStore.id === "BCF-STORE-001" && (!it.warehouseId || it.warehouseId === "Central"))) &&
      it.currentBalance > 2
  );

  if (!sourceItem) {
    console.log("No item found in source store with balance > 2; creating a temporary item in source store...");
    const createItemRes = await fetch(`${BASE_URL}/api/procurement/inventory/items`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        stockCode: `TRF-TEST-${Date.now().toString().slice(-4)}`,
        name: "Inter-Depot Test First Aid Kits",
        description: "Test kits for transfer validation",
        category: "Health & Medical Supplies",
        itemClass: "Consumable",
        unit: "Carton",
        minStockLevel: 5,
        maxStockLevel: 100,
        reorderLevel: 10,
        reorderQuantity: 20,
        currentBalance: 50,
        unitCost: 150,
        warehouseId: srcStore.id,
        warehouseName: srcStore.storeName,
      }),
    });
    const createdData = await createItemRes.json();
    console.log("Created test item:", createdData.item?.id);
    return testTransfer(createdData.item, srcStore, destStore, headers);
  }

  await testTransfer(sourceItem, srcStore, destStore, headers);
}

async function testTransfer(sourceItem, srcStore, destStore, headers) {
  const initialSourceBalance = sourceItem.currentBalance;
  const transferQty = 5;
  console.log(`Initial Source Balance for [${sourceItem.stockCode}] ${sourceItem.name}: ${initialSourceBalance}`);

  // Fetch initial destination balance if item already exists there
  const itemsBeforeRes = await fetch(`${BASE_URL}/api/procurement/inventory/items`, { headers });
  const itemsBefore = (await itemsBeforeRes.json()).items || [];
  const existingDestItem = itemsBefore.find(
    (it) =>
      it.stockCode === sourceItem.stockCode &&
      (it.warehouseId === destStore.id || it.warehouseName === destStore.storeName)
  );
  const initialDestBalance = existingDestItem ? existingDestItem.currentBalance : 0;
  console.log(`Initial Destination Balance for [${sourceItem.stockCode}] in ${destStore.storeName}: ${initialDestBalance}`);

  // 3. Initiate Transfer
  const refNum = `WB-TEST-${Date.now().toString().slice(-5)}`;
  console.log(`Dispatching Transfer: ${transferQty} units with Reference ${refNum}...`);

  const transferRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "TRANSFER",
      itemId: sourceItem.id,
      quantity: transferQty,
      sourceStoreId: srcStore.id,
      sourceStoreName: srcStore.storeName,
      destStoreId: destStore.id,
      destStoreName: destStore.storeName,
      referenceNumber: refNum,
      reason: "Automated inter-depot rebalancing verification",
      notes: "Driver: Alpha Turay; Vehicle: BCF-SL-884",
    }),
  });

  if (!transferRes.ok) {
    const err = await transferRes.json();
    console.error("Transfer failed:", err);
    process.exit(1);
  }

  const transferResult = await transferRes.json();
  console.log("Transfer API succeeded:", transferResult.transaction?.referenceNumber);

  // 4. Verify balances
  const itemsAfterRes = await fetch(`${BASE_URL}/api/procurement/inventory/items`, { headers });
  const itemsAfter = (await itemsAfterRes.json()).items || [];

  const updatedSourceItem = itemsAfter.find((it) => it.id === sourceItem.id);
  const updatedDestItem = itemsAfter.find(
    (it) =>
      it.stockCode === sourceItem.stockCode &&
      (it.warehouseId === destStore.id || it.warehouseName === destStore.storeName)
  );

  console.log(`Updated Source Balance: ${updatedSourceItem?.currentBalance} (Expected: ${initialSourceBalance - transferQty})`);
  console.log(`Updated Destination Balance: ${updatedDestItem?.currentBalance} (Expected: ${initialDestBalance + transferQty})`);

  if (updatedSourceItem?.currentBalance !== initialSourceBalance - transferQty) {
    console.error("Source balance did not decrement correctly!");
    process.exit(1);
  }

  if (updatedDestItem?.currentBalance !== initialDestBalance + transferQty) {
    console.error("Destination balance did not increment correctly!");
    process.exit(1);
  }

  // 5. Verify transaction record
  const txnsRes = await fetch(`${BASE_URL}/api/procurement/inventory/transactions`, { headers });
  const txnsData = await txnsRes.json();
  const txns = txnsData.transactions || [];
  const recordedTxn = txns.find((t) => t.referenceNumber === refNum);

  if (!recordedTxn) {
    console.error("Transfer transaction was not found in transactions list!");
    process.exit(1);
  }

  console.log("Verified Transaction Log Entry:");
  console.log({
    referenceNumber: recordedTxn.referenceNumber,
    type: recordedTxn.type,
    stockCode: recordedTxn.stockCode,
    quantity: recordedTxn.quantity,
    source: `${recordedTxn.sourceStoreId} (${recordedTxn.sourceStoreName})`,
    destination: `${recordedTxn.destStoreId} (${recordedTxn.destStoreName})`,
    status: recordedTxn.status,
  });

  console.log("\nALL INTER-WAREHOUSE STOCK TRANSFER VERIFICATION CHECKS PASSED!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
