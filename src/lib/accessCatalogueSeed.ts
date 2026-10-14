import { AccessCatalogueItem, AccessSettings } from "./accessTypes";
import { getCollection, COLLECTIONS } from "./mongodb";

export const DEFAULT_ACCESS_SETTINGS: AccessSettings = {
  id: "access_settings",
  fallbackStage1ApproverRole: "CEO",
  fallbackStage2ApproverRole: "SA",
  fallbackSuperAdminSelfGrant: "CEO",
  acceptanceStatement:
    "I will use this access only for my authorized work, keep my login private, and immediately report any misuse or security irregularity.",
  reminderDays: 3,
  expiryDays: 7,
  notifyHrOnAllRequests: false,
  updatedAt: new Date().toISOString(),
};

export const SENSITIVE_TABS = new Set([
  "Staff Payroll Schedule",
  "Staff Loan Disbursements",
  "End of Service Benefit (EOSB)",
  "Employee Profile",
  "Employee Contracts",
  "Executive Treasury Balance",
  "Disciplinary Committee Log",
  "Disciplinary Committee Profile",
  "Accused/Suspect Profile",
  "Investigation Case Register",
]);

export const NON_REQUESTABLE_ADMIN_TABS = new Set([
  "Staff Account Creation",
  "Staff Account Creation (Admin Only)",
  "Learning Dashboard & Analytics",
  "Learning Dashboard & Analytics (Admin Only)",
  "Staff Login",
  "Staff Login Creation",
  "Employee Account Creation & RBAC",
  "Role & Access Matrix",
  "Security & Audit Trail",
  "Executive Analytics & Dashboard",
]);

