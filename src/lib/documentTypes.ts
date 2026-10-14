import { type RoleCode } from "./permissions";
import { type DocumentTab } from "./documentPermissions";

export interface DocumentUserStamp {
  name: string;
  role: string;
  roleCode: RoleCode;
  email: string;
  date: string;
}

export interface DocumentDownloadEvent {
  id: string;
  name: string;
  role: string;
  roleCode: RoleCode;
  email: string;
  date: string;
  ip?: string;
}

export interface DocumentVersion {
  versionNumber: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData?: string;
  editedBy: DocumentUserStamp;
  changeSummary: string;
  editedAt: string;
}

export const CONTRACT_TYPES = [
  "Permanent",
  "Fixed-Term Contract",
  "Part-Time",
  "Casual",
  "Consultant",
  "Volunteer",
  "Intern",
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_TYPES_WITHOUT_END_DATE: readonly ContractType[] = [
  "Permanent",
  "Volunteer",
] as const;

export const CONTRACT_TYPES_WITH_END_DATE: readonly ContractType[] = [
  "Fixed-Term Contract",
  "Part-Time",
  "Casual",
  "Consultant",
  "Intern",
] as const;

export function contractHasEndDate(type?: string | null): boolean {
  if (!type) return false;
  return CONTRACT_TYPES_WITH_END_DATE.includes(type as ContractType);
}

export interface DocumentItem {
  id: string;
  _id?: string;
  title: string;
  description: string;
  category: "documents" | "policies" | "proposals" | "projects" | "employee-contracts";
  fileName: string;
  fileSize: number;
  fileType: string;
  fileExt: string;
  fileData?: string; // Base64 data string
  status: "Active" | "Deleted";
  subStatus?: string; // Draft, Submitted, Approved, Rejected / Planned, Ongoing, Completed

  // Contract-specific fields
  employeeId?: string; // foreign key to staff record
  employeeName?: string;
  employeeDept?: string;
  contractType?: ContractType;
  startDate?: string;
  endDate?: string | null;
  contractStatus?: "Active" | "Expired" | "Terminated" | "Superseded";

  effectiveDate?: string;
  relatedProgramDonor?: string;
  tags?: string[];
  uploadedBy: DocumentUserStamp;
  uploadedAt?: string;
  editedBy?: DocumentUserStamp;
  editedAt?: string;
  isDeleted?: boolean;
  downloadHistory: DocumentDownloadEvent[];
  downloadCount: number;
  versions: DocumentVersion[];
  currentVersion: number;
  deletedInfo?: {
    deletedBy: DocumentUserStamp;
    reason: string;
    deletedAt: string;
  };
  restoredInfo?: {
    restoredBy: DocumentUserStamp;
    restoredAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DocumentNotification {
  id: string;
  _id?: string;
  recipientUser: string;
  recipientRole?: RoleCode;
  action: "Added" | "Deleted" | "Restored";
  itemTitle: string;
  itemId: string;
  tab: DocumentTab;
  actorName: string;
  actorRole: string;
  actorEmail: string;
  timestamp: string;
  read: boolean;
  readAt?: string;
}
