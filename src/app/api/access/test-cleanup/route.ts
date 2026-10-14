import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { normalizeRole } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const roleHeader = req.headers.get("x-bcf-user-role");
    const roleCode = normalizeRole(roleHeader);

    if (roleCode !== "SA") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { requestIds, grantIds } = body;

    const reqCol = await getCollection(COLLECTIONS.ACCESS_REQUESTS);
    const grantCol = await getCollection(COLLECTIONS.ACCESS_GRANTS);
    const notifCol = await getCollection(COLLECTIONS.ACCESS_NOTIFICATIONS);

    let deletedRequests = 0;
    let deletedGrants = 0;

    if (body.clearAllTest) {
      const rRes = await reqCol.deleteMany({
        $or: [
          { requesterEmail: { $in: ["staff@bcf-sl.org", "staff_b@bcf-sl.org", "fin_staff@bcf-sl.org", "fsesay@bcf-sl.org"] } },
          { requestNumber: { $regex: "^BCF-ACC-" } },
        ],
      });
      deletedRequests += rRes.deletedCount;
      const gRes = await grantCol.deleteMany({
        userEmail: { $in: ["staff@bcf-sl.org", "staff_b@bcf-sl.org", "fin_staff@bcf-sl.org", "fsesay@bcf-sl.org"] },
      });
      deletedGrants += gRes.deletedCount;
      await notifCol.deleteMany({
        $or: [
          { userEmail: { $in: ["staff@bcf-sl.org", "staff_b@bcf-sl.org", "fin_staff@bcf-sl.org", "fsesay@bcf-sl.org", "admin@bcf-sl.org"] } },
          { requestNumber: { $regex: "^BCF-ACC-" } },
        ],
      });
    }

    if (Array.isArray(requestIds) && requestIds.length > 0) {
      const res = await reqCol.deleteMany({ id: { $in: requestIds } });
      deletedRequests += res.deletedCount;
      await notifCol.deleteMany({ requestId: { $in: requestIds } });
    }

    if (Array.isArray(grantIds) && grantIds.length > 0) {
      const res = await grantCol.deleteMany({ id: { $in: grantIds } });
      deletedGrants += res.deletedCount;
    }

    // Also clean up any lingering test notifications
    await notifCol.deleteMany({
      $or: [
        { userEmail: "staff@bcf-sl.org" },
        { userEmail: "staff_b@bcf-sl.org" },
        { userEmail: "fsesay@bcf-sl.org" },
        { requestNumber: { $regex: "^BCF-ACC-" } },
      ],
    });

    return NextResponse.json({
      success: true,
      deletedRequests,
      deletedGrants,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
