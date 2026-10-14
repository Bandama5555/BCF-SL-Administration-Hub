import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { normalizeRole } from "@/lib/permissions";
import { checkDocumentPermission } from "@/lib/documentPermissions";
import { type DocumentNotification } from "@/lib/documentTypes";
import { resolveStaffEmployeeId } from "@/lib/contractSecurity";

function extractUser(req: NextRequest) {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");
  const empIdHeader = req.headers.get("x-bcf-employee-id");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;
  const qEmpId = url.searchParams.get("employeeId") || empIdHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail);
  return {
    username: qUser || "system_user",
    email: qEmail || "user@bcf-sl.org",
    roleCode,
    employeeId: qEmpId || undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = extractUser(req);
    const col = await getCollection<DocumentNotification>(COLLECTIONS.DOCUMENTS_NOTIFICATIONS);

    const staffEmpId = user.roleCode === "ST" ? await resolveStaffEmployeeId(user) : null;

    // Find notifications addressed to this user, their email, employee ID, or their role
    const queryConditions: any[] = [
      { recipientUser: user.username },
      { recipientUser: user.email },
      { recipientRole: user.roleCode },
      { recipientUser: `role:${user.roleCode}` },
    ];

    if (staffEmpId) {
      queryConditions.push({ recipientUser: staffEmpId });
    }

    const rawNotifs = await col
      .find({ $or: queryConditions })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    // Filtering rules:
    // 1. Each user is notified ONLY about tabs they are allowed to see.
    // 2. Staff Privacy Rule: Staff member is notified only about their own contract.
    //    They NEVER receive notifications about someone else's contract.
    const visibleNotifs = rawNotifs.filter((n) => {
      if (!checkDocumentPermission(user.roleCode, n.tab, "view")) {
        return false;
      }

      if (n.tab === "employee-contracts" && user.roleCode === "ST") {
        const isOwn =
          n.recipientUser === user.username ||
          n.recipientUser === user.email ||
          (staffEmpId && n.recipientUser === staffEmpId);
        return isOwn;
      }

      return true;
    });

    const unreadCount = visibleNotifs.filter((n) => !n.read).length;

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: visibleNotifs,
    });
  } catch (error: any) {
    console.error("[GET /api/documents/notifications] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = extractUser(req);
    const body = await req.json().catch(() => ({}));
    const { notificationId, markAllRead } = body;

    const col = await getCollection<DocumentNotification>(COLLECTIONS.DOCUMENTS_NOTIFICATIONS);
    const nowIso = new Date().toISOString();

    const staffEmpId = user.roleCode === "ST" ? await resolveStaffEmployeeId(user) : null;
    const queryConditions: any[] = [
      { recipientUser: user.username },
      { recipientUser: user.email },
      { recipientRole: user.roleCode },
      { recipientUser: `role:${user.roleCode}` },
    ];
    if (staffEmpId) queryConditions.push({ recipientUser: staffEmpId });

    if (markAllRead) {
      await col.updateMany(
        { $or: queryConditions },
        {
          $set: { read: true, readAt: nowIso },
        }
      );
      return NextResponse.json({ success: true, message: "All notifications marked as read." });
    }

    if (notificationId) {
      await col.updateOne(
        { id: notificationId },
        {
          $set: { read: true, readAt: nowIso },
        }
      );
      return NextResponse.json({ success: true, message: "Notification marked as read." });
    }

    return NextResponse.json({ error: "Missing notificationId or markAllRead flag" }, { status: 400 });
  } catch (error: any) {
    console.error("[PATCH /api/documents/notifications] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update notification" }, { status: 500 });
  }
}
