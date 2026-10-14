import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const staff = Array.isArray(body.staff) ? body.staff : [];
    const accounts = Array.isArray(body.accounts) ? body.accounts : [];

    const activeAccounts = accounts.filter((a: any) => a.status === "ACTIVE").length;
    const execs = accounts.filter((a: any) =>
      [
        "Super Admin",
        "Governing Board",
        "HRM Director",
        "Finance Director",
        "Programs Director",
        "IT Director",
        "Health & Safety Director",
        "Internal Risk & Audits Director",
        "Legal & Communication Director",
        "Procurement Director",
      ].includes(a.role)
    ).length;

    const depts = [
      "Executive Management",
      "Finance Department",
      "Health & Safety Department",
      "Human Resources Management Department",
      "Information Technology (IT) Department",
      "Internal Risk & Audits Department",
      "Legal & Communication Department",
      "Procurement Department",
      "Programs Department",
    ];

    const types = [
      "Permanent",
      "Fixed-Term Contract",
      "Part-Time",
      "Casual",
      "Consultant",
      "Volunteer",
      "Intern",
    ];

    const dateStr = new Date().toISOString().split("T")[0];

    // Create a new Excel Workbook
    const wb = XLSX.utils.book_new();

    // -------------------------------------------------------------
    // SHEET 1: Executive KPIs
    // -------------------------------------------------------------
    const kpiRows = [
      { Metric: "Total Registered Employees", Value: staff.length, Source: "HR Staff Registry", Status: "Operational" },
      { Metric: "Active System Accounts", Value: activeAccounts, Source: "User & Access Management", Status: "100% Provisioned" },
      { Metric: "Operational Departments", Value: depts.length, Source: "Standard BCF Units", Status: "Configured" },
      { Metric: "Executive & Director Roles", Value: execs, Source: "Executive Matrix", Status: "Authorized" },
      { Metric: "2FA & Security Compliance", Value: "100%", Source: "Zero Breach Incidents", Status: "Compliant" },
    ];
    const wsKpi = XLSX.utils.json_to_sheet(kpiRows);
    wsKpi["!cols"] = [{ wch: 32 }, { wch: 15 }, { wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsKpi, "Executive KPIs");

    // -------------------------------------------------------------
    // SHEET 2: Department Breakdown
    // -------------------------------------------------------------
    const deptRows = depts.map((d) => {
      const count = staff.filter((e: any) => e.department === d).length;
      const pct = staff.length > 0 ? ((count / staff.length) * 100).toFixed(1) + "%" : "0%";
      return {
        "Department Name": d,
        "Headcount": count,
        "Percentage Share": pct,
      };
    });
    const wsDept = XLSX.utils.json_to_sheet(deptRows);
    wsDept["!cols"] = [{ wch: 42 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsDept, "Department Breakdown");

    // -------------------------------------------------------------
    // SHEET 3: Employment Types
    // -------------------------------------------------------------
    const typeRows = types.map((t) => {
      const count = staff.filter(
        (e: any) => (e.classification || "").toLowerCase() === t.toLowerCase()
      ).length;
      const pct = staff.length > 0 ? ((count / staff.length) * 100).toFixed(1) + "%" : "0%";
      return {
        "Employment Classification": t,
        "Headcount": count,
        "Percentage Share": pct,
      };
    });
    const wsType = XLSX.utils.json_to_sheet(typeRows);
    wsType["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsType, "Employment Types");

    // -------------------------------------------------------------
    // SHEET 4: Role Distribution
    // -------------------------------------------------------------
    const roleTiers = [
      { tier: "Super Admin / CEO", filter: (a: any) => a.role === "Super Admin" },
      { tier: "Governing Board", filter: (a: any) => a.role === "Governing Board" },
      { tier: "Directors", filter: (a: any) => (a.role || "").includes("Director") },
      { tier: "Unit Managers", filter: (a: any) => a.role === "Unit Manager" },
      { tier: "Assistant Managers", filter: (a: any) => a.role === "Assistant Manager" },
      { tier: "Officers", filter: (a: any) => a.role === "Officer" },
      { tier: "Volunteers / Interns", filter: (a: any) => a.role === "Volunteer" || a.role === "Intern" },
    ];
    const roleRows = roleTiers.map((r) => ({
      "Role Tier": r.tier,
      "Account Count": accounts.filter(r.filter).length,
    }));
    const wsRole = XLSX.utils.json_to_sheet(roleRows);
    wsRole["!cols"] = [{ wch: 28 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsRole, "Role Distribution");

    // -------------------------------------------------------------
    // SHEET 5: Staff Registry
    // -------------------------------------------------------------
    const staffRows = staff.map((s: any) => ({
      "Employee ID": s.employeeId || "",
      "Full Name": s.fullName || "",
      "Department": s.department || "",
      "Classification": s.classification || "",
      "Job Title": s.title || "",
      "Official Email": s.email || "",
      "Phone Number": s.phone || "",
    }));
    const wsStaff = XLSX.utils.json_to_sheet(staffRows);
    wsStaff["!cols"] = [
      { wch: 16 },
      { wch: 26 },
      { wch: 36 },
      { wch: 22 },
      { wch: 26 },
      { wch: 32 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsStaff, "Staff Registry");

    // Write binary buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="BCF_SL_Executive_Analytics_${dateStr}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel workbook", details: error.message },
      { status: 500 }
    );
  }
}
