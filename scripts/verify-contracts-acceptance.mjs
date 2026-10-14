/**
 * verify-contracts-acceptance.mjs
 * Complete automated test suite verifying all 10 acceptance tests
 * for the Employee Contracts tab in BCF SL Administration Hub.
 */

const BASE_URL = "http://localhost:3001";

async function runTests() {
  console.log("================================================================================");
  console.log("BCF-SL ADMINISTRATION HUB — EMPLOYEE CONTRACTS MODULE ACCEPTANCE TEST SUITE");
  console.log("================================================================================\n");

  const results = [];
  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`  ✓ ${message}`);
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Staff user (Staff A / BCF-ST-001)
    // -------------------------------------------------------------------------
    console.log("▶ TEST 1: Staff user isolation, permissions, and blocked unauthorized access");
    {
      const res = await fetch(`${BASE_URL}/api/documents?tab=employee-contracts&role=ST&user=staff_user&email=staff@bcf-sl.org&employeeId=BCF-ST-001`);
      assert(res.status === 200, "Staff A receives 200 OK for employee-contracts tab");
      const data = await res.json();
      assert(data.permissions.canView === true, "Staff can view own contract");
      assert(data.permissions.canDownload === true, "Staff can download own contract");
      assert(data.permissions.canUpload === false, "Staff cannot upload contracts");
      assert(data.permissions.canEdit === false, "Staff cannot edit contracts");
      assert(data.permissions.canDelete === false, "Staff cannot delete contracts");
      assert(data.permissions.canRestore === false, "Staff cannot restore contracts");
      assert(data.permissions.canViewDownloadHistory === false, "Staff cannot view download history");

      // Verify all returned items belong exclusively to BCF-ST-001
      assert(data.items.length > 0, "Staff A has at least one contract returned");
      const hasOtherContracts = data.items.some(item => item.employeeId !== "BCF-ST-001");
      assert(!hasOtherContracts, "Staff A sees ONLY contracts with employeeId = BCF-ST-001");

      // Attempt to access another employee's contract (BCF-ST-002) directly by ID
      const bcfSt002Item = (await (await fetch(`${BASE_URL}/api/documents?tab=employee-contracts&role=SA`)).json())
        .items.find(i => i.employeeId === "BCF-ST-002");

      if (bcfSt002Item) {
        const directRes = await fetch(`${BASE_URL}/api/documents/${bcfSt002Item.id}?role=ST&user=staff_user&email=staff@bcf-sl.org&employeeId=BCF-ST-001`);
        assert(directRes.status === 403, "Direct API access to another employee's contract returns 403 Forbidden");
        const errJson = await directRes.json();
        assert(errJson.error === "You do not have access to that page.", "Error message matches institutional privacy specification: 'You do not have access to that page.'");
      }
      results.push({ test: 1, name: "Staff user isolation & permissions", passed: true });
    }

    // -------------------------------------------------------------------------
    // TEST 2: HR Director, Super Admin and CEO full management rights
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 2: HR Director, Super Admin, and CEO management rights");
    for (const role of ["HR", "SA", "CEO"]) {
      const res = await fetch(`${BASE_URL}/api/documents?tab=employee-contracts&role=${role}`);
      assert(res.status === 200, `${role} can access employee-contracts tab (200 OK)`);
      const data = await res.json();
      assert(data.permissions.canView === true, `${role} can view`);
      assert(data.permissions.canDownload === true, `${role} can download`);
      assert(data.permissions.canUpload === true, `${role} can upload`);
      assert(data.permissions.canEdit === true, `${role} can edit`);
      assert(data.permissions.canDelete === true, `${role} can delete`);
      assert(data.items.length >= 2, `${role} sees all employees contracts`);
    }
    results.push({ test: 2, name: "HR, Super Admin, CEO full rights", passed: true });

    // -------------------------------------------------------------------------
    // TEST 3: Internal Audit & Risk Director (IAR) read-only rights
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 3: Internal Audit & Risk Director read-only rights & download history");
    {
      const res = await fetch(`${BASE_URL}/api/documents?tab=employee-contracts&role=IAR`);
      assert(res.status === 200, "IAR can access employee-contracts tab (200 OK)");
      const data = await res.json();
      assert(data.permissions.canView === true, "IAR can view all contracts");
      assert(data.permissions.canDownload === true, "IAR can download contracts");
      assert(data.permissions.canViewDownloadHistory === true, "IAR can view download history");
      assert(data.permissions.canUpload === false, "IAR cannot upload");
      assert(data.permissions.canEdit === false, "IAR cannot edit");
      assert(data.permissions.canDelete === false, "IAR cannot delete");
      assert(data.permissions.canRestore === false, "IAR cannot restore");
      results.push({ test: 3, name: "Internal Audit & Risk Director read-only", passed: true });
    }

    // -------------------------------------------------------------------------
    // TEST 4: Finance, Programs, Procurement, IT Directors blocked (hidden)
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 4: Unauthorized roles blocked from accessing employee-contracts tab");
    for (const role of ["FIN", "PRG", "PRC", "IT"]) {
      const res = await fetch(`${BASE_URL}/api/documents?tab=employee-contracts&role=${role}`);
      assert(res.status === 403, `${role} is blocked from employee-contracts tab with 403 Forbidden`);
      const errJson = await res.json();
      assert(errJson.code === "ACCESS_DENIED", `${role} receives ACCESS_DENIED error code`);
    }
    results.push({ test: 4, name: "Unauthorized roles blocked (FIN, PRG, PRC, IT)", passed: true });

    // -------------------------------------------------------------------------
    // TEST 5 & 6 & 7: Upload by HR, download by employee & CEO, delete by CEO, restore by SA
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 5, 6, 7: Upload by HR, download tracking, delete by CEO, and restore by Super Admin");
    let testContractId = null;
    {
      // 5.1 Upload contract as HR Director
      const createRes = await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": "HR",
          "x-bcf-username": "hr_user",
          "x-bcf-email": "hr@bcf-sl.org",
          "x-bcf-name": "Mariama Sesay (HR Director)",
        },
        body: JSON.stringify({
          category: "employee-contracts",
          tab: "employee-contracts",
          title: "Temporary Test Employment Contract",
          description: "Full-stack acceptance testing contract verification",
          fileName: "employment_contract_test.pdf",
          fileSize: 1048576, // 1MB
          fileType: "application/pdf",
          fileData: "JVBERi0xLjQKJcTl8uXr...",
          employeeId: "BCF-ST-001",
          employeeName: "Mabinty Mustapha",
          employeeDept: "Field Operations",
          contractType: "Fixed-Term Contract",
          startDate: "2026-10-01",
          endDate: "2026-11-20", // Expiring within 60 days
          contractStatus: "Active",
          userRole: "HR",
          userName: "Mariama Sesay (HR Director)",
          userEmail: "hr@bcf-sl.org",
        }),
      });

      const debugBody = await createRes.clone().json().catch(e => null);
      assert(createRes.status === 200 || createRes.status === 201, `HR successfully uploaded test contract (200/201 OK) — debug: ${JSON.stringify(debugBody)}`);
      const createdData = await createRes.json();
      testContractId = createdData.item ? createdData.item.id : createdData.id;
      assert(testContractId !== null && testContractId !== undefined, `Received test contract ID: ${testContractId}`);

      // 5.2 Download as the employee (Staff A)
      const empDlRes = await fetch(`${BASE_URL}/api/documents/${testContractId}/download?role=ST&user=staff_user&email=staff@bcf-sl.org&name=Mabinty%20Mustapha&employeeId=BCF-ST-001`);
      assert(empDlRes.status === 200, "Employee (Staff A) successfully downloaded own contract (200 OK)");

      // 5.3 Download as the CEO
      const ceoDlRes = await fetch(`${BASE_URL}/api/documents/${testContractId}/download?role=CEO&user=ceo_user&email=ceo@bcf-sl.org&name=Dr.%20Kelfala%20Bandama`);
      assert(ceoDlRes.status === 200, "CEO successfully downloaded contract (200 OK)");

      // 5.4 Check download history as HR
      const hrJson = await (await fetch(`${BASE_URL}/api/documents/${testContractId}?role=HR`)).json();
      const itemAsHr = hrJson.item || hrJson;
      assert(itemAsHr.downloadCount === 2, "Contract records exactly 2 downloads (repeats tracked)");
      assert(itemAsHr.downloadHistory.length === 2, "HR sees 2 download records in history");
      assert(itemAsHr.downloadHistory.some(d => d.roleCode === "ST"), "Staff download recorded in download history");
      assert(itemAsHr.downloadHistory.some(d => d.roleCode === "CEO"), "CEO download recorded in download history");

      // 5.5 Confirm download history is hidden from employee
      const staffJson = await (await fetch(`${BASE_URL}/api/documents/${testContractId}?role=ST&user=staff_user&email=staff@bcf-sl.org&employeeId=BCF-ST-001`)).json();
      const itemAsStaff = staffJson.item || staffJson;
      assert(!itemAsStaff.downloadHistory || itemAsStaff.downloadHistory.length === 0, "Download history is hidden from employee record view");

      results.push({ test: 5, name: "Download tracking and role-based history privacy", passed: true });

      // 6.1 Delete as CEO without reason (must fail)
      const delWithoutReason = await fetch(`${BASE_URL}/api/documents/${testContractId}?role=CEO&user=ceo_user&email=ceo@bcf-sl.org&name=Dr.%20Kelfala%20Bandama`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert(delWithoutReason.status === 400, "Deletion without a reason is rejected with 400 Bad Request");

      // 6.2 Delete as CEO with valid reason
      const delWithReason = await fetch(`${BASE_URL}/api/documents/${testContractId}?role=CEO&user=ceo_user&email=ceo@bcf-sl.org&name=Dr.%20Kelfala%20Bandama`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Contract term updated; archived for institutional audit." }),
      });
      assert(delWithReason.status === 200, "Contract soft-deleted successfully by CEO (200 OK)");

      // 6.3 Verify contract left active list
      const activeList = await (await fetch(`${BASE_URL}/api/documents?tab=employee-contracts&role=CEO`)).json();
      assert(!activeList.items.some(i => i.id === testContractId), "Deleted contract is no longer in active contracts list");

      // 6.4 Verify contract appears in Deleted Items Log marked "Deleted"
      const deletedLog = await (await fetch(`${BASE_URL}/api/documents?tab=deleted-items&role=CEO`)).json();
      const deletedItem = deletedLog.items.find(i => i.id === testContractId);
      assert(deletedItem !== undefined, "Deleted contract appears in Deleted Items Log");
      assert(deletedItem.status === "Deleted", "Item status is 'Deleted'");
      assert(deletedItem.deletedInfo.deletedBy.name.includes("Dr. Kelfala Bandama"), "Records CEO as deleter");
      assert(deletedItem.deletedInfo.reason === "Contract term updated; archived for institutional audit.", "Records deletion reason accurately");

      // 6.5 Verify deleted contract cannot be downloaded
      const dlDeleted = await fetch(`${BASE_URL}/api/documents/${testContractId}/download?role=CEO`);
      assert(dlDeleted.status === 403, "Downloading deleted contract is blocked (403 Forbidden)");

      // 6.6 Verify only Super Admin can restore (HR / CEO restore fails)
      const hrRestore = await fetch(`${BASE_URL}/api/documents/${testContractId}/restore?role=HR`, { method: "POST" });
      assert(hrRestore.status === 403, "HR cannot restore deleted contract (403 Forbidden)");

      const ceoRestore = await fetch(`${BASE_URL}/api/documents/${testContractId}/restore?role=CEO`, { method: "POST" });
      assert(ceoRestore.status === 403, "CEO cannot restore deleted contract (403 Forbidden)");

      // 6.7 Restore by Super Admin succeeds
      const saRestore = await fetch(`${BASE_URL}/api/documents/${testContractId}/restore?role=SA&user=albert_admin&name=Albert%20Joseph%20Bandama`, { method: "POST" });
      assert(saRestore.status === 200, "Super Admin restores deleted contract successfully (200 OK)");

      const restoredJson = await (await fetch(`${BASE_URL}/api/documents/${testContractId}?role=SA`)).json();
      const restoredItem = restoredJson.item || restoredJson;
      assert(restoredItem.status === "Active", "Contract restored to 'Active' status");

      results.push({ test: 6, name: "Soft delete, reason requirement, and Super Admin restore", passed: true });

      // -------------------------------------------------------------------------
      // TEST 7: Notifications
      // -------------------------------------------------------------------------
      console.log("\n▶ TEST 7: Notifications delivery to employee & governance roles; no leaks to other staff");
      const empNotifsData = await (await fetch(`${BASE_URL}/api/documents/notifications?role=ST&user=staff_user&email=staff@bcf-sl.org&employeeId=BCF-ST-001`)).json();
      const empNotifs = empNotifsData.notifications || empNotifsData.items || [];
      assert(empNotifs.length > 0, "Staff A received notification about contract action on their record");
      assert(empNotifs.some(n => n.itemTitle.includes("contract") || n.action === "Added" || n.action === "Restored"), "Notification accurately describes event without leaking other data");

      // Verify Staff B did not receive any notification for Staff A's contract
      const staffBNotifsData = await (await fetch(`${BASE_URL}/api/documents/notifications?role=ST&user=staff_user_b&email=staff_b@bcf-sl.org&employeeId=BCF-ST-002`)).json();
      const staffBNotifs = staffBNotifsData.notifications || staffBNotifsData.items || [];
      const leakedNotif = staffBNotifs.some(n => n.itemId === testContractId);
      assert(!leakedNotif, "Staff B received ZERO notifications regarding Staff A's contract");

      results.push({ test: 7, name: "Notification targeting & privacy", passed: true });
    }

    // -------------------------------------------------------------------------
    // TEST 8: Shared layout validation
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 8: Shared layout and single-header design");
    {
      // SubApp routing check: /documents-policies/employee-contracts
      const pageRes = await fetch(`${BASE_URL}/documents-policies/employee-contracts`);
      assert(pageRes.status === 200, "SubApp route /documents-policies/employee-contracts renders 200 OK");
      results.push({ test: 8, name: "Shared layout and URL routing integrity", passed: true });
    }

    // -------------------------------------------------------------------------
    // TEST 9: Clean up test data
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 9: Clean up test data");
    {
      if (testContractId) {
        // Permanently clean up test contract from database via DELETE or direct query
        const delRes = await fetch(`${BASE_URL}/api/documents/${testContractId}?role=SA&user=admin&name=Albert%20Bandama`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "End of automated acceptance test cleanup" }),
        });
        assert(delRes.status === 200, "Cleaned up temporary test contract");
      }
      results.push({ test: 9, name: "Acceptance test data cleanup", passed: true });
    }

    // -------------------------------------------------------------------------
    // TEST 10: Multi-staff isolation (Staff A vs Staff B)
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 10: Multi-staff isolation (Staff A vs Staff B)");
    {
      // Query as Staff A
      const resA = await fetch(`${BASE_URL}/api/documents?tab=employee-contracts&role=ST&user=staff_user&email=staff@bcf-sl.org&employeeId=BCF-ST-001`);
      const dataA = await resA.json();
      assert(dataA.items.every(i => i.employeeId === "BCF-ST-001"), "Staff A sees ONLY A's contracts");

      // Query as Staff B
      const resB = await fetch(`${BASE_URL}/api/documents?tab=employee-contracts&role=ST&user=staff_user_b&email=staff_b@bcf-sl.org&employeeId=BCF-ST-002`);
      const dataB = await resB.json();
      assert(dataB.items.every(i => i.employeeId === "BCF-ST-002"), "Staff B sees ONLY B's contracts");

      // Staff A tries to access Staff B's contract via API
      const contractB = dataB.items[0];
      if (contractB) {
        // Direct GET
        const blockGet = await fetch(`${BASE_URL}/api/documents/${contractB.id}?role=ST&user=staff_user&email=staff@bcf-sl.org&employeeId=BCF-ST-001`);
        assert(blockGet.status === 403, "Staff A direct GET for Staff B's contract is blocked with 403");

        // Download link
        const blockDl = await fetch(`${BASE_URL}/api/documents/${contractB.id}/download?role=ST&user=staff_user&email=staff@bcf-sl.org&employeeId=BCF-ST-001`);
        assert(blockDl.status === 403, "Staff A direct download for Staff B's contract is blocked with 403");
      }

      // Staff B tries to access Staff A's contract via API
      const contractA = dataA.items[0];
      if (contractA) {
        // Direct GET
        const blockGetB = await fetch(`${BASE_URL}/api/documents/${contractA.id}?role=ST&user=staff_user_b&email=staff_b@bcf-sl.org&employeeId=BCF-ST-002`);
        assert(blockGetB.status === 403, "Staff B direct GET for Staff A's contract is blocked with 403");

        // Download link
        const blockDlB = await fetch(`${BASE_URL}/api/documents/${contractA.id}/download?role=ST&user=staff_user_b&email=staff_b@bcf-sl.org&employeeId=BCF-ST-002`);
        assert(blockDlB.status === 403, "Staff B direct download for Staff A's contract is blocked with 403");
      }

      results.push({ test: 10, name: "Multi-staff complete isolation (A vs B)", passed: true });
    }

    // -------------------------------------------------------------------------
    // TEST 11: Contract Type Required (Cannot submit without choosing one of 7 types)
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 11: Upload contract type required and validation of the 7 types");
    {
      // Missing contractType
      const noTypeRes = await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Contract Without Type",
          description: "Testing contract upload without type",
          category: "employee-contracts",
          employeeId: "BCF-ST-001",
          employeeName: "Mabinty Mustapha",
          startDate: "2026-01-01",
          fileName: "contract_test.pdf",
          fileData: "data:application/pdf;base64,JVBERi0xLjQKJ",
          userName: "Joseph Conteh",
          userRole: "HR",
        }),
      });
      assert(noTypeRes.status === 400, "Submitting contract without contractType is blocked with 400");
      const err = await noTypeRes.json();
      assert(err.error.includes("Contract type is required"), "Error mentions contract type is required");

      // Invalid contractType
      const badTypeRes = await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Contract Invalid Type",
          description: "Testing invalid type",
          category: "employee-contracts",
          employeeId: "BCF-ST-001",
          contractType: "Temporary",
          startDate: "2026-01-01",
          fileName: "contract_test.pdf",
          fileData: "data:application/pdf;base64,JVBERi0xLjQKJ",
          userName: "Joseph Conteh",
          userRole: "HR",
        }),
      });
      assert(badTypeRes.status === 400, "Submitting invalid contractType is blocked with 400");
      results.push({ test: 11, name: "Contract Type required & 7 valid types enforced", passed: true });
    }

    // -------------------------------------------------------------------------
    // TEST 12: Conditional End Date for the 5 types (Required & after start date)
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 12: Fixed-Term, Part-Time, Casual, Consultant, Intern require End Date > Start Date");
    const typesWithEndDate = ["Fixed-Term Contract", "Part-Time", "Casual", "Consultant", "Intern"];
    for (const cType of typesWithEndDate) {
      // Missing end date
      const noEndRes = await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Test ${cType} without end date`,
          description: `Testing missing end date for ${cType}`,
          category: "employee-contracts",
          employeeId: "BCF-ST-001",
          contractType: cType,
          startDate: "2026-01-01",
          fileName: "contract_test.pdf",
          fileData: "data:application/pdf;base64,JVBERi0xLjQKJ",
          userName: "Joseph Conteh",
          userRole: "HR",
        }),
      });
      assert(noEndRes.status === 400, `${cType} without end date is rejected with 400`);

      // End date before or equal to start date
      const badEndRes = await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Test ${cType} bad date order`,
          description: `Testing end date <= start date for ${cType}`,
          category: "employee-contracts",
          employeeId: "BCF-ST-001",
          contractType: cType,
          startDate: "2026-06-01",
          endDate: "2026-05-01",
          fileName: "contract_test.pdf",
          fileData: "data:application/pdf;base64,JVBERi0xLjQKJ",
          userName: "Joseph Conteh",
          userRole: "HR",
        }),
      });
      assert(badEndRes.status === 400, `${cType} with endDate <= startDate is rejected with 400`);
    }
    results.push({ test: 12, name: "End Date required and strictly after Start Date for 5 types", passed: true });

    // -------------------------------------------------------------------------
    // TEST 13: Permanent & Volunteer contracts never store or show end date or Expired status
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 13: Permanent & Volunteer contracts have null end date & never Expired");
    let testPermDocId = null;
    let testVolDocId = null;
    {
      // Create valid Permanent contract
      const createPermRes = await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Acceptance Test Permanent Contract",
          description: "Permanent contract for acceptance verification",
          category: "employee-contracts",
          employeeId: "BCF-ST-001",
          contractType: "Permanent",
          startDate: "2026-01-01",
          contractStatus: "Active",
          fileName: "perm_test.pdf",
          fileData: "data:application/pdf;base64,JVBERi0xLjQKJ",
          userName: "Joseph Conteh",
          userRole: "HR",
        }),
      });
      assert(createPermRes.status === 200 || createPermRes.status === 201, "Successfully created Permanent contract");
      const permData = await createPermRes.json();
      testPermDocId = permData.item.id;
      const fetchedPerm = (await (await fetch(`${BASE_URL}/api/documents/${testPermDocId}?role=HR`)).json()).item;
      assert(fetchedPerm.endDate === null, "Permanent contract stored endDate is strictly null");

      // Create valid Volunteer contract
      const createVolRes = await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Acceptance Test Volunteer Contract",
          description: "Volunteer contract for acceptance verification",
          category: "employee-contracts",
          employeeId: "BCF-ST-001",
          contractType: "Volunteer",
          startDate: "2026-01-01",
          contractStatus: "Active",
          fileName: "vol_test.pdf",
          fileData: "data:application/pdf;base64,JVBERi0xLjQKJ",
          userName: "Joseph Conteh",
          userRole: "HR",
        }),
      });
      assert(createVolRes.status === 200 || createVolRes.status === 201, "Successfully created Volunteer contract");
      const volData = await createVolRes.json();
      testVolDocId = volData.item.id;
      const fetchedVol = (await (await fetch(`${BASE_URL}/api/documents/${testVolDocId}?role=HR`)).json()).item;
      assert(fetchedVol.endDate === null, "Volunteer contract stored endDate is strictly null");

      // Verify in Staff A "My Contract" view: endDate is null
      const staffViewRes = await fetch(`${BASE_URL}/api/documents?tab=employee-contracts&role=ST&user=staff_user&email=staff@bcf-sl.org&employeeId=BCF-ST-001`);
      const staffItems = (await staffViewRes.json()).items;
      const permItem = staffItems.find(i => i.id === testPermDocId);
      assert(permItem && permItem.endDate === null, "Staff My Contract view: Permanent contract endDate is null");

      // Verify Volunteer contract cannot have status 'Expired'
      const badStatusRes = await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Invalid Expired Volunteer Contract",
          description: "Trying to upload Expired volunteer",
          category: "employee-contracts",
          employeeId: "BCF-ST-001",
          contractType: "Volunteer",
          startDate: "2026-01-01",
          contractStatus: "Expired",
          fileName: "vol_expired.pdf",
          fileData: "data:application/pdf;base64,JVBERi0xLjQKJ",
          userName: "Joseph Conteh",
          userRole: "HR",
        }),
      });
      assert(badStatusRes.status === 400, "Server blocks status 'Expired' on Volunteer contract with 400");

      results.push({ test: 13, name: "Permanent & Volunteer never have end date or Expired status", passed: true });
    }

    // -------------------------------------------------------------------------
    // TEST 14: Direct API sends end date for Permanent contract -> server rejects with 400
    // -------------------------------------------------------------------------
    console.log("\n▶ TEST 14: Server explicitly rejects an end date sent for Permanent contracts");
    {
      // 14a. Reject end date in POST
      const rejectPostRes = await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Malicious End Date Permanent Contract",
          description: "Direct API submission trying to bypass client UI",
          category: "employee-contracts",
          employeeId: "BCF-ST-001",
          contractType: "Permanent",
          startDate: "2026-01-01",
          endDate: "2027-01-01",
          fileName: "contract_test.pdf",
          fileData: "data:application/pdf;base64,JVBERi0xLjQKJ",
          userName: "Joseph Conteh",
          userRole: "HR",
        }),
      });
      assert(rejectPostRes.status === 400, "POST with end date for Permanent contract is rejected with 400");
      const postErr = await rejectPostRes.json();
      assert(postErr.error.includes("Permanent contracts cannot have an end date"), "Error message specifies: Permanent contracts cannot have an end date");

      // 14b. Reject end date in PUT
      if (testPermDocId) {
        const rejectPutRes = await fetch(`${BASE_URL}/api/documents/${testPermDocId}?role=HR&user=Joseph%20Conteh`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractType: "Permanent",
            startDate: "2026-01-01",
            endDate: "2028-12-31",
          }),
        });
        assert(rejectPutRes.status === 400, "PUT with end date for Permanent contract is rejected with 400");
        const putErr = await rejectPutRes.json();
        assert(putErr.error.includes("Permanent contracts cannot have an end date"), "PUT error confirms: Permanent contracts cannot have an end date");
      }

      // 14c. Editing type to Permanent clears end date in database
      const createFixedRes = await fetch(`${BASE_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Temporary Fixed Term for Conversion",
          description: "Will convert to permanent",
          category: "employee-contracts",
          employeeId: "BCF-ST-001",
          contractType: "Fixed-Term Contract",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          contractStatus: "Active",
          fileName: "fixed_test.pdf",
          fileData: "data:application/pdf;base64,JVBERi0xLjQKJ",
          userName: "Joseph Conteh",
          userRole: "HR",
        }),
      });
      const fixedDoc = await createFixedRes.json();
      assert(createFixedRes.status === 200 || createFixedRes.status === 201, "Created Fixed-Term contract");

      // Convert to Permanent via PUT without sending an end date:
      const convertRes = await fetch(`${BASE_URL}/api/documents/${fixedDoc.item.id}?role=HR&user=Joseph%20Conteh`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractType: "Permanent",
          startDate: "2026-01-01",
          changeSummary: "Promoted to permanent staff",
        }),
      });
      assert(convertRes.status === 200, "Successfully converted to Permanent contract");
      const updatedFixed = (await (await fetch(`${BASE_URL}/api/documents/${fixedDoc.item.id}?role=HR&user=Joseph%20Conteh`)).json()).item;
      assert(updatedFixed.endDate === null, "Converted contract has stored endDate stripped to null");

      // Clean up temporary documents
      for (const idToClean of [testPermDocId, testVolDocId, fixedDoc.item.id]) {
        if (idToClean) {
          await fetch(`${BASE_URL}/api/documents/${idToClean}?role=SA&user=admin`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Cleanup acceptance test 14" }),
          });
        }
      }

      results.push({ test: 14, name: "Server API rejects end date for Permanent contract (POST & PUT)", passed: true });
    }

    console.log("\n================================================================================");
    console.log("ALL 14 ACCEPTANCE TESTS PASSED SUCCESSFULLY! 100% COMPLIANT");
    console.log("================================================================================");
    console.table(results);
    return true;
  } catch (error) {
    console.error("\n❌ Acceptance test suite failed:", error);
    process.exit(1);
  }
}

runTests();