export const ACCESS_CATALOGUE_SEED: Omit<AccessCatalogueItem, "id">[] = [
  // 1. Employee
  { module: "Employee", moduleSlug: "employees", tab: "Staff Directory", tabId: "staff-directory", requestable: true, sensitive: false },
  { module: "Employee", moduleSlug: "employees", tab: "Employee Profile", tabId: "employee-profile", requestable: true, sensitive: true },
  { module: "Employee", moduleSlug: "employees", tab: "Register New Staff", tabId: "register-staff", requestable: true, sensitive: false },
  { module: "Employee", moduleSlug: "employees", tab: "Staff Analytics", tabId: "staff-analytics", requestable: true, sensitive: false },
  { module: "Employee", moduleSlug: "employees", tab: "BCF Organogram", tabId: "organogram", requestable: true, sensitive: false },

  // 2. Donors
  { module: "Donors", moduleSlug: "donors", tab: "Donors Directory", tabId: "donors-directory", requestable: true, sensitive: false },
  { module: "Donors", moduleSlug: "donors", tab: "Donor Dossier", tabId: "donor-dossier", requestable: true, sensitive: false },
  { module: "Donors", moduleSlug: "donors", tab: "Log New Donation", tabId: "log-donation", requestable: true, sensitive: false },
  { module: "Donors", moduleSlug: "donors", tab: "Giving Analytics", tabId: "giving-analytics", requestable: true, sensitive: false },

  // 3. Beneficiaries
  { module: "Beneficiaries", moduleSlug: "beneficiaries", tab: "Beneficiaries Log", tabId: "beneficiaries-log", requestable: true, sensitive: false },
  { module: "Beneficiaries", moduleSlug: "beneficiaries", tab: "Beneficiaries Analytics", tabId: "beneficiaries-analytics", requestable: true, sensitive: false },

  // 4. Finance
  { module: "Finance", moduleSlug: "finance", tab: "Donor Funds Inflow Ledger", tabId: "donor-inflow-ledger", requestable: true, sensitive: false },
  { module: "Finance", moduleSlug: "finance", tab: "Programme Expenditure", tabId: "programme-budgets", requestable: true, sensitive: false },
  { module: "Finance", moduleSlug: "finance", tab: "Executive Treasury Balance", tabId: "treasury-balance", requestable: true, sensitive: true },
  { module: "Finance", moduleSlug: "finance", tab: "Staff Payroll Schedule", tabId: "payroll-schedule", requestable: true, sensitive: true },
  { module: "Finance", moduleSlug: "finance", tab: "Staff Payslip Self-Service", tabId: "payslip-self-service", requestable: true, sensitive: false },
  { module: "Finance", moduleSlug: "finance", tab: "Staff Loan Disbursements", tabId: "loan-register", requestable: true, sensitive: true },
  { module: "Finance", moduleSlug: "finance", tab: "End of Service Benefit (EOSB)", tabId: "end-of-service", requestable: true, sensitive: true },

  // 5. Loans
  { module: "Loans", moduleSlug: "loans", tab: "Staff Loan Application", tabId: "loan-application", requestable: true, sensitive: false },
  { module: "Loans", moduleSlug: "loans", tab: "HR Approval Console", tabId: "hr-approval", requestable: true, sensitive: false },
  { module: "Loans", moduleSlug: "loans", tab: "Finance Approval Console", tabId: "finance-approval", requestable: true, sensitive: false },
  { module: "Loans", moduleSlug: "loans", tab: "CEO Executive Authorization", tabId: "ceo-authorisation", requestable: true, sensitive: false },
  { module: "Loans", moduleSlug: "loans", tab: "HR Disbursement Voucher Preparation", tabId: "hr-disbursement-voucher", requestable: true, sensitive: false },
  { module: "Loans", moduleSlug: "loans", tab: "Finance Disbursement Release", tabId: "finance-disbursement-release", requestable: true, sensitive: false },
  { module: "Loans", moduleSlug: "loans", tab: "Loan Dashboard Management", tabId: "tracking-repayment", requestable: true, sensitive: false },
  { module: "Loans", moduleSlug: "loans", tab: "Payroll Integration & Deduction", tabId: "payroll-integration", requestable: true, sensitive: false },

  // 6. Leave Management
  { module: "Leave Management", moduleSlug: "leave", tab: "Leave & Allowance Dashboard", tabId: "leave-dashboard", requestable: true, sensitive: false },
  { module: "Leave Management", moduleSlug: "leave", tab: "Leave & Allowance Application Form", tabId: "leave-application", requestable: true, sensitive: false },
  { module: "Leave Management", moduleSlug: "leave", tab: "HR Review & Multi-Tier Approval Console", tabId: "hr-review", requestable: true, sensitive: false },
  { module: "Leave Management", moduleSlug: "leave", tab: "Institutional Audit Trail & FOMS Payment", tabId: "foms-audit", requestable: true, sensitive: false },

  // 7. Partnerships
  { module: "Partnerships", moduleSlug: "partnerships", tab: "Partner Master Register & Hub", tabId: "partners-directory", requestable: true, sensitive: false },
  { module: "Partnerships", moduleSlug: "partnerships", tab: "11-Stage Engagement Pipeline", tabId: "deal-pipeline", requestable: true, sensitive: false },
  { module: "Partnerships", moduleSlug: "partnerships", tab: "Institutional Partner Dossier", tabId: "partner-profile", requestable: true, sensitive: false },
  { module: "Partnerships", moduleSlug: "partnerships", tab: "Strategic Partnership Analytics", tabId: "partnership-analytics", requestable: true, sensitive: false },

  // 8. Procurement
  { module: "Procurement", moduleSlug: "procurement", tab: "Purchase Requisitions (PR)", tabId: "purchase-requisition", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "Supplier & Vendor Master", tabId: "supplier-management", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "RFQ & Tender Management", tabId: "rfq-management", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "Purchase Orders (PO)", tabId: "purchase-order", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "Goods Received Notes (GRN)", tabId: "goods-received-note", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "Invoice & 3-Way Match", tabId: "invoice-matching", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "Transaction Audit Trail", tabId: "transaction-audit-trail", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "Partnership Management Hub", tabId: "partnership-management", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "Procurement Dashboard", tabId: "procurement-dashboard", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "Procurement Data Hub", tabId: "procurement-data", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "Inventory Management", tabId: "inventory-management", requestable: true, sensitive: false },
  { module: "Procurement", moduleSlug: "procurement", tab: "Asset Management", tabId: "asset-management", requestable: true, sensitive: false },

  // 9. Programs
  { module: "Programs", moduleSlug: "programs", tab: "Programs Database", tabId: "programs-database", requestable: true, sensitive: false },
  { module: "Programs", moduleSlug: "programs", tab: "Financial Ledger", tabId: "programme-financials", requestable: true, sensitive: false },
  { module: "Programs", moduleSlug: "programs", tab: "Donors & Partners", tabId: "donors-partners", requestable: true, sensitive: false },
  { module: "Programs", moduleSlug: "programs", tab: "Performance Evaluation", tabId: "performance-evaluation", requestable: true, sensitive: false },

  // 10. Learning
  { module: "Learning", moduleSlug: "learning", tab: "Course Catalogue & Allocation", tabId: "course-allocation", requestable: true, sensitive: false },
  { module: "Learning", moduleSlug: "learning", tab: "My Learning & Grades", tabId: "learning-grades", requestable: true, sensitive: false },
  { module: "Learning", moduleSlug: "learning", tab: "Assessments & Certificates", tabId: "certificates", requestable: true, sensitive: false },
  // Non-requestable Admin Only tabs:
  { module: "Learning", moduleSlug: "learning", tab: "Learning Dashboard & Analytics (admin only)", tabId: "learning-dashboard", requestable: false, sensitive: false },
  { module: "Learning", moduleSlug: "learning", tab: "Staff Account Creation (Admin Only)", tabId: "account-creation", requestable: false, sensitive: false },

  // 11. Discipline
  { module: "Discipline", moduleSlug: "discipline", tab: "Committee Registration Log", tabId: "committee-log", requestable: true, sensitive: false },
  { module: "Discipline", moduleSlug: "discipline", tab: "Committee Profile", tabId: "committee-profile", requestable: true, sensitive: false },
  { module: "Discipline", moduleSlug: "discipline", tab: "Disciplinary Committee Log", tabId: "disciplinary-log", requestable: true, sensitive: true },
  { module: "Discipline", moduleSlug: "discipline", tab: "Disciplinary Committee Profile", tabId: "disciplinary-profile", requestable: true, sensitive: true },
  { module: "Discipline", moduleSlug: "discipline", tab: "Accused/Suspect Profile", tabId: "accused-profile", requestable: true, sensitive: true },
  { module: "Discipline", moduleSlug: "discipline", tab: "Investigation Case Register", tabId: "investigation-cases", requestable: true, sensitive: true },

  // 12. Documents & Policies
  { module: "Documents & Policies", moduleSlug: "documents-policies", tab: "Documents", tabId: "documents", requestable: true, sensitive: false },
  { module: "Documents & Policies", moduleSlug: "documents-policies", tab: "Policies", tabId: "policies", requestable: true, sensitive: false },
  { module: "Documents & Policies", moduleSlug: "documents-policies", tab: "Proposals", tabId: "proposals", requestable: true, sensitive: false },
  { module: "Documents & Policies", moduleSlug: "documents-policies", tab: "Projects", tabId: "projects", requestable: true, sensitive: false },
  { module: "Documents & Policies", moduleSlug: "documents-policies", tab: "Employee Contracts", tabId: "employee-contracts", requestable: true, sensitive: true },
];

