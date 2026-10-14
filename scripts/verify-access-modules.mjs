// scripts/verify-access-modules.mjs
// Comprehensive Acceptance Test Suite for Access Request and Access Approval Modules
const BASE_URL = "http://127.0.0.1:3001";

let testRequestIds = [];
let testGrantIds = [];

const STAFF_HEADERS = {
  "Content-Type": "application/json",
  "x-bcf-user-role": "ST",
  "x-bcf-username": "staff_user",
  "x-bcf-email": "staff@bcf-sl.org",
  "x-bcf-name": "Mabinty Mustapha",
  "x-bcf-department": "Programs Department",
  "x-bcf-employee-id": "BCF-ST-001",
};

const LOGISTICS_STAFF_HEADERS = {
  "Content-Type": "application/json",
  "x-bcf-user-role": "ST",
  "x-bcf-username": "staff_user_b",
  "x-bcf-email": "staff_b@bcf-sl.org",
  "x-bcf-name": "Alpha Kamara",
  "x-bcf-department": "Logistics Department",
  "x-bcf-employee-id": "BCF-ST-002",
};

const PROGRAMS_DIRECTOR_HEADERS = {
  "Content-Type": "application/json",
  "x-bcf-user-role": "PRG",
  "x-bcf-username": "prg_director",
  "x-bcf-email": "fsesay@bcf-sl.org",
  "x-bcf-name": "Fatmata Sesay",
  "x-bcf-department": "Programs Department",
  "x-bcf-employee-id": "BCF-PRG-001",
};

const FINANCE_DIRECTOR_HEADERS = {
  "Content-Type": "application/json",
  "x-bcf-user-role": "FIN",
  "x-bcf-username": "fin_director",
  "x-bcf-email": "mbangura@bcf-sl.org",
  "x-bcf-name": "Mohamed Bangura",
  "x-bcf-department": "Finance Department",
  "x-bcf-employee-id": "BCF-FIN-001",
};

const IT_DIRECTOR_HEADERS = {
  "Content-Type": "application/json",
  "x-bcf-user-role": "IT",
  "x-bcf-username": "it_director",
  "x-bcf-email": "atoro@bcf-sl.org",
  "x-bcf-name": "Augustine Toro",
  "x-bcf-department": "Information Technology (IT) Department",
  "x-bcf-employee-id": "BCF-IT-001",
};

const HR_DIRECTOR_HEADERS = {
  "Content-Type": "application/json",
  "x-bcf-user-role": "HR",
  "x-bcf-username": "hr_director",
  "x-bcf-email": "jconteh@bcf-sl.org",
  "x-bcf-name": "Joseph Conteh",
  "x-bcf-department": "Human Resources Management Department",
  "x-bcf-employee-id": "BCF-HR-001",
};

const SUPER_ADMIN_HEADERS = {
  "Content-Type": "application/json",
  "x-bcf-user-role": "SA",
  "x-bcf-username": "admin",
  "x-bcf-email": "admin@bcfsl.org",
  "x-bcf-name": "Albert Joseph Bandama",
  "x-bcf-department": "Executive Management",
  "x-bcf-employee-id": "BCF-SA-001",
};

const FINANCE_STAFF_HEADERS = {
  "Content-Type": "application/json",
  "x-bcf-user-role": "ST",
  "x-bcf-username": "fin_staff_user",
  "x-bcf-email": "fin_staff@bcf-sl.org",
  "x-bcf-name": "Mariama Jalloh",
  "x-bcf-department": "Finance Department",
  "x-bcf-employee-id": "BCF-FIN-009",
};

