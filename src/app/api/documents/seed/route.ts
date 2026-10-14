import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { type DocumentItem } from "@/lib/documentTypes";

// 1x1 transparent PNG data URI or sample mock PDF text data URI
const SAMPLE_MOCK_PDF_DATA =
  "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjggMDAwMDAgbiAKMDAwMDAwMDEyNSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE5OQolJUVPRg==";

export const SEED_DOCUMENTS: Partial<DocumentItem>[] = [
  // ─── Documents ───────────────────────────────────────────────────────────────
  {
    id: "doc_seed_001",
    title: "BCF-SL Institutional Constitution and Governance Charter 2026",
    description: "Official founding charter, statutory registration with the Government of Sierra Leone, and executive board governance guidelines.",
    category: "documents",
    fileName: "BCF_SL_Constitution_2026.pdf",
    fileSize: 3450000,
    fileType: "application/pdf",
    fileExt: "pdf",
    fileData: SAMPLE_MOCK_PDF_DATA,
    status: "Active",
    tags: ["Governance", "Charter", "Legal", "Statutory"],
    uploadedBy: {
      name: "Albert Joseph Bandama",
      role: "Super Administrator",
      roleCode: "SA",
      email: "admin@bcfsl.org",
      date: "2026-01-10T09:00:00Z",
    },
    downloadHistory: [
      {
        id: "dl_01",
        name: "Dr. Alimamy Koroma",
        role: "Chief Executive Officer",
        roleCode: "CEO",
        email: "ceo@bcf-sl.org",
        date: "2026-01-12T10:14:00Z",
      },
      {
        id: "dl_02",
        name: "Joseph Conteh",
        role: "Human Resources Director",
        roleCode: "HR",
        email: "jconteh@bcf-sl.org",
        date: "2026-01-15T14:30:00Z",
      },
      {
        id: "dl_03",
        name: "Samuel Kamara",
        role: "Internal Audit & Risk Director",
        roleCode: "IAR",
        email: "skamara@bcf-sl.org",
        date: "2026-02-01T11:20:00Z",
      },
    ],
    downloadCount: 3,
    versions: [
      {
        versionNumber: 1,
        fileName: "BCF_SL_Constitution_2026.pdf",
        fileSize: 3450000,
        fileType: "application/pdf",
        editedBy: {
          name: "Albert Joseph Bandama",
          role: "Super Administrator",
          roleCode: "SA",
          email: "admin@bcfsl.org",
          date: "2026-01-10T09:00:00Z",
        },
        changeSummary: "Official charter adoption and board certification.",
        editedAt: "2026-01-10T09:00:00Z",
      },
    ],
    currentVersion: 1,
    createdAt: "2026-01-10T09:00:00Z",
    updatedAt: "2026-01-10T09:00:00Z",
  },
  {
    id: "doc_seed_002",
    title: "Five-Year Strategic Humanitarian Impact Framework (2026–2030)",
    description: "Multi-year programmatic strategy outlining poverty alleviation, healthcare outreach, and clean water delivery goals in Sierra Leone.",
    category: "documents",
    fileName: "BCF_Strategic_Framework_2026_2030.pdf",
    fileSize: 5120000,
    fileType: "application/pdf",
    fileExt: "pdf",
    fileData: SAMPLE_MOCK_PDF_DATA,
    status: "Active",
    tags: ["Strategy", "Humanitarian", "Impact"],
    uploadedBy: {
      name: "Joseph Conteh",
      role: "Human Resources Director",
      roleCode: "HR",
      email: "jconteh@bcf-sl.org",
      date: "2026-02-05T11:30:00Z",
    },
    downloadHistory: [
      {
        id: "dl_04",
        name: "Fatmata Sesay",
        role: "Programs Director",
        roleCode: "PRG",
        email: "fsesay@bcf-sl.org",
        date: "2026-02-10T08:45:00Z",
      },
      {
        id: "dl_05",
        name: "Mabinty Mustapha",
        role: "Community Field Officer",
        roleCode: "ST",
        email: "staff@bcf-sl.org",
        date: "2026-02-12T16:10:00Z",
      },
    ],
    downloadCount: 2,
    versions: [
      {
        versionNumber: 1,
        fileName: "BCF_Strategic_Framework_2026_2030.pdf",
        fileSize: 5120000,
        fileType: "application/pdf",
        editedBy: {
          name: "Joseph Conteh",
          role: "Human Resources Director",
          roleCode: "HR",
          email: "jconteh@bcf-sl.org",
          date: "2026-02-05T11:30:00Z",
        },
        changeSummary: "Initial version approved by executive directorate.",
        editedAt: "2026-02-05T11:30:00Z",
      },
    ],
    currentVersion: 1,
    createdAt: "2026-02-05T11:30:00Z",
    updatedAt: "2026-02-05T11:30:00Z",
  },

  // ─── Policies ────────────────────────────────────────────────────────────────
  {
    id: "doc_seed_003",
    title: "Institutional Child Safeguarding and Vulnerable Adults Protection Policy",
    description: "Zero-tolerance operational standards, reporting protocols, background check requirements, and staff conduct guidelines in communities.",
    category: "policies",
    fileName: "BCF_Child_Safeguarding_Policy_2026.pdf",
    fileSize: 2200000,
    fileType: "application/pdf",
    fileExt: "pdf",
    fileData: SAMPLE_MOCK_PDF_DATA,
    status: "Active",
    effectiveDate: "2026-01-01",
    tags: ["Safeguarding", "Protection", "Mandatory", "Compliance"],
    uploadedBy: {
      name: "Joseph Conteh",
      role: "Human Resources Director",
      roleCode: "HR",
      email: "jconteh@bcf-sl.org",
      date: "2026-01-02T08:00:00Z",
    },
    downloadHistory: [
      {
        id: "dl_06",
        name: "Albert Joseph Bandama",
        role: "Super Administrator",
        roleCode: "SA",
        email: "admin@bcfsl.org",
        date: "2026-01-05T09:12:00Z",
      },
      {
        id: "dl_07",
        name: "Mabinty Mustapha",
        role: "Community Field Officer",
        roleCode: "ST",
        email: "staff@bcf-sl.org",
        date: "2026-01-10T12:00:00Z",
      },
    ],
    downloadCount: 2,
    versions: [
      {
        versionNumber: 1,
        fileName: "BCF_Child_Safeguarding_Policy_2026.pdf",
        fileSize: 2200000,
        fileType: "application/pdf",
        editedBy: {
          name: "Joseph Conteh",
          role: "Human Resources Director",
          roleCode: "HR",
          email: "jconteh@bcf-sl.org",
          date: "2026-01-02T08:00:00Z",
        },
        changeSummary: "Mandatory compliance release for all BCF-SL personnel.",
        editedAt: "2026-01-02T08:00:00Z",
      },
    ],
    currentVersion: 1,
    createdAt: "2026-01-02T08:00:00Z",
    updatedAt: "2026-01-02T08:00:00Z",
  },
  {
    id: "doc_seed_004",
    title: "Financial Governance, Dual-Authorization & Anti-Corruption Framework",
    description: "Standard operating procedures covering procurement thresholds, dual bank authorizations, travel allowances, and internal fraud reporting.",
    category: "policies",
    fileName: "BCF_Financial_Governance_AntiCorruption.pdf",
    fileSize: 3100000,
    fileType: "application/pdf",
    fileExt: "pdf",
    fileData: SAMPLE_MOCK_PDF_DATA,
    status: "Active",
    effectiveDate: "2026-01-15",
    tags: ["Finance", "Governance", "Anti-Corruption", "Audit"],
    uploadedBy: {
      name: "Albert Joseph Bandama",
      role: "Super Administrator",
      roleCode: "SA",
      email: "admin@bcfsl.org",
      date: "2026-01-15T10:00:00Z",
    },
    downloadHistory: [
      {
        id: "dl_08",
        name: "Mohamed Bangura",
        role: "Finance Director",
        roleCode: "FIN",
        email: "mbangura@bcf-sl.org",
        date: "2026-01-16T11:00:00Z",
      },
      {
        id: "dl_09",
        name: "Samuel Kamara",
        role: "Internal Audit & Risk Director",
        roleCode: "IAR",
        email: "skamara@bcf-sl.org",
        date: "2026-01-18T15:30:00Z",
      },
    ],
    downloadCount: 2,
    versions: [
      {
        versionNumber: 1,
        fileName: "BCF_Financial_Governance_AntiCorruption.pdf",
        fileSize: 3100000,
        fileType: "application/pdf",
        editedBy: {
          name: "Albert Joseph Bandama",
          role: "Super Administrator",
          roleCode: "SA",
          email: "admin@bcfsl.org",
          date: "2026-01-15T10:00:00Z",
        },
        changeSummary: "Formal publication following board audit ratification.",
        editedAt: "2026-01-15T10:00:00Z",
      },
    ],
    currentVersion: 1,
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  },

  // ─── Proposals ───────────────────────────────────────────────────────────────
  {
    id: "doc_seed_005",
    title: "Freetown Community Clean Water & Borehole Filtration Initiative 2026–2027",
    description: "Comprehensive grant proposal submitted to Global Water Trust seeking $450,000 for deep solar-powered boreholes in informal coastal settlements.",
    category: "proposals",
    fileName: "Freetown_WASH_Grant_Proposal_2026.docx",
    fileSize: 1850000,
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileExt: "docx",
    fileData: SAMPLE_MOCK_PDF_DATA,
    status: "Active",
    subStatus: "Submitted",
    relatedProgramDonor: "Global Water Trust / Freetown City Council",
    tags: ["Water", "WASH", "Grants", "Freetown"],
    uploadedBy: {
      name: "Fatmata Sesay",
      role: "Programs Director",
      roleCode: "PRG",
      email: "fsesay@bcf-sl.org",
      date: "2026-02-18T14:20:00Z",
    },
    downloadHistory: [
      {
        id: "dl_10",
        name: "Dr. Alimamy Koroma",
        role: "Chief Executive Officer",
        roleCode: "CEO",
        email: "ceo@bcf-sl.org",
        date: "2026-02-20T09:30:00Z",
      },
    ],
    downloadCount: 1,
    versions: [
      {
        versionNumber: 1,
        fileName: "Freetown_WASH_Grant_Proposal_2026.docx",
        fileSize: 1850000,
        fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        editedBy: {
          name: "Fatmata Sesay",
          role: "Programs Director",
          roleCode: "PRG",
          email: "fsesay@bcf-sl.org",
          date: "2026-02-18T14:20:00Z",
        },
        changeSummary: "Submitted proposal submission draft with complete cost breakdown.",
        editedAt: "2026-02-18T14:20:00Z",
      },
    ],
    currentVersion: 1,
    createdAt: "2026-02-18T14:20:00Z",
    updatedAt: "2026-02-18T14:20:00Z",
  },

  // ─── Projects ────────────────────────────────────────────────────────────────
  {
    id: "doc_seed_006",
    title: "Kambia Youth Vocational Apprenticeship Incubation Project (Phase 2)",
    description: "Ongoing field project charter providing certified vocational apprenticeships in electrical installation, carpentry, and agricultural processing.",
    category: "projects",
    fileName: "Kambia_Youth_Vocational_Project_Charter.pdf",
    fileSize: 4200000,
    fileType: "application/pdf",
    fileExt: "pdf",
    fileData: SAMPLE_MOCK_PDF_DATA,
    status: "Active",
    subStatus: "Ongoing",
    relatedProgramDonor: "Bandama Foundation Endowment & USAID Youth Lead",
    tags: ["Youth", "Vocational", "Apprenticeship", "Kambia"],
    uploadedBy: {
      name: "Fatmata Sesay",
      role: "Programs Director",
      roleCode: "PRG",
      email: "fsesay@bcf-sl.org",
      date: "2026-01-28T16:00:00Z",
    },
    downloadHistory: [
      {
        id: "dl_11",
        name: "Samuel Kamara",
        role: "Internal Audit & Risk Director",
        roleCode: "IAR",
        email: "skamara@bcf-sl.org",
        date: "2026-02-02T13:40:00Z",
      },
    ],
    downloadCount: 1,
    versions: [
      {
        versionNumber: 1,
        fileName: "Kambia_Youth_Vocational_Project_Charter.pdf",
        fileSize: 4200000,
        fileType: "application/pdf",
        editedBy: {
          name: "Fatmata Sesay",
          role: "Programs Director",
          roleCode: "PRG",
          email: "fsesay@bcf-sl.org",
          date: "2026-01-28T16:00:00Z",
        },
        changeSummary: "Phase 2 baseline milestones and district council MoU signed.",
        editedAt: "2026-01-28T16:00:00Z",
      },
    ],
    currentVersion: 1,
    createdAt: "2026-01-28T16:00:00Z",
    updatedAt: "2026-01-28T16:00:00Z",
  },

  // ─── Deleted Items Log (Soft-deleted record) ──────────────────────────────────
  {
    id: "doc_seed_007",
    title: "Fleet Vehicle Fuel Rationing Protocol 2024 (Archived Draft)",
    description: "Preliminary emergency fuel allocation schedule drafted for 2024 regional emergency response vehicles.",
    category: "policies",
    fileName: "Draft_Vehicle_Fuel_Protocol_2024.pdf",
    fileSize: 1100000,
    fileType: "application/pdf",
    fileExt: "pdf",
    fileData: SAMPLE_MOCK_PDF_DATA,
    status: "Deleted",
    tags: ["Archived", "Fleet", "Historical"],
    uploadedBy: {
      name: "Joseph Conteh",
      role: "Human Resources Director",
      roleCode: "HR",
      email: "jconteh@bcf-sl.org",
      date: "2024-06-12T10:00:00Z",
    },
    deletedInfo: {
      deletedBy: {
        name: "Dr. Alimamy Koroma",
        role: "Chief Executive Officer",
        roleCode: "CEO",
        email: "ceo@bcf-sl.org",
        date: "2026-02-14T11:45:00Z",
      },
      reason: "Superseded by modernized 2026 Transport and Fleet Operations Logistics Manual.",
      deletedAt: "2026-02-14T11:45:00Z",
    },
    downloadHistory: [
      {
        id: "dl_12",
        name: "Mohamed Bangura",
        role: "Finance Director",
        roleCode: "FIN",
        email: "mbangura@bcf-sl.org",
        date: "2024-07-01T09:00:00Z",
      },
    ],
    downloadCount: 1,
    versions: [
      {
        versionNumber: 1,
        fileName: "Draft_Vehicle_Fuel_Protocol_2024.pdf",
        fileSize: 1100000,
        fileType: "application/pdf",
        editedBy: {
          name: "Joseph Conteh",
          role: "Human Resources Director",
          roleCode: "HR",
          email: "jconteh@bcf-sl.org",
          date: "2024-06-12T10:00:00Z",
        },
        changeSummary: "Original draft policy.",
        editedAt: "2024-06-12T10:00:00Z",
      },
    ],
    currentVersion: 1,
    createdAt: "2024-06-12T10:00:00Z",
    updatedAt: "2026-02-14T11:45:00Z",
  },

  // ─── Employee Contracts ───────────────────────────────────────────────────
  {
    id: "contract_seed_st001",
    title: "Mabinty Mustapha — Permanent Employment Contract",
    description: "Official institutional contract of employment for Community Field Officer in the Programs Department.",
    category: "employee-contracts",
    employeeId: "BCF-ST-001",
    employeeName: "Mabinty Mustapha",
    employeeDept: "Programs Department",
    contractType: "Permanent",
    startDate: "2026-01-01",
    endDate: null,
    contractStatus: "Active",
    fileName: "Contract_BCF_ST_001_Mabinty_Mustapha.pdf",
    fileSize: 1850000,
    fileType: "application/pdf",
    fileExt: "pdf",
    fileData: SAMPLE_MOCK_PDF_DATA,
    status: "Active",
    tags: ["Contract", "Permanent", "Programs", "Employment"],
    uploadedBy: {
      name: "Joseph Conteh",
      role: "Human Resources Director",
      roleCode: "HR",
      email: "jconteh@bcf-sl.org",
      date: "2026-01-05T09:00:00Z",
    },
    uploadedAt: "2026-01-05T09:00:00Z",
    downloadHistory: [
      {
        id: "dl_c1",
        name: "Mabinty Mustapha",
        role: "Staff Member",
        roleCode: "ST",
        email: "staff@bcf-sl.org",
        date: "2026-01-06T10:15:00Z",
      },
      {
        id: "dl_c2",
        name: "Dr. Alimamy Koroma",
        role: "Chief Executive Officer",
        roleCode: "CEO",
        email: "ceo@bcf-sl.org",
        date: "2026-01-08T14:20:00Z",
      },
    ],
    downloadCount: 2,
    versions: [
      {
        versionNumber: 1,
        fileName: "Contract_BCF_ST_001_Mabinty_Mustapha.pdf",
        fileSize: 1850000,
        fileType: "application/pdf",
        fileData: SAMPLE_MOCK_PDF_DATA,
        editedBy: {
          name: "Joseph Conteh",
          role: "Human Resources Director",
          roleCode: "HR",
          email: "jconteh@bcf-sl.org",
          date: "2026-01-05T09:00:00Z",
        },
        changeSummary: "Initial permanent appointment contract.",
        editedAt: "2026-01-05T09:00:00Z",
      },
    ],
    currentVersion: 1,
    createdAt: "2026-01-05T09:00:00Z",
    updatedAt: "2026-01-05T09:00:00Z",
  },
  {
    id: "contract_seed_st002",
    title: "Alpha Kamara — Fixed-Term Logistics Contract",
    description: "Fixed-term logistics support contract for humanitarian relief distribution operations.",
    category: "employee-contracts",
    employeeId: "BCF-ST-002",
    employeeName: "Alpha Kamara",
    employeeDept: "Logistics Department",
    contractType: "Fixed-Term Contract",
    startDate: "2026-01-15",
    endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    contractStatus: "Active",
    fileName: "Contract_BCF_ST_002_Alpha_Kamara.pdf",
    fileSize: 1650000,
    fileType: "application/pdf",
    fileExt: "pdf",
    fileData: SAMPLE_MOCK_PDF_DATA,
    status: "Active",
    tags: ["Contract", "Fixed-Term Contract", "Logistics"],
    uploadedBy: {
      name: "Joseph Conteh",
      role: "Human Resources Director",
      roleCode: "HR",
      email: "jconteh@bcf-sl.org",
      date: "2026-01-15T11:00:00Z",
    },
    uploadedAt: "2026-01-15T11:00:00Z",
    downloadHistory: [],
    downloadCount: 0,
    versions: [
      {
        versionNumber: 1,
        fileName: "Contract_BCF_ST_002_Alpha_Kamara.pdf",
        fileSize: 1650000,
        fileType: "application/pdf",
        fileData: SAMPLE_MOCK_PDF_DATA,
        editedBy: {
          name: "Joseph Conteh",
          role: "Human Resources Director",
          roleCode: "HR",
          email: "jconteh@bcf-sl.org",
          date: "2026-01-15T11:00:00Z",
        },
        changeSummary: "Initial fixed-term deployment contract.",
        editedAt: "2026-01-15T11:00:00Z",
      },
    ],
    currentVersion: 1,
    createdAt: "2026-01-15T11:00:00Z",
    updatedAt: "2026-01-15T11:00:00Z",
  },
  {
    id: "contract_seed_del001",
    title: "Sahr Bangura — Field Trainee Internship Contract (Archived)",
    description: "Probationary field trainee contract for initial trial period.",
    category: "employee-contracts",
    employeeId: "BCF-EMP-2027-0001",
    employeeName: "Sahr Emmanuel Bangura",
    employeeDept: "Programs Department",
    contractType: "Intern",
    startDate: "2025-10-01",
    endDate: "2025-12-31",
    contractStatus: "Terminated",
    fileName: "Contract_BCF_EMP_2027_0001_Probation.pdf",
    fileSize: 1420000,
    fileType: "application/pdf",
    fileExt: "pdf",
    fileData: SAMPLE_MOCK_PDF_DATA,
    status: "Deleted",
    isDeleted: true,
    deletedInfo: {
      deletedBy: {
        name: "Dr. Alimamy Koroma",
        role: "Chief Executive Officer",
        roleCode: "CEO",
        email: "ceo@bcf-sl.org",
        date: "2026-01-02T16:00:00Z",
      },
      reason: "Superseded by full permanent appointment contract.",
      deletedAt: "2026-01-02T16:00:00Z",
    },
    uploadedBy: {
      name: "Joseph Conteh",
      role: "Human Resources Director",
      roleCode: "HR",
      email: "jconteh@bcf-sl.org",
      date: "2025-10-01T08:30:00Z",
    },
    uploadedAt: "2025-10-01T08:30:00Z",
    downloadHistory: [
      {
        id: "dl_cdel1",
        name: "Samuel Kamara",
        role: "Internal Audit & Risk Director",
        roleCode: "IAR",
        email: "skamara@bcf-sl.org",
        date: "2025-11-10T12:00:00Z",
      },
    ],
    downloadCount: 1,
    versions: [
      {
        versionNumber: 1,
        fileName: "Contract_BCF_EMP_2027_0001_Probation.pdf",
        fileSize: 1420000,
        fileType: "application/pdf",
        fileData: SAMPLE_MOCK_PDF_DATA,
        editedBy: {
          name: "Joseph Conteh",
          role: "Human Resources Director",
          roleCode: "HR",
          email: "jconteh@bcf-sl.org",
          date: "2025-10-01T08:30:00Z",
        },
        changeSummary: "Initial probation filing.",
        editedAt: "2025-10-01T08:30:00Z",
      },
    ],
    currentVersion: 1,
    createdAt: "2025-10-01T08:30:00Z",
    updatedAt: "2026-01-02T16:00:00Z",
  },
];