export async function ensureAccessCatalogueAndSettings(): Promise<{
  catalogue: AccessCatalogueItem[];
  settings: AccessSettings;
}> {
  try {
    const catCol = await getCollection<AccessCatalogueItem>(COLLECTIONS.ACCESS_CATALOGUE);
    const setCol = await getCollection<AccessSettings>(COLLECTIONS.ACCESS_SETTINGS);

    // 1. Ensure Catalogue seeded
    const count = await catCol.countDocuments();
    if (count === 0) {
      const itemsToInsert: AccessCatalogueItem[] = ACCESS_CATALOGUE_SEED.map((item) => ({
        ...item,
        id: `${item.moduleSlug}-${item.tabId}`,
      }));
      await catCol.insertMany(itemsToInsert as any);
    }

    const catalogue = await catCol.find({}).toArray();

    // 2. Ensure Settings seeded
    let settings = await setCol.findOne({ id: "access_settings" });
    if (!settings) {
      await setCol.insertOne(DEFAULT_ACCESS_SETTINGS as any);
      settings = DEFAULT_ACCESS_SETTINGS as any;
    }

    return {
      catalogue: catalogue.map((c) => ({
        id: c.id || `${c.moduleSlug}-${c.tabId}`,
        module: c.module,
        moduleSlug: c.moduleSlug,
        tab: c.tab,
        tabId: c.tabId,
        requestable: c.requestable !== false,
        sensitive: !!c.sensitive,
        description: c.description,
      })),
      settings: settings as AccessSettings,
    };
  } catch (err) {
    console.warn("[ensureAccessCatalogueAndSettings] DB fallback:", err);
    return {
      catalogue: ACCESS_CATALOGUE_SEED.map((item) => ({
        ...item,
        id: `${item.moduleSlug}-${item.tabId}`,
      })),
      settings: DEFAULT_ACCESS_SETTINGS,
    };
  }
}