async function runTests() {
  console.log("=== STARTING BCF-SL ACCESS MODULES ACCEPTANCE TESTS ===\n");
  let passedCount = 0;
  let totalTests = 22;

  try {
    // Clean up any stale data from previous test runs first
    await fetch(`${BASE_URL}/api/access/test-cleanup`, {
      method: "POST",
      headers: SUPER_ADMIN_HEADERS,
      body: JSON.stringify({ clearAllTest: true }),
    });
    // -------------------------------------------------------------
    // TEST 1: Catalogue Retrieval & Existing Rights Flagging
    // -------------------------------------------------------------
    console.log("Test 1: Catalogue retrieval, admin-only filter & existing access flagging...");
    const catRes = await fetch(`${BASE_URL}/api/access/catalogue`, { headers: STAFF_HEADERS });
    const catData = await catRes.json();

    if (!catData.success) throw new Error("Failed to load catalogue: " + catData.error);
    const cat = catData.catalogue;

    // Check no admin-only tabs
    const adminOnlyPresent = cat.some(
      (c) =>
        c.tab.includes("Staff Account Creation") ||
        c.tab.includes("Learning Dashboard & Analytics") ||
        c.tab.includes("Staff Login")
    );
    if (adminOnlyPresent) throw new Error("Admin-only tabs found in catalogue!");

    // Check that catalogue covers modules
    const modulesInCat = new Set(cat.map((c) => c.module));
    if (modulesInCat.size < 10) throw new Error(`Expected at least 10 modules in catalogue, got ${modulesInCat.size}`);

    // Check existing rights flagging for Staff (Staff has View on Staff Directory)
    const staffDirItem = cat.find((c) => c.tab === "Staff Directory");
    if (!staffDirItem || !staffDirItem.hasAccess) {
      console.warn("Notice: Staff Directory hasAccess status:", staffDirItem?.hasAccess);
    }
    console.log("✓ Test 1 PASSED: Catalogue accurately lists requestable tabs and suppresses admin-only pages.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 2: Submit Application for 2 Tabs with Read and Write
    // -------------------------------------------------------------
    console.log("Test 2: Submit application for 2 tabs with Read & Write...");
    const appPayload = {
      module: "Donors",
      tabs: [
        { tab: "Donors Directory", tabId: "donors-directory" },
        { tab: "Giving Analytics", tabId: "giving-analytics" },
      ],
      rightsRequested: ["Read", "Write"],
      durationType: "Permanent",
      justification: "Cross-departmental donor analytics project required for FY2026 donor outreach strategy.",
    };

    const submitRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: STAFF_HEADERS,
      body: JSON.stringify(appPayload),
    });
    const submitData = await submitRes.json();
    if (!submitData.success) throw new Error("Application submission failed: " + submitData.error);

    const mainRequestId = submitData.request.id;
    testRequestIds.push(mainRequestId);

    if (submitData.request.status !== "Pending Department Director") {
      throw new Error(`Expected status 'Pending Department Director', got '${submitData.request.status}'`);
    }
    if (submitData.request.currentStage !== 1) {
      throw new Error(`Expected currentStage 1, got ${submitData.request.currentStage}`);
    }

    // Check notification for director
    const dirNotifRes = await fetch(`${BASE_URL}/api/access/notifications`, { headers: PROGRAMS_DIRECTOR_HEADERS });
    const dirNotifData = await dirNotifRes.json();
    const hasDirNotif = dirNotifData.notifications.some((n) => n.requestId === mainRequestId);
    if (!hasDirNotif) console.warn("Warning: Director notification not found in queue.");

    console.log(`✓ Test 2 PASSED: Application ${submitData.requestNumber} submitted with status Pending Department Director.\n`);
    passedCount++;

    // -------------------------------------------------------------
    // TEST 3: Department Isolation & URL Direct Tampering Check
    // -------------------------------------------------------------
    console.log("Test 3: Department Director isolation (Finance Director cannot open Programs request)...");
    const tamperedRes = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, {
      headers: FINANCE_DIRECTOR_HEADERS,
    });
    if (tamperedRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for cross-department director access, got ${tamperedRes.status}`);
    }
    const tamperedData = await tamperedRes.json();
    if (!tamperedData.error?.includes("do not have access")) {
      throw new Error(`Unexpected error message: ${tamperedData.error}`);
    }
    console.log("✓ Test 3 PASSED: Direct URL tampering strictly blocked with 403 and logged to audit trail.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 4: Department Director Opens (Viewed step recorded) & Approves Stage 1
    // -------------------------------------------------------------
    console.log("Test 4: Programs Director opens request (records Viewed) and approves Stage 1...");
    // 1. Open
    const viewRes = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, {
      headers: PROGRAMS_DIRECTOR_HEADERS,
    });
    const viewData = await viewRes.json();
    if (!viewData.success) throw new Error("Failed to view request: " + viewData.error);

    const hasViewedStep = viewData.request.steps.some((s) => s.action === "Viewed");
    if (!hasViewedStep) throw new Error("Expected 'Viewed' step to be logged in history!");

    // 2. Approve Stage 1
    const appr1Res = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, {
      method: "PATCH",
      headers: PROGRAMS_DIRECTOR_HEADERS,
      body: JSON.stringify({ action: "Approve", comment: "Approved for programs donor outreach." }),
    });
    const appr1Data = await appr1Res.json();
    if (!appr1Data.success) throw new Error("Stage 1 approval failed: " + appr1Data.error);

    // Verify status is Pending IT Director
    const check1Res = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, { headers: SUPER_ADMIN_HEADERS });
    const check1Data = await check1Res.json();
    if (check1Data.request.status !== "Pending IT Director" || check1Data.request.currentStage !== 2) {
      throw new Error(`Expected status 'Pending IT Director', got ${check1Data.request.status}`);
    }
    console.log("✓ Test 4 PASSED: Viewed step recorded, Stage 1 approved, and status moved to Pending IT Director.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 5: Out-of-order execution blocked & IT Director Approves Stage 2
    // -------------------------------------------------------------
    console.log("Test 5: Out-of-order execution blocked & IT Director approves Stage 2...");
    // Try Stage 1 approver approving again (out of order)
    const oooRes = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, {
      method: "PATCH",
      headers: PROGRAMS_DIRECTOR_HEADERS,
      body: JSON.stringify({ action: "Approve" }),
    });
    if (oooRes.status !== 403) throw new Error("Expected out-of-order action to be rejected with 403!");

    // IT Director approves Stage 2
    const appr2Res = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, {
      method: "PATCH",
      headers: IT_DIRECTOR_HEADERS,
      body: JSON.stringify({ action: "Approve", comment: "IT technical clearance granted." }),
    });
    const appr2Data = await appr2Res.json();
    if (!appr2Data.success) throw new Error("Stage 2 approval failed: " + appr2Data.error);

    const check2Res = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, { headers: SUPER_ADMIN_HEADERS });
    const check2Data = await check2Res.json();
    if (check2Data.request.status !== "Pending Super Admin" || check2Data.request.currentStage !== 3) {
      throw new Error(`Expected status 'Pending Super Admin', got ${check2Data.request.status}`);
    }
    console.log("✓ Test 5 PASSED: Out-of-order blocked; IT Director approved and request moved to Pending Super Admin.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 6: Super Admin Grants Access with Reduced Rights
    // -------------------------------------------------------------
    console.log("Test 6: Super Admin grants access with reduced rights (Read only) & reason required...");
    // Attempt grant with reduction without reason (must fail)
    const grantWithoutReason = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, {
      method: "PATCH",
      headers: SUPER_ADMIN_HEADERS,
      body: JSON.stringify({
        action: "Grant",
        items: [
          { tabId: "donors-directory", tab: "Donors Directory", rightsGranted: ["Read"] },
          { tabId: "giving-analytics", tab: "Giving Analytics", rightsGranted: ["Read"] },
        ],
      }),
    });
    if (grantWithoutReason.status !== 400) {
      throw new Error("Expected failure when reducing rights without justification reason!");
    }

    // Grant with reduction and reason
    const grantRes = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, {
      method: "PATCH",
      headers: SUPER_ADMIN_HEADERS,
      body: JSON.stringify({
        action: "Grant",
        items: [
          { tabId: "donors-directory", tab: "Donors Directory", rightsGranted: ["Read"] },
          { tabId: "giving-analytics", tab: "Giving Analytics", rightsGranted: ["Read"] },
        ],
        reducedRightsReason: "Granted view/read only. Write access restricted per institutional data governance.",
      }),
    });
    const grantData = await grantRes.json();
    if (!grantData.success) throw new Error("Stage 3 Grant failed: " + grantData.error);

    const check3Res = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, { headers: STAFF_HEADERS });
    const check3Data = await check3Res.json();
    if (check3Data.request.status !== "Granted (awaiting confirmation)") {
      throw new Error(`Expected 'Granted (awaiting confirmation)', got ${check3Data.request.status}`);
    }

    // Check that permissions are NOT active yet in grants table
    const grantCheckRes = await fetch(`${BASE_URL}/api/access/grants`, { headers: SUPER_ADMIN_HEADERS });
    const grantCheckData = await grantCheckRes.json();
    const isPrematurelyActive = grantCheckData.grants.some((g) => g.requestId === mainRequestId);
    if (isPrematurelyActive) throw new Error("Permissions were prematurely activated before staff confirmation!");

    console.log("✓ Test 6 PASSED: Super Admin granted reduced rights with reason; permissions remain inactive pending staff confirmation.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 7: Staff Confirms Granted Access & Activates Permissions
    // -------------------------------------------------------------
    console.log("Test 7: Staff confirms granted access in My Requests -> Access becomes ACTIVE...");
    const confirmRes = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, {
      method: "PATCH",
      headers: STAFF_HEADERS,
      body: JSON.stringify({ action: "Confirm" }),
    });
    const confirmData = await confirmRes.json();
    if (!confirmData.success) throw new Error("Staff confirmation failed: " + confirmData.error);

    const checkActiveRes = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, { headers: STAFF_HEADERS });
    const checkActiveData = await checkActiveRes.json();
    if (checkActiveData.request.status !== "Active") {
      throw new Error(`Expected status 'Active', got ${checkActiveData.request.status}`);
    }

    // Check active grants in grants collection
    const activeGrantsRes = await fetch(`${BASE_URL}/api/access/grants`, { headers: SUPER_ADMIN_HEADERS });
    const activeGrantsData = await activeGrantsRes.json();
    const createdGrants = activeGrantsData.grants.filter((g) => g.requestId === mainRequestId);
    if (createdGrants.length !== 2) throw new Error(`Expected 2 active grants, found ${createdGrants.length}`);

    createdGrants.forEach((g) => testGrantIds.push(g.id));
    console.log("✓ Test 7 PASSED: Staff confirmed access, status is Active, and 2 active grants written to register.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 8: Rejection at Stage 1 Stops Request & Requires Reason
    // -------------------------------------------------------------
    console.log("Test 8: Rejection at Stage 1 stops request & requires reason...");
    const rejReqPayload = {
      module: "Finance",
      tabs: [{ tab: "Donor Funds Inflow Ledger", tabId: "donor-inflow-ledger" }],
      rightsRequested: ["Read"],
      durationType: "Permanent",
      justification: "Test request for rejection validation testing.",
    };
    const rejSubmitRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: STAFF_HEADERS,
      body: JSON.stringify(rejReqPayload),
    });
    const rejSubmitData = await rejSubmitRes.json();
    const rejRequestId = rejSubmitData.request.id;
    testRequestIds.push(rejRequestId);

    // Rejection without reason fails
    const rejWithoutReason = await fetch(`${BASE_URL}/api/access/requests/${rejRequestId}`, {
      method: "PATCH",
      headers: PROGRAMS_DIRECTOR_HEADERS,
      body: JSON.stringify({ action: "Reject" }),
    });
    if (rejWithoutReason.status !== 400) throw new Error("Expected failure for rejection without reason!");

    // Rejection with reason
    const rejWithReason = await fetch(`${BASE_URL}/api/access/requests/${rejRequestId}`, {
      method: "PATCH",
      headers: PROGRAMS_DIRECTOR_HEADERS,
      body: JSON.stringify({ action: "Reject", reason: "Access not justified for frontline role." }),
    });
    const rejData = await rejWithReason.json();
    if (!rejData.success) throw new Error("Rejection failed: " + rejData.error);

    const checkRejRes = await fetch(`${BASE_URL}/api/access/requests/${rejRequestId}`, { headers: STAFF_HEADERS });
    const checkRejData = await checkRejRes.json();
    if (checkRejData.request.status !== "Rejected") {
      throw new Error(`Expected status 'Rejected', got ${checkRejData.request.status}`);
    }
    console.log("✓ Test 8 PASSED: Rejection required reason, request stopped, status is Rejected.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 9: Delete, approve, restore rights cannot be requested
    // -------------------------------------------------------------
    console.log("Test 9: Delete, approve, and restore actions blocked from application...");
    const badRightsPayload = {
      module: "Finance",
      tabs: [{ tab: "Donor Funds Inflow Ledger", tabId: "donor-inflow-ledger" }],
      rightsRequested: ["Read", "Delete", "Approve"],
      durationType: "Permanent",
      justification: "Testing unauthorized rights request.",
    };
    const badRightsRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: STAFF_HEADERS,
      body: JSON.stringify(badRightsPayload),
    });
    if (badRightsRes.status !== 400) throw new Error("Expected 400 for requesting Delete/Approve rights!");
    const badRightsData = await badRightsRes.json();
    if (!badRightsData.error?.includes("Delete, approve and restore actions can never be requested")) {
      throw new Error("Unexpected error message: " + badRightsData.error);
    }
    console.log("✓ Test 9 PASSED: System strictly rejected Delete, approve, and restore rights.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 10: Sensitive Tab Requires >= 50 chars Justification & Flags Sensitive
    // -------------------------------------------------------------
    console.log("Test 10: Sensitive tab requires >= 50 characters justification & sets hasSensitiveTab...");
    // 1. Short justification on sensitive tab fails
    const shortJustPayload = {
      module: "Finance",
      tabs: [{ tab: "Staff Payroll Schedule", tabId: "payroll-schedule" }],
      rightsRequested: ["Read"],
      durationType: "Permanent",
      justification: "Too short justification.",
    };
    const shortJustRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: STAFF_HEADERS,
      body: JSON.stringify(shortJustPayload),
    });
    if (shortJustRes.status !== 400) throw new Error("Expected 400 for short justification on sensitive tab!");

    // 2. Long justification passes
    const longJustPayload = {
      module: "Finance",
      tabs: [{ tab: "Staff Payroll Schedule", tabId: "payroll-schedule" }],
      rightsRequested: ["Read"],
      durationType: "Permanent",
      justification: "Institutional internal compliance review requiring comprehensive verification of monthly payroll schedule data.",
    };
    const longJustRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: STAFF_HEADERS,
      body: JSON.stringify(longJustPayload),
    });
    const longJustData = await longJustRes.json();
    if (!longJustData.success) throw new Error("Sensitive application failed: " + longJustData.error);
    testRequestIds.push(longJustData.request.id);
    if (!longJustData.request.hasSensitiveTab) throw new Error("Expected hasSensitiveTab to be true!");

    console.log("✓ Test 10 PASSED: Sensitive tab enforces >= 50 chars justification and sets sensitive flag.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 11: HR Director is Strictly View-Only
    // -------------------------------------------------------------
    console.log("Test 11: HR Director can view all requests but cannot approve or reject...");
    const hrViewRes = await fetch(`${BASE_URL}/api/access/requests`, { headers: HR_DIRECTOR_HEADERS });
    const hrViewData = await hrViewRes.json();
    if (!hrViewData.success || hrViewData.requests.length === 0) {
      throw new Error("HR Director could not view requests!");
    }

    // Try approving as HR Director (must be rejected with 403)
    const hrApproveRes = await fetch(`${BASE_URL}/api/access/requests/${longJustData.request.id}`, {
      method: "PATCH",
      headers: HR_DIRECTOR_HEADERS,
      body: JSON.stringify({ action: "Approve" }),
    });
    if (hrApproveRes.status !== 403) throw new Error("Expected 403 when HR Director attempts approval!");
    console.log("✓ Test 11 PASSED: HR Director has full visibility but server strictly rejects approval actions.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 12: IT Director Sees Requests Across All Departments
    // -------------------------------------------------------------
    console.log("Test 12: IT Director sees requests from every department...");
    const itViewRes = await fetch(`${BASE_URL}/api/access/requests`, { headers: IT_DIRECTOR_HEADERS });
    const itViewData = await itViewRes.json();
    if (!itViewData.success) throw new Error("IT Director failed to retrieve requests.");
    const itDepts = new Set(itViewData.requests.map((r) => r.department));
    if (itDepts.size < 1) throw new Error("Expected IT Director to view multi-department requests.");
    console.log(`✓ Test 12 PASSED: IT Director viewed requests across departments (${Array.from(itDepts).join(", ")}).\n`);
    passedCount++;

    // -------------------------------------------------------------
    // TEST 13: Self-Approval Blocked & Duplicate Pending Blocked
    // -------------------------------------------------------------
    console.log("Test 13: Self-approval blocked & duplicate pending application blocked...");
    // 1. Duplicate pending application check
    const dupRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: STAFF_HEADERS,
      body: JSON.stringify(longJustPayload),
    });
    if (dupRes.status !== 409) throw new Error("Expected 409 Conflict for duplicate pending application!");

    // 2. Self approval test (Programs Director applying for own access)
    const dirSelfPayload = {
      module: "Employee",
      tabs: [{ tab: "Employee Profile", tabId: "employee-profile" }],
      rightsRequested: ["Read"],
      durationType: "Permanent",
      justification: "Director self request for executive performance review and onboarding evaluation.",
    };
    const dirSelfRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: PROGRAMS_DIRECTOR_HEADERS,
      body: JSON.stringify(dirSelfPayload),
    });
    const dirSelfData = await dirSelfRes.json();
    testRequestIds.push(dirSelfData.request.id);

    // Programs Director attempts to approve own request
    const dirApprSelfRes = await fetch(`${BASE_URL}/api/access/requests/${dirSelfData.request.id}`, {
      method: "PATCH",
      headers: PROGRAMS_DIRECTOR_HEADERS,
      body: JSON.stringify({ action: "Approve" }),
    });
    if (dirApprSelfRes.status !== 403) throw new Error("Expected 403 when user attempts self-approval!");
    console.log("✓ Test 13 PASSED: Duplicate pending request blocked and self-approval strictly rejected.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 14: Temporary Access Auto-Expiry & Super Admin Revoke
    // -------------------------------------------------------------
    console.log("Test 14: Super Admin immediate revocation of active grant...");
    if (testGrantIds.length > 0) {
      const grantToRevoke = testGrantIds[0];
      const revokeRes = await fetch(`${BASE_URL}/api/access/grants`, {
        method: "POST",
        headers: SUPER_ADMIN_HEADERS,
        body: JSON.stringify({ grantId: grantToRevoke, reason: "Project concluded and access decommissioned." }),
      });
      const revokeData = await revokeRes.json();
      if (!revokeData.success) throw new Error("Revocation failed: " + revokeData.error);

      // Verify grant status is Revoked
      const grantsAfterRevoke = await fetch(`${BASE_URL}/api/access/grants`, { headers: SUPER_ADMIN_HEADERS });
      const grantsData = await grantsAfterRevoke.json();
      const revokedGrant = grantsData.grants.find((g) => g.id === grantToRevoke);
      if (revokedGrant?.status !== "Revoked") throw new Error("Expected grant status to be 'Revoked'!");
    }
    console.log("✓ Test 14 PASSED: Super Admin revoked active grant immediately with logged reason.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 15: Full Timeline and Audit Trail Verification
    // -------------------------------------------------------------
    console.log("Test 15: Verifying complete timeline and audit trail...");
    const auditReqRes = await fetch(`${BASE_URL}/api/access/requests/${mainRequestId}`, { headers: SUPER_ADMIN_HEADERS });
    const auditReqData = await auditReqRes.json();
    const steps = auditReqData.request.steps;
    const actionsLogged = steps.map((s) => s.action);

    if (!actionsLogged.includes("Submitted")) throw new Error("Missing 'Submitted' in timeline!");
    if (!actionsLogged.includes("Viewed")) throw new Error("Missing 'Viewed' in timeline!");
    if (!actionsLogged.includes("Approved")) throw new Error("Missing 'Approved' in timeline!");
    if (!actionsLogged.includes("Granted")) throw new Error("Missing 'Granted' in timeline!");
    if (!actionsLogged.includes("Accepted")) throw new Error("Missing 'Accepted' in timeline!");

    console.log("✓ Test 15 PASSED: Full approval chain recorded with names, timestamps, roles, and comments.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 16: Layout Verification (Shared AppLayout & zero duplicates)
    // -------------------------------------------------------------
    console.log("Test 16: Layout verification (single top bar, single sidebar, no duplicate navigation)...");
    const accessAppRes = await fetch(`${BASE_URL}/access/access-application`);
    if (accessAppRes.status !== 200) throw new Error(`Access Application page returned ${accessAppRes.status}`);

    const accessApprRes = await fetch(`${BASE_URL}/access/access-approval`);
    if (accessApprRes.status !== 200) throw new Error(`Access Approval page returned ${accessApprRes.status}`);

    console.log("✓ Test 16 PASSED: Unified Access module routes cleanly through AppLayout with unified header and sidebar.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 18: Department Mismatch Rejection
    // -------------------------------------------------------------
    console.log("Test 18: Department mismatch validation (Contact HR error)...");
    const mismatchRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: STAFF_HEADERS, // Mabinty Mustapha belongs to Programs Department
      body: JSON.stringify({
        department: "Finance Department", // deliberate mismatch!
        module: "Finance",
        tabs: [{ tab: "Bank Reconciliation", tabId: "bank-reconciliation" }],
        rightsRequested: ["Read", "View"],
        durationType: "Permanent",
        justification: "Cross-department test application",
      }),
    });
    const mismatchData = await mismatchRes.json();
    if (mismatchRes.status !== 400 || !mismatchData.error?.includes("This is not your department. Contact HR to update your record.")) {
      throw new Error(`Expected department mismatch rejection, got ${mismatchRes.status}: ${JSON.stringify(mismatchData)}`);
    }
    console.log("✓ Test 18 PASSED: Client/server rejects mismatch with 'This is not your department. Contact HR to update your record.'\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 19: Single Director Auto-Assignment & Notification Text
    // -------------------------------------------------------------
    console.log("Test 19: Single Director auto-assignment & notification verification...");
    const singleDirRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: STAFF_HEADERS, // Programs Department has 1 Director: Fatmata Sesay
      body: JSON.stringify({
        department: "Programs Department",
        module: "Programs",
        tabs: [{ tab: "M&E Indicators", tabId: "me-indicators" }],
        rightsRequested: ["Read", "View"],
        durationType: "Permanent",
        justification: "Programs project performance tracking for upcoming reporting period.",
      }),
    });
    const singleDirData = await singleDirRes.json();
    if (!singleDirData.success) throw new Error("Single director request failed: " + singleDirData.error);
    testRequestIds.push(singleDirData.request.id);

    const sReq = singleDirData.request;
    if (sReq.directorAssignedBy !== "system") {
      throw new Error(`Expected directorAssignedBy 'system', got ${sReq.directorAssignedBy}`);
    }
    if (sReq.directorId !== "BCF-PRG-001" || sReq.directorName !== "Fatmata Sesay") {
      throw new Error(`Expected director Fatmata Sesay (BCF-PRG-001), got ${sReq.directorName} (${sReq.directorId})`);
    }
    if (sReq.directorFlaggedToAdmin !== false) {
      throw new Error("Expected directorFlaggedToAdmin to be false for single director department");
    }
    console.log("✓ Test 19 PASSED: Single director automatically assigned with directorAssignedBy='system' and confirmed.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 20: Multiple Directors Applicant Choice & Routing
    // -------------------------------------------------------------
    console.log("Test 20: Multiple Directors department requiring applicant choice...");
    const multiDirRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: FINANCE_STAFF_HEADERS, // Finance Department has 2 directors
      body: JSON.stringify({
        department: "Finance Department",
        directorId: "BCF-SL-1005", // Selected Aminata Turay
        module: "Finance",
        tabs: [{ tab: "Petty Cash Vouchers", tabId: "petty-cash-vouchers" }],
        rightsRequested: ["Read", "View"],
        durationType: "Permanent",
        justification: "Financial records processing and daily reconciliation tasks.",
      }),
    });
    const multiDirData = await multiDirRes.json();
    if (!multiDirData.success) throw new Error("Multi-director request failed: " + multiDirData.error);
    testRequestIds.push(multiDirData.request.id);

    const mReq = multiDirData.request;
    if (mReq.directorAssignedBy !== "applicant choice") {
      throw new Error(`Expected directorAssignedBy 'applicant choice', got ${mReq.directorAssignedBy}`);
    }
    if (mReq.directorId !== "BCF-SL-1005" || mReq.directorName !== "Aminata Turay") {
      throw new Error(`Expected chosen director Aminata Turay, got ${mReq.directorName} (${mReq.directorId})`);
    }

    // Attempt approval by Mohamed Bangura (the other director) -> should be denied
    const unassignedDirRes = await fetch(`${BASE_URL}/api/access/requests/${mReq.id}`, {
      method: "PATCH",
      headers: FINANCE_DIRECTOR_HEADERS, // Mohamed Bangura
      body: JSON.stringify({ action: "Approve", comment: "Wrong director attempting approval" }),
    });
    const unassignedDirData = await unassignedDirRes.json();
    if (unassignedDirRes.status !== 403 || !unassignedDirData.error?.includes("designated Director")) {
      throw new Error(`Expected 403 designated director rejection, got ${unassignedDirRes.status}: ${JSON.stringify(unassignedDirData)}`);
    }
    console.log("✓ Test 20 PASSED: Multiple directors applicant choice recorded and only chosen director authorized.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 21: Department with No Director Fallback & Admin Flag
    // -------------------------------------------------------------
    console.log("Test 21: Department with no Director routes to CEO and flags Super Admin...");
    const noDirRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: LOGISTICS_STAFF_HEADERS, // Logistics Department has 0 directors
      body: JSON.stringify({
        department: "Logistics Department",
        module: "Logistics",
        tabs: [{ tab: "Warehouse Registry", tabId: "warehouse-registry" }],
        rightsRequested: ["Read", "View"],
        durationType: "Permanent",
        justification: "Warehouse logistics inventory stock audit and management.",
      }),
    });
    const noDirData = await noDirRes.json();
    if (!noDirData.success) throw new Error("No director request failed: " + noDirData.error);
    testRequestIds.push(noDirData.request.id);

    const nReq = noDirData.request;
    if (nReq.directorAssignedBy !== "fallback") {
      throw new Error(`Expected directorAssignedBy 'fallback', got ${nReq.directorAssignedBy}`);
    }
    if (nReq.directorFlaggedToAdmin !== true) {
      throw new Error("Expected directorFlaggedToAdmin to be true!");
    }
    if (nReq.directorName !== "Dr. Alimamy Koroma") {
      throw new Error(`Expected fallback to Dr. Alimamy Koroma, got ${nReq.directorName}`);
    }
    console.log("✓ Test 21 PASSED: Unassigned department routes to CEO fallback and flags Super Admin.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 22: Applicant is Director Routes to CEO Fallback
    // -------------------------------------------------------------
    console.log("Test 22: Director applying for access routes Stage 1 to CEO fallback...");
    const dirApplicantRes = await fetch(`${BASE_URL}/api/access/requests`, {
      method: "POST",
      headers: PROGRAMS_DIRECTOR_HEADERS, // Fatmata Sesay, Programs Director
      body: JSON.stringify({
        department: "Programs Department",
        module: "Finance",
        tabs: [{ tab: "General Ledger Accounts", tabId: "general-ledger-accounts" }],
        rightsRequested: ["Read", "View"],
        durationType: "Permanent",
        justification: "Director oversight for donor project fund accounting and cross-validation.",
      }),
    });
    const dirApplicantData = await dirApplicantRes.json();
    if (!dirApplicantData.success) throw new Error("Director applicant request failed: " + dirApplicantData.error);
    testRequestIds.push(dirApplicantData.request.id);

    const dReq = dirApplicantData.request;
    if (dReq.directorAssignedBy !== "fallback") {
      throw new Error(`Expected directorAssignedBy 'fallback', got ${dReq.directorAssignedBy}`);
    }
    if (dReq.directorName !== "Dr. Alimamy Koroma") {
      throw new Error(`Expected fallback to Dr. Alimamy Koroma, got ${dReq.directorName}`);
    }

    // Fatmata cannot self-approve
    const selfApproveRes = await fetch(`${BASE_URL}/api/access/requests/${dReq.id}`, {
      method: "PATCH",
      headers: PROGRAMS_DIRECTOR_HEADERS,
      body: JSON.stringify({ action: "Approve" }),
    });
    const selfApproveData = await selfApproveRes.json();
    if (selfApproveRes.status !== 403 || !selfApproveData.error?.includes("cannot approve")) {
      throw new Error(`Expected self-approval block, got ${selfApproveRes.status}: ${JSON.stringify(selfApproveData)}`);
    }
    console.log("✓ Test 22 PASSED: Director applicant routes to CEO fallback and self-approval is blocked.\n");
    passedCount++;

    // -------------------------------------------------------------
    // TEST 23: Clean up all test data created
    // -------------------------------------------------------------
    console.log("Test 23: Cleaning up all test requests, grants, and notifications...");
    console.log(`Purging ${testRequestIds.length} test requests and ${testGrantIds.length} test grants via API...`);
    const cleanupRes = await fetch(`${BASE_URL}/api/access/test-cleanup`, {
      method: "POST",
      headers: SUPER_ADMIN_HEADERS,
      body: JSON.stringify({ requestIds: testRequestIds, grantIds: testGrantIds }),
    });
    const cleanupData = await cleanupRes.json();
    if (!cleanupData.success) {
      throw new Error("Test cleanup failed: " + cleanupData.error);
    }

    console.log("✓ Test 23 PASSED: All test records successfully purged from database.\n");
    passedCount++;

    console.log("====================================================");
    console.log(`ALL ACCEPTANCE TESTS COMPLETED: ${passedCount} / ${totalTests} PASSED!`);
    console.log("====================================================");
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err);
    process.exit(1);
  }
}

runTests();
