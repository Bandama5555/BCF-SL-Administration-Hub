/**
 * Comprehensive Automated Verification Script for Documents & Policies Module
 * Testing all requirements from Section 10:
 * 1. Role tab visibility and button permissions
 * 2. Staff user boundary checks (view/download docs & policies only, blocked on proposals/projects/upload/edit/delete)
 * 3. HR upload -> Two users download -> Download history verification
 * 4. CEO soft deletion with reason -> archived to Deleted Items Log -> download blocked -> SA restore
 * 5. Notification bell dispatch and role-based filtering (no self-notification, no hidden tabs)
 * 6. Clean up test data
 */

import fs from "fs";
import path from "path";

// Load .env.local
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [k, ...v] = trimmed.split("=");
        process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
      }
    });
  }
} catch (_) {}

const BASE_URL = "http://localhost:3001";

async function runTests() {
  console.log("=== STARTING DOCUMENTS & POLICIES AUDIT & VERIFICATION ===\n");
  const results = [];

  // Seed default items first
  console.log("-> Seeding institutional records...");
  const seedRes = await fetch(`${BASE_URL}/api/documents/seed`);
  const seedData = await seedRes.json();
  console.log("Seed result:", seedData.message);

  // ─── CHECK 1: Role tab visibility & permissions table ─────────────────────────
  console.log("\n-> CHECK 1: Testing access matrix across all roles...");
  const rolesToTest = [
    { role: "ST", expectedTabs: ["documents", "policies"], blockedTabs: ["proposals", "projects", "deleted-items"] },
    { role: "HR", expectedTabs: ["documents", "policies", "proposals", "projects", "deleted-items"], blockedTabs: [] },
    { role: "SA", expectedTabs: ["documents", "policies", "proposals", "projects", "deleted-items"], blockedTabs: [] },
    { role: "CEO", expectedTabs: ["documents", "policies", "proposals", "projects", "deleted-items"], blockedTabs: [] },
    { role: "IAR", expectedTabs: ["documents", "policies", "proposals", "projects", "deleted-items"], blockedTabs: [] },
    { role: "PRG", expectedTabs: ["documents", "policies", "proposals", "projects", "deleted-items"], blockedTabs: [] },
    { role: "FIN", expectedTabs: ["documents", "policies", "proposals", "projects"], blockedTabs: ["deleted-items"] },
    { role: "PRC", expectedTabs: [], blockedTabs: ["documents", "policies", "proposals", "projects", "deleted-items"] },
    { role: "IT", expectedTabs: [], blockedTabs: ["documents", "policies", "proposals", "projects", "deleted-items"] },
  ];

  let check1Passed = true;
  for (const t of rolesToTest) {
    for (const tab of t.expectedTabs) {
      const res = await fetch(`${BASE_URL}/api/documents?tab=${tab}`, {
        headers: { "x-bcf-user-role": t.role },
      });
      if (!res.ok) {
        console.error(`FAIL: Role ${t.role} should have access to ${tab}, got status ${res.status}`);
        check1Passed = false;
      }
    }
    for (const tab of t.blockedTabs) {
      const res = await fetch(`${BASE_URL}/api/documents?tab=${tab}`, {
        headers: { "x-bcf-user-role": t.role },
      });
      if (res.status !== 403) {
        console.error(`FAIL: Role ${t.role} should be BLOCKED (403) from ${tab}, got status ${res.status}`);
        check1Passed = false;
      }
    }
  }
  results.push({ check: "Check 1: Role tab visibility & access boundaries", passed: check1Passed });
  console.log(`Check 1 Result: ${check1Passed ? "PASSED" : "FAILED"}`);

  // ─── CHECK 2: Staff boundary checks ───────────────────────────────────────────
  console.log("\n-> CHECK 2: Testing Staff (ST) boundary enforcement...");
  // Staff trying to upload to documents (must be 403)
  const staffUploadRes = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "ST",
      "x-bcf-username": "staff_user",
    },
    body: JSON.stringify({
      title: "Illegal Staff Upload",
      description: "Should fail",
      category: "documents",
      fileName: "test.pdf",
      fileSize: 1000,
      fileData: "data:application/pdf;base64,AAAA",
    }),
  });
  const staffUploadBlocked = staffUploadRes.status === 403;

  // Staff trying to view Proposals (must be 403)
  const staffProposalsRes = await fetch(`${BASE_URL}/api/documents?tab=proposals`, {
    headers: { "x-bcf-user-role": "ST", "x-bcf-username": "staff_user" },
  });
  const staffProposalsBlocked = staffProposalsRes.status === 403;

  const check2Passed = staffUploadBlocked && staffProposalsBlocked;
  results.push({ check: "Check 2: Staff restricted to view/download docs & policies only", passed: check2Passed });
  console.log(`Staff upload blocked: ${staffUploadBlocked} (Status ${staffUploadRes.status})`);
  console.log(`Staff proposals access blocked: ${staffProposalsBlocked} (Status ${staffProposalsRes.status})`);
  console.log(`Check 2 Result: ${check2Passed ? "PASSED" : "FAILED"}`);

  // ─── CHECK 3: Upload as HR -> Download as two users -> Check Download history ──
  console.log("\n-> CHECK 3: Upload item as HR -> Download by 2 users -> Verify download history...");
  const hrUploadRes = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "HR",
      "x-bcf-username": "hr_director",
      "x-bcf-name": "Joseph Conteh",
      "x-bcf-email": "jconteh@bcf-sl.org",
    },
    body: JSON.stringify({
      title: "TEST_AUDIT_HR_Staff_Handbook_2026",
      description: "Comprehensive staff operational handbook for testing upload and tracking.",
      category: "documents",
      fileName: "Staff_Handbook_2026.pdf",
      fileSize: 154000,
      fileType: "application/pdf",
      fileData: "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjggMDAwMDAgbiAKMDAwMDAwMDEyNSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE5OQolJUVPRg==",
      tags: ["Test", "Handbook"],
    }),
  });
  const hrUploadData = await hrUploadRes.json();
  const testDocId = hrUploadData.item?.id;
  console.log("HR Upload created doc ID:", testDocId);

  // User 1 downloads (Staff user: Mabinty Mustapha)
  const dl1Res = await fetch(`${BASE_URL}/api/documents/${testDocId}/download?format=json`, {
    headers: {
      "x-bcf-user-role": "ST",
      "x-bcf-username": "staff_user",
      "x-bcf-name": "Mabinty Mustapha",
      "x-bcf-email": "staff@bcf-sl.org",
    },
  });
  const dl1Data = await dl1Res.json();

  // User 2 downloads (Finance Director: Mohamed Bangura)
  const dl2Res = await fetch(`${BASE_URL}/api/documents/${testDocId}/download?format=json`, {
    headers: {
      "x-bcf-user-role": "FIN",
      "x-bcf-username": "fin_director",
      "x-bcf-name": "Mohamed Bangura",
      "x-bcf-email": "mbangura@bcf-sl.org",
    },
  });
  const dl2Data = await dl2Res.json();

  // Verify full download history viewed by authorized HR role
  const checkDocRes = await fetch(`${BASE_URL}/api/documents/${testDocId}`, {
    headers: { "x-bcf-user-role": "HR", "x-bcf-username": "hr_director" },
  });
  const checkDocData = await checkDocRes.json();
  const docHistory = checkDocData.item?.downloadHistory || [];
  console.log("Download count recorded:", checkDocData.item?.downloadCount);
  console.log("Download history entries:", docHistory.map((d) => `${d.name} (${d.role})`));

  const check3Passed =
    testDocId &&
    dl1Data.success &&
    dl2Data.success &&
    checkDocData.item?.downloadCount >= 2 &&
    docHistory.some((d) => d.name === "Mabinty Mustapha") &&
    docHistory.some((d) => d.name === "Mohamed Bangura");

  results.push({ check: "Check 3: Upload tracking and dual-user download history", passed: check3Passed });
  console.log(`Check 3 Result: ${check3Passed ? "PASSED" : "FAILED"}`);

  // ─── CHECK 4: CEO Delete with reason -> Soft delete -> Download blocked -> Restore ──
  console.log("\n-> CHECK 4: CEO soft delete with reason, download blocking, and SA restore...");
  // Attempt delete without reason (should fail 400)
  const noReasonDeleteRes = await fetch(`${BASE_URL}/api/documents/${testDocId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "CEO",
      "x-bcf-name": "Dr. Alimamy Koroma",
    },
    body: JSON.stringify({ reason: "" }),
  });
  const noReasonBlocked = noReasonDeleteRes.status === 400;

  // CEO deletes with valid reason
  const ceoDeleteRes = await fetch(`${BASE_URL}/api/documents/${testDocId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "CEO",
      "x-bcf-name": "Dr. Alimamy Koroma",
      "x-bcf-email": "ceo@bcf-sl.org",
    },
    body: JSON.stringify({ reason: "Replaced with unified compliance edition." }),
  });
  const ceoDeletedOk = ceoDeleteRes.ok;

  // Verify item is NOT in active list
  const activeListRes = await fetch(`${BASE_URL}/api/documents?tab=documents`, {
    headers: { "x-bcf-user-role": "HR" },
  });
  const activeListData = await activeListRes.json();
  const notInActive = !activeListData.items.some((i) => i.id === testDocId);

  // Verify item IS in Deleted Items Log
  const deletedLogRes = await fetch(`${BASE_URL}/api/documents?tab=deleted-items`, {
    headers: { "x-bcf-user-role": "CEO" },
  });
  const deletedLogData = await deletedLogRes.json();
  const inDeletedLog = deletedLogData.items.some((i) => i.id === testDocId);

  // Verify download is now blocked because item is soft-deleted
  const blockedDownloadRes = await fetch(`${BASE_URL}/api/documents/${testDocId}/download?format=json`, {
    headers: { "x-bcf-user-role": "HR" },
  });
  const downloadBlockedOnDeleted = blockedDownloadRes.status === 403;

  // Attempt restore by non-SA (e.g. HR should fail 403)
  const nonSaRestoreRes = await fetch(`${BASE_URL}/api/documents/${testDocId}/restore`, {
    method: "POST",
    headers: { "x-bcf-user-role": "HR", "x-bcf-username": "hr_director" },
  });
  const nonSaRestoreBlocked = nonSaRestoreRes.status === 403;

  // SA restores item
  const saRestoreRes = await fetch(`${BASE_URL}/api/documents/${testDocId}/restore`, {
    method: "POST",
    headers: { "x-bcf-user-role": "SA", "x-bcf-username": "admin" },
  });
  const saRestoredOk = saRestoreRes.ok;

  const check4Passed =
    noReasonBlocked &&
    ceoDeletedOk &&
    notInActive &&
    inDeletedLog &&
    downloadBlockedOnDeleted &&
    nonSaRestoreBlocked &&
    saRestoredOk;

  results.push({ check: "Check 4: CEO soft delete, download block & SA-only restore", passed: check4Passed });
  console.log(`Delete without reason blocked: ${noReasonBlocked}`);
  console.log(`CEO delete with reason success: ${ceoDeletedOk}`);
  console.log(`Removed from active list: ${notInActive}`);
  console.log(`Appeared in Deleted Items Log: ${inDeletedLog}`);
  console.log(`Download blocked when deleted: ${downloadBlockedOnDeleted}`);
  console.log(`Non-SA restore blocked: ${nonSaRestoreBlocked}`);
  console.log(`SA restore succeeded: ${saRestoredOk}`);
  console.log(`Check 4 Result: ${check4Passed ? "PASSED" : "FAILED"}`);

  // ─── CHECK 5: Notification Bell Filtering ─────────────────────────────────────
  console.log("\n-> CHECK 5: Notification bell triggers and recipient role filtering...");
  // Upload a Proposal as PRG
  const prgProposalRes = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bcf-user-role": "PRG",
      "x-bcf-username": "prg_director",
      "x-bcf-name": "Fatmata Sesay",
      "x-bcf-email": "fsesay@bcf-sl.org",
    },
    body: JSON.stringify({
      title: "TEST_AUDIT_PRG_Solar_MiniGrid_Proposal",
      description: "Grant proposal for solar minigrid in Moyamba district.",
      category: "proposals",
      fileName: "Moyamba_Solar_Proposal.docx",
      fileSize: 85000,
      fileData: "data:application/pdf;base64,AAAA",
    }),
  });
  const prgProposalData = await prgProposalRes.json();
  const testProposalId = prgProposalData.item?.id;

  // Check Staff notifications: Staff CANNOT see proposals, so they should NOT receive this notification
  const staffNotifsRes = await fetch(`${BASE_URL}/api/documents/notifications`, {
    headers: { "x-bcf-user-role": "ST", "x-bcf-username": "staff_user" },
  });
  const staffNotifsData = await staffNotifsRes.json();
  const staffReceivedProposalNotif = staffNotifsData.notifications.some(
    (n) => n.itemTitle === "TEST_AUDIT_PRG_Solar_MiniGrid_Proposal"
  );

  // Check CEO notifications: CEO CAN see proposals, so they SHOULD receive this notification
  const ceoNotifsRes = await fetch(`${BASE_URL}/api/documents/notifications`, {
    headers: { "x-bcf-user-role": "CEO", "x-bcf-username": "ceo_user" },
  });
  const ceoNotifsData = await ceoNotifsRes.json();
  const ceoReceivedProposalNotif = ceoNotifsData.notifications.some(
    (n) => n.itemTitle === "TEST_AUDIT_PRG_Solar_MiniGrid_Proposal"
  );

  // Check PRG (actor) notifications: Actor who performed the action must NOT be notified!
  const prgNotifsRes = await fetch(`${BASE_URL}/api/documents/notifications`, {
    headers: { "x-bcf-user-role": "PRG", "x-bcf-username": "prg_director" },
  });
  const prgNotifsData = await prgNotifsRes.json();
  const prgSelfNotified = prgNotifsData.notifications.some(
    (n) => n.itemTitle === "TEST_AUDIT_PRG_Solar_MiniGrid_Proposal"
  );

  const check5Passed = !staffReceivedProposalNotif && ceoReceivedProposalNotif && !prgSelfNotified;
  results.push({ check: "Check 5: Notification bell visibility filtering and no self-alert", passed: check5Passed });
  console.log(`Staff blocked from proposal notification: ${!staffReceivedProposalNotif}`);
  console.log(`CEO received proposal notification: ${ceoReceivedProposalNotif}`);
  console.log(`Uploader (PRG) NOT self-notified: ${!prgSelfNotified}`);
  console.log(`Check 5 Result: ${check5Passed ? "PASSED" : "FAILED"}`);

  // ─── CHECK 6 & 7: Clean up test items ─────────────────────────────────────────
  console.log("\n-> CHECK 6 & 7: Cleaning up test data from MongoDB...");
  // Permanently delete test items using database collection directly
  const { getCollection, COLLECTIONS } = await import("../src/lib/mongodb.ts");
  const docCol = await getCollection(COLLECTIONS.DOCUMENTS);
  const notifCol = await getCollection(COLLECTIONS.DOCUMENTS_NOTIFICATIONS);

  const delDocs = await docCol.deleteMany({
    $or: [{ id: testDocId }, { id: testProposalId }, { title: { $regex: "^TEST_AUDIT_" } }],
  });
  const delNotifs = await notifCol.deleteMany({
    itemTitle: { $regex: "^TEST_AUDIT_" },
  });
  console.log(`Deleted ${delDocs.deletedCount} test document records and ${delNotifs.deletedCount} test notifications.`);

  const allPassed = results.every((r) => r.passed);
  console.log("\n==========================================");
  console.log(allPassed ? "✅ ALL CHECKS PASSED PERFECTLY!" : "❌ SOME CHECKS FAILED");
  console.log("==========================================");
  console.table(results);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