import { generateDefaultPermissionRows } from "@/lib/documentPermissions";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const reset = url.searchParams.get("reset") === "true";

    const col = await getCollection<DocumentItem>(COLLECTIONS.DOCUMENTS);
    const count = await col.countDocuments();

    // 1. Seed or update permissions table rows
    const permCol = await getCollection(COLLECTIONS.DOCUMENTS_PERMISSIONS);
    const permCount = await permCol.countDocuments();
    if (permCount === 0 || reset) {
      if (reset) await permCol.deleteMany({});
      const permRows = generateDefaultPermissionRows();
      await permCol.insertMany(permRows.map((r) => ({ ...r, updatedAt: new Date().toISOString() })) as any);
    }

    // 2. Ensure test staff employees exist in EMPLOYEES collection
    const empCol = await getCollection(COLLECTIONS.EMPLOYEES);
    const existingStaffA = await empCol.findOne({
      $or: [{ employeeId: "BCF-ST-001" }, { email: "staff@bcf-sl.org" }],
    });
    if (!existingStaffA) {
      await empCol.insertOne({
        id: "BCF-ST-001",
        employeeId: "BCF-ST-001",
        name: "Mabinty Mustapha",
        fullName: "Mabinty Mustapha",
        username: "staff_user",
        email: "staff@bcf-sl.org",
        dept: "Programs Department",
        department: "Programs Department",
        title: "Community Field Officer",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      });
    }

    const existingStaffB = await empCol.findOne({
      $or: [{ employeeId: "BCF-ST-002" }, { email: "staff_b@bcf-sl.org" }],
    });
    if (!existingStaffB) {
      await empCol.insertOne({
        id: "BCF-ST-002",
        employeeId: "BCF-ST-002",
        name: "Alpha Kamara",
        fullName: "Alpha Kamara",
        username: "staff_user_b",
        email: "staff_b@bcf-sl.org",
        dept: "Logistics Department",
        department: "Logistics Department",
        title: "Field Logistics Assistant",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Seed documents if empty, or insert missing contracts if contracts not yet present
    const contractsCount = await col.countDocuments({ category: "employee-contracts" });

    if (count === 0 || reset) {
      if (reset) await col.deleteMany({});
      await col.insertMany(SEED_DOCUMENTS as any);
      return NextResponse.json({
        success: true,
        seeded: true,
        message: `Successfully seeded ${SEED_DOCUMENTS.length} official institutional documents and contracts into MongoDB Atlas.`,
      });
    }

    if (contractsCount === 0) {
      const contractSeeds = SEED_DOCUMENTS.filter((d) => d.category === "employee-contracts");
      if (contractSeeds.length > 0) {
        await col.insertMany(contractSeeds as any);
      }
      return NextResponse.json({
        success: true,
        seeded: true,
        message: `Added ${contractSeeds.length} seeded employee contracts to existing documents.`,
      });
    }

    return NextResponse.json({
      success: true,
      seeded: false,
      message: `Documents collection already contains ${count} items (including ${contractsCount} contracts).`,
    });
  } catch (error: any) {
    console.error("[GET /api/documents/seed] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to seed documents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

