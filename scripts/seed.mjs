/**
 * BCF-SL Administration System — MongoDB Atlas Seed Script
 * ---------------------------------------------------------
 * Seeds every collection used by the Administrative Hub with baseline data.
 *
 * Usage (from frontend/):
 *   npm run seed            → upsert all seed data (safe to re-run, no duplicates)
 *   npm run seed -- --reset → DROP each seeded collection first, then insert fresh
 *
 * Reads MONGODB_URI / MONGO_URI and MONGODB_DB from .env.local then .env.
 */

import { MongoClient } from "mongodb";
import dns from "dns";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RESET = process.argv.includes("--reset");
const NOW = new Date().toISOString();

// ─── Env loading (no dotenv dependency) ─────────────────────────────────────
function loadEnv(file) {
  const p = join(ROOT, file);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");
loadEnv(".env");

const URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || "bcf_administrative_hub";

if (!URI || URI.includes("<db_username>") || URI.includes("<db_password>")) {
  console.error("✗ MONGODB_URI is missing or still contains <db_username>/<db_password> placeholders.");
  process.exit(1);
}

// Windows/ISP DNS often refuses SRV lookups — use public resolvers.
try { dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]); } catch {}

function directReplicaUri(uri) {
  const m = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@administrativehub\.e9xkgcl\.mongodb\.net/);
  if (!m) return null;
  const hosts = [0, 1, 2].map((i) => `ac-jt1fltj-shard-00-0${i}.e9xkgcl.mongodb.net:27017`).join(",");
  return `mongodb://${m[1]}:${m[2]}@${hosts}/?ssl=true&authSource=admin&replicaSet=atlas-9c1itd-shard-0&appName=AdministrativeHub`;
}

