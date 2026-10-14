import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { normalizeRole, type RoleCode } from "@/lib/permissions";
import { type DocumentItem, type DocumentNotification } from "@/lib/documentTypes";
import { logSecurityAudit, type UserContext } from "@/lib/contractSecurity";

interface Params {
  params: Promise<{ id: string }>;
}

function extractUser(req: NextRequest): {
  username: string;
  email: string;
  name: string;
  role: string;
  roleCode: RoleCode;
} {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");
  const nameHeader = req.headers.get("x-bcf-name");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;
  const qName = url.searchParams.get("name") || nameHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail);
  return {
    username: qUser || "system_user",
    email: qEmail || "user@bcf-sl.org",
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Staff Member"),
    role: qRole || roleCode,
    roleCode,
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = extractUser(req);

    // Rule: ONLY the Super Admin can restore a deleted item!
    if (user.roleCode !== "SA") {
      await logSecurityAudit({
        action: "RESTORE_PERMISSION_DENIED",
        user: user.name,
        role: user.roleCode,
        email: user.email,
        itemId: id,
        reason: "Only Super Administrator is authorized to restore deleted items.",
      });

      return NextResponse.json(
        {
          error: "Permission denied. Only the Super Administrator has authorization to restore deleted items.",
          code: "SUPER_ADMIN_REQUIRED",
        },
        { status: 403 }
      );
    }

    const col = await getCollection<DocumentItem>(COLLECTIONS.DOCUMENTS);
    let doc = await col.findOne({ id });
    if (!doc) {
      try {
        doc = await col.findOne({ _id: new ObjectId(id) as any });
      } catch (_) {}
    }

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.status !== "Deleted") {
      return NextResponse.json({ error: "Item is not currently deleted." }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const restoreUpdate: any = {
      $set: {
        status: "Active",
        isDeleted: false,
        restoredInfo: {
          restoredBy: {
            name: user.name,
            role: user.role,
            roleCode: user.roleCode,
            email: user.email,
            date: nowIso,
          },
          restoredAt: nowIso,
        },
        updatedAt: nowIso,
      },
    };

    await col.updateOne({ id: doc.id }, restoreUpdate);

    // Sync to EMPLOYEE_CONTRACTS if contract
    if (doc.category === "employee-contracts") {
      try {
        const contractsCol = await getCollection(COLLECTIONS.EMPLOYEE_CONTRACTS);
        await contractsCol.updateOne({ id: doc.id }, restoreUpdate);
      } catch (_) {}
    }

    // Audit log
    await logSecurityAudit({
      action: doc.category === "employee-contracts" ? "CONTRACT_RESTORED" : "DOCUMENT_RESTORED",
      user: user.name,
      role: user.roleCode,
      email: user.email,
      employeeId: doc.employeeId,
      itemId: doc.id,
      itemTitle: doc.title,
      tab: doc.category,
      timestamp: nowIso,
    });

    // Notification trigger
    try {
      const notifCol = await getCollection<DocumentNotification>(COLLECTIONS.DOCUMENTS_NOTIFICATIONS);

      if (doc.category === "employee-contracts") {
        const notifs: any[] = [];
        let empUserTarget = doc.employeeId || "";
        try {
          const empCol = await getCollection(COLLECTIONS.EMPLOYEES);
          const empRecord = await empCol.findOne({
            $or: [{ employeeId: doc.employeeId }, { id: doc.employeeId }],
          });
          if (empRecord && (empRecord.username || empRecord.email)) {
            empUserTarget = empRecord.username || empRecord.email;
          }
        } catch (_) {}

        if (empUserTarget && empUserTarget !== user.username && empUserTarget !== user.email) {
          notifs.push({
            id: `notif_${Date.now()}_emp_${Math.random().toString(36).substring(2, 6)}`,
            recipientUser: empUserTarget,
            recipientRole: "ST",
            action: "Restored",
            itemTitle: "A contract was restored on your record",
            itemId: doc.id,
            tab: "employee-contracts",
            actorName: user.name,
            actorRole: user.role,
            actorEmail: user.email,
            timestamp: nowIso,
            read: false,
          });
        }

        const governanceRoles = ["HR", "CEO", "IAR"];
        governanceRoles.forEach((r) => {
          notifs.push({
            id: `notif_${Date.now()}_${r}_${Math.random().toString(36).substring(2, 6)}`,
            recipientUser: `role:${r}`,
            recipientRole: r as any,
            action: "Restored",
            itemTitle: `Contract Restored: ${doc.employeeName || doc.employeeId} — ${doc.title}`,
            itemId: doc.id,
            tab: "employee-contracts",
            actorName: user.name,
            actorRole: user.role,
            actorEmail: user.email,
            timestamp: nowIso,
            read: false,
          });
        });

        if (notifs.length > 0) {
          await notifCol.insertMany(notifs);
        }
      } else {
        const targetRoles = ["HR", "CEO", "IAR", "PRG", "FIN"];
        const notificationsToInsert = targetRoles.map((r) => ({
          id: `notif_${Date.now()}_${r}_${Math.random().toString(36).substring(2, 6)}`,
          recipientUser: `role:${r}`,
          recipientRole: r as any,
          action: "Restored" as const,
          itemTitle: doc.title,
          itemId: doc.id,
          tab: doc.category,
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
      message: `Item '${doc.title}' has been successfully restored to Active status.`,
      itemId: doc.id,
    });
  } catch (error: any) {
    console.error("[POST /api/documents/:id/restore] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to restore document" }, { status: 500 });
  }
}
