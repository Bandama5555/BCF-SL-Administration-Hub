import { getDb, isPlaceholderUri, COLLECTIONS } from "@/lib/mongodb";
import { forwardToBackend } from "@/lib/backend";
import { canonicalizeDepartmentName } from "@/lib/accessServer";

export const dynamic = "force-dynamic";

const DEFAULT_EMPLOYEES = [
  {
    id: "BCF-PTE-2026-0001",
    name: "Albert Joseph Bandama",
    phone: "+232 76 123456",
    email: "albertjosephhassanbandama@gmail.com",
    dept: "Executive Management",
    title: "Chief Executive Officer (CEO)",
    username: "abandama",
    status: "ACTIVE",
  },
  {
    id: "BCF-PTE-2026-0002",
    name: "Joe Ansumana Conteh",
    phone: "+232 78 234567",
    email: "joe.conteh@bcf-sl.org",
    dept: "Human Resources Management Department",
    title: "Human Resources Director",
    username: "jconteh",
    status: "ACTIVE",
  },
  {
    id: "BCF-SL-1002",
    name: "Dr. Sorie Sesay",
    phone: "+232 78 441 200",
    email: "s.sesay@bcf-sl.org",
    dept: "Human Resources Management Department",
    title: "Director of Human Resources",
    username: "ssesay",
    status: "ACTIVE",
  },
  {
    id: "BCF-EMP-2026-0003",
    name: "Mariama Bangura",
    phone: "+232 77 345678",
    email: "mariama.bangura@bcf-sl.org",
    dept: "Finance Department",
    title: "Finance Director",
    username: "mbangura",
    status: "ACTIVE",
  },
  {
    id: "BCF-SL-1005",
    name: "Aminata Turay",
    phone: "+232 79 552 119",
    email: "a.turay@bcf-sl.org",
    dept: "Finance Department",
    title: "Director of Financial Operations",
    username: "aturay",
    status: "ACTIVE",
  },
  {
    id: "BCF-EMP-2027-0001",
    name: "Sahr Emmanuel Bangura",
    phone: "+232 76 123456",
    email: "sahr.bangura@bcf.sl",
    dept: "Programs Department",
    title: "Programme Officer",
    username: "sbangura",
    status: "ACTIVE",
  },
  {
    id: "BCF-EMP-2026-0015",
    name: "Alex Koroma",
    phone: "+232 76 892341",
    email: "alex.koroma@bcf-sl.org",
    dept: "Procurement Department",
    title: "Logistics & Procurement Officer",
    username: "akoroma",
    status: "ACTIVE",
  },
  {
    id: "BCF-EMP-2026-0016",
    name: "Mohamed Sesay",
    phone: "+232 78 514298",
    email: "mohamed.sesay@bcf-sl.org",
    dept: "Internal Risk & Audits Department",
    title: "Internal Audit & Risk Officer",
    username: "msesay",
    status: "ACTIVE",
  },
];

const inMemoryStaff = [...DEFAULT_EMPLOYEES];

