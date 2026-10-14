import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { AccessNotification } from "@/lib/accessTypes";
import { normalizeRole } from "@/lib/permissions";

function extractActor(req: NextRequest) {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail);
  return {
    email: (qEmail || "staff@bcf-sl.org").toLowerCase().trim(),
    roleCode,
  };
}

// GET /api/access/notifications
export async function GET(req: NextRequest) {
  try {
    const actor = extractActor(req);
    const col = await getCollection<AccessNotification>(COLLECTIONS.ACCESS_NOTIFICATIONS);

    const notifications = await col
      .find({
        userEmail: actor.email,
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH /api/access/notifications (Mark read / Mark all read)
export async function PATCH(req: NextRequest) {
  try {
    const actor = extractActor(req);
    const body = await req.json();
    const { notificationId, markAll } = body;

    const col = await getCollection<AccessNotification>(COLLECTIONS.ACCESS_NOTIFICATIONS);

    if (markAll) {
      await col.updateMany({ userEmail: actor.email }, { $set: { isRead: true } });
      return NextResponse.json({ success: true, message: "All notifications marked as read." });
    }

    if (notificationId) {
      await col.updateOne({ id: notificationId, userEmail: actor.email }, { $set: { isRead: true } });
      return NextResponse.json({ success: true, message: "Notification marked as read." });
    }

    return NextResponse.json({ success: false, error: "Missing notificationId or markAll." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
