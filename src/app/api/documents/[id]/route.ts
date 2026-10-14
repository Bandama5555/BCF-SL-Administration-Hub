import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { normalizeRole, type RoleCode } from "@/lib/permissions";
import { checkDocumentPermission, type DocumentTab } from "@/lib/documentPermissions";
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

interface Params {
  params: Promise<{ id: string }>;
}

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

async function findItem(id: string, col: any): Promise<DocumentItem | null> {
  let doc = await col.findOne({ id });
  if (!doc) {
    try {
      doc = await col.findOne({ _id: new ObjectId(id) as any });
    } catch (_) {}
  }
  return doc;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = extractUser(req);
    const col = await getCollection<DocumentItem>(COLLECTIONS.DOCUMENTS);
    const item = await findItem(id, col);

    if (!item) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Check if user has permission to view this tab
    if (!checkDocumentPermission(user.roleCode, item.category as DocumentTab, "view")) {
      await logSecurityAudit({
        action: "DOCUMENT_VIEW_DENIED",
        user: user.name,
        role: user.roleCode,
        email: user.email,
        itemId: id,
        tab: item.category,
        reason: "User role cannot view items in this tab.",
      });

      return NextResponse.json({ error: "You do not have access to that page." }, { status: 403 });
    }

    // STAFF PRIVACY RULE:
    // If requesting an employee contract, staff can see ONLY their own contract!
    // Changing an ID or URL returns "You do not have access to that page" and logs failed access attempt.
    if (item.category === "employee-contracts" && user.roleCode === "ST") {
      const staffEmpId = await resolveStaffEmployeeId(user);
      if (!staffEmpId || item.employeeId !== staffEmpId) {
        await logSecurityAudit({
          action: "FAILED_ACCESS_ATTEMPT",
          user: user.name,
          role: user.roleCode,
          email: user.email,
          employeeId: staffEmpId || "UNLINKED",
          itemId: id,
          itemTitle: item.title,
          tab: "employee-contracts",
          reason: "Staff member attempted to view contract belonging to another employee.",
        });

        return NextResponse.json({ error: "You do not have access to that page." }, { status: 403 });
      }
    }

    const canViewHistory = checkDocumentPermission(user.roleCode, item.category as DocumentTab, "viewDownloadHistory");

    const sanitized: any = {
      ...item,
      id: item.id || (item as any)._id?.toString(),
    };

    if (!canViewHistory) {
      sanitized.downloadHistory = [];
    }

    // Write view to audit log if contract
    if (item.category === "employee-contracts") {
      await logSecurityAudit({
        action: "CONTRACT_VIEWED",
        user: user.name,
        role: user.roleCode,
        email: user.email,
        employeeId: item.employeeId,
        itemId: item.id,
        itemTitle: item.title,
        tab: "employee-contracts",
      });
    }

    return NextResponse.json({
      success: true,
      item: sanitized,
    });
  } catch (error: any) {
    console.error("[GET /api/documents/:id] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load document" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = extractUser(req);
    const col = await getCollection<DocumentItem>(COLLECTIONS.DOCUMENTS);
    const item = await findItem(id, col);

    if (!item) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Enforce edit permission
    if (!checkDocumentPermission(user.roleCode, item.category as DocumentTab, "edit")) {
      await logSecurityAudit({
        action: "DOCUMENT_EDIT_DENIED",
        user: user.name,
        role: user.roleCode,
        email: user.email,
        itemId: id,
        tab: item.category,
        reason: "User does not have edit permission for this item.",
      });

      return NextResponse.json(
        { error: "You do not have permission to edit items in this section." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      subStatus,
      tags,
      effectiveDate,
      changeSummary,
      newFile,
      // Contract fields
      contractType,
      startDate,
      endDate,
      contractStatus,
    } = body;

    const nowIso = new Date().toISOString();
    const newVersionNumber = (item.currentVersion || 1) + 1;

    let updatedFileName = item.fileName;
    let updatedFileSize = item.fileSize;
    let updatedFileType = item.fileType;
    let updatedFileExt = item.fileExt;
    let updatedFileData = item.fileData;

    if (newFile && newFile.fileName && newFile.fileData) {
      updatedFileName = newFile.fileName;
      updatedFileSize = newFile.fileSize || item.fileSize;
      updatedFileType = newFile.fileType || item.fileType;
      updatedFileExt = newFile.fileName.split(".").pop()?.toLowerCase() || item.fileExt;
      updatedFileData = newFile.fileData;
    }

    const newVersionEntry = {
      versionNumber: newVersionNumber,
      fileName: updatedFileName,
      fileSize: updatedFileSize,
      fileType: updatedFileType,
      fileData: updatedFileData,
      editedBy: {
        name: user.name,
        role: user.role,
        roleCode: user.roleCode,
        email: user.email,
        date: nowIso,
      },
      changeSummary: changeSummary || (item.category === "employee-contracts" ? "Contract amendment and details update." : "Document updated with revised version and metadata."),
      editedAt: nowIso,
    };

    const updateDoc: any = {
      $set: {
        title: title ? title.trim() : item.title,
        description: description ? description.trim() : item.description,
        subStatus: subStatus || item.subStatus,
        effectiveDate: effectiveDate || item.effectiveDate,
        tags: Array.isArray(tags) ? tags : item.tags,
        fileName: updatedFileName,
        fileSize: updatedFileSize,
        fileType: updatedFileType,
        fileExt: updatedFileExt,
        fileData: updatedFileData,
        currentVersion: newVersionNumber,
        editedBy: {
          name: user.name,
          role: user.role,
          roleCode: user.roleCode,
          email: user.email,
          date: nowIso,
        },
        editedAt: nowIso,
        updatedAt: nowIso,
      },
      $push: {
        versions: newVersionEntry,
      },
    };

    if (item.category === "employee-contracts") {
      const targetType = (contractType || item.contractType) as ContractType;
      if (contractType && !CONTRACT_TYPES.includes(targetType)) {
        return NextResponse.json(
          {
            error:
              "Contract type is invalid. Must be one of: Permanent, Fixed-Term Contract, Part-Time, Casual, Consultant, Volunteer, Intern.",
          },
          { status: 400 }
        );
      }

      const targetStartDate = startDate !== undefined ? startDate : item.startDate;
      if (!targetStartDate || !String(targetStartDate).trim()) {
        return NextResponse.json(
          { error: "Start date is required for employment contracts." },
          { status: 400 }
        );
      }

      const isNoEndDate = CONTRACT_TYPES_WITHOUT_END_DATE.includes(targetType);

      if (isNoEndDate) {
        // Must be NULL and is never stored or shown for Permanent and Volunteer.
        // If an end date value was explicitly provided, reject it on the server:
        if (endDate !== undefined && endDate !== null && String(endDate).trim() !== "") {
          return NextResponse.json(
            { error: `${targetType} contracts cannot have an end date.` },
            { status: 400 }
          );
        }
        if (contractStatus === "Expired") {
          return NextResponse.json(
            { error: `${targetType} contracts do not expire and cannot have 'Expired' status.` },
            { status: 400 }
          );
        }
        // If the type is changed to Permanent or Volunteer, remove the stored end date
        updateDoc.$set.endDate = null;
      } else {
        // Fixed-Term Contract, Part-Time, Casual, Consultant, Intern require an end date
        const targetEndDate = endDate !== undefined ? endDate : item.endDate;
        if (!targetEndDate || !String(targetEndDate).trim()) {
          return NextResponse.json(
            { error: `End date is required for ${targetType} contracts.` },
            { status: 400 }
          );
        }
        if (new Date(targetEndDate).getTime() <= new Date(targetStartDate).getTime()) {
          return NextResponse.json(
            { error: "End date must be after the start date." },
            { status: 400 }
          );
        }
        updateDoc.$set.endDate = targetEndDate;
      }

      if (contractType) updateDoc.$set.contractType = targetType;
      if (startDate !== undefined) updateDoc.$set.startDate = targetStartDate;
      if (contractStatus) updateDoc.$set.contractStatus = contractStatus;
    }

    await col.updateOne({ id: item.id }, updateDoc);

    // Sync to EMPLOYEE_CONTRACTS collection if contract
    if (item.category === "employee-contracts") {
      try {
        const contractsCol = await getCollection(COLLECTIONS.EMPLOYEE_CONTRACTS);
        await contractsCol.updateOne({ id: item.id }, updateDoc);
      } catch (_) {}
    }

    // Audit Log entry (Edits do not trigger notifications per institutional setting)
    await logSecurityAudit({
      action: item.category === "employee-contracts" ? "CONTRACT_EDITED" : "DOCUMENT_EDITED",
      user: user.name,
      role: user.roleCode,
      email: user.email,
      employeeId: item.employeeId,
      itemId: item.id,
      itemTitle: title || item.title,
      tab: item.category,
      reason: changeSummary || "Metadata and file replacement",
      details: {
        version: newVersionNumber,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Document updated to Version ${newVersionNumber}.`,
      currentVersion: newVersionNumber,
    });
  } catch (error: any) {
    console.error("[PUT /api/documents/:id] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = extractUser(req);
    const col = await getCollection<DocumentItem>(COLLECTIONS.DOCUMENTS);
    const item = await findItem(id, col);

    if (!item) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Enforce delete permission:
    // For employee contracts: Only HR Director, Super Admin and CEO can delete!
    if (!checkDocumentPermission(user.roleCode, item.category as DocumentTab, "delete")) {
      await logSecurityAudit({
        action: "DOCUMENT_DELETE_DENIED",
        user: user.name,
        role: user.roleCode,
        email: user.email,
        itemId: id,
        tab: item.category,
        reason: "User role does not have delete permission.",
      });

      return NextResponse.json(
        { error: "You do not have permission to delete items in this module." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason = (body.reason || "").trim();

    // Required deletion justification
    if (!reason) {
      return NextResponse.json(
        { error: "A valid deletion reason is required for institutional compliance." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const deleteUpdate: any = {
      $set: {
        status: "Deleted",
        isDeleted: true,
        deletedInfo: {
          deletedBy: {
            name: user.name,
            role: user.role,
            roleCode: user.roleCode,
            email: user.email,
            date: nowIso,
          },
          reason,
          deletedAt: nowIso,
        },
        updatedAt: nowIso,
      },
    };

    // Soft delete: set status to Deleted, keep record and file
    await col.updateOne({ id: item.id }, deleteUpdate);

    // Sync to EMPLOYEE_CONTRACTS collection if contract
    if (item.category === "employee-contracts") {
      try {
        const contractsCol = await getCollection(COLLECTIONS.EMPLOYEE_CONTRACTS);
        await contractsCol.updateOne({ id: item.id }, deleteUpdate);
      } catch (_) {}
    }

    // Audit log
    await logSecurityAudit({
      action: item.category === "employee-contracts" ? "CONTRACT_DELETED" : "DOCUMENT_DELETED",
      user: user.name,
      role: user.roleCode,
      email: user.email,
      employeeId: item.employeeId,
      itemId: item.id,
      itemTitle: item.title,
      tab: item.category,
      reason,
    });

    // Trigger Notifications:
    try {
      const notifCol = await getCollection<DocumentNotification>(COLLECTIONS.DOCUMENTS_NOTIFICATIONS);

      if (item.category === "employee-contracts") {
        // Notification rules for contracts deletion:
        // Notify:
        // 1. Employee it belongs to: "A contract was deleted from your record"
        // 2. HR Director, Super Admin, CEO, Internal Audit & Risk Director
        // Do NOT notify other staff.
        // Do not notify person who performed the action.
        const notifs: any[] = [];

        let empUserTarget = item.employeeId || "";
        try {
          const empCol = await getCollection(COLLECTIONS.EMPLOYEES);
          const empRecord = await empCol.findOne({
            $or: [{ employeeId: item.employeeId }, { id: item.employeeId }],
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
            action: "Deleted",
            itemTitle: "A contract was deleted from your record",
            itemId: item.id,
            tab: "employee-contracts",
            actorName: user.name,
            actorRole: user.role,
            actorEmail: user.email,
            timestamp: nowIso,
            read: false,
          });
        }

        const governanceRoles: RoleCode[] = ["HR", "SA", "CEO", "IAR"];
        governanceRoles.forEach((r) => {
          if (r !== user.roleCode) {
            notifs.push({
              id: `notif_${Date.now()}_${r}_${Math.random().toString(36).substring(2, 6)}`,
              recipientUser: `role:${r}`,
              recipientRole: r,
              action: "Deleted",
              itemTitle: `Contract Deleted: ${item.employeeName || item.employeeId} — ${item.title}`,
              itemId: item.id,
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
        const targetRoles: RoleCode[] = ["ST", "HR", "SA", "CEO", "IAR", "PRG", "FIN"];
        const notificationsToInsert = targetRoles
          .filter((r) => r !== user.roleCode && checkDocumentPermission(r, item.category as DocumentTab, "view"))
          .map((r) => ({
            id: `notif_${Date.now()}_${r}_${Math.random().toString(36).substring(2, 6)}`,
            recipientUser: `role:${r}`,
            recipientRole: r,
            action: "Deleted" as const,
            itemTitle: item.title,
            itemId: item.id,
            tab: item.category as DocumentTab,
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
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: "Item soft-deleted and moved to Deleted Items Log.",
    });
  } catch (error: any) {
    console.error("[DELETE /api/documents/:id] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete document" }, { status: 500 });
  }
}
