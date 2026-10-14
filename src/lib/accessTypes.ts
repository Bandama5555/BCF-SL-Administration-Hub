export type AccessRight = "Read" | "Write" | "View" | "Upload" | "Download";

export interface AccessCatalogueItem {
  id: string; // e.g. "finance-payroll-schedule"
  module: string; // e.g. "Finance"
  moduleSlug: string; // e.g. "finance"
  tab: string; // e.g. "Staff Payroll Schedule"
  tabId: string; // e.g. "payroll-schedule"
  requestable: boolean;
  sensitive: boolean;
  description?: string;
}

export type DurationType = "Permanent" | "Temporary";

export type AccessRequestStatus =
  | "Pending Department Director"
  | "Pending IT Director"
  | "Pending Super Admin"
  | "Granted (awaiting confirmation)"
  | "Active"
  | "Rejected"
  | "Cancelled"
  | "Declined"
  | "Expired"
  | "Revoked";

export type ApprovalStage = 0 | 1 | 2 | 3;

export interface AccessRequestItem {
  tab: string;
  tabId: string;
  module: string;
  moduleSlug: string;
  sensitive: boolean;
  rightsRequested: AccessRight[];
  rightsGranted?: AccessRight[];
}

export interface AccessRequestStep {
  id: string;
  requestId: string;
  stage: ApprovalStage;
  stageName: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  approverEmail?: string;
  action:
    | "Submitted"
    | "Viewed"
    | "Approved"
    | "Rejected"
    | "Granted"
    | "Accepted"
    | "Declined"
    | "Revoked"
    | "Cancelled";
  comment?: string;
  actedAt: string;
}

export type AccessRouteType = "A" | "B" | "C";

export interface AccessRequest {
  id: string;
  requestNumber: string; // e.g. BCF-ACC-2026-000001
  requesterId: string; // e.g. employeeId or userId
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  staffId: string;
  departmentId?: string;
  department: string;
  position: string;
  route?: AccessRouteType; // "A" | "B" | "C"
  routeName?: string; // e.g. "Route A: Staff (3 stages)"
  routeNote?: string;
  totalStages?: number; // 3 for A, 2 for B, 1 for C
  executive_management_id?: string;
  executiveManagementId?: string;
  executiveManagementName?: string;
  executiveManagementEmail?: string;
  executiveManagementPosition?: string;
  directorId?: string;
  directorName?: string;
  directorEmail?: string;
  directorPosition?: string;
  directorAssignedBy?: "system" | "fallback" | "applicant choice";
  directorFlaggedToAdmin?: boolean;
  module: string;
  moduleSlug: string;
  durationType: DurationType;
  endDate?: string | null;
  justification: string;
  document?: string | null;
  hasSensitiveTab: boolean;
  items: AccessRequestItem[];
  status: AccessRequestStatus;
  currentStage: ApprovalStage;
  currentApproverRole?: string;
  currentApproverDepartment?: string;
  steps: AccessRequestStep[];
  reducedRightsReason?: string | null;
  grantedBy?: string | null;
  grantedAt?: string | null;
  acceptedAt?: string | null;
  declinedReason?: string | null;
  cancelledReason?: string | null;
  rejectionReason?: string | null;
  revocationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessGrant {
  id: string;
  requestId: string;
  requestNumber: string;
  userId: string;
  userEmail: string;
  userName: string;
  staffId: string;
  department: string;
  module: string;
  moduleSlug: string;
  tab: string;
  tabId: string;
  rightsGranted: AccessRight[];
  grantedBy: string;
  grantedByName: string;
  grantedAt: string;
  acceptedAt: string;
  endDate?: string | null;
  status: "Active" | "Expired" | "Revoked";
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
}

export interface AccessNotification {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  requestId: string;
  requestNumber: string;
  title: string;
  message: string;
  category: "Access";
  isRead: boolean;
  createdAt: string;
}

export interface AccessSettings {
  id: "access_settings";
  fallbackStage1ApproverRole: string; // "CEO"
  fallbackStage2ApproverRole: string; // "SA"
  fallbackSuperAdminSelfGrant: string; // "CEO"
  acceptanceStatement: string;
  reminderDays: number; // default 3
  expiryDays: number; // default 7
  notifyHrOnAllRequests: boolean;
  updatedAt: string;
}

export type RevokeScope = "Module" | "Tab" | "Rights";

export type RevokeReasonCode =
  | "Role change"
  | "Transferred"
  | "Resigned or terminated"
  | "Misuse"
  | "Access no longer needed"
  | "Access expired"
  | "Security concern"
  | "Other";

export interface AccessRevocation {
  id: string;
  grant_id?: string;
  grantId?: string;
  staff_id: string;
  staffId: string;
  staffName?: string;
  staffEmail?: string;
  department?: string;
  position?: string;
  directorName?: string;
  module: string;
  moduleSlug?: string;
  tab?: string;
  tabId?: string;
  rights_removed: AccessRight[];
  rightsRemoved?: AccessRight[];
  scope: RevokeScope;
  reason_code: RevokeReasonCode;
  reasonCode?: RevokeReasonCode;
  reason_text?: string;
  reasonText?: string;
  revoked_by: string;
  revokedBy?: string;
  effective_at: string;
  effectiveAt?: string;
  revoked_at: string;
  revokedAt?: string;
  bulk_batch_id?: string | null;
  bulkBatchId?: string | null;
}
