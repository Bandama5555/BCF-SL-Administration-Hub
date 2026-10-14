import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";
import { AccessGrant } from "@/lib/accessTypes";
import { resolveUserProfile, RequestActorContext, getDepartmentDirectory } from "@/lib/accessServer";
import { normalizeRole } from "@/lib/permissions";

function extractActor(req: NextRequest): RequestActorContext {
  const roleHeader = req.headers.get("x-bcf-user-role");
  const userHeader = req.headers.get("x-bcf-username");
  const emailHeader = req.headers.get("x-bcf-email");
  const nameHeader = req.headers.get("x-bcf-name");
  const deptHeader = req.headers.get("x-bcf-department");
  const empIdHeader = req.headers.get("x-bcf-employee-id");

  const url = new URL(req.url);
  const qRole = url.searchParams.get("role") || roleHeader;
  const qUser = url.searchParams.get("user") || userHeader;
  const qEmail = url.searchParams.get("email") || emailHeader;
  const qName = url.searchParams.get("name") || nameHeader;
  const qDept = url.searchParams.get("department") || deptHeader;
  const qEmpId = url.searchParams.get("employeeId") || empIdHeader;

  const roleCode = normalizeRole(qRole, qUser, qEmail, qDept);
  return {
    userId: qEmpId || qEmail || "staff@bcf-sl.org",
    username: qUser || "staff_user",
    email: qEmail || "staff@bcf-sl.org",
    name: qName || (roleCode === "SA" ? "Albert Joseph Bandama" : "Staff Member"),
    role: qRole || roleCode,
    roleCode,
    department: qDept || undefined,
    employeeId: qEmpId || undefined,
    staffId: qEmpId || undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = extractActor(req);
    const userProfile = await resolveUserProfile(actor);
    const effectiveActor: RequestActorContext = {
      ...actor,
      ...userProfile,
      roleCode: actor.roleCode,
    };

    if (effectiveActor.roleCode !== "SA") {
      return NextResponse.json(
        { error: "You do not have access to that page.", code: "ACCESS_DENIED" },
        { status: 403 }
      );
    }

    const grantsCol = await getCollection<AccessGrant>(COLLECTIONS.ACCESS_GRANTS);
    const empCol = await getCollection(COLLECTIONS.EMPLOYEES);
    const deptDir = await getDepartmentDirectory();

    const activeGrants = await grantsCol.find({ status: "Active" }).toArray();
    const allEmployees = await empCol.find({}).toArray();

    // Group active grants by staffId / email
    const staffMap = new Map<string, {
      staffId: string;
      name: string;
      email: string;
      department: string;
      position: string;
      director: string;
      directorEmail?: string;
      activeGrants: AccessGrant[];
    }>();

    for (const grant of activeGrants) {
      const key = grant.staffId || grant.userId || grant.userEmail;
      if (!staffMap.has(key)) {
        const empMatch: any = allEmployees.find(
          (e) =>
            e.employeeId === grant.staffId ||
            e.staffId === grant.staffId ||
            (e.email && e.email.toLowerCase() === grant.userEmail?.toLowerCase())
        );

        const dept = empMatch?.department || grant.department || "Operations";
        const dirs = deptDir.departmentDirectors[dept];
        const dirName = empMatch?.directReport || empMatch?.director || (dirs && dirs[0]?.name) || deptDir.fallbackDirector.name;
        const dirEmail = (dirs && dirs[0]?.email) || deptDir.fallbackDirector.email;

        staffMap.set(key, {
          staffId: empMatch?.employeeId || grant.staffId || key,
          name: empMatch?.fullName || empMatch?.name || grant.userName || "Staff Member",
          email: empMatch?.email || grant.userEmail,
          department: dept,
          position: empMatch?.position || "Staff Officer",
          director: dirName,
          directorEmail: dirEmail,
          activeGrants: [],
        });
      }

      staffMap.get(key)!.activeGrants.push(grant);
    }

    const staffList = Array.from(staffMap.values());

    return NextResponse.json({
      success: true,
      staff: staffList,
      count: staffList.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
