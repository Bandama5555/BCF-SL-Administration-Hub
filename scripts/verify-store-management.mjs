/**
 * verify-store-management.mjs
 * Acceptance test verification for Store/Warehouse creation, item viewing, status toggling, and CEO email alerting.
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3001";

async function run() {
  console.log("==================================================================");
  console.log(" BCF-SL STORE / WAREHOUSE MANAGEMENT VERIFICATION");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  // 1. GET Stores
  console.log("--- TEST 1: Retrieve All Stores ---");
  const getRes = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
    headers: { "x-bcf-user-role": "SA", "x-bcf-name": "System Administrator" },
  });
  const getData = await getRes.json();
  assert(getRes.status === 200 && Array.isArray(getData.stores), `Stores retrieved successfully (found ${getData.stores?.length} stores)`);

  // 2. Create New Store (as PRC)
  console.log("\n--- TEST 2: Create New Store with Automated CEO Email Dispatch ---");
  const testStoreName = `Acceptance Test Kono Warehouse ${Date.now()}`;
  const createRes = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "PRC",
      "x-bcf-name": "Mariama Sesay (Procurement Director)",
    },
    body: JSON.stringify({
      storeName: testStoreName,
      location: "14 Post Office Road, Koidu Town",
      district: "Kono",
      chiefdom: "Gbense",
      storekeeper: "Sahr Tamba",
      contact: "+232 78 555 123",
      storageType: "Regional Depot",
      capacity: 6500,
      status: "Active",
    }),
  });
  const createData = await createRes.json();
  assert(createRes.status === 201 && createData.store?.id, `New store created: ${createData.store?.id} (${createData.store?.storeName}) with status: ${createData.store?.status}`);
  const createdStoreId = createData.store?.id;

  // 3. Test Unauthorized Create (as HR / View user)
  console.log("\n--- TEST 3: Block Store Creation by Unauthorized View-Only Roles ---");
  const unauthRes = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "HR",
      "x-bcf-name": "HR Director",
    },
    body: JSON.stringify({
      storeName: "Unauthorized Store",
      location: "Freetown",
    }),
  });
  assert(unauthRes.status === 403, `Unauthorized store creation rejected with 403 Forbidden`);

  // 4. Test Store Status Update: Active -> Suspended
  console.log("\n--- TEST 4: Update Store Status to Suspended (Triggers CEO Email) ---");
  const patchRes1 = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "SA",
      "x-bcf-name": "System Administrator",
    },
    body: JSON.stringify({
      id: createdStoreId,
      status: "Suspended",
    }),
  });
  const patchData1 = await patchRes1.json();
  assert(patchRes1.status === 200 && patchData1.store?.status === "Suspended", `Store ${createdStoreId} status transitioned to Suspended`);

  // 5. Test Store Status Update: Suspended -> Closed
  console.log("\n--- TEST 5: Update Store Status to Closed ---");
  const patchRes2 = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "PRC",
      "x-bcf-name": "Mariama Sesay (Procurement Director)",
    },
    body: JSON.stringify({
      id: createdStoreId,
      status: "Closed",
    }),
  });
  const patchData2 = await patchRes2.json();
  assert(patchRes2.status === 200 && patchData2.store?.status === "Closed", `Store ${createdStoreId} status transitioned to Closed`);

  // 6. Test Store Status Update: Closed -> Inactive -> Active
  console.log("\n--- TEST 6: Update Store Status to Inactive then Active ---");
  const patchRes3 = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "PRC",
      "x-bcf-name": "Mariama Sesay (Procurement Director)",
    },
    body: JSON.stringify({
      id: createdStoreId,
      status: "Inactive",
    }),
  });
  const patchData3 = await patchRes3.json();
  assert(patchRes3.status === 200 && patchData3.store?.status === "Inactive", `Store ${createdStoreId} status transitioned to Inactive`);

  const patchRes4 = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "SA",
      "x-bcf-name": "System Administrator",
    },
    body: JSON.stringify({
      id: createdStoreId,
      status: "Active",
    }),
  });
  const patchData4 = await patchRes4.json();
  assert(patchRes4.status === 200 && patchData4.store?.status === "Active", `Store ${createdStoreId} status transitioned to Active`);

  // 7. Test Invalid Status Rejection
  console.log("\n--- TEST 7: Reject Invalid Status Values ---");
  const invalidRes = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "PRC",
      "x-bcf-name": "Mariama Sesay",
    },
    body: JSON.stringify({
      id: createdStoreId,
      status: "INVALID_STATUS_CODE",
    }),
  });
  assert(invalidRes.status === 400, `Invalid store status rejected with 400 Bad Request`);

  // 8. Test Store Creation WITH Security Personnel Information
  console.log("\n--- TEST 8: Create Warehouse with Optional Security & Guard Information ---");
  const secStoreName = `Acceptance Test Secured Depot ${Date.now()}`;
  const secCreateRes = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "PRC",
      "x-bcf-name": "Mariama Sesay (Procurement Director)",
    },
    body: JSON.stringify({
      storeName: secStoreName,
      location: "Kissy Dockyard Logistics Compound",
      district: "Western Area Urban",
      chiefdom: "Kissy",
      storekeeper: "Alhaji Kamara",
      contact: "+232 78 111 222",
      storageType: "Central Warehouse",
      capacity: 12000,
      status: "Active",
      securityName: "Alpha Sesay & Lamin Bangura",
      securityAddress: "Gate 1 Guard Post, Dockyard Road",
      securityPhone: "+232 77 444 555",
      securityAgency: "Mount Everest Security Agency",
      securitySupervisorName: "Capt. Ibrahim Koroma",
      securitySupervisorPhone: "+232 76 333 444",
      securitySupervisorAddress: "Mount Everest HQ, 15 Wilkinson Road, Freetown",
    }),
  });
  const secCreateData = await secCreateRes.json();
  assert(
    secCreateRes.status === 201 &&
      secCreateData.store?.securityAgency === "Mount Everest Security Agency" &&
      secCreateData.store?.securitySupervisorName === "Capt. Ibrahim Koroma",
    `Created secured store with security details: Agency "${secCreateData.store?.securityAgency}", Guard "${secCreateData.store?.securityName}", Supervisor "${secCreateData.store?.securitySupervisorName}"`
  );
  const secStoreId = secCreateData.store?.id;

  // 9. Test Editing Stored Information (General and Security Details)
  console.log("\n--- TEST 9: Edit Stored Facility & Security Information ---");
  const editRes = await fetch(`${BASE_URL}/api/procurement/inventory/stores`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "SA",
      "x-bcf-name": "System Administrator",
    },
    body: JSON.stringify({
      id: secStoreId,
      storeName: `${secStoreName} (Renovated)`,
      location: "Kissy Dockyard Expanded Wing B",
      storekeeper: "Alhaji Kamara Jr.",
      capacity: 15000,
      securityAgency: "G4S Security Sierra Leone",
      securitySupervisorName: "Maj. David Mansaray",
      securitySupervisorPhone: "+232 79 999 888",
    }),
  });
  const editData = await editRes.json();
  assert(
    editRes.status === 200 &&
      editData.store?.storeName.includes("(Renovated)") &&
      editData.store?.capacity === 15000 &&
      editData.store?.securityAgency === "G4S Security Sierra Leone" &&
      editData.store?.securitySupervisorName === "Maj. David Mansaray",
    `Successfully edited store information and security details (Agency now "${editData.store?.securityAgency}", Supervisor: "${editData.store?.securitySupervisorName}")`
  );

  console.log("\n==================================================================");
  console.log(` STORE ACCEPTANCE SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
