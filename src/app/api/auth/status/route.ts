import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Identifier is required" },
        { status: 400 }
      );
    }

    const cleanId = id.toLowerCase();

    // Master super administrator is always active
    if (
      cleanId === "admin@bcfsl.org" ||
      cleanId === "admin@bcf-sl.org" ||
      cleanId === "abandama" ||
      cleanId === "albertjosephhassanbandama@gmail.com"
    ) {
      return NextResponse.json({
        success: true,
        suspended: false,
        status: "ACTIVE",
        canLogin: true,
      });
    }

    const db = await getDb();
    const userCol = db.collection("user_accounts");
    const empCol = db.collection("employees");

    // Look for user in user_accounts first
    let userDoc: any = await userCol.findOne({
      $or: [
        { userId: { $regex: `^${id}$`, $options: "i" } },
        { username: { $regex: `^${id}$`, $options: "i" } },
        { email: { $regex: `^${id}$`, $options: "i" } },
        { employeeId: { $regex: `^${id}$`, $options: "i" } },
      ],
    });

    // Fallback to employees collection
    if (!userDoc) {
      userDoc = await empCol.findOne({
        $or: [
          { employeeId: { $regex: `^${id}$`, $options: "i" } },
          { username: { $regex: `^${id}$`, $options: "i" } },
          { email: { $regex: `^${id}$`, $options: "i" } },
        ],
      });
    }

    if (!userDoc) {
      return NextResponse.json({
        success: true,
        suspended: false,
        status: "UNKNOWN",
        canLogin: true,
      });
    }

    const isSuspended =
      userDoc.status === "SUSPENDED" ||
      userDoc.status === "DEACTIVATED" ||
      userDoc.canLogin === false;

    return NextResponse.json({
      success: true,
      suspended: isSuspended,
      status: userDoc.status || (isSuspended ? "SUSPENDED" : "ACTIVE"),
      canLogin: !isSuspended,
      userId: userDoc.userId || userDoc.employeeId,
      fullName: userDoc.fullName || userDoc.name,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
