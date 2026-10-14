import { getCollection, COLLECTIONS } from "./mongodb";
import {
  AccessRequest,
  AccessRequestStep,
  AccessRequestItem,
  AccessGrant,
  AccessNotification,
  AccessRight,
  ApprovalStage,
  AccessSettings,
} from "./accessTypes";
import { ensureAccessCatalogueAndSettings } from "./accessCatalogueSeed";
import { normalizeRole, RoleCode, SEED_TEST_USERS, ACCESS_MATRIX } from "./permissions";
import { logSecurityAudit } from "./contractSecurity";

export interface RequestActorContext {
  userId: string;
  username: string;
  email: string;
  name: string;
  role: string;
  roleCode: RoleCode;
  department?: string;
  position?: string;
  employeeId?: string;
  staffId?: string;
}

export const OFFICIAL_INSTITUTIONAL_DEPARTMENTS: string[] = [
  "Finance Department",
  "Health & Safety Department",
  "Human Resources Management Department",
  "Information Technology (IT) Department",
  "Internal Risk & Audits Department",
  "Legal & Communication Department",
  "Procurement Department",
  "Programs Department",
  "Executive Management",
];

/**
 * Maps any raw or legacy department string to its official institutional department name.
 */
export function canonicalizeDepartmentName(dept?: string | null): string {
  if (!dept) return OFFICIAL_INSTITUTIONAL_DEPARTMENTS[0];
  const dNorm = normalizeDepartmentName(dept);
  for (const official of OFFICIAL_INSTITUTIONAL_DEPARTMENTS) {
    const oNorm = normalizeDepartmentName(official);
    if (dNorm === oNorm || dNorm.includes(oNorm) || oNorm.includes(dNorm)) {
      return official;
    }
  }
  // Keyword-based matching
  if (dNorm.includes("health") || dNorm.includes("safety")) return "Health & Safety Department";
  if (dNorm.includes("legal") || dNorm.includes("communication")) return "Legal & Communication Department";
  if (dNorm.includes("risk") || dNorm.includes("audit")) return "Internal Risk & Audits Department";
  if (dNorm.includes("procure") || dNorm.includes("logistics")) return "Procurement Department";
  if (dNorm.includes("it") || dNorm.includes("ict") || dNorm.includes("tech") || dNorm.includes("information")) return "Information Technology (IT) Department";
  if (dNorm.includes("hr") || dNorm.includes("human")) return "Human Resources Management Department";
  if (dNorm.includes("finance") || dNorm.includes("fin")) return "Finance Department";
  if (dNorm.includes("program") || dNorm.includes("prog")) return "Programs Department";
  if (dNorm.includes("executive") || dNorm.includes("ceo") || dNorm.includes("admin")) return "Executive Management";

  return dept;
}

/**
 * Normalizes department string for robust comparison
 * e.g. "Programs Department" vs "Programs"
 */
