import { NextRequest, NextResponse } from "next/server";
import { getDb, isPlaceholderUri, COLLECTIONS } from "@/lib/mongodb";
import { forwardToBackend } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToBackend(req, "/api/db/seed", async () => {
    if (isPlaceholderUri()) {
    return NextResponse.json({
      success: false,
      status: "placeholder_credentials",
      message:
        "Cannot seed MongoDB Atlas: Please configure your actual database credentials in frontend/.env by replacing <db_username> and <db_password>.",
    });
  }

  try {
    const db = await getDb();
    const results: Record<string, number> = {};

    // 1. Employees Collection
    const empCol = db.collection(COLLECTIONS.EMPLOYEES);
    const empCount = await empCol.countDocuments();
    if (empCount === 0) {
      const defaultEmployees = [
        {
          id: "BCF-PTE-2026-0001",
          name: "Albert Joseph Bandama",
          phone: "+232 76 123456",
          email: "albertjosephhassanbandama@gmail.com",
          dept: "Executive Management",
          title: "Chief Executive Officer (CEO)",
          username: "abandama",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
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
          createdAt: new Date().toISOString(),
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
          createdAt: new Date().toISOString(),
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
          createdAt: new Date().toISOString(),
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
          createdAt: new Date().toISOString(),
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
          createdAt: new Date().toISOString(),
        },
      ];
      await empCol.insertMany(defaultEmployees);
      results[COLLECTIONS.EMPLOYEES] = defaultEmployees.length;
    } else {
      results[COLLECTIONS.EMPLOYEES] = empCount;
    }

    // 2. Learning Accounts Collection
    const accCol = db.collection(COLLECTIONS.LEARNING_ACCOUNTS);
    const accCount = await accCol.countDocuments();
    if (accCount === 0) {
      const defaultAccounts = [
        {
          accountId: "ACC-000",
          employeeId: "BCF-PTE-2026-0001",
          employeeName: "Albert Joseph Bandama",
          employeePhone: "+232 76 123456",
          employeeEmail: "albertjosephhassanbandama@gmail.com",
          username: "abandama",
          password: "Password123!",
          department: "Executive Management",
          position: "Chief Executive Officer (CEO)",
          supervisor: "Board of Directors",
          isActive: true,
          quotaTier: 4,
          createdAt: new Date().toISOString(),
        },
        {
          accountId: "ACC-001",
          employeeId: "BCF-EMP-2027-0001",
          employeeName: "Sahr Emmanuel Bangura",
          employeePhone: "+232 76 123456",
          employeeEmail: "sahr.bangura@bcf.sl",
          username: "sbangura",
          password: "Password123!",
          department: "Programmes",
          position: "Programme Officer",
          supervisor: "Fatima Turay",
          isActive: true,
          quotaTier: 2,
          createdAt: new Date().toISOString(),
        },
        {
          accountId: "ACC-002",
          employeeId: "BCF-EMP-2027-0002",
          employeeName: "Aminata Sesay",
          employeePhone: "+232 78 654321",
          employeeEmail: "aminata.sesay@bcf.sl",
          username: "asesay",
          password: "Password123!",
          department: "ICT",
          position: "ICT Officer",
          supervisor: "Ibrahim Koroma",
          isActive: true,
          quotaTier: 2,
          createdAt: new Date().toISOString(),
        },
        {
          accountId: "ACC-003",
          employeeId: "BCF-EMP-2027-0003",
          employeeName: "Mohamed Kamara",
          employeePhone: "+232 77 987654",
          employeeEmail: "m.kamara@bcf.sl",
          username: "mkamara",
          password: "Password123!",
          department: "Finance",
          position: "Finance Officer",
          supervisor: "Ibrahim Koroma",
          isActive: true,
          quotaTier: 2,
          createdAt: new Date().toISOString(),
        },
        {
          accountId: "ACC-004",
          employeeId: "BCF-EMP-2027-0004",
          employeeName: "Fatima Turay",
          employeePhone: "+232 88 112233",
          employeeEmail: "f.turay@bcf.sl",
          username: "fturay",
          password: "Password123!",
          department: "Programmes",
          position: "Programmes Manager",
          supervisor: "Albert J. Bandama",
          isActive: true,
          quotaTier: 3,
          createdAt: new Date().toISOString(),
        },
      ];
      await accCol.insertMany(defaultAccounts);
      results[COLLECTIONS.LEARNING_ACCOUNTS] = defaultAccounts.length;
    } else {
      results[COLLECTIONS.LEARNING_ACCOUNTS] = accCount;
    }

    // 3. Learning Semesters & Settings
    const semCol = db.collection(COLLECTIONS.LEARNING_SEMESTERS);
    const semCount = await semCol.countDocuments();
    if (semCount === 0) {
      await semCol.insertMany([
        { id: "SEM-2026-1", name: "Semester 1 (Jan – Jun 2026)", active: false, maxSlots: 2, status: "Archived" },
        { id: "SEM-2026-2", name: "Semester 2 (Jul – Dec 2026)", active: true, maxSlots: 2, status: "Active" },
        { id: "SEM-2027-1", name: "Semester 1 (Jan – Jun 2027)", active: false, maxSlots: 2, status: "Upcoming" },
      ]);
      results[COLLECTIONS.LEARNING_SEMESTERS] = 3;
    } else {
      results[COLLECTIONS.LEARNING_SEMESTERS] = semCount;
    }

    // 4. Donors Collection
    const donorCol = db.collection(COLLECTIONS.DONORS);
    const donorCount = await donorCol.countDocuments();
    if (donorCount === 0) {
      const defaultDonors = [
        { id: "DNR-001", name: "Global Giving Fund", category: "Institutional", country: "United Kingdom", totalGiven: 250000, status: "Active" },
        { id: "DNR-002", name: "West Africa Development Trust", category: "Foundation", country: "Sierra Leone", totalGiven: 180000, status: "Active" },
        { id: "DNR-003", name: "Irish Aid Partnership", category: "Bilateral", country: "Ireland", totalGiven: 420000, status: "Active" },
      ];
      await donorCol.insertMany(defaultDonors);
      results[COLLECTIONS.DONORS] = defaultDonors.length;
    } else {
      results[COLLECTIONS.DONORS] = donorCount;
    }

    // 5. System Settings
    const settingsCol = db.collection(COLLECTIONS.SYSTEM_SETTINGS);
    await settingsCol.updateOne(
      { key: "hub_config" },
      {
        $set: {
          key: "hub_config",
          institution: "Bandama Charity Foundation Sierra Leone (BCF-SL)",
          currency: "NLe",
          academicYear: "2026/2027",
          databaseConnected: true,
          seededAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );
    results[COLLECTIONS.SYSTEM_SETTINGS] = 1;

    return NextResponse.json({
      success: true,
      message: "BCF-SL MongoDB Atlas database initialized and seeded successfully.",
      collections: results,
      database: db.databaseName,
    });
  } catch (err: any) {
    console.error("MongoDB seed error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
  });
}
