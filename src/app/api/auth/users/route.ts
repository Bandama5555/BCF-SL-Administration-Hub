import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

const DEFAULT_STAFF = [
  {
    id: "BCF-PTE-2026-0001",
    employeeId: "BCF-PTE-2026-0001",
    name: "Albert Joseph Bandama",
    fullName: "Albert Joseph Bandama",
    phone: "+232 76 123456",
    email: "albertjosephhassanbandama@gmail.com",
    dept: "Executive Management",
    department: "Executive Management",
    title: "Chief Executive Officer (CEO)",
    position: "Chief Executive Officer (CEO)",
    username: "abandama",
    role: "Super Admin",
    accessLevel: "Level 1 — Full System Control",
    status: "ACTIVE",
  },
  {
    id: "BCF-PTE-2026-0002",
    employeeId: "BCF-PTE-2026-0002",
    name: "Joe Ansumana Conteh",
    fullName: "Joe Ansumana Conteh",
    phone: "+232 78 234567",
    email: "joe.conteh@bcf-sl.org",
    dept: "Human Resources Management Department",
    department: "Human Resources Management Department",
    title: "Human Resources Director",
    position: "Human Resources Director",
    username: "jconteh",
    role: "HRM Director",
    accessLevel: "Level 2 — Departmental / Executive",
    status: "ACTIVE",
  },
  {
    id: "BCF-SL-1002",
    employeeId: "BCF-SL-1002",
    name: "Dr. Sorie Sesay",
    fullName: "Dr. Sorie Sesay",
    phone: "+232 78 441 200",
    email: "s.sesay@bcf-sl.org",
    dept: "Human Resources Management Department",
    department: "Human Resources Management Department",
    title: "Director of Human Resources",
    position: "Director of Human Resources",
    username: "ssesay",
    role: "HRM Director",
    accessLevel: "Level 2 — Departmental / Executive",
    status: "ACTIVE",
  },
  {
    id: "BCF-EMP-2026-0003",
    employeeId: "BCF-EMP-2026-0003",
    name: "Mariama Bangura",
    fullName: "Mariama Bangura",
    phone: "+232 77 345678",
    email: "mariama.bangura@bcf-sl.org",
    dept: "Finance Department",
    department: "Finance Department",
    title: "Finance Director",
    position: "Finance Director",
    username: "mbangura",
    role: "Finance Director",
    accessLevel: "Level 2 — Departmental / Executive",
    status: "ACTIVE",
  },
  {
    id: "BCF-SL-1005",
    employeeId: "BCF-SL-1005",
    name: "Aminata Turay",
    fullName: "Aminata Turay",
    phone: "+232 79 552 119",
    email: "a.turay@bcf-sl.org",
    dept: "Finance Department",
    department: "Finance Department",
    title: "Director of Financial Operations",
    position: "Director of Financial Operations",
    username: "aturay",
    role: "Finance Director",
    accessLevel: "Level 2 — Departmental / Executive",
    status: "ACTIVE",
  },
  {
    id: "BCF-EMP-2027-0001",
    employeeId: "BCF-EMP-2027-0001",
    name: "Sahr Emmanuel Bangura",
    fullName: "Sahr Emmanuel Bangura",
    phone: "+232 76 123456",
    email: "sahr.bangura@bcf.sl",
    dept: "Programs Department",
    department: "Programs Department",
    title: "Programme Officer",
    position: "Programme Officer",
    username: "sbangura",
    role: "Officer",
    accessLevel: "Level 3 — Frontline Operations",
    status: "ACTIVE",
  },
  {
    id: "BCF-EMP-2026-0015",
    employeeId: "BCF-EMP-2026-0015",
    name: "Alex Koroma",
    fullName: "Alex Koroma",
    phone: "+232 76 892341",
    email: "alex.koroma@bcf-sl.org",
    dept: "Procurement Department",
    department: "Procurement Department",
    title: "Logistics & Procurement Officer",
    position: "Logistics & Procurement Officer",
    username: "akoroma",
    role: "Officer",
    accessLevel: "Level 3 — Frontline Operations",
    status: "ACTIVE",
  },
  {
    id: "BCF-EMP-2026-0016",
    employeeId: "BCF-EMP-2026-0016",
    name: "Mohamed Sesay",
    fullName: "Mohamed Sesay",
    phone: "+232 78 514298",
    email: "mohamed.sesay@bcf-sl.org",
    dept: "Internal Risk & Audits Department",
    department: "Internal Risk & Audits Department",
    title: "Internal Audit & Risk Officer",
    position: "Internal Audit & Risk Officer",
    username: "msesay",
    role: "Officer",
    accessLevel: "Level 3 — Frontline Operations",
    status: "ACTIVE",
  },
];

