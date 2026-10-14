/**
 * BCF-SL Staff Loan Management System - Shared Core Library
 * Implements Bandama Charity Foundation Sierra Leone Loan Policy,
 * Eligibility Engine, Calculation Rules, Workflow State, Email Notifications & 8-Tab Navigation.
 */

const BCF_LOANS = (function () {
  // Policy Constants
  const POLICY = {
    TENOR_MONTHS: 10,
    APPLICABLE_RATE_PERCENT: 10, // 10% Fixed per BCF Staff Loan Policy
    APPROVAL_THRESHOLD_PERCENT: 85, // Minimum >= 85% required for approval to next level
    MULTIPLIERS: {
      "Officer": { factor: 1.0, deduction: 1000, label: "1. Officer" },
      "Manager/Assistant Manager": { factor: 2.0, deduction: 2000, label: "2. Manager/Assistant Manager" },
      "Director": { factor: 3.0, deduction: 3000, label: "3. Director" },
      "CEO/Governing Board": { factor: 4.0, deduction: 4000, label: "4. CEO/Governing Board" }
    },
    HR_WEIGHTS: [
      { id: "hr_v1", text: "Staff member has completed a minimum of one (1) continuous year of service", weight: 35 },
      { id: "hr_v2", text: "No outstanding or unsettled loan exists on the staff member's account", weight: 30 },
      { id: "hr_v3", text: "Employment status and contract are confirmed as active and in good standing", weight: 20 },
      { id: "hr_v4", text: "Staff member's conduct record is satisfactory with no pending disciplinary matters", weight: 15 }
    ],
    FINANCE_WEIGHTS: [
      { id: "fin_v1", text: "Staff member's loan eligibility is confirmed per the applicable policy tier", weight: 25 },
      { id: "fin_v2", text: "The proposed monthly deduction is feasible relative to net salary", weight: 15 },
      { id: "fin_v3", text: "Sufficient budget allocation exists to support disbursement of this loan", weight: 35 },
      { id: "fin_v4", text: "No conflicts with existing payroll deductions or financial commitments identified", weight: 25 }
    ],
    DEPARTMENTS: [
      "Executive Management",
      "Finance Department",
      "Health & Safety Department",
      "Human Resources Management Department",
      "Information Technology (IT) Department",
      "Internal Risk & Audits Department",
      "Legal & Communication Department",
      "Procurement Department",
      "Programs Department"
    ]
  };

  // Seed standard personnel if not present
  const DEFAULT_STAFF = [
    {
      employeeId: "BCF-SL-1048",
      fullName: "Mariama Kamara",
      gender: "Female",
      title: "Senior Field Coordinator",
      department: "Programs Department",
      empDate: "2021-02-12",
      classification: "Permanent",
      jobLevel: "Officer",
      mgmtLevel: "Employee",
      phone: "+232 76 892 104",
      email: "m.kamara@bcf-sl.org",
      payBasic: "8500",
      multiplierCategory: "Officer",
      status: "ACTIVE",
      disciplinaryStatus: "Clean Record",
      contractStanding: "Active - Good Standing",
      bankName: "Sierra Leone Commercial Bank",
      accNo: "003001892341",
      bban: "003001892341001"
    },
    {
      employeeId: "BCF-SL-1002",
      fullName: "Dr. Sorie Sesay",
      gender: "Male",
      title: "Director of Human Resources",
      department: "Human Resources Management Department",
      empDate: "2019-06-01",
      classification: "Permanent",
      jobLevel: "Director",
      mgmtLevel: "Top Management",
      phone: "+232 78 441 200",
      email: "s.sesay@bcf-sl.org",
      payBasic: "22000",
      multiplierCategory: "Director",
      status: "ACTIVE",
      disciplinaryStatus: "Clean Record",
      contractStanding: "Active - Good Standing",
      bankName: "Rokel Commercial Bank",
      accNo: "002011983422",
      bban: "002011983422001"
    },
    {
      employeeId: "BCF-SL-1005",
      fullName: "Aminata Turay",
      gender: "Female",
      title: "Director of Financial Operations",
      department: "Finance Department",
      empDate: "2020-01-15",
      classification: "Permanent",
      jobLevel: "Director",
      mgmtLevel: "Top Management",
      phone: "+232 79 552 119",
      email: "a.turay@bcf-sl.org",
      payBasic: "24000",
      multiplierCategory: "Director",
      status: "ACTIVE",
      disciplinaryStatus: "Clean Record",
      contractStanding: "Active - Good Standing",
      bankName: "Standard Chartered SL",
      accNo: "001099238411",
      bban: "001099238411001"
    },
    {
      employeeId: "BCF-SL-1012",
      fullName: "Mohamed Bangura",
      gender: "Male",
      title: "Program Monitoring Manager",
      department: "Programs Department",
      empDate: "2022-04-10",
      classification: "Permanent",
      jobLevel: "Manager",
      mgmtLevel: "Middle Management",
      phone: "+232 77 334 891",
      email: "m.bangura@bcf-sl.org",
      payBasic: "14000",
      multiplierCategory: "Manager/Assistant Manager",
      status: "ACTIVE",
      disciplinaryStatus: "Clean Record",
      contractStanding: "Active - Good Standing",
      bankName: "Sierra Leone Commercial Bank",
      accNo: "003004817263",
      bban: "003004817263001"
    },
    {
      employeeId: "BCF-SL-1019",
      fullName: "Joseph Conteh",
      gender: "Male",
      title: "Assistant Logistics Manager",
      department: "Procurement Department",
      empDate: "2023-01-20",
      classification: "Fixed-Term Contract",
      jobLevel: "Assistant Manager",
      mgmtLevel: "Middle Management",
      phone: "+232 88 123 456",
      email: "j.conteh@bcf-sl.org",
      payBasic: "11500",
      multiplierCategory: "Manager/Assistant Manager",
      status: "ACTIVE",
      disciplinaryStatus: "Clean Record",
      contractStanding: "Active - Good Standing",
      bankName: "United Bank for Africa (UBA)",
      accNo: "004018274911",
      bban: "004018274911001"
    },
    {
      employeeId: "BCF-SL-1025",
      fullName: "Fatmata Mansaray",
      gender: "Female",
      title: "Junior Community Facilitator",
      department: "Programs Department",
      empDate: "2026-06-01", // Recent employee (< 1 year to demonstrate ineligibility)
      classification: "Fixed-Term Contract",
      jobLevel: "Officer",
      mgmtLevel: "Employee",
      phone: "+232 76 654 321",
      email: "f.mansaray@bcf-sl.org",
      payBasic: "6500",
      multiplierCategory: "Officer",
      status: "ACTIVE",
      disciplinaryStatus: "Clean Record",
      contractStanding: "Active - Good Standing",
      bankName: "Rokel Commercial Bank",
      accNo: "002048192344",
      bban: "002048192344001"
    },
    {
      employeeId: "BCF-SL-1003",
      fullName: "Ibrahim Kargbo",
      gender: "Male",
      title: "Senior Program Coordinator",
      department: "Health & Safety Department",
      empDate: "2021-08-10",
      classification: "Permanent",
      jobLevel: "Manager",
      mgmtLevel: "Middle Management",
      phone: "+232 76 223 344",
      email: "i.kargbo@bcf-sl.org",
      payBasic: "16000",
      multiplierCategory: "Manager/Assistant Manager",
      status: "ACTIVE",
      disciplinaryStatus: "Clean Record",
      contractStanding: "Active - Good Standing",
      bankName: "Sierra Leone Commercial Bank",
      accNo: "003009988771",
      bban: "003009988771001"
    },
    {
      employeeId: "BCF-SL-1007",
      fullName: "Sahr Bangura",
      gender: "Male",
      title: "Senior Finance Manager",
      department: "Finance Department",
      empDate: "2020-11-05",
      classification: "Permanent",
      jobLevel: "Manager",
      mgmtLevel: "Middle Management",
      phone: "+232 77 445 566",
      email: "s.bangura@bcf-sl.org",
      payBasic: "20000",
      multiplierCategory: "Manager/Assistant Manager",
      status: "ACTIVE",
      disciplinaryStatus: "Clean Record",
      contractStanding: "Active - Good Standing",
      bankName: "Sierra Leone Commercial Bank",
      accNo: "003004455661",
      bban: "003004455661001"
    },
    {
      employeeId: "BCF-EMP-2026-0007",
      fullName: "Mariama J. Bundu",
      gender: "Female",
      title: "Field Operations Officer",
      department: "Programs Department",
      empDate: "2023-03-15",
      classification: "Fixed-Term Contract",
      jobLevel: "Officer",
      mgmtLevel: "Employee",
      phone: "+232 78 778 899",
      email: "m.bundu@bcf-sl.org",
      payBasic: "8500",
      multiplierCategory: "Officer",
      status: "ACTIVE",
      disciplinaryStatus: "Clean Record",
      contractStanding: "Active - Good Standing",
      bankName: "Rokel Commercial Bank",
      accNo: "002008899112",
      bban: "002008899112001"
    },
    {
      employeeId: "BCF-SL-1001",
      fullName: "Albert J. Bandama",
      gender: "Male",
      title: "Executive Director / CEO",
      department: "Executive Management",
      empDate: "2018-01-01",
      classification: "Permanent",
      jobLevel: "Executive",
      mgmtLevel: "Top Management",
      phone: "+232 76 000 001",
      email: "ceo@bcf-sl.org",
      payBasic: "35000",
      multiplierCategory: "CEO/Governing Board",
      status: "ACTIVE",
      disciplinaryStatus: "Clean Record",
      contractStanding: "Active - Good Standing",
      bankName: "Sierra Leone Commercial Bank",
      accNo: "003000000001",
      bban: "003000000001001"
    }
  ];

  // Department Normalizer: Maps any variant/legacy name to the canonical 9 system departments
  function normalizeDepartment(dept) {
    if (!dept) return "Programs Department";
    const d = String(dept).toLowerCase().trim();
    if (d.includes("exec") || d.includes("board")) return "Executive Management";
    if (d.includes("finan") || d.includes("account")) return "Finance Department";
    if (d.includes("health") || d.includes("medic") || d.includes("nutrit") || d.includes("safety")) return "Health & Safety Department";
    if (d.includes("human") || d.includes("resource") || d.includes("admin")) return "Human Resources Management Department";
    if (d.includes("tech") || d.includes("information") || d.includes("it ") || d === "it") return "Information Technology (IT) Department";
    if (d.includes("audit") || d.includes("risk")) return "Internal Risk & Audits Department";
    if (d.includes("legal") || d.includes("law") || d.includes("compliance")) return "Legal & Communication Department";
    if (d.includes("procure") || d.includes("logistic")) return "Procurement Department";
    if (d.includes("program") || d.includes("operat") || d.includes("field") || d.includes("m&e")) return "Programs Department";
    return dept;
  }

  // Helper: Retrieve all registered staff
  function getStaffRegistry() {
    let reg = [];
    try {
      reg = JSON.parse(localStorage.getItem("bcf_staff_registry") || "[]");
    } catch (e) {
      reg = [];
    }

    if (!Array.isArray(reg) || reg.length === 0) {
      reg = DEFAULT_STAFF;
    } else {
      // Ensure DEFAULT_STAFF are present if not already added
      DEFAULT_STAFF.forEach(defEmp => {
        const existingIdx = reg.findIndex(e => e.employeeId === defEmp.employeeId);
        if (existingIdx === -1) {
          reg.unshift(defEmp);
        } else {
          // Normalize department
          reg[existingIdx].department = normalizeDepartment(reg[existingIdx].department);
        }
      });
    }

    // Always normalize departments and enforce employment date & multiplier across all loaded staff
    const todayStr = new Date().toISOString().split('T')[0];
    reg.forEach(e => {
      e.department = normalizeDepartment(e.department);

      // The Employment Date is effective from the day of staff registration
      if (!e.empDate && !e.employmentDate) {
        e.empDate = e.registrationDate || e.createdDate || e.registeredAt || todayStr;
      }
      if (!e.employmentDate) {
        e.employmentDate = e.empDate;
      }
      if (!e.empDate) {
        e.empDate = e.employmentDate;
      }
      if (!e.registrationDate) {
        e.registrationDate = e.empDate;
      }

      // Ensure multiplierCategory is present
      if (!e.multiplierCategory) {
        const lvl = (e.jobLevel || e.mgmtLevel || e.title || "").toLowerCase();
        if (lvl.includes("ceo") || lvl.includes("executive") || lvl.includes("board")) {
          e.multiplierCategory = "CEO/Governing Board";
        } else if (lvl.includes("director")) {
          e.multiplierCategory = "Director";
        } else if (lvl.includes("manager") || lvl.includes("assistant")) {
          e.multiplierCategory = "Manager/Assistant Manager";
        } else {
          e.multiplierCategory = "Officer";
        }
      }

      // Ensure gender is present
      if (!e.gender) {
        const fn = (e.fullName || "").toLowerCase();
        if (fn.includes("mariama") || fn.includes("aminata") || fn.includes("fatmata") || fn.includes("isatu") || fn.includes("kadiatu") || fn.includes("zainab") || fn.includes("hawa")) {
          e.gender = "Female";
        } else {
          e.gender = "Male";
        }
      }

      // Ensure classification is present
      if (!e.classification) {
        e.classification = "Permanent";
      }

      // Ensure jobLevel is present
      if (!e.jobLevel) {
        const t = (e.title || e.position || "").toLowerCase();
        if (t.includes("ceo") || t.includes("executive director")) e.jobLevel = "Executive";
        else if (t.includes("director")) e.jobLevel = "Director";
        else if (t.includes("assistant manager")) e.jobLevel = "Assistant Manager";
        else if (t.includes("manager")) e.jobLevel = "Manager";
        else if (t.includes("officer") || t.includes("coordinator") || t.includes("facilitator")) e.jobLevel = "Officer";
        else e.jobLevel = "Officer";
      }

      // Ensure mgmtLevel is present
      if (!e.mgmtLevel) {
        const jl = (e.jobLevel || "").toLowerCase();
        if (jl.includes("exec") || jl.includes("director")) e.mgmtLevel = "Top Management";
        else if (jl.includes("manager")) e.mgmtLevel = "Middle Management";
        else e.mgmtLevel = "Employee";
      }

      if (!e.status) e.status = "ACTIVE";
      if (!e.disciplinaryStatus) e.disciplinaryStatus = "Clean Record";
      if (!e.contractStanding) e.contractStanding = "Active - Good Standing";
    });

    localStorage.setItem("bcf_staff_registry", JSON.stringify(reg));
    return reg;
  }

  // Calculate Service Duration (Years) between Employment Date and present date
  function calculateServiceDuration(empDateStr, referenceDate = new Date()) {
    if (!empDateStr) {
      return { years: 0, text: "0.0 Years (0 Mos)", rawYears: 0, rawMonths: 0, totalDays: 0 };
    }
    const empDate = new Date(empDateStr);
    const now = new Date(referenceDate);

    if (isNaN(empDate.getTime())) {
      return { years: 0, text: "Invalid Date", rawYears: 0, rawMonths: 0, totalDays: 0 };
    }

    let diffMonths = (now.getFullYear() - empDate.getFullYear()) * 12 + (now.getMonth() - empDate.getMonth());
    if (now.getDate() < empDate.getDate()) {
      diffMonths -= 1;
    }
    if (diffMonths < 0) diffMonths = 0;

    const yrs = Math.floor(diffMonths / 12);
    const mos = diffMonths % 12;
    const decimalYears = (diffMonths / 12).toFixed(1);

    const text = `${decimalYears} Years (${yrs > 0 ? yrs + " Yr" + (yrs > 1 ? "s " : " ") : ""}${mos} Mo${mos !== 1 ? "s" : ""})`;

    return {
      years: parseFloat(decimalYears),
      text: text,
      rawYears: yrs,
      rawMonths: mos,
      totalMonths: diffMonths
    };
  }

  // Default Initial Payroll Loans Ledger (Single source of truth)
  // Strict Formula: Total Amount of Loan = Total Recovered To Date + Outstanding Balance
  const DEFAULT_ACTIVE_LOANS = [
    {
      refNo: 'BCF-LN-2026-0001',
      loanId: 'BCF-LN-2026-0001',
      empId: 'BCF-SL-1048',
      employeeId: 'BCF-SL-1048',
      fullName: 'Mariama Kamara',
      employeeName: 'Mariama Kamara',
      gender: 'Female',
      classification: 'Permanent',
      jobLevel: 'Officer',
      mgmtLevel: 'Employee',
      department: 'Programs Department',
      multiplierCategory: 'Officer',
      monthlyBasicSalary: 8500,
      approvedAmount: 7500,
      totalPrincipal: 7500,
      monthlyDeduction: 750,
      monthsTotal: 10,
      totalMonths: 10,
      monthsPaid: 2,
      recoveredAmount: 1500,
      outstandingBalance: 6000,
      balanceRemaining: 6000,
      status: 'ACTIVE',
      disbursedDate: '2026-08-15'
    },
    {
      refNo: 'BCF-LN-2026-0002',
      loanId: 'BCF-LN-2026-0002',
      empId: 'BCF-SL-1001',
      employeeId: 'BCF-SL-1001',
      fullName: 'Albert Joseph Bandama',
      employeeName: 'Albert Joseph Bandama',
      gender: 'Male',
      classification: 'Permanent',
      jobLevel: 'Executive',
      mgmtLevel: 'Top Management',
      department: 'Executive Management',
      multiplierCategory: 'CEO/Governing Board',
      monthlyBasicSalary: 35000,
      approvedAmount: 4200,
      totalPrincipal: 4200,
      monthlyDeduction: 420,
      monthsTotal: 10,
      totalMonths: 10,
      monthsPaid: 3,
      recoveredAmount: 1260,
      outstandingBalance: 2940,
      balanceRemaining: 2940,
      status: 'ACTIVE',
      disbursedDate: '2026-07-01'
    },
    {
      refNo: 'BCF-LN-2026-0003',
      loanId: 'BCF-LN-2026-0003',
      empId: 'BCF-SL-1002',
      employeeId: 'BCF-SL-1002',
      fullName: 'Dr. Sorie Sesay',
      employeeName: 'Dr. Sorie Sesay',
      gender: 'Male',
      classification: 'Permanent',
      jobLevel: 'Director',
      mgmtLevel: 'Top Management',
      department: 'Human Resources Management Department',
      multiplierCategory: 'Director',
      monthlyBasicSalary: 22000,
      approvedAmount: 12000,
      totalPrincipal: 12000,
      monthlyDeduction: 1200,
      monthsTotal: 10,
      totalMonths: 10,
      monthsPaid: 3,
      recoveredAmount: 3600,
      outstandingBalance: 8400,
      balanceRemaining: 8400,
      status: 'ACTIVE',
      disbursedDate: '2026-07-01'
    },
    {
      refNo: 'BCF-LN-2026-0004',
      loanId: 'BCF-LN-2026-0004',
      empId: 'BCF-SL-1007',
      employeeId: 'BCF-SL-1007',
      fullName: 'Sahr Bangura',
      employeeName: 'Sahr Bangura',
      gender: 'Male',
      classification: 'Permanent',
      jobLevel: 'Manager',
      mgmtLevel: 'Middle Management',
      department: 'Finance Department',
      multiplierCategory: 'Manager/Assistant Manager',
      monthlyBasicSalary: 20000,
      approvedAmount: 30000,
      totalPrincipal: 30000,
      monthlyDeduction: 3000,
      monthsTotal: 10,
      totalMonths: 10,
      monthsPaid: 8,
      recoveredAmount: 24000,
      outstandingBalance: 6000,
      balanceRemaining: 6000,
      status: 'ACTIVE',
      disbursedDate: '2026-02-01'
    },
    {
      refNo: 'BCF-LN-2026-0005',
      loanId: 'BCF-LN-2026-0005',
      empId: 'BCF-SL-1025',
      employeeId: 'BCF-SL-1025',
      fullName: 'Aminata Kamara',
      employeeName: 'Aminata Kamara',
      gender: 'Female',
      classification: 'Permanent',
      jobLevel: 'Officer',
      mgmtLevel: 'Employee',
      department: 'Programs Department',
      multiplierCategory: 'Officer',
      monthlyBasicSalary: 12000,
      approvedAmount: 18000,
      totalPrincipal: 18000,
      monthlyDeduction: 1800,
      monthsTotal: 10,
      totalMonths: 10,
      monthsPaid: 2,
      recoveredAmount: 3600,
      outstandingBalance: 14400,
      balanceRemaining: 14400,
      status: 'ACTIVE',
      disbursedDate: '2026-08-01'
    },
    {
      refNo: 'BCF-LN-2026-0006',
      loanId: 'BCF-LN-2026-0006',
      empId: 'BCF-SL-1003',
      employeeId: 'BCF-SL-1003',
      fullName: 'Ibrahim Kargbo',
      employeeName: 'Ibrahim Kargbo',
      gender: 'Male',
      classification: 'Permanent',
      jobLevel: 'Manager',
      mgmtLevel: 'Middle Management',
      department: 'Health & Safety Department',
      multiplierCategory: 'Manager/Assistant Manager',
      monthlyBasicSalary: 16000,
      approvedAmount: 25000,
      totalPrincipal: 25000,
      monthlyDeduction: 2500,
      monthsTotal: 10,
      totalMonths: 10,
      monthsPaid: 8,
      recoveredAmount: 20000,
      outstandingBalance: 5000,
      balanceRemaining: 5000,
      status: 'ACTIVE',
      disbursedDate: '2026-02-15'
    },
    {
      refNo: 'BCF-LN-2026-0007',
      loanId: 'BCF-LN-2026-0007',
      empId: 'BCF-SL-1019',
      employeeId: 'BCF-SL-1019',
      fullName: 'Joseph Conteh',
      employeeName: 'Joseph Conteh',
      gender: 'Male',
      classification: 'Fixed-Term Contract',
      jobLevel: 'Assistant Manager',
      mgmtLevel: 'Middle Management',
      department: 'Procurement Department',
      multiplierCategory: 'Manager/Assistant Manager',
      monthlyBasicSalary: 11500,
      approvedAmount: 10000,
      totalPrincipal: 10000,
      monthlyDeduction: 1000,
      monthsTotal: 10,
      totalMonths: 10,
      monthsPaid: 2,
      recoveredAmount: 2000,
      outstandingBalance: 8000,
      balanceRemaining: 8000,
      status: 'ACTIVE',
      disbursedDate: '2026-08-01'
    },
    {
      refNo: 'BCF-LN-2026-0008',
      loanId: 'BCF-LN-2026-0008',
      empId: 'BCF-EMP-2026-0007',
      employeeId: 'BCF-EMP-2026-0007',
      fullName: 'Mariama J. Bundu',
      employeeName: 'Mariama J. Bundu',
      gender: 'Female',
      classification: 'Fixed-Term Contract',
      jobLevel: 'Officer',
      mgmtLevel: 'Employee',
      department: 'Programs Department',
      multiplierCategory: 'Officer',
      monthlyBasicSalary: 8500,
      approvedAmount: 8000,
      totalPrincipal: 8000,
      monthlyDeduction: 800,
      monthsTotal: 10,
      totalMonths: 10,
      monthsPaid: 2,
      recoveredAmount: 1600,
      outstandingBalance: 6400,
      balanceRemaining: 6400,
      status: 'ACTIVE',
      disbursedDate: '2026-08-01'
    }
  ];

  // Active Staff Loan Repayments for Payroll Ledger
  function getStaffLoans() {
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem("bcf_staff_loans") || "[]");
    } catch (e) { list = []; }
    if (!Array.isArray(list) || list.length === 0) {
      list = DEFAULT_ACTIVE_LOANS;
      localStorage.setItem("bcf_staff_loans", JSON.stringify(list));
    }
    return list;
  }

  function saveStaffLoans(list) {
    localStorage.setItem("bcf_staff_loans", JSON.stringify(list));
  }

  // Strict Single-Loan Policy Enforcement: Find active/unsettled loan for staff
  function getStaffActiveOrUnsettledLoan(staff) {
    if (!staff) return null;
    const staffId = (staff.employeeId || staff.empId || "").trim().toLowerCase();
    const staffName = (staff.fullName || staff.employeeName || "").trim().toLowerCase();

    const isMatch = (id, name) => {
      const cleanId = (id || "").trim().toLowerCase();
      const cleanName = (name || "").trim().toLowerCase();
      if (staffId && cleanId && (staffId === cleanId || staffId.includes(cleanId) || cleanId.includes(staffId))) return true;
      if (staffName && cleanName && (staffName === cleanName || staffName.includes(cleanName) || cleanName.includes(staffName))) return true;
      return false;
    };

    // 1. Check payroll active loans (bcf_staff_loans)
    const loans = getStaffLoans();
    for (const l of loans) {
      const lId = l.employeeId || l.empId || (l.staff && l.staff.employeeId) || "";
      const lName = l.employeeName || l.fullName || (l.staff && l.staff.fullName) || "";
      if (isMatch(lId, lName)) {
        const status = (l.status || "").toUpperCase();
        const bal = parseFloat(l.outstandingBalance !== undefined ? l.outstandingBalance : (l.balanceRemaining !== undefined ? l.balanceRemaining : 0));
        const monthsPaid = parseInt(l.monthsPaid || 0, 10);
        const totalMonths = parseInt(l.totalMonths || l.monthsTotal || 10, 10);

        // A loan is strictly settled ONLY if marked COMPLETED/SETTLED/CLOSED OR balance is 0 or less
        const isSettled = (status === "COMPLETED" || status === "SETTLED" || status === "CLOSED") || bal <= 0;
        if (!isSettled) {
          return {
            refNo: l.loanId || l.refNo || "BCF-LN-ACTIVE",
            outstandingBalance: bal,
            totalPrincipal: parseFloat(l.approvedAmount || l.totalPrincipal || 0),
            status: status || "ACTIVE",
            monthsPaid: monthsPaid,
            totalMonths: totalMonths,
            monthlyDeduction: parseFloat(l.monthlyDeduction || 0),
            source: "bcf_staff_loans",
            details: l
          };
        }
      }
    }

    // 2. Check pending/in-flight applications (bcf_all_loan_applications / bcf_loan_applications)
    let apps = [];
    try {
      apps = JSON.parse(localStorage.getItem("bcf_all_loan_applications") || localStorage.getItem("bcf_loan_applications") || "[]");
    } catch (e) { apps = []; }

    for (const a of apps) {
      const aId = (a.staff && a.staff.employeeId) || a.employeeId || "";
      const aName = (a.staff && a.staff.fullName) || a.employeeName || "";
      if (isMatch(aId, aName)) {
        const st = (a.status || "").toUpperCase();
        if (st && st !== "REJECTED" && st !== "DECLINED" && st !== "SETTLED" && st !== "COMPLETED" && st !== "CLOSED") {
          const bal = parseFloat((a.repayment && a.repayment.outstandingBalance) || (a.request && a.request.loanAmount) || 0);
          return {
            refNo: a.refNo || "BCF-LN-PENDING",
            outstandingBalance: bal,
            totalPrincipal: parseFloat((a.request && a.request.loanAmount) || 0),
            status: st,
            source: "bcf_loan_applications",
            details: a
          };
        }
      }
    }

    return null;
  }

  // Find settled/cleared previous loans for staff
  function getStaffSettledLoans(staff) {
    if (!staff) return [];
    const staffId = (staff.employeeId || staff.empId || "").trim().toLowerCase();
    const staffName = (staff.fullName || staff.employeeName || "").trim().toLowerCase();

    const isMatch = (id, name) => {
      const cleanId = (id || "").trim().toLowerCase();
      const cleanName = (name || "").trim().toLowerCase();
      if (staffId && cleanId && (staffId === cleanId || staffId.includes(cleanId) || cleanId.includes(staffId))) return true;
      if (staffName && cleanName && (staffName === cleanName || staffName.includes(cleanName) || cleanName.includes(staffName))) return true;
      return false;
    };

    const loans = getStaffLoans();
    const settled = [];
    for (const l of loans) {
      const lId = l.employeeId || l.empId || (l.staff && l.staff.employeeId) || "";
      const lName = l.employeeName || l.fullName || (l.staff && l.staff.fullName) || "";
      if (isMatch(lId, lName)) {
        const status = (l.status || "").toUpperCase();
        const bal = parseFloat(l.outstandingBalance !== undefined ? l.outstandingBalance : (l.balanceRemaining !== undefined ? l.balanceRemaining : 0));
        if (status === "COMPLETED" || status === "SETTLED" || status === "CLOSED" || bal <= 0) {
          settled.push({
            refNo: l.loanId || l.refNo || "BCF-LN-SETTLED",
            approvedAmount: parseFloat(l.approvedAmount || l.totalPrincipal || 0),
            recoveredAmount: parseFloat(l.recoveredAmount || l.approvedAmount || 0),
            settledDate: l.settledDate || l.closedDate || "Settled"
          });
        }
      }
    }
    return settled;
  }

  // Check Eligibility against BCF-SL Loan Policy
  function checkEligibility(staff) {
    if (!staff) {
      return { eligible: false, reasons: ["No employee record selected."], serviceDuration: null };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const effectiveEmpDate = staff.empDate || staff.employmentDate || staff.registrationDate || todayStr;
    const duration = calculateServiceDuration(effectiveEmpDate);
    const reasons = [];
    const checks = {
      serviceRequirementPassed: false,
      contractStatusPassed: false,
      loanAccountCleanPassed: false,
      conductPassed: false,
      effectiveEmpDate: effectiveEmpDate,
      monthsRemaining: 0
    };

    // 1. Minimum continuous service: 1 year (Service Duration >= 1.0 continuous year from Employment Date)
    if (duration.years >= 1.0) {
      checks.serviceRequirementPassed = true;
    } else {
      const monthsRemaining = Math.max(1, 12 - duration.totalMonths);
      checks.monthsRemaining = monthsRemaining;
      reasons.push(`Service duration (${duration.years} yrs / ${duration.totalMonths} mos) is below the minimum mandatory threshold of 1.0 continuous year (12 months) from Employment Date (${effectiveEmpDate}). Staff requires ${monthsRemaining} more month${monthsRemaining > 1 ? 's' : ''} of service to become eligible.`);
    }

    // 2. Active contract standing
    const cls = (staff.classification || "").toLowerCase();
    const isRestrictedClass = cls.includes("intern") || cls.includes("volunteer") || cls.includes("casual");
    if (!isRestrictedClass && (staff.status || "ACTIVE").toUpperCase() === "ACTIVE") {
      checks.contractStatusPassed = true;
    } else {
      reasons.push(isRestrictedClass ? `Classification "${staff.classification}" is ineligible for credit facilities per BCF policy.` : "Staff employment status is not active.");
    }

    // 3. No outstanding/unsettled loans policy enforcement
    const unsettledLoan = getStaffActiveOrUnsettledLoan(staff);

    if (!unsettledLoan) {
      checks.loanAccountCleanPassed = true;
      checks.settledLoans = getStaffSettledLoans(staff);
    } else {
      checks.loanAccountCleanPassed = false;
      checks.unsettledLoan = unsettledLoan;
      reasons.push("You have not settled and you are not eligible for another loan at this moment.");
    }

    // 4. Conduct record
    if ((staff.disciplinaryStatus || "Clean Record").toLowerCase().includes("clean")) {
      checks.conductPassed = true;
    } else {
      reasons.push("Pending disciplinary action or warning recorded on staff file.");
    }

    const eligible = checks.serviceRequirementPassed && checks.contractStatusPassed && checks.loanAccountCleanPassed && checks.conductPassed;

    return {
      eligible,
      reasons,
      duration,
      checks,
      unsettledLoan,
      effectiveEmpDate
    };
  }

  // Multiplier details helper
  function getMultiplierDetails(categoryName) {
    if (!categoryName) return POLICY.MULTIPLIERS["Officer"];
    for (const key of Object.keys(POLICY.MULTIPLIERS)) {
      if (categoryName.toLowerCase().includes(key.toLowerCase().split("/")[0])) {
        return POLICY.MULTIPLIERS[key];
      }
    }
    return POLICY.MULTIPLIERS["Officer"];
  }

  // Applications Storage
  function getLoanApplications() {
    let apps = [];
    try {
      apps = JSON.parse(localStorage.getItem("bcf_loan_applications") || "[]");
    } catch (e) { apps = []; }

    // Seed sample initial application if empty
    if (!Array.isArray(apps) || apps.length === 0) {
      const defaultApp = {
        refNo: "BCF-LN-2026-0842",
        status: "PENDING_HR", // PENDING_HR, HR_APPROVED, FINANCE_APPROVED, CEO_AUTHORIZED, DISBURSED
        date: "2026-10-02",
        createdAt: new Date().toISOString(),
        staff: {
          fullName: "Mariama Kamara",
          employeeId: "BCF-SL-1048",
          title: "Senior Field Coordinator",
          department: "Programs Department",
          empDate: "2021-02-12",
          serviceYears: "4.3 Years (4 Yrs 4 Mos)",
          classification: "Permanent",
          phone: "+232 76 892 104",
          email: "m.kamara@bcf-sl.org",
          multiplierCategory: "Officer",
          basicSalary: 8500,
          bankName: "Sierra Leone Commercial Bank",
          accNo: "003001892341"
        },
        request: {
          loanAmount: 8500,
          categoryRange: "Tier 2: Medical & Personal Development (NLe 5,001 - NLe 10,000)",
          purpose: "Emergency family medical procedure and household relocation advance.",
          repaymentPeriod: "10 Months",
          applicableRate: "10% (Fixed — per BCF Staff Loan Policy)",
          proposedMonthlyDeduction: 850,
          applicationDate: "2026-10-02",
          previousLoanRef: "Fully Settled"
        },
        declaration: {
          signed: true,
          applicantName: "Mariama Kamara",
          agreedAll: true
        },
        hrReview: null,
        financeReview: null,
        ceoReview: null,
        voucher: null,
        disbursement: null
      };
      apps = [defaultApp];
    } else {
      apps.forEach(app => {
        if (app.staff && app.staff.department) {
          app.staff.department = normalizeDepartment(app.staff.department);
        }
      });
    }
    localStorage.setItem("bcf_loan_applications", JSON.stringify(apps));
    return apps;
  }

  function saveLoanApplication(app) {
    const apps = getLoanApplications();
    const index = apps.findIndex(a => a.refNo === app.refNo);
    if (index >= 0) {
      apps[index] = app;
    } else {
      apps.unshift(app);
    }
    localStorage.setItem("bcf_loan_applications", JSON.stringify(apps));
    localStorage.setItem("currentLoanApplication", JSON.stringify(app));
    localStorage.setItem("bcf_active_loan_id", app.refNo);
    return app;
  }

  function getActiveLoanApplication() {
    let current = null;
    try {
      const activeRef = localStorage.getItem("bcf_active_loan_id");
      const apps = getLoanApplications();
      if (activeRef) {
        current = apps.find(a => a.refNo === activeRef);
      }
      if (!current && apps.length > 0) {
        current = apps[0];
      }
    } catch (e) {}
    return current;
  }

  function setActiveLoanApplication(refNo) {
    const apps = getLoanApplications();
    const app = apps.find(a => a.refNo === refNo);
    if (app) {
      localStorage.setItem("bcf_active_loan_id", refNo);
      localStorage.setItem("currentLoanApplication", JSON.stringify(app));
    }
    return app;
  }

  // Simulated Email Notification System
  function getSimulatedEmails() {
    try {
      return JSON.parse(localStorage.getItem("bcf_simulated_emails") || "[]");
    } catch (e) {
      return [];
    }
  }

  function dispatchEmail({ to, toName, from, subject, body, badgeText, linkUrl, tabId }) {
    const emails = getSimulatedEmails();
    const now = new Date();
    const newEmail = {
      id: "EML-" + Date.now().toString(36).toUpperCase(),
      to,
      toName,
      from: from || "BCF Loan Governance System <loans-automation@bcf-sl.org>",
      subject,
      body,
      badgeText: badgeText || "Action Required",
      linkUrl: linkUrl || "#",
      tabId: tabId || "loan-application",
      timestamp: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + ", " + now.toLocaleDateString("en-GB"),
      unread: true
    };
    emails.unshift(newEmail);
    localStorage.setItem("bcf_simulated_emails", JSON.stringify(emails));

    showEmailToast(newEmail);
    return newEmail;
  }

  function showEmailToast(email) {
    let container = document.getElementById("bcf-email-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "bcf-email-toast-container";
      container.className = "fixed bottom-5 right-5 z-[99999] flex flex-col gap-3 max-w-md w-full pointer-events-none p-4";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "pointer-events-auto bg-slate-900/95 text-white border border-emerald-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-md transform transition-all duration-300 translate-y-4 opacity-0 flex flex-col gap-2.5";
    toast.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-700/60 pb-2">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span class="font-bold text-xs uppercase tracking-wider text-emerald-400">📧 Official BCF Email Dispatched</span>
        </div>
        <span class="text-[11px] text-slate-400 font-mono">${email.timestamp}</span>
      </div>
      <div>
        <p class="text-xs text-slate-300"><strong class="text-white">To:</strong> ${email.toName} &lt;${email.to}&gt;</p>
        <p class="text-sm font-bold text-white mt-0.5">${email.subject}</p>
        <p class="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">${email.body}</p>
      </div>
      <div class="flex items-center justify-between pt-1">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">${email.badgeText}</span>
        <button onclick="BCF_LOANS.switchTab('${email.tabId}'); this.closest('.bg-slate-900\\/95').remove();" class="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg transition active:scale-95 shadow">
          Open Console &rarr;
        </button>
      </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove("translate-y-4", "opacity-0");
    }, 50);

    setTimeout(() => {
      toast.classList.add("translate-y-4", "opacity-0");
      setTimeout(() => toast.remove(), 350);
    }, 7000);
  }

  // =========================================================================
  // INSTITUTIONAL ROLE-BASED ACCESS CONTROL (RBAC) SYSTEM
  // =========================================================================
  const ROLES = {
    ADMIN: {
      id: "ADMIN",
      name: "System Administrator",
      title: "System Administrator (Admin)",
      persona: "Albert Joseph Bandama",
      badge: "Full Admin",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
      icon: "admin_panel_settings",
      description: "Full access across all 8 loan applications, approvals, vouchers, releases, dashboards, and payroll systems."
    },
    STAFF: {
      id: "STAFF",
      name: "Staff Member",
      title: "General Staff Member",
      persona: "Joseph Conteh / General Staff",
      badge: "Staff Only",
      badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
      icon: "person",
      description: "Staff access restricted strictly to viewing and applying for staff credit facilities."
    },
    HR: {
      id: "HR",
      name: "HR Director",
      title: "Director of Human Resources",
      persona: "Dr. Sorie Sesay",
      badge: "HR Access",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
      icon: "how_to_reg",
      description: "HR Verification sign-off, voucher preparation, loan dashboard telemetry view, and payroll integration review."
    },
    FINANCE: {
      id: "FINANCE",
      name: "Finance Director",
      title: "Director of Financial Operations",
      persona: "Aminata Turay",
      badge: "Finance Access",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
      icon: "account_balance",
      description: "Finance audit endorsement, bank disbursement release, loan dashboard view, and applying automatic payroll deductions."
    },
    CEO: {
      id: "CEO",
      name: "Executive Director / CEO",
      title: "Executive Director / CEO",
      persona: "Albert J. Bandama",
      badge: "CEO Access",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      icon: "verified_user",
      description: "Executive policy review, final loan authorization sign-off, loan dashboard telemetry view, and payroll integration review."
    }
  };

  const TAB_PERMISSIONS = {
    "loan-application": {
      label: "Staff Loan Application",
      allowedRoles: ["ADMIN", "STAFF", "HR", "FINANCE", "CEO"],
      accessDescription: "Access to All Staff to view and apply for loan",
      mode: { ADMIN: "FULL", STAFF: "APPLY", HR: "APPLY", FINANCE: "APPLY", CEO: "APPLY" }
    },
    "hr-approval": {
      label: "HR Approval Console",
      allowedRoles: ["ADMIN", "HR"],
      accessDescription: "HR Access",
      mode: { ADMIN: "FULL", HR: "FULL" }
    },
    "finance-approval": {
      label: "Finance Approval Console",
      allowedRoles: ["ADMIN", "FINANCE"],
      accessDescription: "Finance Access",
      mode: { ADMIN: "FULL", FINANCE: "FULL" }
    },
    "ceo-authorisation": {
      label: "CEO Executive Authorization",
      allowedRoles: ["ADMIN", "CEO"],
      accessDescription: "CEO Access",
      mode: { ADMIN: "FULL", CEO: "FULL" }
    },
    "hr-disbursement-voucher": {
      label: "HR Disbursement Voucher Preparation",
      allowedRoles: ["ADMIN", "HR"],
      accessDescription: "HR Access",
      mode: { ADMIN: "FULL", HR: "FULL" }
    },
    "finance-disbursement-release": {
      label: "Finance Disbursement Release",
      allowedRoles: ["ADMIN", "FINANCE"],
      accessDescription: "Finance Access",
      mode: { ADMIN: "FULL", FINANCE: "FULL" }
    },
    "tracking-repayment": {
      label: "Loan Dashboard Management",
      allowedRoles: ["ADMIN", "HR", "FINANCE", "CEO"],
      accessDescription: "HR-View, CEO-View, Finance Access-View",
      mode: { ADMIN: "FULL", HR: "VIEW", FINANCE: "VIEW", CEO: "VIEW" }
    },
    "payroll-integration": {
      label: "Payroll Integration & Deduction",
      allowedRoles: ["ADMIN", "HR", "FINANCE", "CEO"],
      accessDescription: "HR & CEO: View-Only, Finance Director & Admin: View & Apply Deductions (Staff: No Access)",
      mode: { ADMIN: "FULL", HR: "VIEW", FINANCE: "DEDUCT", CEO: "VIEW" }
    }
  };

  function normalizeRoleKey(val) {
    if (!val) return null;
    const v = String(val).trim().toUpperCase();
    if (v === "HR" || v === "HR_DIRECTOR" || v.includes("HUMAN")) return "HR";
    if (v === "CEO" || v === "EXECUTIVE" || v.includes("DIRECTOR_CEO") || v.includes("EXECUTIVE_DIRECTOR")) return "CEO";
    if (v === "FINANCE" || v === "FINANCE_DIRECTOR" || v.includes("FINAN")) return "FINANCE";
    if (v === "STAFF" || v === "EMPLOYEE" || v === "OFFICER") return "STAFF";
    if (v === "ADMIN" || v === "SUPER_ADMIN" || v.includes("ADMIN")) return "ADMIN";
    return null;
  }

  function getCurrentUserRole() {
    const loanRole = localStorage.getItem("bcf_loan_user_role");
    const sysRole = localStorage.getItem("bcf_user_role");

    const normLoan = normalizeRoleKey(loanRole);
    const normSys = normalizeRoleKey(sysRole);

    let r = normLoan || normSys || "STAFF";
    if (!ROLES[r]) r = "STAFF";
    return r;
  }

  function setCurrentUserRole(roleId) {
    const norm = normalizeRoleKey(roleId) || roleId;
    if (ROLES[norm]) {
      localStorage.setItem("bcf_loan_user_role", norm);
      const sysMap = {
        ADMIN: "super_admin",
        STAFF: "staff",
        HR: "hr_director",
        FINANCE: "finance_director",
        CEO: "ceo"
      };
      if (sysMap[norm]) {
        localStorage.setItem("bcf_user_role", sysMap[norm]);
      }

      const menu = document.getElementById("bcf-role-menu");
      if (menu) menu.classList.add("hidden");

      const activeTab = getActiveTabIdFromPage();
      if (activeTab && !hasTabAccess(activeTab, norm)) {
        switchTab("loan-application");
      } else {
        window.location.reload();
      }
    }
  }

  function hasTabAccess(tabId, roleId) {
    const role = roleId || getCurrentUserRole();
    const perm = TAB_PERMISSIONS[tabId];
    if (!perm) return true;
    return perm.allowedRoles.includes(role);
  }

  function getTabAccessMode(tabId, roleId) {
    const role = roleId || getCurrentUserRole();
    const perm = TAB_PERMISSIONS[tabId];
    if (!perm) return "FULL";
    return perm.mode[role] || "DENIED";
  }

  function toggleRoleDropdown() {
    const menu = document.getElementById("bcf-role-menu");
    if (menu) {
      menu.classList.toggle("hidden");
    }
  }

  function getActiveTabIdFromPage() {
    const path = window.location.pathname.toLowerCase();
    for (const t of TABS) {
      if (path.includes(t.id) || (t.href && path.includes(t.href.replace("../", "").split("/")[0]))) {
        return t.id;
      }
    }
    return null;
  }

  // 8 Tabs Definition
  const TABS = [
    { id: "loan-application", label: "Staff Loan Application", shortLabel: "Application", icon: "edit_document", href: "../staff_eligibility_loan_application/code.html", route: "/loans/loan-application" },
    { id: "hr-approval", label: "HR Approval Console", shortLabel: "HR Approval", icon: "how_to_reg", href: "../hr_approval_console/code.html", route: "/loans/hr-approval" },
    { id: "finance-approval", label: "Finance Approval Console", shortLabel: "Finance Approval", icon: "account_balance", href: "../finance_approval_console/code.html", route: "/loans/finance-approval" },
    { id: "ceo-authorisation", label: "CEO Executive Authorization", shortLabel: "CEO Authorization", icon: "verified_user", href: "../ceo_executive_review_authorization/code.html", route: "/loans/ceo-authorisation" },
    { id: "hr-disbursement-voucher", label: "HR Disbursement Voucher Preparation", shortLabel: "HR Voucher", icon: "receipt_long", href: "../hr_disbursement_voucher/code.html", route: "/loans/hr-disbursement-voucher" },
    { id: "finance-disbursement-release", label: "Finance Disbursement Release", shortLabel: "Disbursement Release", icon: "payments", href: "../finance_disbursement_release/code.html", route: "/loans/finance-disbursement-release" },
    { id: "tracking-repayment", label: "Loan Dashboard Management", shortLabel: "Loan Dashboard", icon: "dashboard", href: "../loan_tracking_repayment_dashboard/code.html", route: "/loans/tracking-repayment" },
    { id: "payroll-integration", label: "Payroll Integration & Deduction", shortLabel: "Payroll Integration", icon: "request_quote", href: "../payroll_integration/code.html", route: "/loans/payroll-integration" }
  ];

  function switchTab(tabId) {
    const currentRole = getCurrentUserRole();
    const target = TABS.find(t => t.id === tabId);
    if (!target) return;

    if (!hasTabAccess(tabId, currentRole)) {
      const currentRoleObj = ROLES[currentRole] || ROLES.ADMIN;
      const perm = TAB_PERMISSIONS[tabId] || { accessDescription: "Restricted Access" };
      showToast(`ACCESS DENIED: ${target.label} requires ${perm.accessDescription}. Current Role: ${currentRoleObj.name}`, "error");
      alert(`Access Restricted!\n\n${target.label} requires: ${perm.accessDescription}.\n\nYour current role is: ${currentRoleObj.name} (${currentRoleObj.badge}).\n\nStaff can only access the Staff Loan Application Form. Please switch to an authorized role from the top Role Switcher to proceed.`);
      return;
    }

    try {
      if (window.top && window.top !== window && window.top.location) {
        window.top.location.href = target.route;
        return;
      }
    } catch (e) {}
    window.location.href = target.href;
  }

  // Header & Tab Bar Renderer
  function renderHeaderAndTabs(activeTabId) {
    const headerContainer = document.getElementById("bcf-loans-nav-header");
    if (!headerContainer) return;

    const currentRole = getCurrentUserRole();
    const currentRoleObj = ROLES[currentRole] || ROLES.ADMIN;
    const isTabPermitted = hasTabAccess(activeTabId, currentRole);
    const tabPerm = TAB_PERMISSIONS[activeTabId] || { label: activeTabId, accessDescription: "Authorized Staff" };

    const emails = getSimulatedEmails();
    const unreadCount = emails.filter(e => e.unread).length;
    const currentApp = getActiveLoanApplication();
    const appRef = currentApp ? currentApp.refNo : "BCF-LN-2026-0842";
    const appStatus = currentApp ? currentApp.status : "PENDING_HR";

    const statusBadge = (function () {
      switch (appStatus) {
        case "PENDING_HR": return `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">Pending HR</span>`;
        case "HR_APPROVED": return `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">Pending Finance</span>`;
        case "FINANCE_APPROVED": return `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300">Pending CEO</span>`;
        case "CEO_AUTHORIZED": return `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">CEO Authorized</span>`;
        case "DISBURSED": return `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800 border border-teal-300">Disbursed</span>`;
        case "HR_REJECTED":
        case "FINANCE_REJECTED":
        case "CEO_REJECTED": return `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">Not Approved</span>`;
        default: return `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">Active</span>`;
      }
    })();

    headerContainer.innerHTML = `
      <!-- TOP INSTITUTIONAL BAR -->
      <header class="bg-surface border-b border-outline shadow-xs sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <!-- Logo & Brand -->
          <div class="flex items-center gap-3 min-w-0">
            <img src="/bcf-logo.jpg" onerror="this.src='../bcf-logo.jpg'" alt="BCF-SL Logo" class="h-9 w-auto object-contain shrink-0"/>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-sm sm:text-base text-primary tracking-tight truncate uppercase leading-none">
                  Bandama Charity Foundation
                </span>
                <span class="hidden sm:inline-block px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  SIERRA LEONE
                </span>
              </div>
              <span class="text-[11px] font-semibold text-secondary truncate mt-0.5">
                Staff Loan Management System &bull; Policy Tier Governance
              </span>
            </div>
          </div>

          <!-- Right Controls: Active Loan Indicator, Role Selector & Email Notifications -->
          <div class="flex items-center gap-2.5 shrink-0">
            <!-- Active Loan Indicator -->
            <div class="hidden xl:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span class="material-symbols-outlined text-[16px] text-primary">folder_open</span>
              <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${appRef}</span>
              ${statusBadge}
            </div>

            <!-- Role Selector & Privileges Dropdown -->
            <div class="relative">
              <button onclick="BCF_LOANS.toggleRoleDropdown()" id="bcf-role-btn" type="button" class="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-surface hover:bg-slate-50 text-xs font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100 transition shadow-2xs active:scale-95 cursor-pointer" title="Switch active security role (Admin, Staff, HR, Finance, CEO)">
                <span class="material-symbols-outlined text-primary text-[18px]">${currentRoleObj.icon}</span>
                <div class="text-left hidden sm:block leading-tight">
                  <span class="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block">Role Access</span>
                  <span class="text-slate-900 font-extrabold truncate max-w-[130px] block">${currentRoleObj.name}</span>
                </div>
                <span class="px-2 py-0.5 rounded-md text-[10px] font-black border ${currentRoleObj.badgeColor}">${currentRoleObj.badge}</span>
                <span class="material-symbols-outlined text-slate-400 text-[18px]">arrow_drop_down</span>
              </button>

              <!-- Role Switcher Dropdown Menu -->
              <div id="bcf-role-menu" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-[99995] animate-in fade-in zoom-in-95">
                <div class="p-2.5 border-b border-slate-100 mb-1">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider">Access Privileges Menu</span>
                    <span class="text-[10px] font-extrabold text-primary">BCF-SL Security</span>
                  </div>
                  <p class="text-[11px] text-slate-500 mt-0.5">Switch active security role to verify access permissions</p>
                </div>
                ${Object.values(ROLES).map(r => {
                  const isCur = r.id === currentRole;
                  return `
                    <button type="button" onclick="BCF_LOANS.setCurrentUserRole('${r.id}')" class="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 flex items-start gap-2.5 transition cursor-pointer mb-1 ${isCur ? 'bg-primary/5 border border-primary/20 shadow-2xs font-bold' : ''}">
                      <span class="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">${r.icon}</span>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-bold text-slate-900 truncate">${r.name}</span>
                          <span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${r.badgeColor}">${r.badge}</span>
                        </div>
                        <span class="text-[11px] text-slate-500 block truncate mt-0.5">${r.persona}</span>
                        <span class="text-[10px] text-slate-400 block line-clamp-1 mt-0.5 leading-tight">${r.description}</span>
                      </div>
                      ${isCur ? `<span class="material-symbols-outlined text-primary text-base shrink-0 mt-1">check</span>` : ''}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Email Notification Center Button -->
            <button onclick="BCF_LOANS.toggleEmailDrawer()" class="relative h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-surface hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200 transition shadow-2xs active:scale-95 cursor-pointer" title="Open Simulated Email Drawer">
              <span class="material-symbols-outlined text-[18px] text-primary">mail</span>
              <span class="hidden sm:inline">Emails</span>
              ${unreadCount > 0 ? `<span class="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">${unreadCount}</span>` : ""}
            </button>
          </div>
        </div>

        <!-- 8 TABS WORKFLOW BAR (With Role Security Badges) -->
        <div class="border-t border-slate-200/80 bg-slate-50/80 overflow-x-auto no-scrollbar shadow-inner">
          <div class="max-w-7xl mx-auto px-2 flex items-center gap-1 py-1.5 min-w-max">
            ${TABS.map((tab, idx) => {
              const isActive = tab.id === activeTabId;
              const allowed = hasTabAccess(tab.id, currentRole);
              const mode = getTabAccessMode(tab.id, currentRole);
              const p = TAB_PERMISSIONS[tab.id];

              let badgeHtml = "";
              if (!allowed) {
                badgeHtml = `<span class="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-red-100 text-red-700 border border-red-200 flex items-center gap-0.5"><span class="material-symbols-outlined text-[10px]">lock</span>Locked</span>`;
              } else if (mode === "VIEW") {
                badgeHtml = `<span class="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200">View</span>`;
              } else if (mode === "DEDUCT") {
                badgeHtml = `<span class="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Deduct</span>`;
              }

              if (allowed) {
                return `
                  <button
                    type="button"
                    onclick="BCF_LOANS.switchTab('${tab.id}')"
                    class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
                      isActive
                        ? "bg-primary text-white shadow-md ring-1 ring-primary-dark"
                        : "text-slate-600 hover:text-primary hover:bg-white"
                    }"
                    title="${tab.label} (${p ? p.accessDescription : ''})"
                  >
                    <span class="text-[10px] opacity-75 font-mono">${idx + 1}.</span>
                    <span class="material-symbols-outlined text-[16px] ${isActive ? "text-white" : "text-slate-400"}">${tab.icon}</span>
                    <span>${tab.label}</span>
                    ${badgeHtml}
                  </button>
                `;
              } else {
                return `
                  <button
                    type="button"
                    onclick="BCF_LOANS.switchTab('${tab.id}')"
                    class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap opacity-45 hover:opacity-60 text-slate-400 hover:bg-red-50/50 cursor-not-allowed"
                    title="Access Restricted: Requires ${p ? p.accessDescription : 'Specialized Role'}"
                  >
                    <span class="text-[10px] opacity-50 font-mono">${idx + 1}.</span>
                    <span class="material-symbols-outlined text-[16px] text-slate-400">lock</span>
                    <span>${tab.label}</span>
                    ${badgeHtml}
                  </button>
                `;
              }
            }).join("")}
          </div>
        </div>
      </header>

      <!-- ACCESS DENIED 403 RESTRICTION OVERLAY (When current active page is forbidden) -->
      ${!isTabPermitted ? `
        <div id="bcf-access-denied-screen" class="fixed inset-0 top-16 z-[99990] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div class="max-w-lg w-full bg-white rounded-2xl shadow-2xl border-2 border-red-500 p-6 sm:p-8 text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in-95">
            <div class="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center shadow-inner border border-red-200">
              <span class="material-symbols-outlined text-4xl">gpp_bad</span>
            </div>
            <div class="space-y-1">
              <span class="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-600 text-white">
                Access Restricted • 403 Forbidden
              </span>
              <h2 class="text-xl font-black text-slate-900 mt-2">${tabPerm.label}</h2>
              <p class="text-sm font-bold text-red-700 mt-1">
                Your current role (<span class="underline">${currentRoleObj.name}</span>) is not permitted to access this module.
              </p>
            </div>
            <div class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 text-left space-y-2">
              <div><strong>Required Privileges:</strong> <span class="text-slate-900 font-semibold">${tabPerm.accessDescription}</span></div>
              <div><strong>Authorized Roles:</strong> <span class="text-emerald-700 font-bold">${tabPerm.allowedRoles.map(r => ROLES[r].name).join(", ")}</span></div>
              <div class="text-[11px] text-slate-500 pt-1.5 border-t border-slate-200 leading-relaxed">
                ${currentRole === 'STAFF' 
                  ? 'Under BCF-SL access policy, staff members only have access to the Staff Loan Application Form.' 
                  : 'Limited access is assigned per BCF-SL governance rules. Switch to an authorized role to proceed.'}
              </div>
            </div>
            <div class="flex flex-wrap gap-2.5 justify-center w-full pt-2">
              <button type="button" onclick="BCF_LOANS.switchTab('loan-application')" class="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-black rounded-xl transition shadow flex items-center gap-1.5 active:scale-95 cursor-pointer">
                <span class="material-symbols-outlined text-[18px]">edit_document</span>
                <span>Go to Staff Loan Application</span>
              </button>
              <button type="button" onclick="BCF_LOANS.toggleRoleDropdown()" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition shadow flex items-center gap-1.5 active:scale-95 cursor-pointer">
                <span class="material-symbols-outlined text-[18px]">manage_accounts</span>
                <span>Switch Role Privilege</span>
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- EMAIL DRAWER MODAL -->
      <div id="bcf-email-drawer" class="fixed inset-0 z-[99990] bg-black/50 backdrop-blur-xs hidden flex items-center justify-center p-4">
        <div class="bg-surface rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
          <div class="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-2xl">mark_email_unread</span>
              <div>
                <h3 class="text-base font-bold text-slate-900">BCF-SL Automated Email Notifications</h3>
                <p class="text-xs text-slate-500">Simulated official notifications dispatched across HR, Finance & CEO approval chain</p>
              </div>
            </div>
            <button onclick="BCF_LOANS.toggleEmailDrawer()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div id="bcf-email-list" class="flex-1 overflow-y-auto space-y-3 pr-1">
            <!-- Dynamic emails rendered here -->
          </div>

          <div class="flex items-center justify-between pt-4 border-t border-slate-200 mt-4 text-xs text-slate-500">
            <span>Powered by BCF-SL Internal Email Gateway</span>
            <button onclick="BCF_LOANS.clearEmails()" class="text-red-600 hover:underline font-bold">Clear All</button>
          </div>
        </div>
      </div>
    `;

    renderEmailDrawerContent();

    if (!isTabPermitted) {
      setTimeout(() => {
        const mainEl = document.querySelector('main');
        if (mainEl) mainEl.style.display = 'none';
      }, 0);
    }
  }

  function toggleEmailDrawer() {
    const drawer = document.getElementById("bcf-email-drawer");
    if (drawer) {
      drawer.classList.toggle("hidden");
      renderEmailDrawerContent();
    }
  }

  function renderEmailDrawerContent() {
    const list = document.getElementById("bcf-email-list");
    if (!list) return;

    const emails = getSimulatedEmails();
    if (emails.length === 0) {
      list.innerHTML = `
        <div class="text-center py-12 text-slate-400">
          <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
          <p class="text-sm font-semibold">No emails dispatched yet.</p>
          <p class="text-xs">Submit a loan application or pass approvals to generate official notifications.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = emails.map(e => `
      <div class="p-3.5 rounded-xl border border-slate-200 hover:border-primary/40 bg-slate-50/70 hover:bg-white transition flex flex-col gap-1.5 shadow-2xs">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-primary">${e.toName} &lt;${e.to}&gt;</span>
          <span class="text-slate-400 font-mono text-[11px]">${e.timestamp}</span>
        </div>
        <p class="text-sm font-bold text-slate-800">${e.subject}</p>
        <p class="text-xs text-slate-600 leading-relaxed">${e.body}</p>
        <div class="flex items-center justify-between pt-1">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">${e.badgeText}</span>
          <button onclick="BCF_LOANS.switchTab('${e.tabId}'); BCF_LOANS.toggleEmailDrawer();" class="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-0.5">
            Open in Console &rarr;
          </button>
        </div>
      </div>
    `).join("");
  }

  function clearEmails() {
    localStorage.removeItem("bcf_simulated_emails");
    renderEmailDrawerContent();
  }

  // Format currency in NLe with 2 decimal places
  function formatNLe(amt) {
    const val = parseFloat(amt || 0);
    return `NLe ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Lightweight user feedback notification toast
  function showToast(msg, type = "info") {
    const existing = document.getElementById("bcf-toast-msg");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "bcf-toast-msg";
    const bg = type === "error" ? "bg-red-700" : (type === "success" ? "bg-emerald-700" : "bg-slate-900");
    toast.className = `fixed bottom-6 right-6 z-[9999] px-5 py-3.5 rounded-xl shadow-2xl text-white text-xs font-bold flex items-center gap-2.5 ${bg} border border-white/20 transition-all`;
    const icon = type === "success" ? "check_circle" : (type === "error" ? "error" : "info");
    toast.innerHTML = `<span class="material-symbols-outlined text-[20px]">${icon}</span><span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }

  return {
    POLICY,
    ROLES,
    TAB_PERMISSIONS,
    getCurrentUserRole,
    setCurrentUserRole,
    hasTabAccess,
    getTabAccessMode,
    toggleRoleDropdown,
    normalizeDepartment,
    formatNLe,
    showToast,
    getStaffRegistry,
    calculateServiceDuration,
    checkEligibility,
    getStaffActiveOrUnsettledLoan,
    getStaffSettledLoans,
    getMultiplierDetails,
    getLoanApplications,
    getAllApplications: getLoanApplications,
    saveLoanApplication,
    getActiveLoanApplication,
    setActiveLoanApplication,
    getStaffLoans,
    saveStaffLoans,
    dispatchEmail,
    getSimulatedEmails,
    switchTab,
    renderHeaderAndTabs,
    toggleEmailDrawer,
    clearEmails
  };
})();
