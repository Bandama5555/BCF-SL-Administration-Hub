export interface SubApp {
  id: string;
  label: string;
  description: string;
  htmlPath: string; // relative to /public/apps/
  icon: string; // Material Symbol name
  hidden?: boolean; // If true, hide from sidebar and hub menus
  adminOnly?: boolean; // If true, only accessible by administrator and hidden from staff
}

export interface Module {
  id: string;
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: string; // Material Symbol name
  color: string; // Tailwind gradient from/to for the card accent
  accentHex: string;
  kpiLabel: string;
  kpiValue: string;
  kpiTrend: string;
  folderName: string; // actual subfolder name on disk
  subApps: SubApp[];
}

export const MODULES: Module[] = [
  {
    id: "super-admin",
    slug: "super-admin",
    label: "Super Admin, Dashboard Creation & Data Analytics",
    shortLabel: "Super Admin",
    description: "Executive analytics, custom dashboard builder, automated employee account provisioning, and comprehensive RBAC security management.",
    icon: "admin_panel_settings",
    color: "from-amber-600 via-emerald-600 to-teal-700",
    accentHex: "#15803d",
    kpiLabel: "Active Accounts",
    kpiValue: "100%",
    kpiTrend: "Automated RBAC",
    folderName: "stitch_super_admin_analytics",
    subApps: [
      {
        id: "executive-analytics",
        label: "Executive Analytics & Dashboard",
        description: "Organizational analytics, departmental metrics, KPI aggregations, and customizable executive dashboards.",
        htmlPath: "stitch_super_admin_analytics/executive_analytics/code.html",
        icon: "insights",
      },
      {
        id: "login-creation",
        label: "Staff Login Creation",
        description: "Provision and configure system login credentials for staff members, assign passwords, and enable access to open the administration system.",
        htmlPath: "stitch_super_admin_analytics/login_creation/code.html",
        icon: "badge",
      },
      {
        id: "account-management",
        label: "Employee Account Creation & RBAC",
        description: "Automatic account provisioning, credential management, role assignment, and lifecycle management.",
        htmlPath: "stitch_super_admin_analytics/account_management/code.html",
        icon: "manage_accounts",
      },
      {
        id: "access-matrix",
        label: "Role & Access Matrix",
        description: "Configure multi-tier permissions for Super Admin, Board, Directors, Managers, Officers, and Volunteers.",
        htmlPath: "stitch_super_admin_analytics/access_matrix/code.html",
        icon: "security",
      },
      {
        id: "reset-password",
        label: "Reset Password",
        description: "Governance of staff forgotten-password reset requests, 5-digit OTP telemetry, suspicious flags, and administrative login revocation.",
        htmlPath: "",
        icon: "lock_reset",
      },
      {
        id: "audit-logs",
        label: "Security & Audit Trail",
        description: "Immutable security audit logs tracking user activity, role changes, account status, and data modifications.",
        htmlPath: "stitch_super_admin_analytics/audit_logs/code.html",
        icon: "history_edu",
      },
    ],
  },
  {
    id: "access",
    slug: "access",
    label: "Access Management System",
    shortLabel: "Access",
    description: "End-to-end access governance: staff tab access applications, multi-tier approvals, Super Admin acceptance, active grants register, and revocation.",
    icon: "vpn_key",
    color: "from-blue-600 via-sky-600 to-indigo-700",
    accentHex: "#0284c7",
    kpiLabel: "Access Governance",
    kpiValue: "Multi-Tier",
    kpiTrend: "Active Routing",
    folderName: "access",
    subApps: [
      {
        id: "access-application",
        label: "Access Application",
        description: "Apply for access to any tab in any module with customized rights, duration, and justifications.",
        htmlPath: "",
        icon: "post_add",
      },
      {
        id: "my-requests",
        label: "My Requests",
        description: "Track request workflow stages, inspect audit timelines, cancel pending requests, and confirm granted access.",
        htmlPath: "",
        icon: "fact_check",
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "Personalized access alerts, approval status updates, and actionable confirmation notifications.",
        htmlPath: "",
        icon: "notifications",
      },
      {
        id: "access-approval",
        label: "Access Approval",
        description: "Approval queue for Department Directors, IT Director, and Super Admin reviews with immutable history.",
        htmlPath: "",
        icon: "rule",
      },
      {
        id: "access-acceptance",
        label: "Access Acceptance",
        description: "Super Admin final rights granting, active grants register, search, and instant permissions revocation.",
        htmlPath: "",
        icon: "gavel",
      },
      {
        id: "access-revoke",
        label: "Access Revoke",
        description: "Super Admin removes access granted to a staff member by module, tab, or specific rights with instant session revocation.",
        htmlPath: "",
        icon: "block",
        adminOnly: true,
      },
      {
        id: "access-master",
        label: "Access Master",
        description: "The master register of who has been given access, with full approval trails, baseline role comparison, and bulk revocation.",
        htmlPath: "",
        icon: "verified_user",
      },
    ],
  },
  {
    id: "employees",
    slug: "employees",
    label: "Employee Database",
    shortLabel: "Employees",
    description: "Manage staff records, profiles, org charts, and HR analytics across all BCF-SL departments.",
    icon: "badge",
    color: "from-blue-600 to-indigo-700",
    accentHex: "#1A56DB",
    kpiLabel: "Total Staff",
    kpiValue: "142",
    kpiTrend: "+8 this quarter",
    folderName: "stitch_employee_database_management_system",
    subApps: [
      {
        id: "staff-directory",
        label: "Staff Directory",
        description: "Searchable directory of all BCF-SL personnel with contract type and department filters.",
        htmlPath: "stitch_employee_database_management_system/staff_directory/code.html",
        icon: "contacts",
      },
      {
        id: "employee-profile",
        label: "Employee Profile",
        description: "Detailed individual staff profiles including payroll, qualifications, and history.",
        htmlPath: "stitch_employee_database_management_system/employee_profile_detail/code.html",
        icon: "person",
      },
      {
        id: "register-staff",
        label: "Register New Staff",
        description: "Auto-generate employee IDs and onboard new personnel into the system.",
        htmlPath: "stitch_employee_database_management_system/register_staff_auto_id/code.html",
        icon: "person_add",
      },
      {
        id: "staff-analytics",
        label: "Staff Analytics",
        description: "HR reporting dashboards with headcount trends, turnover, and department breakdowns.",
        htmlPath: "stitch_employee_database_management_system/staff_analysis_reporting/code.html",
        icon: "analytics",
      },
      {
        id: "organogram",
        label: "BCF Organogram",
        description: "Interactive organisational chart showing reporting lines and department structure.",
        htmlPath: "stitch_employee_database_management_system/BCF Organogram Updated.html",
        icon: "account_tree",
      },
    ],
  },
  {
    id: "donors",
    slug: "donors",
    label: "Donor Database",
    shortLabel: "Donors",
    description: "Track donor relationships, giving history, analytics, and new donation logging for BCF-SL.",
    icon: "volunteer_activism",
    color: "from-emerald-600 to-teal-700",
    accentHex: "#22A849",
    kpiLabel: "Active Donors",
    kpiValue: "4",
    kpiTrend: "4 verified",
    folderName: "stitch_donor_database_log",
    subApps: [
      {
        id: "donors-directory",
        label: "Donors Directory",
        description: "Full CRM-style donor directory with KPIs, search, and segmentation filters.",
        htmlPath: "stitch_donor_database_log/donors_directory_log/code.html",
        icon: "contacts",
      },
      {
        id: "donor-dossier",
        label: "Donor Dossier",
        description: "Individual donor profile with full giving history and engagement timeline.",
        htmlPath: "stitch_donor_database_log/donor_dossier_history/code.html",
        icon: "person",
      },
      {
        id: "log-donation",
        label: "Log New Donation",
        description: "Record a new donation from an existing or new donor with full attribution.",
        htmlPath: "stitch_donor_database_log/log_new_donation/code.html",
        icon: "add_circle",
      },
      {
        id: "giving-analytics",
        label: "Giving Analytics",
        description: "Visualised reports on donation trends, campaign performance, and donor retention.",
        htmlPath: "stitch_donor_database_log/giving_analytics_reports/code.html",
        icon: "bar_chart",
      },
    ],
  },
  {
    id: "beneficiaries",
    slug: "beneficiaries",
    label: "Beneficiaries Database",
    shortLabel: "Beneficiaries",
    description: "Log and manage programme beneficiaries, field data, and outcome tracking for Bandama.",
    icon: "groups",
    color: "from-violet-600 to-purple-700",
    accentHex: "#5b21b6",
    kpiLabel: "Beneficiaries",
    kpiValue: "142,500+",
    kpiTrend: "14 districts • FY 2024 audit",
    folderName: "stitch_bandama_beneficiaries_database_log",
    subApps: [
      {
        id: "beneficiaries-log",
        label: "Beneficiaries Log",
        description: "Central database of all enrolled beneficiaries with status and programme tracking.",
        htmlPath: "stitch_bandama_beneficiaries_database_log/beneficiaries_database_log/code.html",
        icon: "list_alt",
      },
      {
        id: "beneficiaries-analytics",
        label: "Beneficiaries Analytics",
        description: "Demographic breakdowns, district distribution analytics, program allocation metrics, and outcome monitoring.",
        htmlPath: "stitch_bandama_beneficiaries_database_log/beneficiaries_analytics/code.html",
        icon: "insights",
      },
    ],
  },
  {
    id: "finance",
    slug: "finance",
    label: "Financial Operations",
    shortLabel: "Finance",
    description: "Oversee donor fund inflows, programme expenditure budgets, payroll, and treasury balances.",
    icon: "account_balance",
    color: "from-amber-500 to-orange-600",
    accentHex: "#d97706",
    kpiLabel: "Funds Raised",
    kpiValue: "$248.5k",
    kpiTrend: "+12.4% YTD",
    folderName: "stitch_bandama_financial_operations_management_system",
    subApps: [
      {
        id: "donor-inflow-ledger",
        label: "Donor Funds Inflow Ledger",
        description: "Real-time ledger of all donor fund receipts, categorised by source and campaign.",
        htmlPath: "stitch_bandama_financial_operations_management_system/donor_funds_inflow_ledger/code.html",
        icon: "payments",
      },
      {
        id: "programme-budgets",
        label: "Programme Expenditure Budgets",
        description: "Budget tracking and variance analysis for all BCF-SL programmes.",
        htmlPath: "stitch_bandama_financial_operations_management_system/program_expenditure_budgets/code.html",
        icon: "receipt_long",
      },
      {
        id: "treasury-balance",
        label: "Executive Treasury Balance",
        description: "Senior executive view of all BCF-SL bank account balances and treasury position.",
        htmlPath: "stitch_bandama_financial_operations_management_system/executive_treasury_bank_balance/code.html",
        icon: "savings",
      },
      {
        id: "payroll-schedule",
        label: "Staff Payroll Schedule",
        description: "Monthly payroll register with statutory deductions and net pay computations.",
        htmlPath: "stitch_bandama_financial_operations_management_system/staff_payroll_statutory_schedule/code.html",
        icon: "currency_exchange",
      },
      {
        id: "payslip-self-service",
        label: "Staff Payslip Self-Service",
        description: "Staff-facing payslip portal for monthly salary statements.",
        htmlPath: "stitch_bandama_financial_operations_management_system/staff_monthly_payslip_self_service/code.html",
        icon: "description",
      },
      {
        id: "loan-register",
        label: "Staff Loan Disbursements",
        description: "Financial register of all staff loan disbursements from the finance side.",
        htmlPath: "stitch_bandama_financial_operations_management_system/staff_loan_register_disbursements/code.html",
        icon: "price_check",
      },
      {
        id: "end-of-service",
        label: "End of Service Benefit (EOSB)",
        description: "Compute, verify, and disburse end-of-service entitlements, gratuity bonuses, leave compensation, and clearance settlements.",
        htmlPath: "stitch_bandama_financial_operations_management_system/end_of_service_benefit/code.html",
        icon: "handshake",
      },
    ],
  },
  {
    id: "loans",
    slug: "loans",
    label: "Staff Loan Management",
    shortLabel: "Loans",
    description: "Process staff loan applications, HR/CEO approvals, disbursements, and repayment tracking.",
    icon: "request_quote",
    color: "from-cyan-600 to-sky-700",
    accentHex: "#0369a1",
    kpiLabel: "Active Loans",
    kpiValue: "37",
    kpiTrend: "NLe 182k outstanding",
    folderName: "stitch_bcf_staff_loan_management_system",
    subApps: [
      {
        id: "loan-application",
        label: "Staff Loan Application",
        description: "Eligibility checker and loan application form for BCF-SL staff.",
        htmlPath: "stitch_bcf_staff_loan_management_system/staff_eligibility_loan_application/code.html",
        icon: "edit_document",
      },
      {
        id: "hr-approval",
        label: "HR Approval Console",
        description: "HR sign-off console for pending loan applications.",
        htmlPath: "stitch_bcf_staff_loan_management_system/hr_approval_console/code.html",
        icon: "fact_check",
      },
      {
        id: "finance-approval",
        label: "Finance Approval Console",
        description: "Finance sign-off console for pending loan applications.",
        htmlPath: "stitch_bcf_staff_loan_management_system/finance_approval_console/code.html",
        icon: "account_balance",
      },
      {
        id: "ceo-authorisation",
        label: "CEO Executive Authorization",
        description: "CEO-level final authorisation for approved loan applications.",
        htmlPath: "stitch_bcf_staff_loan_management_system/ceo_executive_review_authorization/code.html",
        icon: "verified_user",
      },
      {
        id: "hr-disbursement-voucher",
        label: "HR Disbursement Voucher Preparation",
        description: "Generate and sign disbursement vouchers to forward to Finance.",
        htmlPath: "stitch_bcf_staff_loan_management_system/hr_disbursement_voucher/code.html",
        icon: "receipt",
      },
      {
        id: "finance-disbursement-release",
        label: "Finance Disbursement Release",
        description: "Process authorized vouchers and physically release funds.",
        htmlPath: "stitch_bcf_staff_loan_management_system/finance_disbursement_release/code.html",
        icon: "payments",
      },
      {
        id: "tracking-repayment",
        label: "Loan Dashboard Management",
        description: "Executive analytics and searchable dashboard of all staff loan applications.",
        htmlPath: "stitch_bcf_staff_loan_management_system/loan_tracking_repayment_dashboard/code.html",
        icon: "dashboard",
      },
      {
        id: "payroll-integration",
        label: "Payroll Integration & Deduction",
        description: "Automated loan repayment ledger and amortization schedules.",
        htmlPath: "stitch_bcf_staff_loan_management_system/payroll_integration/code.html",
        icon: "payments",
      },
    ],
  },
  {
    id: "leave",
    slug: "leave",
    label: "Leave & Statutory Allowance Management",
    shortLabel: "Leave Management",
    description: "Automated service anniversary calculation, 31-day annual leave entitlement, 5% salary allowance processing, FOMS payroll integration, and multi-tier approval hierarchy.",
    icon: "event_available",
    color: "from-emerald-700 via-teal-700 to-cyan-800",
    accentHex: "#004328",
    kpiLabel: "Leave Eligibility",
    kpiValue: "31 / 45 Staff",
    kpiTrend: "31 Days / 5% Allowance",
    folderName: "stitch_leave_and_allowance_portal",
    subApps: [
      {
        id: "leave-dashboard",
        label: "Leave & Allowance Dashboard",
        description: "HR & Management KPI dashboard tracking 15 key indicators, employee tenure countdown, 31-day quota meters, and policy configurations.",
        htmlPath: "stitch_leave_and_allowance_portal/bcf_sl_leave_allowance_dashboard/code.html",
        icon: "dashboard",
      },
      {
        id: "leave-application",
        label: "Leave & Allowance Application Form",
        description: "Option 1 (Leave), Option 2 (Allowance), and Option 3 (Combined) requests with real-time staffing conflict detection and duty handover logs.",
        htmlPath: "stitch_leave_and_allowance_portal/bcf_sl_leave_application_form/code.html",
        icon: "edit_calendar",
      },
      {
        id: "hr-review",
        label: "HR Review & Multi-Tier Approval Console",
        description: "Multi-tier approval pipeline (Supervisor -> HR -> Executive), staffing conflict alerts, emergency recall protocols, and return-to-work clearance.",
        htmlPath: "stitch_leave_and_allowance_portal/bcf_sl_hr_review_approval/code.html",
        icon: "verified_user",
      },
      {
        id: "foms-audit",
        label: "Institutional Audit Trail & FOMS Payment",
        description: "FOMS fiscal voucher generation, 6-stage lifecycle audit velocity, bank EFT disbursement gateway, and downloadable HR approval certificates.",
        htmlPath: "stitch_leave_and_allowance_portal/bcf_sl_audit_trail_foms_payment/code.html",
        icon: "receipt_long",
      },
    ],
  },
  {
    id: "partnerships",
    slug: "partnerships",
    label: "Partnership Management System",
    shortLabel: "Partnerships",
    description: "Central relationship management connecting Programme Management, Procurement, Finance, HR, M&E, and Beneficiaries across Sierra Leone.",
    icon: "handshake",
    color: "from-blue-600 to-indigo-700",
    accentHex: "#0037b0",
    kpiLabel: "Active Partners",
    kpiValue: "8 Active",
    kpiTrend: "NLe 6.37M Portfolio",
    folderName: "stitch_partnership_directory_hub",
    subApps: [
      {
        id: "partners-directory",
        label: "Partner Master Register & Hub",
        description: "Full directory of verified institutional, funding, and governmental partners.",
        htmlPath: "stitch_partnership_directory_hub/partners_directory/code.html",
        icon: "contacts",
      },
      {
        id: "deal-pipeline",
        label: "11-Stage Engagement Pipeline",
        description: "Track prospective partners from identification through to signed agreements.",
        htmlPath: "stitch_partnership_directory_hub/deal_pipeline/code.html",
        icon: "timeline",
      },
      {
        id: "partner-profile",
        label: "Institutional Partner Dossier",
        description: "Detailed partner credentials, 5-pillar due diligence score, and active MoUs.",
        htmlPath: "stitch_partnership_directory_hub/partner_profile_stripe/code.html",
        icon: "badge",
      },
      {
        id: "partnership-analytics",
        label: "Strategic Partnership Analytics",
        description: "Geographic coverage across 16 districts, renewal forecasts, and risk metrics.",
        htmlPath: "stitch_partnership_directory_hub/partnership_analytics/code.html",
        icon: "bar_chart",
      },
    ],
  },
  {
    id: "procurement",
    slug: "procurement",
    label: "Procurement Management",
    shortLabel: "Procurement",
    description: "Track purchase orders, vendor management, and executive spend analytics for BCF-SL.",
    icon: "shopping_cart",
    color: "from-lime-600 to-green-700",
    accentHex: "#16a34a",
    kpiLabel: "Open POs",
    kpiValue: "23",
    kpiTrend: "NLe 94k committed",
    folderName: "stitch_procurement_data_management_system",
    subApps: [
      {
        id: "procurement-dashboard",
        label: "Procurement Dashboard",
        description: "High-level institutional spend analytics across programmes, donor grants, and pipeline telemetry.",
        htmlPath: "stitch_procurement_data_management_system/procurement_dashboard/code.html",
        icon: "insights",
      },
      {
        id: "purchase-requisition",
        label: "Purchase Requisitions",
        description: "Create & approve PRs with auto-linked Programme, Donor, Grant, & Budget. Generates Master BCF-TXN key.",
        htmlPath: "stitch_procurement_data_management_system/purchase_requisition/code.html",
        icon: "request_quote",
      },
      {
        id: "supplier-management",
        label: "Supplier & Vendor Master",
        description: "Verified supplier directory, NRA TIN/NASSIT compliance, ratings, and banking details.",
        htmlPath: "stitch_procurement_data_management_system/supplier_management/code.html",
        icon: "storefront",
      },
      {
        id: "rfq-management",
        label: "RFQ & Tender Management",
        description: "Issue RFQs from approved PRs, evaluate vendor quotes, and score competitive bids.",
        htmlPath: "stitch_procurement_data_management_system/rfq_management/code.html",
        icon: "forward_to_inbox",
      },
      {
        id: "purchase-order",
        label: "Purchase Orders",
        description: "Official Purchase Orders with commitment generation, line items, and delivery terms.",
        htmlPath: "stitch_procurement_data_management_system/purchase_order/code.html",
        icon: "shopping_bag",
      },
      {
        id: "goods-received-note",
        label: "Goods Received Notes",
        description: "Record physical delivery offloading, QC inspection, and regional warehouse intake.",
        htmlPath: "stitch_procurement_data_management_system/goods_received_note/code.html",
        icon: "inventory_2",
      },
      {
        id: "invoice-matching",
        label: "Invoice & 3-Way Match",
        description: "PO + GRN + Invoice verification, NRA tax withholding calculation, and payment clearance.",
        htmlPath: "stitch_procurement_data_management_system/invoice_matching/code.html",
        icon: "receipt_long",
      },
      {
        id: "transaction-audit-trail",
        label: "Transaction Audit Trail",
        description: "End-to-end BCF-TXN lifecycle tracker: Requisition → RFQ → PO → GRN → Invoice → Payment.",
        htmlPath: "stitch_procurement_data_management_system/transaction_audit_trail/code.html",
        icon: "timeline",
      },
      {
        id: "partnership-management",
        label: "Partnership Management Hub",
        description: "Central relationship-management, due diligence, MoUs, deliverables, and cross-module procurement linkage.",
        htmlPath: "stitch_procurement_data_management_system/partnership_management/code.html",
        icon: "handshake",
      },
      {
        id: "procurement-data",
        label: "Procurement Data Hub",
        description: "Master spend records, data pipelines, and ERP synchronization feeds.",
        htmlPath: "stitch_procurement_data_management_system/procurement_data_management/code.html",
        icon: "database",
      },
      {
        id: "inventory-management",
        label: "Inventory Management",
        description: "Consumable and programme stock control, warehouse receipts, issues, transfers, and real-time valuation.",
        htmlPath: "",
        icon: "inventory",
      },
      {
        id: "asset-management",
        label: "Asset Management",
        description: "Comprehensive capital and controlled asset register, QR tagging, employee assignments, maintenance, and disposals.",
        htmlPath: "",
        icon: "devices_other",
      },
    ],
  },
  {
    id: "programs",
    slug: "programs",
    label: "Programs Database",
    shortLabel: "Programs",
    description: "Manage BCF-SL programme portfolios, financial ledgers, donor/partner links, and evaluations.",
    icon: "folder_special",
    color: "from-orange-500 to-red-600",
    accentHex: "#ea580c",
    kpiLabel: "Number of Projects",
    kpiValue: "18",
    kpiTrend: "5 done • 13 undone",
    folderName: "stitch_programs_database_manager",
    subApps: [
      {
        id: "programs-database",
        label: "Programs Database",
        description: "Full portfolio view of all BCF-SL programmes with status and impact metrics.",
        htmlPath: "stitch_programs_database_manager/programs_database/code.html",
        icon: "list_alt",
      },
      {
        id: "programme-financials",
        label: "Financial Ledger",
        description: "Programme-level financial ledger tracking income and expenditure.",
        htmlPath: "stitch_programs_database_manager/financial_ledger/code.html",
        icon: "account_balance_wallet",
      },
      {
        id: "donors-partners",
        label: "Donors & Partners",
        description: "Link programmes to their funding donors and implementation partners.",
        htmlPath: "stitch_programs_database_manager/donors_partners/code.html",
        icon: "link",
      },
      {
        id: "performance-evaluation",
        label: "Performance Evaluation",
        description: "M&E reporting and performance rating for each BCF-SL programme.",
        htmlPath: "stitch_programs_database_manager/performance_evaluation/code.html",
        icon: "leaderboard",
      },
    ],
  },
  {
    id: "learning",
    slug: "learning",
    label: "Staff Learning & Professional Development",
    shortLabel: "Learning",
    description: "Integrated staff development system: access approved online courses through contracted learning partners (Coursera, Udemy, Microsoft Learn), 2-course semester slot governance, progress tracking, and verifiable certificates.",
    icon: "school",
    color: "from-blue-700 via-indigo-600 to-sky-700",
    accentHex: "#00236f",
    kpiLabel: "Active Term",
    kpiValue: "Sem 1, 2027",
    kpiTrend: "2 Slots / Term Quota",
    folderName: "stitch_staff_learning_management_portal",
    subApps: [
      {
        id: "course-allocation",
        label: "Course Catalogue & Allocation",
        description: "Browse contracted learning partner courses (Coursera, Udemy, Microsoft Learn) and allocate up to 2 optional courses per semester.",
        htmlPath: "stitch_staff_learning_management_portal/catalog_course_allocation/code.html",
        icon: "menu_book",
      },
      {
        id: "learning-grades",
        label: "My Learning & Grades",
        description: "Monitor enrolled course progress, modules, assessment test scores, and retake requirements (>80 pass mark).",
        htmlPath: "stitch_staff_learning_management_portal/my_learning_grades/code.html",
        icon: "fact_check",
      },
      {
        id: "certificates",
        label: "Assessments & Certificates",
        description: "View official verifiable certificates, transcript records, and achievements upon passing accredited courses.",
        htmlPath: "stitch_staff_learning_management_portal/assessment_certificate/code.html",
        icon: "workspace_premium",
      },
      {
        id: "account-creation",
        label: "Staff Account Creation (Admin Only)",
        description: "Single & batch staff account provisioning, credential generation for all 18 institutional personnel, and automated Gmail SMTP delivery.",
        htmlPath: "stitch_staff_learning_management_portal/admin_staff_provisioning/code.html?tab=accounts",
        icon: "person_add",
        adminOnly: true,
      },
      {
        id: "learning-dashboard",
        label: "Learning Dashboard & Analytics (Admin Only)",
        description: "Workforce capability telemetry, departmental completion matrix, partner academy distribution, and score tier analytics.",
        htmlPath: "stitch_staff_learning_management_portal/admin_staff_provisioning/code.html?tab=analytics",
        icon: "insights",
        adminOnly: true,
      },
    ],
  },
  {
    id: "discipline",
    slug: "discipline",
    label: "Discipline and Committee Module",
    shortLabel: "Discipline",
    description: "Manage committee registrations, disciplinary panels, and track confidential investigations and accused profiles.",
    icon: "gavel",
    color: "from-slate-700 to-slate-900",
    accentHex: "#334155",
    kpiLabel: "Active Cases",
    kpiValue: "0",
    kpiTrend: "Confidential",
    folderName: "stitch_discipline_committee_module",
    subApps: [
      {
        id: "committee-log",
        label: "Committee Registration Log",
        description: "Register members and assign them to various committees.",
        htmlPath: "stitch_discipline_committee_module/committee_registration_log/code.html",
        icon: "groups",
      },
      {
        id: "committee-profile",
        label: "Committee Profile",
        description: "View detailed profiles of registered committee members.",
        htmlPath: "stitch_discipline_committee_module/committee_profile/code.html",
        icon: "badge",
      },
      {
        id: "disciplinary-log",
        label: "Disciplinary Committee Log",
        description: "Register members for disciplinary panels.",
        htmlPath: "stitch_discipline_committee_module/disciplinary_committee_registration_log/code.html",
        icon: "admin_panel_settings",
      },
      {
        id: "disciplinary-profile",
        label: "Disciplinary Committee Profile",
        description: "View profiles of disciplinary committee members.",
        htmlPath: "stitch_discipline_committee_module/disciplinary_committee_profile/code.html",
        icon: "badge",
      },
      {
        id: "accused-profile",
        label: "Accused/Suspect Profile",
        description: "Confidential register for logging details of accused or suspected individuals.",
        htmlPath: "stitch_discipline_committee_module/accused_suspect_profile/code.html",
        icon: "person_alert",
      },
      {
        id: "investigation-cases",
        label: "Investigation Case Register",
        description: "Master log of all investigative cases linked to accused profiles.",
        htmlPath: "stitch_discipline_committee_module/investigation_case_register_log/code.html",
        icon: "manage_search",
      },
    ],
  },
  {
    id: "documents-policies",
    slug: "documents-policies",
    label: "Documents & Policies Management System",
    shortLabel: "Documents & Policies",
    description: "Official institutional repository for BCF-SL documents, policies, grant proposals, project charters, and comprehensive download audit tracking.",
    icon: "folder_managed",
    color: "from-blue-600 via-indigo-600 to-teal-700",
    accentHex: "#0284c7",
    kpiLabel: "Active Records",
    kpiValue: "100% Tracked",
    kpiTrend: "Audit Compliant",
    folderName: "documents_policies",
    subApps: [
      {
        id: "documents",
        label: "Documents",
        description: "Official institutional documentation, constitution, statutory filings, and administrative records.",
        htmlPath: "",
        icon: "description",
      },
      {
        id: "policies",
        label: "Policies",
        description: "Governance policies, safeguarding guidelines, anti-corruption frameworks, and standard operating procedures.",
        htmlPath: "",
        icon: "policy",
      },
      {
        id: "proposals",
        label: "Proposals",
        description: "Donor grant applications, funding proposals, partnership pitches, and concept notes.",
        htmlPath: "",
        icon: "assignment",
      },
      {
        id: "projects",
        label: "Projects",
        description: "Project charters, execution roadmaps, community impact deliverables, and monitoring reports.",
        htmlPath: "",
        icon: "account_tree",
      },
      {
        id: "employee-contracts",
        label: "Employee Contracts",
        description: "Official employee employment contracts, offer letters, renewals, amendments, and download audit trail.",
        htmlPath: "",
        icon: "badge",
      },
      {
        id: "deleted-items",
        label: "Deleted Items Log",
        description: "Audit trail and secure archive of soft-deleted documents, deletion justifications, and historical download logs.",
        htmlPath: "",
        icon: "auto_delete",
      },
    ],
  },
];