export function normalizeDepartmentName(dept?: string | null): string {
  if (!dept) return "";
  return dept
    .toLowerCase()
    .replace(/\bdepartment\b/g, "")
    .replace(/\bdept\b/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

/**
 * Resolves full profile for user, querying DB employees or SEED_TEST_USERS
 */
export async function resolveUserProfile(actor: RequestActorContext): Promise<{
  name: string;
  email: string;
  username: string;
  role: string;
  roleCode: RoleCode;
  department: string;
  position: string;
  staffId: string;
}> {
  const cleanEmail = (actor.email || "").toLowerCase().trim();
  const cleanUser = (actor.username || "").toLowerCase().trim();

  // Try DB
  try {
    const col = await getCollection(COLLECTIONS.EMPLOYEES);
    const emp = await col.findOne({
      $or: [
        { email: { $regex: `^${cleanEmail}$`, $options: "i" } },
        { username: { $regex: `^${cleanUser}$`, $options: "i" } },
      ],
    });
    if (emp) {
      return {
        name: emp.fullName || emp.name || actor.name || "Staff Member",
        email: emp.email || actor.email,
        username: emp.username || actor.username,
        role: emp.role || actor.role,
        roleCode: normalizeRole(emp.role || actor.role, emp.username, emp.email),
        department: canonicalizeDepartmentName(emp.department || actor.department || "General Administration"),
        position: emp.position || actor.position || "Staff",
        staffId: emp.employeeId || emp.staffId || actor.employeeId || "BCF-ST-001",
      };
    }
  } catch (e) {
    // DB fallback
  }

  // Check seed test users by username or email
  const seedMatch = SEED_TEST_USERS.find(
    (u) =>
      (cleanUser && u.username.toLowerCase() === cleanUser) ||
      (cleanEmail && u.email.toLowerCase() === cleanEmail)
  );

  if (seedMatch) {
    return {
      name: seedMatch.fullName,
      email: seedMatch.email,
      username: seedMatch.username,
      role: seedMatch.role,
      roleCode: normalizeRole(seedMatch.role, seedMatch.username, seedMatch.email),
      department: canonicalizeDepartmentName(actor.department || seedMatch.department),
      position: seedMatch.position,
      staffId: (seedMatch as any).employeeId || `BCF-${seedMatch.role}-001`,
    };
  }

  // Check role-based seed match only if no custom username/email was supplied
  if (!cleanUser && !cleanEmail) {
    const roleMatch = SEED_TEST_USERS.find((u) => u.role === actor.roleCode);
    if (roleMatch) {
      return {
        name: roleMatch.fullName,
        email: roleMatch.email,
        username: roleMatch.username,
        role: roleMatch.role,
        roleCode: normalizeRole(roleMatch.role, roleMatch.username, roleMatch.email),
        department: canonicalizeDepartmentName(actor.department || roleMatch.department),
        position: roleMatch.position,
        staffId: (roleMatch as any).employeeId || `BCF-${roleMatch.role}-001`,
      };
    }
  }

  return {
    name: actor.name || "Staff Member",
    email: actor.email || "staff@bcf-sl.org",
    username: actor.username || "staff_user",
    role: actor.role || "ST",
    roleCode: actor.roleCode || "ST",
    department: canonicalizeDepartmentName(actor.department || "General Administration"),
    position: actor.position || "Staff Officer",
    staffId: actor.employeeId || actor.staffId || "BCF-ST-001",
  };
}

export interface DepartmentDirectorInfo {
  id: string;
  name: string;
  email: string;
  position: string;
  roleCode: RoleCode;
  department: string;
}

export const KNOWN_DEPARTMENTS_AND_DIRECTORS: Record<string, DepartmentDirectorInfo[]> = {
  "Finance Department": [
    {
      id: "BCF-EMP-2026-0003",
      name: "Mariama Bangura",
      email: "mariama.bangura@bcf-sl.org",
      position: "Finance Director",
      roleCode: "FIN",
      department: "Finance Department",
    },
    {
      id: "BCF-FIN-001",
      name: "Mohamed Bangura",
      email: "mbangura@bcf-sl.org",
      position: "Finance Director",
      roleCode: "FIN",
      department: "Finance Department",
    },
    {
      id: "BCF-SL-1005",
      name: "Aminata Turay",
      email: "a.turay@bcf-sl.org",
      position: "Director of Financial Operations",
      roleCode: "FIN",
      department: "Finance Department",
    },
  ],
  "Health & Safety Department": [],
  "Human Resources Management Department": [
    {
      id: "BCF-PTE-2026-0002",
      name: "Joe Ansumana Conteh",
      email: "joe.conteh@bcf-sl.org",
      position: "Human Resources Director",
      roleCode: "HR",
      department: "Human Resources Management Department",
    },
    {
      id: "BCF-HR-001",
      name: "Joseph Conteh",
      email: "jconteh@bcf-sl.org",
      position: "Human Resources Director",
      roleCode: "HR",
      department: "Human Resources Management Department",
    },
    {
      id: "BCF-SL-1002",
      name: "Dr. Sorie Sesay",
      email: "s.sesay@bcf-sl.org",
      position: "Director of Human Resources",
      roleCode: "HR",
      department: "Human Resources Management Department",
    },
  ],
  "Information Technology (IT) Department": [
    {
      id: "BCF-IT-001",
      name: "Augustine Toro",
      email: "atoro@bcf-sl.org",
      position: "IT Director",
      roleCode: "IT",
      department: "Information Technology (IT) Department",
    },
    {
      id: "BCF-EMP-2026-0010",
      name: "Ibrahim Koroma",
      email: "i.koroma@bcf-sl.org",
      position: "IT Director",
      roleCode: "IT",
      department: "Information Technology (IT) Department",
    },
  ],
  "Internal Risk & Audits Department": [
    {
      id: "BCF-IAR-001",
      name: "Samuel Kamara",
      email: "skamara@bcf-sl.org",
      position: "Internal Audit & Risk Director",
      roleCode: "IAR",
      department: "Internal Risk & Audits Department",
    },
  ],
  "Legal & Communication Department": [],
  "Procurement Department": [
    {
      id: "BCF-EMP-2026-10002",
      name: "Alex Koroma",
      email: "alex.koroma@bcf-sl.org",
      position: "Director",
      roleCode: "PRC",
      department: "Procurement Department",
    },
    {
      id: "BCF-PRC-001",
      name: "Hassan Kanu",
      email: "hkanu@bcf-sl.org",
      position: "Procurement Director",
      roleCode: "PRC",
      department: "Procurement Department",
    },
  ],
  "Programs Department": [
    {
      id: "BCF-PRG-001",
      name: "Fatmata Sesay",
      email: "fsesay@bcf-sl.org",
      position: "Programs Director",
      roleCode: "PRG",
      department: "Programs Department",
    },
  ],
  "Executive Management": [
    {
      id: "BCF-PTE-2026-0001",
      name: "Albert Joseph Bandama",
      email: "albertjosephhassanbandama@gmail.com",
      position: "Chief Executive Officer (CEO)",
      roleCode: "CEO",
      department: "Executive Management",
    },
    {
      id: "BCF-CEO-001",
      name: "Dr. Alimamy Koroma",
      email: "ceo@bcf-sl.org",
      position: "Chief Executive Officer (CEO)",
      roleCode: "CEO",
      department: "Executive Management",
    },
  ],
};

export const DEFAULT_DIRECTORS_SEED: DepartmentDirectorInfo[] = [
  {
    id: "BCF-PTE-2026-0001",
    name: "Albert Joseph Bandama",
    email: "albertjosephhassanbandama@gmail.com",
    position: "Chief Executive Officer (CEO)",
    roleCode: "CEO",
    department: "Executive Management",
  },
  {
    id: "BCF-CEO-001",
    name: "Dr. Alimamy Koroma",
    email: "ceo@bcf-sl.org",
    position: "Chief Executive Officer (CEO)",
    roleCode: "CEO",
    department: "Executive Management",
  },
  {
    id: "BCF-PTE-2026-0002",
    name: "Joe Ansumana Conteh",
    email: "joe.conteh@bcf-sl.org",
    position: "Human Resources Director",
    roleCode: "HR",
    department: "Human Resources Management Department",
  },
  {
    id: "BCF-HR-001",
    name: "Joseph Conteh",
    email: "jconteh@bcf-sl.org",
    position: "Human Resources Director",
    roleCode: "HR",
    department: "Human Resources Management Department",
  },
  {
    id: "BCF-SL-1002",
    name: "Dr. Sorie Sesay",
    email: "s.sesay@bcf-sl.org",
    position: "Director of Human Resources",
    roleCode: "HR",
    department: "Human Resources Management Department",
  },
  {
    id: "BCF-EMP-2026-0003",
    name: "Mariama Bangura",
    email: "mariama.bangura@bcf-sl.org",
    position: "Finance Director",
    roleCode: "FIN",
    department: "Finance Department",
  },
  {
    id: "BCF-FIN-001",
    name: "Mohamed Bangura",
    email: "mbangura@bcf-sl.org",
    position: "Finance Director",
    roleCode: "FIN",
    department: "Finance Department",
  },
  {
    id: "BCF-SL-1005",
    name: "Aminata Turay",
    email: "a.turay@bcf-sl.org",
    position: "Director of Financial Operations",
    roleCode: "FIN",
    department: "Finance Department",
  },
  {
    id: "BCF-PRG-001",
    name: "Fatmata Sesay",
    email: "fsesay@bcf-sl.org",
    position: "Programs Director",
    roleCode: "PRG",
    department: "Programs Department",
  },
  {
    id: "BCF-EMP-2026-10002",
    name: "Alex Koroma",
    email: "alex.koroma@bcf-sl.org",
    position: "Director",
    roleCode: "PRC",
    department: "Procurement Department",
  },
  {
    id: "BCF-PRC-001",
    name: "Hassan Kanu",
    email: "hkanu@bcf-sl.org",
    position: "Procurement Director",
    roleCode: "PRC",
    department: "Procurement Department",
  },
  {
    id: "BCF-IT-001",
    name: "Augustine Toro",
    email: "atoro@bcf-sl.org",
    position: "IT Director",
    roleCode: "IT",
    department: "Information Technology (IT) Department",
  },
  {
    id: "BCF-EMP-2026-0010",
    name: "Ibrahim Koroma",
    email: "i.koroma@bcf-sl.org",
    position: "IT Director",
    roleCode: "IT",
    department: "Information Technology (IT) Department",
  },
  {
    id: "BCF-IAR-001",
    name: "Samuel Kamara",
    email: "skamara@bcf-sl.org",
    position: "Internal Audit & Risk Director",
    roleCode: "IAR",
    department: "Internal Risk & Audits Department",
  },
];

/**
 * Queries MongoDB employees collection and combines with known seed directors
 * to return all personnel registered as Directors across the Staff Directory.
 */
export async function getAllStaffDirectoryDirectors(): Promise<DepartmentDirectorInfo[]> {
  const directorsMap = new Map<string, DepartmentDirectorInfo>();

  // 1. Add base seeded directors
  for (const d of DEFAULT_DIRECTORS_SEED) {
    const key = (d.email || d.id).toLowerCase().trim();
    directorsMap.set(key, d);
  }

  // 2. Add KNOWN_DEPARTMENTS_AND_DIRECTORS
  for (const [_, dirs] of Object.entries(KNOWN_DEPARTMENTS_AND_DIRECTORS)) {
    for (const d of dirs) {
      const key = (d.email || d.id).toLowerCase().trim();
      if (!directorsMap.has(key)) {
        directorsMap.set(key, d);
      }
    }
  }

  // 3. Query MongoDB employees collection for any registered staff
  try {
    const col = await getCollection(COLLECTIONS.EMPLOYEES);
    const emps = await col.find({}).toArray();

    for (const emp of emps) {
      const title = (emp.position || emp.title || "").toLowerCase();
      const jobLevel = (emp.jobLevel || "").toLowerCase();
      const mgmtLevel = (emp.mgmtLevel || "").toLowerCase();
      const roleStr = (emp.role || "").toLowerCase();

      const isDirector =
        title.includes("director") ||
        title.includes("chief executive officer") ||
        title.includes("ceo") ||
        jobLevel.includes("director") ||
        jobLevel.includes("executive") ||
        mgmtLevel.includes("director") ||
        mgmtLevel.includes("top management") ||
        roleStr.includes("director") ||
        ["hr", "fin", "prc", "prg", "iar", "it", "ceo", "director"].includes(roleStr);

      if (isDirector) {
        const id = emp.employeeId || emp.id || `EMP-${Date.now()}`;
        const email = emp.email || "";
        const key = (email || id).toLowerCase().trim();

        let dept = emp.department || emp.dept || "General Administration";
        dept = canonicalizeDepartmentName(dept);

        const roleCode = normalizeRole(emp.role, emp.username, emp.email);

        directorsMap.set(key, {
          id,
          name: emp.fullName || emp.name || "Director",
          email: email || `${id.toLowerCase()}@bcf-sl.org`,
          position: emp.position || emp.title || (roleCode === "CEO" ? "Chief Executive Officer (CEO)" : "Department Director"),
          roleCode,
          department: dept,
        });
      }
    }
  } catch (err) {
    console.warn("[getAllStaffDirectoryDirectors] DB read warning:", err);
  }

  return Array.from(directorsMap.values());
}

/**
 * Returns full department directory with directors and complete registered directors list
 */
export async function getDepartmentDirectory(settings?: AccessSettings): Promise<{
  departments: string[];
  departmentDirectors: Record<string, DepartmentDirectorInfo[]>;
  fallbackDirector: DepartmentDirectorInfo;
  allDirectors: DepartmentDirectorInfo[];
}> {
  const allDirectors = await getAllStaffDirectoryDirectors();

  // The official 9 institutional departments in fixed authoritative order
  const departments = [...OFFICIAL_INSTITUTIONAL_DEPARTMENTS];

  // Group directors by department
  const departmentDirectors: Record<string, DepartmentDirectorInfo[]> = {};
  for (const dept of departments) {
    const norm = normalizeDepartmentName(dept);
    const matched = allDirectors.filter(
      (d) => normalizeDepartmentName(canonicalizeDepartmentName(d.department)) === norm
    );
    if (matched.length === 0 && KNOWN_DEPARTMENTS_AND_DIRECTORS[dept]) {
      departmentDirectors[dept] = KNOWN_DEPARTMENTS_AND_DIRECTORS[dept];
    } else {
      departmentDirectors[dept] = matched;
    }
  }

  const fallbackDirector: DepartmentDirectorInfo = {
    id: "BCF-CEO-001",
    name: "Dr. Alimamy Koroma",
    email: "ceo@bcf-sl.org",
    position: "Chief Executive Officer (CEO)",
    roleCode: (settings?.fallbackStage1ApproverRole as RoleCode) || "CEO",
    department: "Executive Management",
  };

  return {
    departments,
    departmentDirectors,
    fallbackDirector,
    allDirectors,
  };
}

/**
 * Finds all directors for a given department, including the full list of registered directors.
 */
export async function findDepartmentDirectors(
  departmentName: string,
  settings: AccessSettings
): Promise<{
  directors: DepartmentDirectorInfo[];
  fallbackDirector: DepartmentDirectorInfo;
  hasNoDirector: boolean;
  allDirectors: DepartmentDirectorInfo[];
}> {
  const allDirs = await getAllStaffDirectoryDirectors();
  const canonicalDept = canonicalizeDepartmentName(departmentName);
  const normDept = normalizeDepartmentName(canonicalDept);

  const fallbackDirector: DepartmentDirectorInfo = {
    id: "BCF-CEO-001",
    name: "Dr. Alimamy Koroma",
    email: "ceo@bcf-sl.org",
    position: "Chief Executive Officer (CEO)",
    roleCode: (settings.fallbackStage1ApproverRole as RoleCode) || "CEO",
    department: "Executive Management",
  };

  const matched = allDirs.filter(
    (d) => normalizeDepartmentName(canonicalizeDepartmentName(d.department)) === normDept
  );

  return {
    directors: matched,
    fallbackDirector,
    hasNoDirector: matched.length === 0,
    allDirectors: allDirs,
  };
}

/**
 * Finds the Department Director for a given department.
 * Kept for backward compatibility.
 */
export async function findDepartmentDirector(
  departmentName: string,
  settings: AccessSettings
): Promise<{
  id: string;
  name: string;
  email: string;
  position: string;
  roleCode: RoleCode;
  department: string;
  isFallback: boolean;
}> {
  const { directors, fallbackDirector, hasNoDirector } = await findDepartmentDirectors(
    departmentName,
    settings
  );

  if (hasNoDirector || directors.length === 0) {
    return {
      ...fallbackDirector,
      isFallback: true,
    };
  }

  return {
    ...directors[0],
    isFallback: false,
  };
}

/**
 * Generates the next sequential request number in format BCF-ACC-YYYY-NNNNNN
 */
export async function generateRequestNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BCF-ACC-${year}-`;
  try {
    const col = await getCollection<AccessRequest>(COLLECTIONS.ACCESS_REQUESTS);
    const count = await col.countDocuments({
      requestNumber: { $regex: `^${prefix}` },
    });
    const nextSeq = (count + 1).toString().padStart(6, "0");
    return `${prefix}${nextSeq}`;
  } catch (err) {
    const randomSeq = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${randomSeq}`;
  }
}

