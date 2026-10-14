import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { normalizeRole, type RoleCode } from "@/lib/permissions";
import {
  checkDocumentPermission,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  type DocumentTab,
} from "@/lib/documentPermissions";
import {
  type DocumentItem,
  type DocumentNotification,
  CONTRACT_TYPES,
  CONTRACT_TYPES_WITHOUT_END_DATE,
  contractHasEndDate,
  type ContractType,
} from "@/lib/documentTypes";
import {
  resolveStaffEmployeeId,
  logSecurityAudit,
  type UserContext,
} from "@/lib/contractSecurity";

function extractUser(req: NextRequest): {
  username: string;
  email: string;
  name: string;
  role: string;
  roleCode: RoleCode;
  employeeId?: string;
} {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");
  const nameHeader = req.headers.get("x-bcf-name");
  const empIdHeader = req.headers.get("x-bcf-employee-id");

  // Also check query params as fallback for downloads/testing
  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;
  const qName = url.searchParams.get("name") || nameHeader;
  const qEmpId = url.searchParams.get("employeeId") || empIdHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail);
  return {
    username: qUser || "system_user",
    email: qEmail || "user@bcf-sl.org",
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Staff Member"),
    role: qRole || roleCode,
    roleCode,
    employeeId: qEmpId || undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = extractUser(req);
    const url = new URL(req.url);
    const tab = (url.searchParams.get("tab") || "documents") as DocumentTab;

    // Strict Server-Side RBAC Enforcement: Deny by default
    if (!checkDocumentPermission(user.roleCode, tab, "view")) {
      await logSecurityAudit({
        action: "TAB_ACCESS_DENIED",
        user: user.name,
        role: user.roleCode,
        email: user.email,
        tab,
        reason: "Role does not have permission to view this tab.",
      });

      return NextResponse.json(
        {
          error: "You do not have access to that page.",
          code: "ACCESS_DENIED",
          tab,
          role: user.roleCode,
        },
        { status: 403 }
      );
    }

    const col = await getCollection<DocumentItem>(COLLECTIONS.DOCUMENTS);

    // Build database query
    let query: any = {};

    if (tab === "deleted-items") {
      // Soft-deleted items log (hidden from Staff and Finance)
      query = { status: "Deleted" };
    } else if (tab === "employee-contracts") {
      // STAFF PRIVACY RULE:
      // A staff member can see and download ONLY their own contract.
      // Every query for contracts must automatically include employee_id = <logged-in user's employee_id>.
      if (user.roleCode === "ST") {
        const staffEmpId = await resolveStaffEmployeeId(user);
        if (!staffEmpId) {
          // If a user has no linked record, show an empty state ("No contract on file")
          // and do NOT fall back to showing all contracts.
          const permissions = {
            canView: true,
            canDownload: false,
            canUpload: false,
            canEdit: false,
            canDelete: false,
            canRestore: false,
            canViewDownloadHistory: false,
          };
          return NextResponse.json({
            success: true,
            tab,
            userRole: user.roleCode,
            permissions,
            items: [],
            totalCount: 0,
            message: "No contract on file",
          });
        }
        query = { category: "employee-contracts", status: "Active", employeeId: staffEmpId };
      } else {
        // HR, Super Admin, CEO, Internal Audit: see all active contracts
        query = { category: "employee-contracts", status: "Active" };
      }
    } else {
      query = { category: tab, status: "Active" };
    }

    const rawItems = await col.find(query).sort({ createdAt: -1 }).toArray();
    const canViewHistory = checkDocumentPermission(user.roleCode, tab, "viewDownloadHistory");

    // Mask sensitive download history for roles that cannot view it (Staff & Finance)
    const items = rawItems.map((item) => {
      const sanitized: any = {
        ...item,
        id: item.id || (item as any)._id?.toString(),
      };

      if (!canViewHistory) {
        sanitized.downloadHistory = [];
      }

      // Do not return raw base64 data in listing to keep payloads light
      delete sanitized.fileData;
      if (sanitized.versions) {
        sanitized.versions = sanitized.versions.map((v: any) => {
          const { fileData, ...rest } = v;
          return rest;
        });
      }

      return sanitized;
    });

    const permissions = {
      canView: true,
      canDownload: checkDocumentPermission(user.roleCode, tab, "download"),
      canUpload: checkDocumentPermission(user.roleCode, tab, "upload"),
      canEdit: checkDocumentPermission(user.roleCode, tab, "edit"),
      canDelete: checkDocumentPermission(user.roleCode, tab, "delete"),
      canRestore: checkDocumentPermission(user.roleCode, tab, "restore"),
      canViewDownloadHistory: canViewHistory,
    };

    return NextResponse.json({
      success: true,
      tab,
      userRole: user.roleCode,
      permissions,
      items,
      totalCount: items.length,
    });
  } catch (error: any) {
    console.error("[GET /api/documents] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let user = extractUser(req);
    const body = await req.json();

    if (body.userRole || body.role) {
      const bRole = body.userRole || body.role;
      const bRoleCode = normalizeRole(bRole, body.userName || body.user, body.userEmail || body.email);
      user = {
        username: body.userName || body.user || user.username,
        email: body.userEmail || body.email || user.email,
        name: body.userName || body.name || user.name,
        role: bRole || bRoleCode,
        roleCode: bRoleCode,
        employeeId: user.employeeId,
      };
    }

    const {
      title,
      description,
      category,
      fileName,
      fileSize,
      fileType,
      fileData,
      effectiveDate,
      subStatus,
      relatedProgramDonor,
      tags,
      // Contract-specific fields
      employeeId,
      employeeName,
      employeeDept,
      contractType,
      startDate,
      endDate,
      contractStatus,
    } = body;

    const tab = (category || body.tab || "documents") as DocumentTab;

    // Strict Server-side permission check:
    if (!checkDocumentPermission(user.roleCode, tab, "upload")) {
      await logSecurityAudit({
        action: "CONTRACT_UPLOAD_DENIED",
        user: user.name,
        role: user.roleCode,
        email: user.email,
        tab,
        reason: "User does not have upload permission for this tab.",
      });

      return NextResponse.json(
        {
          error: "You do not have permission to upload documents to this section.",
          code: "ACCESS_DENIED",
          role: user.roleCode,
        },
        { status: 403 }
      );
    }

    // Required fields check
    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!description || !description.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (!fileName || !fileData) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Contract tab specific validations
    if (tab === "employee-contracts") {
      if (!employeeId || !employeeId.trim()) {
        return NextResponse.json(
          { error: "Employee selection is required for employment contracts." },
          { status: 400 }
        );
      }
      if (!contractType || !CONTRACT_TYPES.includes(contractType as ContractType)) {
        return NextResponse.json(
          {
            error:
              "Contract type is required. Must be one of: Permanent, Fixed-Term Contract, Part-Time, Casual, Consultant, Volunteer, Intern.",
          },
          { status: 400 }
        );
      }
      if (!startDate || !startDate.trim()) {
        return NextResponse.json(
          { error: "Start date is required for employment contracts." },
          { status: 400 }
        );
      }

      const isNoEndDate = CONTRACT_TYPES_WITHOUT_END_DATE.includes(contractType as ContractType);

      if (isNoEndDate) {
        // Must be NULL and is never stored or shown for Permanent and Volunteer.
        // Reject one on the server if it is sent.
        if (endDate !== undefined && endDate !== null && String(endDate).trim() !== "") {
          return NextResponse.json(
            { error: `${contractType} contracts cannot have an end date.` },
            { status: 400 }
          );
        }
        if (contractStatus === "Expired") {
          return NextResponse.json(
            { error: `${contractType} contracts do not expire and cannot have 'Expired' status.` },
            { status: 400 }
          );
        }
      } else {
        // Fixed-Term Contract, Part-Time, Casual, Consultant, Intern require an end date
        if (!endDate || !String(endDate).trim()) {
          return NextResponse.json(
            { error: `End date is required for ${contractType} contracts.` },
            { status: 400 }
          );
        }
        if (new Date(endDate).getTime() <= new Date(startDate).getTime()) {
          return NextResponse.json(
            { error: "End date must be after the start date." },
            { status: 400 }
          );
        }
      }

      // Contracts restricted to PDF, DOC, DOCX
      const contractExt = fileName.split(".").pop()?.toLowerCase() || "";
      if (!["pdf", "doc", "docx"].includes(contractExt)) {
        return NextResponse.json(
          { error: `Contract files must be PDF or DOC/DOCX format (received .${contractExt}).` },
          { status: 400 }
        );
      }
    } else {
      // General documents validation
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `File type .${ext} is not allowed. Supported types: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, PNG/JPG.` },
          { status: 400 }
        );
      }
    }

    const sizeInBytes = Number(fileSize) || 0;
    if (sizeInBytes > DEFAULT_MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds the 25 MB institutional limit (${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB).` },
        { status: 400 }
      );
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();
    const ext = fileName.split(".").pop()?.toLowerCase() || "";

    const newItem: DocumentItem = {
      id: docId,
      title: title.trim(),
      description: description.trim(),
      category: tab as DocumentItem["category"],
      fileName,
      fileSize: sizeInBytes,
      fileType: fileType || "application/octet-stream",
      fileExt: ext,
      fileData,
      status: "Active",
      subStatus: subStatus || (tab === "proposals" ? "Draft" : tab === "projects" ? "Planned" : undefined),
      effectiveDate: effectiveDate || undefined,
      relatedProgramDonor: relatedProgramDonor || undefined,
      tags: Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],

      // Contract fields
      employeeId: tab === "employee-contracts" ? employeeId.trim() : undefined,
      employeeName: tab === "employee-contracts" ? (employeeName || "").trim() : undefined,
      employeeDept: tab === "employee-contracts" ? (employeeDept || "").trim() : undefined,
      contractType: tab === "employee-contracts" ? (contractType as ContractType) : undefined,
      startDate: tab === "employee-contracts" ? startDate : undefined,
      endDate: tab === "employee-contracts"
        ? (CONTRACT_TYPES_WITHOUT_END_DATE.includes(contractType as ContractType) ? null : endDate)
        : undefined,
      contractStatus: tab === "employee-contracts" ? (contractStatus || "Active") : undefined,

      uploadedBy: {
        name: user.name,
        role: user.role,
        roleCode: user.roleCode,
        email: user.email,
        date: nowIso,
      },
      uploadedAt: nowIso,
      downloadHistory: [],
      downloadCount: 0,
      versions: [
        {
          versionNumber: 1,
          fileName,
          fileSize: sizeInBytes,
          fileType: fileType || "application/octet-stream",
          fileData,
          editedBy: {
            name: user.name,
            role: user.role,
            roleCode: user.roleCode,
            email: user.email,
            date: nowIso,
          },
          changeSummary: tab === "employee-contracts" ? "Initial contract filing." : "Initial institutional upload.",
          editedAt: nowIso,
        },
      ],
      currentVersion: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const col = await getCollection<DocumentItem>(COLLECTIONS.DOCUMENTS);
    await col.insertOne(newItem as any);

    // Also mirror to EMPLOYEE_CONTRACTS collection if contract
    if (tab === "employee-contracts") {
      try {
        const contractsCol = await getCollection(COLLECTIONS.EMPLOYEE_CONTRACTS);
        await contractsCol.insertOne(newItem as any);
      } catch (colErr) {
        console.warn("Contracts mirror collection warning:", colErr);
      }
    }

    // Audit Log entry
    await logSecurityAudit({
      action: tab === "employee-contracts" ? "CONTRACT_UPLOADED" : "DOCUMENT_UPLOADED",
      user: user.name,
      role: user.roleCode,
      email: user.email,
      employeeId: newItem.employeeId,
      itemId: docId,
      itemTitle: title.trim(),
      tab,
      details: {
        contractType: newItem.contractType,
        employeeId: newItem.employeeId,
      },
    });

    // Trigger Notifications:
    try {
      const notifCol = await getCollection<DocumentNotification>(COLLECTIONS.DOCUMENTS_NOTIFICATIONS);

      if (tab === "employee-contracts") {
        // Contract Notification Rules:
        // When a contract is added or deleted, notify:
        // 1. The employee it belongs to ("A contract was added to your record")
        // 2. The HR Director, Super Admin, CEO, and Internal Audit & Risk Director
        // Do NOT notify other staff. Staff never receive notifications about someone else's contract.
        // Do not notify the person who performed the action.
        const notifs: any[] = [];

        // 1. Employee notification
        // Find employee user account to target recipientUser
        let empUserTarget = newItem.employeeId || "";
        try {
          const empCol = await getCollection(COLLECTIONS.EMPLOYEES);
          const empRecord = await empCol.findOne({
            $or: [{ employeeId: newItem.employeeId }, { id: newItem.employeeId }],
          });
          if (empRecord && (empRecord.username || empRecord.email)) {
            empUserTarget = empRecord.username || empRecord.email;
          }
        } catch (_) {}

        if (empUserTarget && empUserTarget !== user.username && empUserTarget !== user.email) {
          notifs.push({
            id: `notif_${Date.now()}_emp_${Math.random().toString(36).substring(2, 6)}`,
            recipientUser: empUserTarget,
            recipientRole: "ST" as RoleCode,
            action: "Added",
            itemTitle: "A contract was added to your record",
            itemId: docId,
            tab: "employee-contracts",
            actorName: user.name,
            actorRole: user.role,
            actorEmail: user.email,
            timestamp: nowIso,
            read: false,
          });
        }

        // 2. Executive / Governance roles: HR, SA, CEO, IAR
        const governanceRoles: RoleCode[] = ["HR", "SA", "CEO", "IAR"];
        governanceRoles.forEach((r) => {
          if (r !== user.roleCode) {
            notifs.push({
              id: `notif_${Date.now()}_${r}_${Math.random().toString(36).substring(2, 6)}`,
              recipientUser: `role:${r}`,
              recipientRole: r,
              action: "Added",
              itemTitle: `Contract Added: ${newItem.employeeName || newItem.employeeId} — ${title.trim()}`,
              itemId: docId,
              tab: "employee-contracts",
              actorName: user.name,
              actorRole: user.role,
              actorEmail: user.email,
              timestamp: nowIso,
              read: false,
            });
          }
        });

        if (notifs.length > 0) {
          await notifCol.insertMany(notifs);
        }
      } else {
        // Standard document notifications
        const targetRoles: RoleCode[] = ["ST", "HR", "SA", "CEO", "IAR", "PRG", "FIN"];
        const notificationsToInsert = targetRoles
          .filter((r) => r !== user.roleCode && checkDocumentPermission(r, tab, "view"))
          .map((r) => ({
            id: `notif_${Date.now()}_${r}_${Math.random().toString(36).substring(2, 6)}`,
            recipientUser: `role:${r}`,
            recipientRole: r,
            action: "Added" as const,
            itemTitle: title.trim(),
            itemId: docId,
            tab,
            actorName: user.name,
            actorRole: user.role,
            actorEmail: user.email,
            timestamp: nowIso,
            read: false,
          }));

        if (notificationsToInsert.length > 0) {
          await notifCol.insertMany(notificationsToInsert as any);
        }
      }
    } catch (notifErr) {
      console.warn("Notification trigger warning:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: tab === "employee-contracts" ? "Employee contract filed successfully." : "Document uploaded successfully.",
      item: {
        id: docId,
        title: newItem.title,
        category: newItem.category,
        fileName: newItem.fileName,
        employeeId: newItem.employeeId,
        employeeName: newItem.employeeName,
        uploadedBy: newItem.uploadedBy,
        createdAt: newItem.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[POST /api/documents] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload document" }, { status: 500 });
  }
}
