import { NextRequest, NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { forwardToBackend } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToBackend(req, "/api/learning/admin-verify", async () => {
    try {
    const body = await req.json();
    const username = (body.username || "").trim().toLowerCase();
    const password = body.password || "";

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Please enter both administrator username and password." },
        { status: 400 }
      );
    }

    // 1. Master Administrator check (Albert Joseph Bandama - CEO & Founder)
    const isMasterAdmin =
      (username === "admin@bcfsl.org" ||
        username === "admin@bcf-sl.org" ||
        username === "admin" ||
        username === "abandama" ||
        username === "bcf-pte-2026-0001" ||
        username === "albertjosephhassanbandama@gmail.com") &&
      (password === "ChangeMe123!" ||
        password === "BCF@2026" ||
        password === "Password123!");

    if (isMasterAdmin) {
      return NextResponse.json({
        success: true,
        user: {
          employeeId: "BCF-PTE-2026-0001",
          employeeName: "Albert Joseph Bandama",
          username: "abandama",
          email: "admin@bcfsl.org",
          department: "Executive Management",
          position: "Chief Executive Officer (CEO)",
          role: "Super Admin",
          verifiedAt: new Date().toISOString(),
        },
      });
    }

    // 2. Check Database for authorized HR / Executive administrators
    try {
      const db = await getDb();
      if (db) {
        // Search learning_accounts
        const learningAcc = await db.collection(COLLECTIONS.LEARNING_ACCOUNTS || "learning_accounts").findOne({
          $or: [
            { username: { $regex: new RegExp(`^${username}$`, "i") } },
            { employeeEmail: { $regex: new RegExp(`^${username}$`, "i") } },
            { employeeId: { $regex: new RegExp(`^${username}$`, "i") } },
          ],
        });

        if (learningAcc && learningAcc.password === password) {
          const dept = (learningAcc.department || "").toLowerCase();
          const pos = (learningAcc.position || "").toLowerCase();
          const isAdm =
            learningAcc.username?.toLowerCase() === "abandama" ||
            learningAcc.employeeId === "BCF-PTE-2026-0001" ||
            dept.includes("executive") ||
            dept.includes("human resource") ||
            dept.includes("hr") ||
            pos.includes("director") ||
            pos.includes("manager") ||
            pos.includes("admin") ||
            pos.includes("ceo");

          if (isAdm) {
            return NextResponse.json({
              success: true,
              user: {
                employeeId: learningAcc.employeeId,
                employeeName: learningAcc.employeeName,
                username: learningAcc.username || username,
                department: learningAcc.department,
                position: learningAcc.position,
                role: "HR Administrator",
                verifiedAt: new Date().toISOString(),
              },
            });
          }
        }

        // Search user_accounts
        const userAcc = await db.collection(COLLECTIONS.USER_ACCOUNTS || "user_accounts").findOne({
          $or: [
            { username: { $regex: new RegExp(`^${username}$`, "i") } },
            { email: { $regex: new RegExp(`^${username}$`, "i") } },
          ],
        });

        if (userAcc && userAcc.password === password) {
          const role = (userAcc.role || "").toLowerCase();
          if (role.includes("admin") || role.includes("director") || role.includes("executive")) {
            return NextResponse.json({
              success: true,
              user: {
                employeeId: userAcc.employeeId || "ADM-001",
                employeeName: userAcc.name || "Administrator",
                username: userAcc.username || username,
                department: userAcc.department || "Executive Management",
                position: userAcc.position || "System Administrator",
                role: "Administrator",
                verifiedAt: new Date().toISOString(),
              },
            });
          }
        }
      }
    } catch (dbErr) {
      console.warn("[Admin-Verify] MongoDB check fallback:", dbErr);
    }

    // 3. Fallback check for standard institutional HR directors
    if (
      (username === "jconteh" || username === "bcf-pte-2026-0002" || username === "joe.conteh@bcf-sl.org") &&
      password === "Password123!"
    ) {
      return NextResponse.json({
        success: true,
        user: {
          employeeId: "BCF-PTE-2026-0002",
          employeeName: "Joe Ansumana Conteh",
          username: "jconteh",
          department: "Human Resources Management Department",
          position: "Human Resources Director",
          role: "HR Administrator",
          verifiedAt: new Date().toISOString(),
        },
      });
    }

    if (
      (username === "ssesay" || username === "bcf-sl-1002" || username === "s.sesay@bcf-sl.org") &&
      password === "Password123!"
    ) {
      return NextResponse.json({
        success: true,
        user: {
          employeeId: "BCF-SL-1002",
          employeeName: "Dr. Sorie Sesay",
          username: "ssesay",
          department: "Human Resources Management Department",
          position: "Director of Human Resources",
          role: "HR Administrator",
          verifiedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Access Denied: Incorrect administrator username or password. Only authorized BCF-SL Administrators can access this area.",
      },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error during administrator verification." },
      { status: 500 }
    );
  }
  });
}