/**
 * Checks if a user already has specific rights for a tab via role matrix or active grants.
 */
export async function getUserExistingTabRights(
  roleCode: RoleCode,
  userEmail: string,
  moduleSlug: string,
  tabId: string
): Promise<AccessRight[]> {
  const existingRights = new Set<AccessRight>();

  // 1. Super Admin has all rights everywhere
  if (roleCode === "SA") {
    return ["Read", "Write", "View", "Upload", "Download"];
  }

  // 2. Role matrix rights
  const modulePerms = ACCESS_MATRIX[moduleSlug];
  if (modulePerms && modulePerms[tabId]) {
    const level = modulePerms[tabId][roleCode] || "-";
    if (level === "F") {
      existingRights.add("Read");
      existingRights.add("View");
      existingRights.add("Write");
      existingRights.add("Upload");
      existingRights.add("Download");
    } else if (level === "OW") {
      existingRights.add("Read");
      existingRights.add("View");
      existingRights.add("Write");
    } else if (level === "V" || level === "O") {
      existingRights.add("Read");
      existingRights.add("View");
    }
  }

  // 3. Active granted permissions in DB
  try {
    const grantsCol = await getCollection<AccessGrant>(COLLECTIONS.ACCESS_GRANTS);
    const grants = await grantsCol
      .find({
        userEmail: userEmail.toLowerCase().trim(),
        moduleSlug,
        tabId,
        status: "Active",
      })
      .toArray();

    const now = new Date().toISOString();
    for (const g of grants) {
      if (g.endDate && g.endDate < now) {
        continue; // Expired
      }
      (g.rightsGranted || []).forEach((r) => existingRights.add(r));
    }
  } catch (e) {}

  return Array.from(existingRights);
}