export async function GET(req: Request) {
  return forwardToBackend(req, "/api/employees", async () => {
    const { searchParams } = new URL(req.url);
    const dept = searchParams.get("dept");

    if (isPlaceholderUri()) {
      let list = inMemoryStaff;
      if (dept && dept !== "All") list = list.filter((e) => e.dept === dept);
      return Response.json({
        success: true,
        source: "memory_fallback",
        data: list,
        count: list.length,
      });
    }

    try {
      const db = await getDb();
      const col = db.collection(COLLECTIONS.EMPLOYEES);
      const totalCount = await col.countDocuments();
      if (totalCount === 0) {
        await col.insertMany(
          DEFAULT_EMPLOYEES.map((e) => ({
            ...e,
            employeeId: e.id,
            fullName: e.name,
            department: e.dept,
            createdAt: new Date().toISOString(),
          }))
        );
      } else {
        // Ensure all DEFAULT_EMPLOYEES exist in the Atlas employees collection
        for (const defEmp of DEFAULT_EMPLOYEES) {
          const exists = await col.findOne({
            $or: [
              { employeeId: defEmp.id },
              { id: defEmp.id },
              { email: defEmp.email },
              { username: defEmp.username },
              { fullName: defEmp.name },
            ],
          });
          if (!exists) {
            await col.insertOne({
              ...defEmp,
              employeeId: defEmp.id,
              fullName: defEmp.name,
              department: defEmp.dept,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      const filter =
        dept && dept !== "All"
          ? { $or: [{ dept }, { department: dept }] }
          : {};

      const docs = await col.find(filter).sort({ createdAt: -1 }).toArray();

      return Response.json({
        success: true,
        source: "mongodb_atlas",
        data: docs,
        count: docs.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({
        success: true,
        source: "fallback_on_error",
        data: inMemoryStaff,
        count: inMemoryStaff.length,
        warning: msg,
      });
    }
  });
}

export async function POST(req: Request) {
  return forwardToBackend(req, "/api/employees", async () => {
    try {
      const body = await req.json();
      const isBatch = Array.isArray(body);
      const items = isBatch ? body : [body];

      if (isPlaceholderUri()) {
        for (const item of items) {
          const id = item.id || `BCF-EMP-${Date.now().toString(36).toUpperCase()}`;
          const record = { ...item, id, updatedAt: new Date().toISOString() };
          const idx = inMemoryStaff.findIndex((s) => s.id === id);
          if (idx >= 0) inMemoryStaff[idx] = record;
          else inMemoryStaff.push(record);
        }
        return Response.json({ success: true, source: "memory_fallback", count: items.length });
      }

      const db = await getDb();
      const col = db.collection(COLLECTIONS.EMPLOYEES);
      const userAccountsCol = db.collection(COLLECTIONS.USER_ACCOUNTS);

      for (const item of items) {
        const id = item.employeeId || item.id || `BCF-EMP-${Date.now().toString(36).toUpperCase()}`;
        const { _id, ...clean } = item;
        const fullName = item.fullName || item.name || "";
        const email = (item.email || "").trim().toLowerCase();
        let username = (item.username || "").trim().toLowerCase();
        if (!username) {
          if (email) {
            username = email.split("@")[0];
          } else {
            const parts = fullName.toLowerCase().split(/\s+/).filter(Boolean);
            username = parts.length > 1 ? `${parts[0][0]}.${parts[parts.length - 1]}` : (parts[0] || id.toLowerCase());
          }
        }
        const assignedEmail = email || `${username}@bcf-sl.org`;
        const department = canonicalizeDepartmentName(item.department || item.dept || "General Administration");
        const position = item.position || item.title || item.role || "Staff Member";
        const role = item.role || item.position || "Staff Member";

        await col.updateOne(
          { $or: [{ employeeId: id }, { id }] },
          {
            $set: {
              ...clean,
              id,
              employeeId: id,
              fullName,
              name: fullName,
              department,
              dept: department,
              email: assignedEmail,
              username,
              status: clean.status || "ACTIVE",
              updatedAt: new Date().toISOString(),
            },
            $setOnInsert: {
              createdAt: clean.createdAt || new Date().toISOString(),
            },
          },
          { upsert: true }
        );

        // Immediately provision or update user account so staff has defined access and credentials stay synchronized
        const existingAcc = await userAccountsCol.findOne({
          $or: [{ employeeId: id }, { username }, { email: assignedEmail }],
        });
        const rawStatus = (clean.status || "ACTIVE").toUpperCase();
        const accountStatus = rawStatus === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
        const canLogin = accountStatus === "ACTIVE";
        const passwordToSet = item.password || existingAcc?.password || "BCF@2026";

        await userAccountsCol.updateOne(
          { $or: [{ employeeId: id }, { username }, { email: assignedEmail }] },
          {
            $set: {
              userId: existingAcc?.userId || `USR-${id}`,
              employeeId: id,
              fullName,
              name: fullName,
              department,
              position,
              email: assignedEmail,
              username,
              password: passwordToSet,
              role,
              accessLevel: item.accessLevel || existingAcc?.accessLevel || (role.toLowerCase().includes("director") ? "Level 2 — Departmental / Executive" : "Level 3 — Frontline Operations"),
              status: accountStatus,
              canLogin,
              updatedAt: new Date().toISOString(),
            },
            $setOnInsert: {
              createdAt: new Date().toISOString(),
            },
          },
          { upsert: true }
        );
      }

      return Response.json({
        success: true,
        source: "mongodb_atlas",
        count: items.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ success: false, error: msg }, { status: 500 });
    }
  });
}