async function connect() {
  const opts = { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000 };
  try {
    return await new MongoClient(URI, opts).connect();
  } catch (err) {
    const direct = directReplicaUri(URI);
    if (direct && /querySrv|SRV|ECONNREFUSED/i.test(String(err?.message ?? err))) {
      console.warn("⚠ SRV lookup failed — retrying via direct replica-set hosts…");
      return await new MongoClient(direct, opts).connect();
    }
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  SEED DATA
// ════════════════════════════════════════════════════════════════════════════

const DEPARTMENTS = [
  "Executive Management",
  "Human Resources Management Department",
  "Finance Department",
  "Programs Department",
  "Procurement Department",
  "ICT Department",
  "Health & Safety Department",
  "Internal Risk & Audits Department",
  "Legal & Communication Department",
];

// ─── Employees ──────────────────────────────────────────────────────────────
const employees = [
  {
    employeeId: "BCF-PTE-2026-0001", fullName: "Albert Joseph Bandama", gender: "Male", dob: "1988-04-12",
    phone: "+232 76 123456", email: "albertjosephhassanbandama@gmail.com", marital: "Married", children: "2",
    nin: "SL19880412001", nassit: "N-880412-001", address: "14 Wilkinson Road, Freetown",
    department: "Executive Management", title: "Chief Executive Officer (CEO)", unit: "Executive Office",
    mgmtLevel: "Top Management", classification: "Permanent", jobLevel: "Executive", empDate: "2026-01-01",
    reportsTo: "Governing Board", bankName: "Sierra Leone Commercial Bank", accNo: "00300123456789",
    bban: "SL010030012345678901", payBasic: "25000", username: "abandama",
    education: [{ inst: "University of Sierra Leone", qual: "Master's Degree", prog: "Development Studies", ey: "2015" }],
    skills: ["Strategic Leadership", "Corporate Governance", "Program Planning", "Financial Management"],
  },
  {
    employeeId: "BCF-PTE-2026-0002", fullName: "Joe Ansumana Conteh", gender: "Male", dob: "1990-08-20",
    phone: "+232 78 234567", email: "joe.conteh@bcf-sl.org", marital: "Married", children: "1",
    nin: "SL19900820002", nassit: "N-900820-002", address: "22 Campbell Street, Freetown",
    department: "Human Resources Management Department", title: "Human Resources Director",
    unit: "Human Resources Operations", mgmtLevel: "Top Management", classification: "Permanent",
    jobLevel: "Director", empDate: "2026-01-15", reportsTo: "Albert Joseph Bandama",
    bankName: "Rokel Commercial Bank", accNo: "00200234567890", bban: "SL020020023456789012",
    payBasic: "18000", username: "jconteh",
    education: [{ inst: "Njala University", qual: "Bachelor's Degree", prog: "Human Resource Management", ey: "2013" }],
    skills: ["HR Strategy", "Talent Acquisition", "Labour Law", "Performance Management"],
  },
  {
    employeeId: "BCF-EMP-2026-0003", fullName: "Mariama Bangura", gender: "Female", dob: "1992-11-05",
    phone: "+232 77 345678", email: "mariama.bangura@bcf-sl.org", marital: "Single", children: "0",
    nin: "SL19921105003", nassit: "N-921105-003", address: "8 Pademba Road, Freetown",
    department: "Finance Department", title: "Finance Director", unit: "Treasury & Accounts",
    mgmtLevel: "Top Management", classification: "Permanent", jobLevel: "Director", empDate: "2026-02-01",
    reportsTo: "Albert Joseph Bandama", bankName: "Sierra Leone Commercial Bank", accNo: "00300345678901",
    bban: "SL010030034567890123", payBasic: "18000", username: "mbangura",
    education: [{ inst: "IPAM, University of Sierra Leone", qual: "Master's Degree", prog: "Finance & Accounting", ey: "2016" }],
    skills: ["Financial Reporting", "IFRS Compliance", "Auditing", "Budget Allocation"],
  },
  {
    employeeId: "BCF-SL-1002", fullName: "Dr. Sorie Sesay", gender: "Male", dob: "1982-03-18",
    phone: "+232 78 441200", email: "s.sesay@bcf-sl.org", marital: "Married", children: "3",
    nin: "SL19820318004", nassit: "N-820318-004", address: "5 Kingharman Road, Freetown",
    department: "Human Resources Management Department", title: "Director of Human Resources",
    unit: "Organisational Development", mgmtLevel: "Top Management", classification: "Permanent",
    jobLevel: "Director", empDate: "2026-01-10", reportsTo: "Albert Joseph Bandama",
    bankName: "Guaranty Trust Bank SL", accNo: "01100441200555", bban: "SL030110044120055501",
    payBasic: "18000", username: "ssesay",
    education: [{ inst: "Fourah Bay College (FBC)", qual: "PhD", prog: "Organisational Psychology", ey: "2012" }],
    skills: ["Organisational Development", "Policy Design", "Training & Development"],
  },
  {
    employeeId: "BCF-SL-1005", fullName: "Aminata Turay", gender: "Female", dob: "1987-07-22",
    phone: "+232 79 552119", email: "a.turay@bcf-sl.org", marital: "Married", children: "2",
    nin: "SL19870722005", nassit: "N-870722-005", address: "31 Siaka Stevens Street, Freetown",
    department: "Finance Department", title: "Director of Financial Operations", unit: "Financial Operations",
    mgmtLevel: "Top Management", classification: "Permanent", jobLevel: "Director", empDate: "2026-02-15",
    reportsTo: "Mariama Bangura", bankName: "Ecobank Sierra Leone", accNo: "02200552119000",
    bban: "SL040220055211900001", payBasic: "17000", username: "aturay",
    education: [{ inst: "Njala University", qual: "Master's Degree", prog: "Accounting", ey: "2014" }],
    skills: ["Payroll Management", "Treasury", "Cash Flow Forecasting"],
  },
  {
    employeeId: "BCF-EMP-2027-0001", fullName: "Sahr Emmanuel Bangura", gender: "Male", dob: "1995-01-30",
    phone: "+232 76 456789", email: "sahr.bangura@bcf.sl", marital: "Single", children: "0",
    nin: "SL19950130006", nassit: "N-950130-006", address: "12 Hill Station, Freetown",
    department: "Programs Department", title: "Programme Officer", unit: "Community Health",
    mgmtLevel: "Operational", classification: "Permanent", jobLevel: "Officer", empDate: "2027-01-05",
    reportsTo: "Fatima Turay", bankName: "Rokel Commercial Bank", accNo: "00200456789012",
    bban: "SL020020045678901201", payBasic: "8500", username: "sbangura",
    education: [{ inst: "University of Makeni (UNIMAK)", qual: "Bachelor's Degree", prog: "Public Health", ey: "2018" }],
    skills: ["M&E", "Community Mobilisation", "Report Writing"],
  },
  {
    employeeId: "BCF-EMP-2027-0002", fullName: "Aminata Sesay", gender: "Female", dob: "1996-06-14",
    phone: "+232 78 654321", email: "aminata.sesay@bcf.sl", marital: "Single", children: "0",
    nin: "SL19960614007", nassit: "N-960614-007", address: "4 Lumley Beach Road, Freetown",
    department: "ICT Department", title: "ICT Officer", unit: "Systems & Infrastructure",
    mgmtLevel: "Operational", classification: "Permanent", jobLevel: "Officer", empDate: "2027-01-12",
    reportsTo: "Ibrahim Koroma", bankName: "Sierra Leone Commercial Bank", accNo: "00300654321000",
    bban: "SL010030065432100001", payBasic: "8500", username: "asesay",
    education: [{ inst: "Limkokwing University of Creative Technology", qual: "Bachelor's Degree", prog: "Information Technology", ey: "2019" }],
    skills: ["Networking", "System Administration", "Cybersecurity"],
  },
  {
    employeeId: "BCF-EMP-2027-0003", fullName: "Mohamed Kamara", gender: "Male", dob: "1993-09-09",
    phone: "+232 77 987654", email: "m.kamara@bcf.sl", marital: "Married", children: "1",
    nin: "SL19930909008", nassit: "N-930909-008", address: "19 Circular Road, Freetown",
    department: "Finance Department", title: "Finance Officer", unit: "Treasury & Accounts",
    mgmtLevel: "Operational", classification: "Permanent", jobLevel: "Officer", empDate: "2027-01-20",
    reportsTo: "Aminata Turay", bankName: "Ecobank Sierra Leone", accNo: "02200987654000",
    bban: "SL040220098765400001", payBasic: "9000", username: "mkamara",
    education: [{ inst: "IPAM, University of Sierra Leone", qual: "Bachelor's Degree", prog: "Banking & Finance", ey: "2016" }],
    skills: ["Bookkeeping", "Reconciliation", "QuickBooks"],
  },
  {
    employeeId: "BCF-EMP-2027-0004", fullName: "Fatima Turay", gender: "Female", dob: "1985-12-02",
    phone: "+232 88 112233", email: "f.turay@bcf.sl", marital: "Married", children: "2",
    nin: "SL19851202009", nassit: "N-851202-009", address: "7 Spur Road, Freetown",
    department: "Programs Department", title: "Programmes Manager", unit: "Programme Management",
    mgmtLevel: "Middle Management", classification: "Permanent", jobLevel: "Manager", empDate: "2026-03-01",
    reportsTo: "Albert Joseph Bandama", bankName: "Guaranty Trust Bank SL", accNo: "01100112233000",
    bban: "SL030110011223300001", payBasic: "14000", username: "fturay",
    education: [{ inst: "Fourah Bay College (FBC)", qual: "Master's Degree", prog: "Project Management", ey: "2011" }],
    skills: ["Programme Design", "Donor Reporting", "Team Leadership"],
  },
  {
    employeeId: "BCF-EMP-2026-0010", fullName: "Ibrahim Koroma", gender: "Male", dob: "1986-05-25",
    phone: "+232 76 778899", email: "i.koroma@bcf-sl.org", marital: "Married", children: "2",
    nin: "SL19860525010", nassit: "N-860525-010", address: "2 Regent Road, Freetown",
    department: "ICT Department", title: "IT Director", unit: "Systems & Infrastructure",
    mgmtLevel: "Top Management", classification: "Permanent", jobLevel: "Director", empDate: "2026-02-10",
    reportsTo: "Albert Joseph Bandama", bankName: "Sierra Leone Commercial Bank", accNo: "00300778899000",
    bban: "SL010030077889900001", payBasic: "17000", username: "ikoroma",
    education: [{ inst: "Milton Margai Technical University (MMTU)", qual: "Master's Degree", prog: "Computer Science", ey: "2013" }],
    skills: ["IT Strategy", "Cloud Infrastructure", "Data Protection"],
  },
  {
    employeeId: "BCF-FTC-2026-0011", fullName: "Hawa Kanu", gender: "Female", dob: "1994-02-17",
    phone: "+232 79 334455", email: "h.kanu@bcf-sl.org", marital: "Single", children: "0",
    nin: "SL19940217011", nassit: "N-940217-011", address: "10 Bo Road, Bo",
    department: "Procurement Department", title: "Procurement Officer", unit: "Sourcing & Contracts",
    mgmtLevel: "Operational", classification: "Fixed-Term Contract", jobLevel: "Officer", empDate: "2026-04-01",
    conStart: "2026-04-01", conEnd: "2027-03-31", reportsTo: "Albert Joseph Bandama",
    bankName: "Rokel Commercial Bank", accNo: "00200334455000", bban: "SL020020033445500001",
    payBasic: "8000", username: "hkanu",
    education: [{ inst: "Njala University", qual: "Bachelor's Degree", prog: "Procurement & Supply Chain", ey: "2017" }],
    skills: ["Tendering", "Vendor Management", "Contract Negotiation"],
  },
  {
    employeeId: "VLJAN-2026-1-0012", fullName: "Musa Jalloh", gender: "Male", dob: "2000-10-10",
    phone: "+232 77 223344", email: "m.jalloh@bcf-sl.org", marital: "Single", children: "0",
    nin: "SL20001010012", nassit: "", address: "45 Kenema Highway, Kenema",
    department: "Programs Department", title: "Community Volunteer", unit: "Community Health",
    mgmtLevel: "Operational", classification: "Volunteer", jobLevel: "Officer", empDate: "2026-05-01",
    reportsTo: "Fatima Turay", bankName: "", accNo: "", bban: "", payBasic: "0", username: "mjalloh",
    education: [{ inst: "Eastern Technical University (ETU)", qual: "Diploma", prog: "Social Work", ey: "2022" }],
    skills: ["Community Outreach", "First Aid"],
  },
].map((e) => ({
  ...e,
  id: e.employeeId,
  name: e.fullName,
  dept: e.department,
  nationality: "Sierra Leonean",
  status: "Active",
  workLoc: e.address.includes("Bo") ? "Bo Regional Office" : e.address.includes("Kenema") ? "Kenema Field Office" : "Freetown Headquarters",
  workEmail: e.email,
  workPhone: e.phone,
  employmentDate: e.empDate,
  registrationDate: e.empDate,
  probStart: e.empDate,
  disciplinaryStatus: "Clean Record",
  contractStanding: "Active - Good Standing",
  createdAt: NOW,
}));

// ─── System user accounts (RBAC) ────────────────────────────────────────────
const ROLE_FOR = (e) => {
  const t = e.title.toLowerCase();
  if (t.includes("ceo")) return ["Super Admin", "Level 1 — Super Administration", "Full System Control"];
  if (t.includes("human resources")) return ["HRM Director", "Departmental / Executive", "HR & People Operations"];
  if (t.includes("financ") && t.includes("director")) return ["Finance Director", "Departmental / Executive", "Financial Management"];
  if (t.includes("it director")) return ["IT Director", "Departmental / Technical", "Systems & Infrastructure"];
  if (t.includes("manager")) return ["Unit Manager", "Department / Unit", "Operational Unit Oversight"];
  if (e.classification === "Volunteer") return ["Volunteer", "Restricted", "Assigned Project Fieldwork"];
  return ["Officer", "Data Entry / Operational", "Frontline Operations"];
};
const user_accounts = employees.map((e, i) => {
  const [role, accessLevel, permissionGroup] = ROLE_FOR(e);
  return {
    userId: `USR-BCF-${String(i + 1).padStart(4, "0")}`,
    employeeId: e.employeeId, fullName: e.fullName, department: e.department, position: e.title,
    employmentType: e.classification, email: e.email, username: e.username,
    role, accessLevel, permissionGroup, status: "ACTIVE",
    createdDate: "01/01/2026", lastLogin: "Never", lastActivity: "Seeded",
    createdAt: NOW,
  };
});

// ─── Learning (LMS) ─────────────────────────────────────────────────────────
const learning_accounts = employees.map((e, i) => ({
  accountId: `ACC-${String(i).padStart(3, "0")}`,
  employeeId: e.employeeId, employeeName: e.fullName, employeePhone: e.phone, employeeEmail: e.email,
  username: e.username, password: "Password123!", department: e.department, position: e.title,
  supervisor: e.reportsTo, isActive: true,
  role: e.title.includes("CEO") ? "admin" : "staff",
  quotaTier: e.jobLevel === "Executive" ? 4 : e.jobLevel === "Director" ? 3 : e.jobLevel === "Manager" ? 3 : 2,
  createdAt: NOW,
}));

const learning_semesters = [
  { id: "SEM-2026-1", name: "Semester 1 (Jan – Jun 2026)", active: false, maxSlots: 2, status: "Archived" },
  { id: "SEM-2026-2", name: "Semester 2 (Jul – Dec 2026)", active: true, maxSlots: 2, status: "Active" },
  { id: "SEM-2027-1", name: "Semester 1 (Jan – Jun 2027)", active: false, maxSlots: 2, status: "Upcoming" },
];

const learning_vendors = [
  { id: "VND-001", name: "Coursera for Business", type: "Online", website: "https://www.coursera.org", status: "Active" },
  { id: "VND-002", name: "IPAM Executive Education", type: "In-Person", website: "https://ipam.usl.edu.sl", status: "Active" },
  { id: "VND-003", name: "LinkedIn Learning", type: "Online", website: "https://www.linkedin.com/learning", status: "Active" },
  { id: "VND-004", name: "Njala University CPD Centre", type: "Blended", website: "https://njala.edu.sl", status: "Active" },
];

const learning_courses = [
  { id: "CRS-001", title: "Project Management Professional (PMP) Prep", vendorId: "VND-001", category: "Management", durationWeeks: 8, costNLe: 4500, level: "Advanced" },
  { id: "CRS-002", title: "Financial Management for NGOs", vendorId: "VND-002", category: "Finance", durationWeeks: 6, costNLe: 3200, level: "Intermediate" },
  { id: "CRS-003", title: "Monitoring & Evaluation Fundamentals", vendorId: "VND-004", category: "Programmes", durationWeeks: 4, costNLe: 1800, level: "Beginner" },
  { id: "CRS-004", title: "Cybersecurity Essentials", vendorId: "VND-003", category: "ICT", durationWeeks: 5, costNLe: 1500, level: "Intermediate" },
  { id: "CRS-005", title: "Strategic HR Leadership", vendorId: "VND-002", category: "Human Resources", durationWeeks: 6, costNLe: 3500, level: "Advanced" },
  { id: "CRS-006", title: "Procurement & Supply Chain Ethics", vendorId: "VND-004", category: "Procurement", durationWeeks: 3, costNLe: 1200, level: "Beginner" },
  { id: "CRS-007", title: "Data Analysis with Excel & Power BI", vendorId: "VND-003", category: "ICT", durationWeeks: 4, costNLe: 1400, level: "Intermediate" },
  { id: "CRS-008", title: "Safeguarding & Child Protection", vendorId: "VND-001", category: "Compliance", durationWeeks: 2, costNLe: 600, level: "Beginner" },
];

const learning_enrollments = [
  { id: "ENR-001", accountId: "ACC-005", employeeId: "BCF-EMP-2027-0001", courseId: "CRS-003", semesterId: "SEM-2026-2", status: "In Progress", progress: 60, grade: null },
  { id: "ENR-002", accountId: "ACC-006", employeeId: "BCF-EMP-2027-0002", courseId: "CRS-004", semesterId: "SEM-2026-2", status: "In Progress", progress: 35, grade: null },
  { id: "ENR-003", accountId: "ACC-007", employeeId: "BCF-EMP-2027-0003", courseId: "CRS-002", semesterId: "SEM-2026-2", status: "Completed", progress: 100, grade: "A" },
  { id: "ENR-004", accountId: "ACC-008", employeeId: "BCF-EMP-2027-0004", courseId: "CRS-001", semesterId: "SEM-2026-2", status: "In Progress", progress: 75, grade: null },
  { id: "ENR-005", accountId: "ACC-001", employeeId: "BCF-PTE-2026-0002", courseId: "CRS-005", semesterId: "SEM-2026-1", status: "Completed", progress: 100, grade: "A-" },
  { id: "ENR-006", accountId: "ACC-010", employeeId: "BCF-FTC-2026-0011", courseId: "CRS-006", semesterId: "SEM-2026-2", status: "Enrolled", progress: 0, grade: null },
].map((x) => ({ ...x, enrolledAt: NOW }));

// ─── Staff loans ────────────────────────────────────────────────────────────
const staff_loans = [
  { loanId: "LOAN-BCF-2026-001", employeeId: "BCF-EMP-2027-0001", employeeName: "Sahr Emmanuel Bangura", purpose: "School Fees", totalPrincipal: 10000, monthlyDeduction: 1000, balanceRemaining: 7000, monthsPaid: 3, totalMonths: 10, status: "ACTIVE", stage: "Repayment" },
  { loanId: "LOAN-BCF-2026-002", employeeId: "BCF-EMP-2027-0003", employeeName: "Mohamed Kamara", purpose: "Medical Emergency", totalPrincipal: 6000, monthlyDeduction: 1000, balanceRemaining: 6000, monthsPaid: 0, totalMonths: 6, status: "PENDING", stage: "HR Approval" },
  { loanId: "LOAN-BCF-2026-003", employeeId: "BCF-EMP-2027-0002", employeeName: "Aminata Sesay", purpose: "Housing Rent", totalPrincipal: 12000, monthlyDeduction: 1000, balanceRemaining: 12000, monthsPaid: 0, totalMonths: 12, status: "PENDING", stage: "Finance Approval" },
  { loanId: "LOAN-BCF-2026-004", employeeId: "BCF-FTC-2026-0011", employeeName: "Hawa Kanu", purpose: "Transport", totalPrincipal: 4000, monthlyDeduction: 500, balanceRemaining: 0, monthsPaid: 8, totalMonths: 8, status: "CLOSED", stage: "Fully Repaid" },
].map((x) => ({ ...x, id: x.loanId, appliedAt: NOW }));

// ─── Leave ──────────────────────────────────────────────────────────────────
const leave_requests = [
  { id: "LV-2026-001", employeeId: "BCF-EMP-2027-0001", employeeName: "Sahr Emmanuel Bangura", type: "Annual Leave", startDate: "2026-11-02", endDate: "2026-11-13", days: 10, status: "Approved", approvedBy: "Joe Ansumana Conteh" },
  { id: "LV-2026-002", employeeId: "BCF-EMP-2027-0002", employeeName: "Aminata Sesay", type: "Sick Leave", startDate: "2026-10-05", endDate: "2026-10-07", days: 3, status: "Approved", approvedBy: "Joe Ansumana Conteh" },
  { id: "LV-2026-003", employeeId: "BCF-EMP-2027-0004", employeeName: "Fatima Turay", type: "Maternity Leave", startDate: "2026-12-01", endDate: "2027-02-28", days: 90, status: "Pending HR Review", approvedBy: null },
  { id: "LV-2026-004", employeeId: "BCF-EMP-2027-0003", employeeName: "Mohamed Kamara", type: "Compassionate Leave", startDate: "2026-10-20", endDate: "2026-10-24", days: 5, status: "Pending HR Review", approvedBy: null },
].map((x) => ({ ...x, appliedAt: NOW }));

// ─── Discipline ─────────────────────────────────────────────────────────────
const discipline_cases = [
  { id: "DC-2026-001", employeeId: "BCF-EMP-2027-0003", employeeName: "Mohamed Kamara", offence: "Repeated Lateness", category: "Minor", status: "Closed", outcome: "Verbal Warning", openedAt: "2026-06-10", closedAt: "2026-06-20" },
  { id: "DC-2026-002", employeeId: "VLJAN-2026-1-0012", employeeName: "Musa Jalloh", offence: "Unauthorised Absence", category: "Minor", status: "Under Investigation", outcome: null, openedAt: "2026-09-15", closedAt: null },
];

// ─── Donors & donations ─────────────────────────────────────────────────────
const donors = [
  { id: "DNR-001", name: "Global Giving Fund", category: "Institutional", country: "United Kingdom", contact: "grants@globalgiving.org", totalGiven: 250000, status: "Active" },
  { id: "DNR-002", name: "West Africa Development Trust", category: "Foundation", country: "Sierra Leone", contact: "info@wadt.org", totalGiven: 180000, status: "Active" },
  { id: "DNR-003", name: "Irish Aid Partnership", category: "Bilateral", country: "Ireland", contact: "sierraleone@irishaid.ie", totalGiven: 420000, status: "Active" },
  { id: "DNR-004", name: "Dr. Kadie Sesay-Williams", category: "Individual", country: "United States", contact: "k.sesaywilliams@mail.com", totalGiven: 15000, status: "Active" },
  { id: "DNR-005", name: "Rotary Club of Freetown", category: "Community", country: "Sierra Leone", contact: "rotary.freetown@gmail.com", totalGiven: 32000, status: "Lapsed" },
];

const donations = [
  { id: "DON-2026-001", donorId: "DNR-001", amount: 100000, currency: "USD", date: "2026-02-14", programId: "PRG-001", method: "Bank Transfer", receiptNo: "RCT-0001" },
  { id: "DON-2026-002", donorId: "DNR-003", amount: 200000, currency: "EUR", date: "2026-03-30", programId: "PRG-002", method: "Bank Transfer", receiptNo: "RCT-0002" },
  { id: "DON-2026-003", donorId: "DNR-002", amount: 80000, currency: "USD", date: "2026-05-11", programId: "PRG-003", method: "Bank Transfer", receiptNo: "RCT-0003" },
  { id: "DON-2026-004", donorId: "DNR-004", amount: 5000, currency: "USD", date: "2026-07-01", programId: "PRG-001", method: "Card", receiptNo: "RCT-0004" },
  { id: "DON-2026-005", donorId: "DNR-005", amount: 12000, currency: "NLe", date: "2026-08-19", programId: "PRG-004", method: "Mobile Money", receiptNo: "RCT-0005" },
];

// ─── Programmes & beneficiaries ─────────────────────────────────────────────
const programs = [
  { id: "PRG-001", name: "Maternal & Child Health Outreach", district: "Bo", budget: 150000, spent: 92000, manager: "Fatima Turay", status: "Active", startDate: "2026-01-15", endDate: "2027-01-14" },
  { id: "PRG-002", name: "Girls' Education Scholarship Fund", district: "Western Area Urban", budget: 220000, spent: 140000, manager: "Fatima Turay", status: "Active", startDate: "2026-02-01", endDate: "2028-01-31" },
  { id: "PRG-003", name: "Clean Water & Sanitation (WASH)", district: "Kenema", budget: 95000, spent: 30000, manager: "Sahr Emmanuel Bangura", status: "Active", startDate: "2026-04-01", endDate: "2027-03-31" },
  { id: "PRG-004", name: "Youth Skills & Livelihoods", district: "Port Loko", budget: 60000, spent: 60000, manager: "Sahr Emmanuel Bangura", status: "Completed", startDate: "2025-06-01", endDate: "2026-05-31" },
];

const beneficiaries = [
  { id: "BEN-0001", name: "Isatu Kamara", gender: "Female", age: 27, district: "Bo", programId: "PRG-001", status: "Active" },
  { id: "BEN-0002", name: "Fatmata Conteh", gender: "Female", age: 15, district: "Western Area Urban", programId: "PRG-002", status: "Active" },
  { id: "BEN-0003", name: "Mariatu Bangura", gender: "Female", age: 16, district: "Western Area Urban", programId: "PRG-002", status: "Active" },
  { id: "BEN-0004", name: "Tombo Village Community", gender: "Mixed", age: null, district: "Kenema", programId: "PRG-003", households: 140, status: "Active" },
  { id: "BEN-0005", name: "Alhaji Sesay", gender: "Male", age: 22, district: "Port Loko", programId: "PRG-004", status: "Graduated" },
];

// ─── Procurement ────────────────────────────────────────────────────────────
const procurement = [
  { id: "SUP-001", docType: "Supplier", name: "Freetown Office Supplies Ltd", category: "Stationery", rating: 4.5, status: "Approved" },
  { id: "SUP-002", docType: "Supplier", name: "SL Medical Distributors", category: "Medical Supplies", rating: 4.2, status: "Approved" },
  { id: "SUP-003", docType: "Supplier", name: "Kenema Borehole Drilling Co.", category: "Construction", rating: 3.9, status: "Approved" },
  { id: "PR-2026-001", docType: "Purchase Requisition", requestedBy: "Fatima Turay", department: "Programs Department", description: "Antenatal kits (200 units)", amount: 18000, status: "Approved" },
  { id: "PR-2026-002", docType: "Purchase Requisition", requestedBy: "Aminata Sesay", department: "ICT Department", description: "Laptops x5", amount: 45000, status: "Pending" },
  { id: "PO-2026-001", docType: "Purchase Order", prId: "PR-2026-001", supplierId: "SUP-002", amount: 17500, status: "Issued" },
  { id: "GRN-2026-001", docType: "Goods Received Note", poId: "PO-2026-001", receivedBy: "Hawa Kanu", receivedDate: "2026-06-12", status: "Complete" },
].map((x) => ({ ...x, createdAt: NOW }));

// ─── Partnerships & deal pipeline ───────────────────────────────────────────
const partnerships = [
  { id: "PTN-001", name: "Ministry of Health & Sanitation", type: "Government", focus: "Health", status: "Active", since: "2025-09-01" },
  { id: "PTN-002", name: "UNICEF Sierra Leone", type: "Multilateral", focus: "Education & Child Protection", status: "Active", since: "2026-01-20" },
  { id: "PTN-003", name: "Njala University", type: "Academic", focus: "Research & Training", status: "Active", since: "2026-03-05" },
];

const deal_pipeline = [
  { id: "DEAL-001", partner: "USAID Sierra Leone", value: 500000, stage: "Proposal Submitted", probability: 40, owner: "Albert Joseph Bandama" },
  { id: "DEAL-002", partner: "World Food Programme", value: 120000, stage: "Negotiation", probability: 65, owner: "Fatima Turay" },
  { id: "DEAL-003", partner: "Orange Sierra Leone Foundation", value: 45000, stage: "Prospecting", probability: 20, owner: "Albert Joseph Bandama" },
];

// ─── Finance ────────────────────────────────────────────────────────────────
const financial_ledger = [
  { id: "GL-2026-0001", date: "2026-02-14", type: "Inflow", account: "Donor Income", reference: "DON-2026-001", amount: 100000, currency: "USD", description: "Global Giving Fund grant tranche 1" },
  { id: "GL-2026-0002", date: "2026-03-30", type: "Inflow", account: "Donor Income", reference: "DON-2026-002", amount: 200000, currency: "EUR", description: "Irish Aid education grant" },
  { id: "GL-2026-0003", date: "2026-06-12", type: "Outflow", account: "Programme Supplies", reference: "PO-2026-001", amount: 17500, currency: "NLe", description: "Antenatal kits — SL Medical Distributors" },
  { id: "GL-2026-0004", date: "2026-09-30", type: "Outflow", account: "Salaries & Wages", reference: "PAY-2026-09", amount: 168500, currency: "NLe", description: "September 2026 payroll" },
];

const payroll = employees
  .filter((e) => Number(e.payBasic) > 0)
  .map((e) => {
    const basic = Number(e.payBasic);
    const nassitEe = Math.round(basic * 0.05);
    const paye = basic > 6000 ? Math.round((basic - 6000) * 0.25) : 0;
    return {
      id: `PAY-2026-09-${e.employeeId}`, period: "2026-09", employeeId: e.employeeId, employeeName: e.fullName,
      basic, nassitEmployee: nassitEe, nassitEmployer: Math.round(basic * 0.1), paye,
      netPay: basic - nassitEe - paye, currency: "NLe", status: "Paid",
    };
  });

// ─── Audit & settings ───────────────────────────────────────────────────────
const audit_logs = [
  { auditId: "AUD-000001", userId: "USR-BCF-0001", action: "Database Seeded", module: "System", dateTime: NOW, result: "Successful", newValue: "Initial institutional dataset loaded" },
];

const system_settings = [
  {
    key: "hub_config",
    institution: "Bandama Charity Foundation Sierra Leone (BCF-SL)",
    motto: "Save Lives",
    slogan: "Empowering Communities Through Services",
    currency: "NLe",
    academicYear: "2026/2027",
    departments: DEPARTMENTS,
    databaseConnected: true,
    seededAt: NOW,
  },
];

// ════════════════════════════════════════════════════════════════════════════
//  COLLECTION → (data, unique key)
// ════════════════════════════════════════════════════════════════════════════
const SEED = [
  ["employees", employees, "employeeId"],
  ["user_accounts", user_accounts, "userId"],
  ["learning_accounts", learning_accounts, "accountId"],
  ["learning_semesters", learning_semesters, "id"],
  ["learning_vendors", learning_vendors, "id"],
  ["learning_courses", learning_courses, "id"],
  ["learning_enrollments", learning_enrollments, "id"],
  ["staff_loans", staff_loans, "loanId"],
  ["leave_requests", leave_requests, "id"],
  ["discipline_cases", discipline_cases, "id"],
  ["donors", donors, "id"],
  ["donations", donations, "id"],
  ["programs", programs, "id"],
  ["beneficiaries", beneficiaries, "id"],
  ["procurement", procurement, "id"],
  ["partnerships", partnerships, "id"],
  ["deal_pipeline", deal_pipeline, "id"],
  ["financial_ledger", financial_ledger, "id"],
  ["payroll", payroll, "id"],
  ["audit_logs", audit_logs, "auditId"],
  ["system_settings", system_settings, "key"],
];

// ════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n🌱 BCF-SL seed → database "${DB_NAME}"${RESET ? " (RESET mode)" : ""}\n`);
  const client = await connect();
  const db = client.db(DB_NAME);
  await db.command({ ping: 1 });
  console.log("✓ Connected to MongoDB Atlas\n");

  let total = 0;
  for (const [name, docs, key] of SEED) {
    const col = db.collection(name);
    if (RESET) await col.deleteMany({});

    const ops = docs.map((doc) => ({
      updateOne: {
        filter: { [key]: doc[key] },
        update: { $set: { ...doc, updatedAt: NOW } },
        upsert: true,
      },
    }));
    const res = await col.bulkWrite(ops, { ordered: false });
    await col.createIndex({ [key]: 1 }, { unique: true }).catch(() => {});

    total += docs.length;
    console.log(
      `  ✓ ${name.padEnd(22)} ${String(docs.length).padStart(3)} docs  ` +
        `(+${res.upsertedCount} new, ${res.modifiedCount} updated)`
    );
  }

  console.log(`\n✅ Seed complete — ${total} documents across ${SEED.length} collections.\n`);
  await client.close();
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message || err);
  process.exit(1);
});