export function getModule(slug: string): Module | undefined {
  if (slug === "access-request" || slug === "access-approval") {
    return MODULES.find((m) => m.slug === "access");
  }
  return MODULES.find((m) => m.slug === slug);
}

export function getSubApp(moduleSlug: string, subAppId: string): SubApp | undefined {
  const mod = getModule(moduleSlug);
  if (!mod) return undefined;
  const directMatch = mod.subApps.find((s) => s.id === subAppId);
  if (directMatch) return directMatch;
  if (moduleSlug === "programs" && (subAppId === "financial-ledger" || subAppId === "financial_ledger")) {
    return mod.subApps.find((s) => s.id === "programme-financials");
  }
  if (moduleSlug === "beneficiaries" && (subAppId === "field-trust" || subAppId === "analytics")) {
    return mod.subApps.find((s) => s.id === "beneficiaries-analytics");
  }
  if (moduleSlug === "learning") {
    if (subAppId === "catalog" || subAppId === "course-allocation" || subAppId === "catalog-course-allocation" || subAppId === "enterprise-learning") {
      return mod.subApps.find((s) => s.id === "course-allocation");
    }
    if (subAppId === "my-learning" || subAppId === "learning-grades" || subAppId === "my-learning-grades") {
      return mod.subApps.find((s) => s.id === "learning-grades");
    }
    if (subAppId === "certificates" || subAppId === "assessment-certificate" || subAppId === "assessment") {
      return mod.subApps.find((s) => s.id === "certificates");
    }
    if (subAppId === "account-creation" || subAppId === "accounts" || subAppId === "staff-account-creation" || subAppId === "provisioning") {
      return mod.subApps.find((s) => s.id === "account-creation");
    }
    if (subAppId === "learning-dashboard" || subAppId === "dashboard" || subAppId === "learning-analytics" || subAppId === "analytics" || subAppId === "benchmarks" || subAppId === "governance" || subAppId === "admin-provisioning" || subAppId === "admin-staff-provisioning" || subAppId === "hr-dashboard") {
      return mod.subApps.find((s) => s.id === "learning-dashboard");
    }
    if (subAppId === "login" || subAppId === "staff-login" || subAppId === "signin") {
      return mod.subApps.find((s) => s.id === "course-allocation");
    }
  }
  return undefined;
}