/**
 * Sends in-app access notifications (and suppresses notification to actor)
 */
export async function sendAccessNotification({
  recipientEmails,
  actorEmail,
  requestId,
  requestNumber,
  title,
  message,
}: {
  recipientEmails: string[];
  actorEmail?: string;
  requestId: string;
  requestNumber: string;
  title: string;
  message: string;
}): Promise<void> {
  const cleanActor = (actorEmail || "").toLowerCase().trim();
  const validRecipients = Array.from(
    new Set(
      recipientEmails
        .map((e) => e.toLowerCase().trim())
        .filter((e) => e.length > 0 && e !== cleanActor)
    )
  );

  if (validRecipients.length === 0) return;

  try {
    const col = await getCollection<AccessNotification>(COLLECTIONS.ACCESS_NOTIFICATIONS);
    const notifs: AccessNotification[] = validRecipients.map((email) => ({
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: email,
      userEmail: email,
      requestId,
      requestNumber,
      title,
      message,
      category: "Access",
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    await col.insertMany(notifs as any);
  } catch (err) {
    console.warn("[sendAccessNotification] Warning:", err);
  }
}

export interface RouteDeterminationResult {
  route: "A" | "B" | "C";
  routeName: string;
  totalStages: number;
  initialStatus: import("./accessTypes").AccessRequestStatus;
  initialStage: ApprovalStage;
  initialApproverRole: string;
  routeNote: string;
}

/**
 * Determines applicant route strictly on the server from the applicant's role in the Staff Directory.
 * - Route A: Staff (3 stages: Dept Director -> IT Director -> Super Admin)
 * - Route B: Directors (2 stages: IT Director -> Super Admin). Executive Management is informed for info only.
 * - Route C: IT Director (1 stage: Super Admin). Nobody may approve their own request.
 */
export function determineApplicantRoute(userProfile: {
  role: string;
  roleCode: RoleCode;
  position?: string;
  department?: string;
}): RouteDeterminationResult {
  const normRole = (userProfile.roleCode || "").toUpperCase();
  const normPos = (userProfile.position || "").toLowerCase();
  const rawRole = (userProfile.role || "").toLowerCase();

  // Route C: IT Director (1 stage)
  if (
    normRole === "IT" ||
    normPos.includes("it director") ||
    (normPos.includes("director") && (normPos.includes("information technology") || normPos.includes("tech")))
  ) {
    return {
      route: "C",
      routeName: "Route C: IT Director (1 stage)",
      totalStages: 1,
      initialStatus: "Pending Super Admin",
      initialStage: 1,
      initialApproverRole: "SA",
      routeNote: "As the IT Director, your request goes straight to Super Admin for final approval.",
    };
  }

  // Route B: Directors (2 stages)
  // Applies to every Director: Department Directors, HR Director, Finance Director, Programs Director,
  // Procurement Director, Internal Audit & Risk Director, and any other Director except IT Director.
  const isDirector =
    ["HR", "FIN", "PRC", "PRG", "IAR"].includes(normRole) ||
    normPos.includes("director") ||
    rawRole.includes("director");

  if (isDirector) {
    return {
      route: "B",
      routeName: "Route B: Director (2 stages)",
      totalStages: 2,
      initialStatus: "Pending IT Director",
      initialStage: 1,
      initialApproverRole: "IT",
      routeNote:
        "As a Director, your request goes to the IT Director, then to Super Admin for final approval. Executive Management is informed.",
    };
  }

  // Route A: Staff (3 stages)
  return {
    route: "A",
    routeName: "Route A: Staff (3 stages)",
    totalStages: 3,
    initialStatus: "Pending Department Director",
    initialStage: 1,
    initialApproverRole: "HR",
    routeNote:
      "As a staff member, your request goes to your Department Director, then to the IT Director, then to Super Admin for final approval.",
  };
}

/**
 * Returns Executive Management members from the Staff Directory.
 * If excludeStaffIdOrEmail is provided (e.g. applicant is themselves in Executive Management), excludes them.
 */
export async function getExecutiveManagementMembers(
  excludeStaffIdOrEmail?: string
): Promise<DepartmentDirectorInfo[]> {
  const allDirs = await getAllStaffDirectoryDirectors();
  const execMembers = allDirs.filter((d) => {
    const deptNorm = normalizeDepartmentName(canonicalizeDepartmentName(d.department));
    const isExecDept = deptNorm.includes("executive");
    const isCEO =
      d.roleCode === "CEO" ||
      (d.position || "").toLowerCase().includes("chief executive") ||
      (d.position || "").toLowerCase().includes("ceo") ||
      (d.position || "").toLowerCase().includes("executive director");
    return isExecDept || isCEO;
  });

  const base = KNOWN_DEPARTMENTS_AND_DIRECTORS["Executive Management"] || [];
  for (const b of base) {
    if (!execMembers.some((m) => m.id === b.id || m.email.toLowerCase() === b.email.toLowerCase())) {
      execMembers.push(b);
    }
  }

  if (!excludeStaffIdOrEmail) return execMembers;

  const cleanExclude = excludeStaffIdOrEmail.toLowerCase().trim();
  return execMembers.filter(
    (m) => m.id.toLowerCase() !== cleanExclude && m.email.toLowerCase() !== cleanExclude
  );
}

/**
 * Checks whether an actor can view a specific request.
 * - Requester: own requests
 * - IT Director: all requests
 * - Super Admin: all requests
 * - Executive Management member named on Route B: view-only (My Requests) for information
 * - Department Director: sees Route A requests from their own department only.
 *   DOES NOT see requests made by other Directors (Route B goes to IT Director).
 */
export function canActorViewRequest(actor: RequestActorContext, request: AccessRequest): boolean {
  const actorEmail = (actor.email || "").toLowerCase().trim();
  const reqEmail = (request.requesterEmail || "").toLowerCase().trim();
  const actorStaffId = (actor.staffId || actor.employeeId || "").trim();

  // 1. Requester can always view their own request
  if (actorEmail === reqEmail || (actorStaffId && actorStaffId === request.requesterId)) {
    return true;
  }

  // 2. Super Admin and IT Director can view all requests
  if (actor.roleCode === "SA" || actor.roleCode === "IT") {
    return true;
  }

  // 3. Executive Management member named on Route B application:
  // Can open that request in read-only view (My Requests) for information only
  const isNamedExec =
    (request.executive_management_id && actorStaffId === request.executive_management_id) ||
    (request.executiveManagementId && actorStaffId === request.executiveManagementId) ||
    (request.executiveManagementEmail && actorEmail === request.executiveManagementEmail.toLowerCase().trim());

  if (isNamedExec) {
    return true;
  }

  // 4. "A Department Director no longer sees or approves requests made by other Directors.
  // Directors' requests go to the IT Director at Stage 1."
  // If request is Route B or Route C, other department directors MUST NOT see it!
  if (request.route === "B" || request.route === "C") {
    return false;
  }

  // 5. Regular staff: only own requests (already checked above)
  if (actor.roleCode === "ST") {
    return false;
  }

  // 6. CEO fallback: can view Route A if named as fallback director
  if (actor.roleCode === "CEO") {
    if (request.directorEmail && actorEmail === request.directorEmail.toLowerCase().trim()) {
      return true;
    }
    if (request.directorAssignedBy === "fallback") {
      return true;
    }
  }

  // 7. Route A: Named Director on the request
  if (request.directorEmail && actorEmail === request.directorEmail.toLowerCase().trim()) {
    return true;
  }

  // 8. Route A: Department Director of requester's department
  const isDirectorRole =
    ["HR", "FIN", "PRC", "PRG", "IAR"].includes(actor.roleCode) ||
    (actor.position || "").toLowerCase().includes("director");

  if (isDirectorRole) {
    const actorDeptNorm = normalizeDepartmentName(actor.department);
    const reqDeptNorm = normalizeDepartmentName(request.department);
    return actorDeptNorm.length > 0 && actorDeptNorm === reqDeptNorm;
  }

  return false;
}

/**
 * Checks whether an actor can take an approval / rejection action on a request.
 * Out-of-order and self-approval are strictly prohibited!
 */
export function canActorActOnRequest(
  actor: RequestActorContext,
  request: AccessRequest,
  action: "Approve" | "Reject" | "Grant" | "Revoke" | "Cancel" | "Confirm" | "Decline"
): { allowed: boolean; reason?: string } {
  const actorEmail = (actor.email || "").toLowerCase().trim();
  const reqEmail = (request.requesterEmail || "").toLowerCase().trim();
  const actorStaffId = (actor.staffId || actor.employeeId || "").trim();

  // Self-action rules:
  // Requester can Cancel only at Stage 1
  if (action === "Cancel") {
    if (actorEmail !== reqEmail) {
      return { allowed: false, reason: "Only the requester can cancel this application." };
    }
    if (request.currentStage !== 1) {
      return { allowed: false, reason: "Applications can only be cancelled while at Stage 1." };
    }
    return { allowed: true };
  }

  // Requester can Confirm / Decline when status is 'Granted (awaiting confirmation)'
  if (action === "Confirm" || action === "Decline") {
    if (actorEmail !== reqEmail) {
      return { allowed: false, reason: "Only the requester can confirm or decline the granted access." };
    }
    if (request.status !== "Granted (awaiting confirmation)") {
      return { allowed: false, reason: "This request is not awaiting your confirmation." };
    }
    return { allowed: true };
  }

  // Super Admin Revoke active grant
  if (action === "Revoke") {
    if (actor.roleCode !== "SA") {
      return { allowed: false, reason: "Only Super Admin can revoke active access grants." };
    }
    return { allowed: true };
  }

  // Executive Management member named on Route B is STRICTLY for information only:
  // "The Executive Management member named on a Director's application receives a notification and can open that request in read-only view (My Requests). They cannot approve, reject, grant or edit it, and they see no other requests."
  const isNamedExec =
    (request.executive_management_id && actorStaffId === request.executive_management_id) ||
    (request.executiveManagementId && actorStaffId === request.executiveManagementId) ||
    (request.executiveManagementEmail && actorEmail === request.executiveManagementEmail.toLowerCase().trim());

  if (isNamedExec && actor.roleCode !== "SA") {
    return {
      allowed: false,
      reason: "Executive Management is informed for information only and cannot approve, reject or grant requests.",
    };
  }

  // NOBODY can approve their own request!
  if ((action === "Approve" || action === "Grant") && actorEmail === reqEmail) {
    return { allowed: false, reason: "You cannot approve or grant your own access request." };
  }

  const route = request.route || "A";

  // ─────────────────────────────────────────────────────────────
  // ROUTE C: IT Director (1 stage)
  // Stage 0: IT Director submits > Stage 1: Super Admin accepts and grants > IT Director confirms > ACTIVE
  // ─────────────────────────────────────────────────────────────
  if (route === "C") {
    if (request.currentStage === 1 && request.status === "Pending Super Admin") {
      if (action === "Grant" || action === "Reject") {
        if (actor.roleCode === "SA" || (reqEmail === actorEmail && actor.roleCode === "CEO")) {
          return { allowed: true };
        }
        return { allowed: false, reason: "Only Super Admin can grant or reject Route C requests." };
      }
      return { allowed: false, reason: "Invalid action for Route C Stage 1." };
    }
    return { allowed: false, reason: "Invalid stage or status for Route C request." };
  }

  // ─────────────────────────────────────────────────────────────
  // ROUTE B: Directors (2 stages)
  // Stage 0: Director submits > Stage 1: IT Director approves > Stage 2: Super Admin accepts and grants > Director confirms > ACTIVE
  // ─────────────────────────────────────────────────────────────
  if (route === "B") {
    // Stage 1: IT Director approves
    if (request.currentStage === 1 && request.status === "Pending IT Director") {
      if (action === "Approve" || action === "Reject") {
        if (actor.roleCode === "IT" || actor.roleCode === "SA") {
          return { allowed: true };
        }
        return { allowed: false, reason: "Only the IT Director can approve Stage 1 for Director applications." };
      }
      return { allowed: false, reason: "Invalid action for Stage 1 (Pending IT Director)." };
    }

    // Stage 2: Super Admin grants
    if (request.currentStage === 2 && request.status === "Pending Super Admin") {
      if (action === "Grant" || action === "Reject") {
        if (actor.roleCode === "SA" || (reqEmail.includes("admin") && actor.roleCode === "CEO")) {
          return { allowed: true };
        }
        return { allowed: false, reason: "Only Super Admin can grant Stage 2 for Director applications." };
      }
      return { allowed: false, reason: "Invalid action for Stage 2 (Pending Super Admin)." };
    }

    return { allowed: false, reason: "Invalid stage or status for Route B request." };
  }

  // ─────────────────────────────────────────────────────────────
  // ROUTE A: Staff (3 stages)
  // Stage 0: Staff submits > Stage 1: Dept Director approves > Stage 2: IT Director approves > Stage 3: Super Admin grants > Staff confirms > ACTIVE
  // ─────────────────────────────────────────────────────────────

  // Stage 1 Action: Department Director or Fallback CEO
  if (request.currentStage === 1) {
    if (request.status !== "Pending Department Director") {
      return { allowed: false, reason: "Request is not currently at Stage 1." };
    }
    if (action !== "Approve" && action !== "Reject") {
      return { allowed: false, reason: "Only Approve or Reject is allowed at Stage 1." };
    }

    const isCEO = actor.roleCode === "CEO";

    // If request has named Director, actor must be that named Director or CEO fallback
    if (request.directorEmail) {
      const isNamed =
        actorEmail === request.directorEmail.toLowerCase().trim() ||
        (request.directorId && (actorStaffId === request.directorId));
      if (isNamed || isCEO) {
        return { allowed: true };
      }
      return { allowed: false, reason: "You are not the designated Director for this request." };
    }

    // Check role and department
    const isDeptMatch =
      normalizeDepartmentName(actor.department) === normalizeDepartmentName(request.department);
    const isDirectorRole = ["HR", "FIN", "PRC", "PRG", "IAR", "IT"].includes(actor.roleCode);

    if ((isDirectorRole && isDeptMatch) || isCEO) {
      return { allowed: true };
    }
    return { allowed: false, reason: "You are not the designated Department Director for this request." };
  }

  // Stage 2 Action: IT Director or Fallback SA
  if (request.currentStage === 2) {
    if (request.status !== "Pending IT Director") {
      return { allowed: false, reason: "Request is not currently at Stage 2." };
    }
    if (action !== "Approve" && action !== "Reject") {
      return { allowed: false, reason: "Only Approve or Reject is allowed at Stage 2." };
    }
    if (actor.roleCode === "IT" || actor.roleCode === "SA") {
      return { allowed: true };
    }
    return { allowed: false, reason: "Only the IT Director can approve Stage 2." };
  }

  // Stage 3 Action: Super Admin (or Fallback CEO if SA is the requester)
  if (request.currentStage === 3) {
    if (request.status !== "Pending Super Admin") {
      return { allowed: false, reason: "Request is not currently at Stage 3." };
    }
    if (action !== "Grant" && action !== "Reject") {
      return { allowed: false, reason: "Only Grant or Reject is allowed at Stage 3." };
    }
    if (actor.roleCode === "SA" || (reqEmail === actorEmail && actor.roleCode === "CEO")) {
      return { allowed: true };
    }
    if (reqEmail.includes("admin") && actor.roleCode === "CEO") {
      return { allowed: true };
    }
    return { allowed: false, reason: "Only Super Admin can grant Stage 3 access." };
  }

  return { allowed: false, reason: "Out-of-order action or invalid stage." };
}