export async function GET() {
  try {
    const db = await getDb();
    const [accounts, dbEmployees] = await Promise.all([
      db.collection("user_accounts").find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray(),
      db.collection("employees").find({}).toArray(),
    ]);

    // Map existing user accounts by employeeId / email / username / userId
    const accountMap = new Map<string, any>();
    accounts.forEach((acc) => {
      const eid = acc.employeeId || acc.id;
      if (eid) accountMap.set(String(eid).toLowerCase(), acc);
      if (acc.email) accountMap.set(String(acc.email).toLowerCase(), acc);
      if (acc.username) accountMap.set(String(acc.username).toLowerCase(), acc);
      if (acc.userId) accountMap.set(String(acc.userId).toLowerCase(), acc);
    });

    // Merge employees from DB and default staff list
    const empMap = new Map<string, any>();
    DEFAULT_STAFF.forEach((s) => empMap.set((s.employeeId || s.id).toLowerCase(), s));
    dbEmployees.forEach((emp) => {
      const key = (emp.employeeId || emp.id || "").toLowerCase();
      if (key) empMap.set(key, emp);
      else if (emp.email) empMap.set(String(emp.email).toLowerCase(), emp);
    });
    const allEmployees = Array.from(empMap.values());

    // Merge employees with their account status
    const combined = allEmployees.map((emp) => {
      const empId = emp.employeeId || emp.id || "";
      const acc =
        (empId ? accountMap.get(empId.toLowerCase()) : null) ||
        (emp.email ? accountMap.get(String(emp.email).toLowerCase()) : null) ||
        (emp.username ? accountMap.get(String(emp.username).toLowerCase()) : null);

      const hasAccount = !!acc;
      const cleanUsername = acc?.username || emp.username || (emp.email ? emp.email.split("@")[0] : `user_${empId ? empId.slice(-4) : "staff"}`);
      const cleanEmail = acc?.email || emp.email || `${cleanUsername}@bcf-sl.org`;

      return {
        _id: acc?._id?.toString() || emp._id?.toString(),
        userId: acc?.userId || `USR-${empId || "STAFF"}`,
        employeeId: empId,
        fullName: acc?.fullName || emp.fullName || emp.name || cleanUsername,
        name: acc?.fullName || emp.fullName || emp.name || cleanUsername,
        department: acc?.department || emp.department || emp.dept || "General Administration",
        position: acc?.position || emp.position || emp.title || "Staff Member",
        email: cleanEmail,
        username: cleanUsername,
        password: acc?.password || "BCF@2026",
        role: acc?.role || emp.role || (
          (emp.position || emp.title || "").toLowerCase().includes("ceo") ? "Super Admin" :
          (emp.position || emp.title || "").toLowerCase().includes("director") ? "Director" : "Officer"
        ),
        accessLevel: acc?.accessLevel || emp.accessLevel || "Level 3 — Frontline Operations",
        status: acc?.status || "ACTIVE",
        canLogin: (acc?.status || "ACTIVE") === "ACTIVE",
        hasAccount,
        lastLogin: acc?.lastLogin || null,
        createdAt: acc?.createdAt || emp.createdAt || new Date().toISOString(),
        updatedAt: acc?.updatedAt || emp.updatedAt || new Date().toISOString(),
      };
    });

    // Also include any user accounts that might not be in employees table
    accounts.forEach((acc) => {
      const accEid = acc.employeeId || acc.id || "";
      const exists = combined.some(
        (c) =>
          c.userId === acc.userId ||
          (accEid && c.employeeId && c.employeeId.toLowerCase() === accEid.toLowerCase()) ||
          (c.email && c.email.toLowerCase() === (acc.email || "").toLowerCase())
      );
      if (!exists) {
        combined.push({
          _id: acc._id?.toString(),
          userId: acc.userId || `USR-${Date.now().toString(36)}`,
          employeeId: accEid || "BCF-SYS-USER",
          fullName: acc.fullName || acc.name || acc.username,
          name: acc.fullName || acc.name || acc.username,
          department: acc.department || "Executive Management",
          position: acc.position || acc.role || "System Account",
          email: acc.email || `${acc.username}@bcf-sl.org`,
          username: acc.username,
          password: acc.password || "BCF@2026",
          role: acc.role || "Super Admin",
          accessLevel: acc.accessLevel || "Level 1 — Full System Control",
          status: acc.status || "ACTIVE",
          canLogin: (acc.status || "ACTIVE") === "ACTIVE",
          hasAccount: true,
          lastLogin: acc.lastLogin || null,
          createdAt: acc.createdAt || new Date().toISOString(),
          updatedAt: acc.updatedAt || new Date().toISOString(),
        });
      }
    });

    return NextResponse.json({
      success: true,
      count: combined.length,
      data: combined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullName,
      employeeId,
      department,
      position,
      email,
      username,
      password,
      role,
      accessLevel,
      status = "ACTIVE",
    } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required to configure a login account." },
        { status: 400 }
      );
    }

    const cleanUsername = (username || "").trim().toLowerCase();
    const cleanEmail = (email || `${cleanUsername}@bcf-sl.org`).trim().toLowerCase();
    const cleanEmpId = (employeeId || `BCF-STAFF-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
    const cleanFullName = (fullName || cleanUsername).trim();
    const cleanRole = role || "Officer";
    const cleanDept = department || "General Administration";
    const cleanPosition = position || cleanRole;
    const cleanAccessLevel = accessLevel || "Level 3 — Frontline Operations";
    const cleanStatus = status || "ACTIVE";

    const db = await getDb();
    const userCol = db.collection("user_accounts");
    const empCol = db.collection("employees");

    // 1. Locate existing document by _id, userId, employeeId, username, or email
    let existingDoc: any = null;

    if (body._id && ObjectId.isValid(body._id)) {
      try {
        existingDoc = await userCol.findOne({ _id: new ObjectId(body._id) });
      } catch {}
    }

    if (!existingDoc && body.userId) {
      existingDoc = await userCol.findOne({ userId: body.userId });
    }

    if (!existingDoc && cleanEmpId) {
      existingDoc = await userCol.findOne({ employeeId: { $regex: `^${cleanEmpId}$`, $options: "i" } });
    }

    if (!existingDoc && cleanUsername) {
      existingDoc = await userCol.findOne({ username: { $regex: `^${cleanUsername}$`, $options: "i" } });
    }

    if (!existingDoc && cleanEmail) {
      existingDoc = await userCol.findOne({ email: { $regex: `^${cleanEmail}$`, $options: "i" } });
    }

    // Secondary collision check on candidate userId: if an existing doc owns it, treat as update
    const candidateUserId = body.userId || `USR-${cleanEmpId}`;
    if (!existingDoc && candidateUserId) {
      const collision = await userCol.findOne({ userId: candidateUserId });
      if (collision) {
        existingDoc = collision;
      }
    }

    let finalUserId: string;
    let savedUser: any;

    if (existingDoc) {
      // Update the existing document in place preserving its unique userId
      finalUserId = existingDoc.userId || candidateUserId;
      const updateData = {
        userId: finalUserId,
        employeeId: cleanEmpId,
        fullName: cleanFullName,
        name: cleanFullName,
        department: cleanDept,
        position: cleanPosition,
        email: cleanEmail,
        username: cleanUsername,
        password,
        role: cleanRole,
        accessLevel: cleanAccessLevel,
        status: cleanStatus,
        canLogin: cleanStatus === "ACTIVE",
        updatedAt: new Date().toISOString(),
      };

      await userCol.updateOne({ _id: existingDoc._id }, { $set: updateData });
      savedUser = { ...existingDoc, ...updateData };
    } else {
      // Brand new user insertion: guarantee strictly unique userId
      finalUserId = candidateUserId;
      let attempt = 0;
      while (await userCol.findOne({ userId: finalUserId })) {
        attempt++;
        finalUserId = `${candidateUserId}-${attempt}`;
      }

      savedUser = {
        userId: finalUserId,
        employeeId: cleanEmpId,
        fullName: cleanFullName,
        name: cleanFullName,
        department: cleanDept,
        position: cleanPosition,
        email: cleanEmail,
        username: cleanUsername,
        password,
        role: cleanRole,
        accessLevel: cleanAccessLevel,
        status: cleanStatus,
        canLogin: cleanStatus === "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await userCol.insertOne(savedUser);
      savedUser._id = result.insertedId;
    }

    // 2. Synchronize employee record in employees collection
    try {
      const existingEmp = await empCol.findOne({
        $or: [
          { employeeId: cleanEmpId },
          { email: cleanEmail },
          { username: cleanUsername },
        ],
      });

      if (existingEmp) {
        await empCol.updateOne(
          { _id: existingEmp._id },
          {
            $set: {
              employeeId: cleanEmpId,
              fullName: cleanFullName,
              name: cleanFullName,
              department: cleanDept,
              dept: cleanDept,
              title: cleanPosition,
              email: cleanEmail,
              username: cleanUsername,
              role: cleanRole,
              status: cleanStatus,
              updatedAt: new Date().toISOString(),
            },
          }
        );
      } else {
        await empCol.insertOne({
          employeeId: cleanEmpId,
          fullName: cleanFullName,
          name: cleanFullName,
          department: cleanDept,
          dept: cleanDept,
          title: cleanPosition,
          email: cleanEmail,
          username: cleanUsername,
          role: cleanRole,
          status: cleanStatus,
          createdAt: new Date().toISOString(),
          joinedDate: new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {}

    // 3. Inform Express backend if running
    try {
      fetch("http://localhost:5000/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedUser),
      }).catch(() => {});
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Login credentials saved successfully for ${cleanFullName}.`,
      data: savedUser,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
