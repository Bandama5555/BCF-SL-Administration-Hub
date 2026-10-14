/**
 * inventoryAssetTypes.ts — Master Types, Schemas and Access Controls
 * for Inventory Management and Asset Management (BCF-SL Integrated Procurement)
 */

import { type RoleCode } from "./permissions";

export type ProcurementTab =
  | "procurement-dashboard"
  | "purchase-requisition"
  | "supplier-management"
  | "rfq-management"
  | "purchase-order"
  | "goods-received-note"
  | "invoice-matching"
  | "transaction-audit-trail"
  | "partnership-management"
  | "procurement-data"
  | "inventory-management"
  | "asset-management";

export type PermissionLevel = "F" | "V" | "-";

export interface ProcurementPermissionRow {
  _id?: string;
  role: RoleCode;
  tab: "inventory-management" | "asset-management" | string;
  level: PermissionLevel;
  updatedAt: string;
}

/**
 * Official Access Rights Matrix for Inventory & Asset Management:
 * - Super Admin (SA): F (Full)
 * - Procurement Director (PRC): F (Full)
 * - HR Director (HR): V (View-only)
 * - CEO (CEO): V (View-only)
 * - Internal Audit & Risk Director (IAR): V (View-only)
 * - Staff (ST), Finance (FIN), Programs (PRG), IT (IT): Hidden (-)
 */
export const DEFAULT_PROCUREMENT_EXT_PERMISSIONS: Record<
  RoleCode,
  { "inventory-management": PermissionLevel; "asset-management": PermissionLevel }
> = {
  SA: { "inventory-management": "F", "asset-management": "F" },
  CEO: { "inventory-management": "V", "asset-management": "V" },
  PRC: { "inventory-management": "F", "asset-management": "F" },
  HR: { "inventory-management": "V", "asset-management": "V" },
  IAR: { "inventory-management": "V", "asset-management": "V" },
  ST: { "inventory-management": "-", "asset-management": "-" },
  FIN: { "inventory-management": "-", "asset-management": "-" },
  PRG: { "inventory-management": "-", "asset-management": "-" },
  IT: { "inventory-management": "-", "asset-management": "-" },
};

export function checkProcurementTabAccess(
  role: RoleCode,
  tab: "inventory-management" | "asset-management"
): { canView: boolean; canFull: boolean; level: PermissionLevel } {
  const level = DEFAULT_PROCUREMENT_EXT_PERMISSIONS[role]?.[tab] || "-";
  return {
    canView: level === "F" || level === "V",
    canFull: level === "F",
    level,
  };
}

// ─────────────────────────────────────────────────────────────
//  INVENTORY MANAGEMENT DATA MODELS
// ─────────────────────────────────────────────────────────────

export type ItemClass =
  | "Consumable"
  | "Programme Material"
  | "Spare Part"
  | "Controlled Item"
  | "Fixed Asset";

export interface InventoryItem {
  id: string; // e.g. INV-ITEM-0001
  stockCode: string; // e.g. BCF-ICT-0001
  name: string;
  description: string;
  category: string;
  subcategory: string;
  brand: string;
  model: string;
  sku: string;
  unit: string; // Carton, Box, Unit, Bag, Pack, Kg, Litre
  barcode?: string;
  serialNumber?: string;
  batchNumber?: string;
  itemClass: ItemClass;
  minStockLevel: number;
  maxStockLevel: number;
  reorderLevel: number;
  reorderQuantity: number;
  currentBalance: number;
  unitCost: number;
  totalValue: number;
  warehouseId?: string;
  warehouseName?: string;
  programmeId?: string;
  programmeName?: string;
  donorId?: string;
  donorName?: string;
  expiryDate?: string | null;
  isFixedAsset?: boolean;
  isPerishable?: boolean;
  isBatchTracked?: boolean;
  status: "In Stock" | "Low Stock" | "Out of Stock" | "Discontinued";
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStore {
  id: string; // e.g. BCF-STORE-001
  storeName: string;
  location: string;
  district: string;
  chiefdom: string;
  storekeeper: string;
  contact: string;
  storageType: string; // Central Warehouse, Regional Depot, Cold Storage, etc.
  capacity: number; // in items or units
  status: "Active" | "Inactive" | "Suspended" | "Closed" | "Maintenance" | string;
  // Security Personnel Details (Optional)
  securityName?: string;
  securityAddress?: string;
  securityPhone?: string;
  securityAgency?: string;
  securitySupervisorName?: string;
  securitySupervisorPhone?: string;
  securitySupervisorAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export type AdjustmentType =
  | "Damage"
  | "Loss"
  | "Theft"
  | "Expired"
  | "Counting Error"
  | "Data Correction"
  | "Donation"
  | "Returned Stock"
  | "Other";

export interface InventoryTransaction {
  id: string; // e.g. INV-TXN-2026-0001
  type: "RECEIPT" | "ISSUE" | "TRANSFER" | "RETURN" | "ADJUSTMENT" | "STOCK_COUNT";
  txnId?: string; // Master BCF-TXN
  referenceNumber: string; // e.g. GRN-001, ISS-2026-001, TRF-001, ADJ-001
  date: string;
  itemId: string;
  stockCode: string;
  itemName: string;
  storeId: string;
  storeName: string;
  quantity: number;
  previousBalance: number;
  newBalance: number;
  unit?: string;
  unitCost: number;
  totalValue: number;
  status: "Completed" | "Pending Approval" | "In Transit" | "Rejected" | "Reversed";
  // Receipt specific
  quantityReceived?: number;
  quantityRejected?: number;
  acceptedQuantity?: number;
  source?: string;
  poNumber?: string;
  supplier?: string;
  donorOwned?: boolean;
  consignmentNumber?: string;
  invoiceNumber?: string;
  batchNumber?: string;
  expiryDate?: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  reversalApprover?: string;
  approvedAt?: string;
  rejectionReason?: string;
  rejectedBy?: {
    name: string;
    role: string;
    email?: string;
  };
  rejectedAt?: string;
  // Issue specific
  quantityRequested?: number;
  isPartial?: boolean;
  remainingQuantity?: number;
  returnedQuantity?: number;
  location?: string;
  department?: string;
  programme?: string;
  donor?: string;
  beneficiary?: string;
  recipient?: string;
  purpose?: string;
  issuedBy?: {
    name: string;
    role: string;
    email?: string;
    title?: string;
  };
  issuedAt?: string;
  // Transfer specific
  sourceStoreId?: string;
  sourceStoreName?: string;
  destStoreId?: string;
  destStoreName?: string;
  // Return specific
  originalIssueNumber?: string;
  condition?: string;
  returnItems?: StockReturnItem[];
  employeeName?: string;
  staffId?: string;
  isNonStaff?: boolean;
  contact?: string;
  conditionVerified?: "Good" | "Damaged" | "Expired" | "Incomplete";
  inventoryUpdated?: "Yes" | "No";
  dateReceived?: string;
  reasonDetails?: string;
  // Adjustment specific
  adjustmentType?: AdjustmentType;
  reason?: string;
  supportingEvidence?: string;
  // Auth/Roles
  requestedBy: {
    name: string;
    role: string;
    email?: string;
  };
  approvedBy?: {
    name: string;
    role: string;
    email?: string;
  };
  authorizedBy?: string;
  receivedBy?: any;
  remarks?: string;
  createdAt: string;
}

export interface StockReturnItem {
  itemIndex: number;
  itemId: string;
  itemName: string;
  stockCode: string;
  storeId: string;
  storeName: string;
  issueNumber?: string;
  qtyIssued: number;
  qtyReturned: number;
  unit: string;
  unitCost: number;
  totalValue: number;
  condition: "Good" | "Damaged";
  remarks?: string;
  inventoryUpdated: boolean;
}

// ─────────────────────────────────────────────────────────────
//  ASSET MANAGEMENT DATA MODELS
// ─────────────────────────────────────────────────────────────

export type AssetStatus =
  | "Active"
  | "In Storage"
  | "Assigned"
  | "Under Maintenance"
  | "Damaged"
  | "Lost"
  | "Stolen"
  | "Disposed"
  | "Transferred"
  | "Retired";

export interface AssetAssignment {
  assignmentNumber: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  location: string;
  dateAssigned: string;
  conditionAtIssue: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  issuedBy: string;
  receivedBy: string;
  remarks?: string;
  active: boolean;
}

export interface AssetTransfer {
  transferNumber: string;
  fromEntity: string;
  toEntity: string;
  previousLocation: string;
  newLocation: string;
  reason: string;
  transferDate: string;
  approvedBy: string;
  releasedBy: string;
  receivedBy: string;
  remarks?: string;
}

export interface AssetMaintenance {
  maintenanceId: string;
  type: "Routine" | "Corrective" | "Emergency" | "Warranty Service";
  serviceProvider: string;
  date: string;
  problemReported: string;
  workPerformed: string;
  partsUsed?: string;
  labourCost: number;
  totalCost: number;
  warrantyStatus: string;
  nextServiceDate?: string;
  technician: string;
  supportingInvoice?: string;
  remarks?: string;
}

export interface AssetInspection {
  inspectionId: string;
  inspectionDate: string;
  physicalLocation: string;
  custodian: string;
  condition: "Excellent" | "Good" | "Fair" | "Poor" | "Damaged" | "Beyond Repair" | "Missing";
  serialNumberVerified: boolean;
  assetTagVerified: boolean;
  workingCondition: boolean;
  damageNotes?: string;
  inspector: string;
  findings: string;
  recommendedAction: string;
}

export interface AssetDisposal {
  disposalId: string;
  description: string;
  originalCost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  reason: string;
  method: "Sale" | "Donation" | "Transfer" | "Scrapping" | "Destruction" | "Return to supplier" | "Other approved method";
  approval: string;
  disposalDate: string;
  disposalValue: number;
  buyerRecipient?: string;
  disposalEvidence?: string;
  authorizedOfficer: string;
  financeConfirmation: boolean;
  confirmedAt?: string;
}

export interface AssetIncident {
  incidentNumber: string;
  custodian: string;
  dateReported: string;
  location: string;
  circumstances: string;
  policeReportNumber?: string;
  internalInvestigation: string;
  insuranceClaimStatus?: "Not Filed" | "Pending" | "Settled" | "Denied";
  recoveryStatus: "Pending" | "Recovered" | "Unrecovered";
  managementDecision: string;
  responsibleOfficer: string;
  resolution?: string;
}

export interface AssetRecord {
  id: string; // Unique Asset ID e.g. BCF-AST-2026-000001
  assetTag: string; // format BCF-AST-YYYY-NNNNNN
  name: string;
  category: string;
  subcategory: string;
  description: string;
  brand: string;
  model: string;
  serialNumber: string;
  barcode: string;
  qrCodeData: string;

  // Procurement Linkage
  procurementId?: string;
  txnId?: string; // Master BCF-TXN
  prNumber?: string;
  poNumber?: string;
  grnNumber?: string;
  supplier: string;
  purchaseDate: string;
  purchaseCost: number;
  invoiceNumber?: string;
  fundingSource?: string;

  // Organizational
  department: string;
  programme?: string;
  project?: string;
  donor?: string;
  location: string;
  custodian?: string;
  custodianEmployeeId?: string;
  responsibleOfficer: string;

  // Financial & Depreciation
  assetCost: number;
  currency: string;
  acquisitionDate: string;
  depreciationMethod: "Straight Line" | "Reducing Balance" | "None";
  usefulLife: number; // in years
  usefulLifeYears?: number;
  residualValue: number;
  accumulatedDepreciation: number;
  periodicDepreciation?: number;
  netBookValue: number;

  // Operational State
  status: AssetStatus;
  warrantyExpiry?: string;

  // Lifecycle Sub-Collections embedded for instant tracing
  assignments: AssetAssignment[];
  transfers: AssetTransfer[];
  maintenance: AssetMaintenance[];
  inspections: AssetInspection[];
  incidents: AssetIncident[];
  disposal?: AssetDisposal;

  createdAt: string;
  updatedAt: string;
}

export type AssetCategory = string;

export interface CategoryRegisterItem {
  id: string;
  code: string;
  name: string;
  icon: string;
  classification: "Tangible Fixed Asset" | "Controlled Asset" | "Intangible Asset" | "Capital Equipment";
  glAccountCode: string;
  subcategories: string[];
  usefulLifeYears: number;
  depreciationMethod: "Straight Line" | "Reducing Balance" | "None";
  annualDepreciationRate: number;
  residualPercentage: number;
  responsibleDepartment: string;
  description: string;
  status: "Active" | "Under Review" | "Phased Out";
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_ASSET_CATEGORIES: CategoryRegisterItem[] = [
  {
    id: "CAT-IT-001",
    code: "CAT-IT-001",
    name: "IT Equipment & Technology",
    icon: "desktop_windows",
    classification: "Tangible Fixed Asset",
    glAccountCode: "1510 - Computer & Office IT Hardware",
    subcategories: ["Desktop PCs", "All-in-One Workstations", "Monitors & Peripherals", "Docking Stations"],
    usefulLifeYears: 4,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 25,
    residualPercentage: 5,
    responsibleDepartment: "IT & Communications Directorate",
    description: "Enterprise computing equipment, desktop systems, workstations, and IT technology infrastructure.",
    status: "Active",
  },
  {
    id: "CAT-LAP-002",
    code: "CAT-LAP-002",
    name: "Laptops & Notebooks",
    icon: "laptop_mac",
    classification: "Tangible Fixed Asset",
    glAccountCode: "1511 - Portable Computing Equipment",
    subcategories: ["Standard Business Laptops", "Field Ultrabooks", "Ruggedised Laptops", "Executive MacBooks"],
    usefulLifeYears: 3,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 33.3,
    residualPercentage: 5,
    responsibleDepartment: "IT & Communications Directorate",
    description: "Portable business laptops, mobile ultrabooks, and executive field computing assets.",
    status: "Active",
  },
  {
    id: "CAT-SRV-003",
    code: "CAT-SRV-003",
    name: "Servers & Network Equipment",
    icon: "dns",
    classification: "Tangible Fixed Asset",
    glAccountCode: "1512 - Datacenter & Enterprise Network Hardware",
    subcategories: ["Rack Servers", "Managed Switches", "Firewalls & Routers", "UPS Rack Systems", "NAS Storage"],
    usefulLifeYears: 5,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 20,
    residualPercentage: 5,
    responsibleDepartment: "IT & Communications Directorate",
    description: "Enterprise rackmount servers, managed network switches, routers, and core data center infrastructure.",
    status: "Active",
  },
  {
    id: "CAT-PRN-004",
    code: "CAT-PRN-004",
    name: "Printers & Scanners",
    icon: "print",
    classification: "Tangible Fixed Asset",
    glAccountCode: "1513 - Printing & Imaging Equipment",
    subcategories: ["Multifunction Photocopiers", "Network Laser Printers", "High-Speed Document Scanners", "ID Badge Printers"],
    usefulLifeYears: 4,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 25,
    residualPercentage: 5,
    responsibleDepartment: "Administration & Logistics",
    description: "High-capacity network laser printers, departmental multifunction copiers, and digitisation scanners.",
    status: "Active",
  },
  {
    id: "CAT-VEH-005",
    code: "CAT-VEH-005",
    name: "Vehicles & Transport",
    icon: "directions_car",
    classification: "Tangible Fixed Asset",
    glAccountCode: "1520 - Motor Vehicles & Transportation Fleet",
    subcategories: ["4x4 Field Vehicles", "Passenger Sedans", "Field Motorcycles", "Utility Cargo Trucks", "Ambulances"],
    usefulLifeYears: 5,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 20,
    residualPercentage: 10,
    responsibleDepartment: "Operations & Fleet Management",
    description: "Institutional vehicle fleet, 4WD field mission vehicles, utility pickups, and operational transport.",
    status: "Active",
  },
  {
    id: "CAT-PWR-006",
    code: "CAT-PWR-006",
    name: "Generators & Power",
    icon: "bolt",
    classification: "Tangible Fixed Asset",
    glAccountCode: "1530 - Plant, Generators & Auxiliary Power",
    subcategories: ["Heavy Industrial Diesel Gensets", "Soundproof Backup Generators", "Automatic Transfer Switches (ATS)"],
    usefulLifeYears: 7,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 14.3,
    residualPercentage: 10,
    responsibleDepartment: "Facilities & Estates Directorate",
    description: "Prime and standby diesel generation systems, automatic transfer switchboards, and heavy power units.",
    status: "Active",
  },
  {
    id: "CAT-FUR-007",
    code: "CAT-FUR-007",
    name: "Office Furniture & Fixtures",
    icon: "chair",
    classification: "Tangible Fixed Asset",
    glAccountCode: "1540 - Office Furniture, Fittings & Fixtures",
    subcategories: ["Executive Desks", "Ergonomic Task Chairs", "Boardroom Tables", "Steel Filing Cabinets", "Fireproof Safes"],
    usefulLifeYears: 8,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 12.5,
    residualPercentage: 5,
    responsibleDepartment: "Administration & Logistics",
    description: "Long-term office furnishings, ergonomic workstations, boardroom suites, and fireproof storage fixtures.",
    status: "Active",
  },
  {
    id: "CAT-AV-008",
    code: "CAT-AV-008",
    name: "Cameras & Audio-Visual",
    icon: "photo_camera",
    classification: "Controlled Asset",
    glAccountCode: "1550 - Audio-Visual & Media Production Equipment",
    subcategories: ["DSLR / Mirrorless Cameras", "Broadcast Camcorders", "Field Audio Recorders", "Studio Lighting & Wireless Mics"],
    usefulLifeYears: 4,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 25,
    residualPercentage: 5,
    responsibleDepartment: "Communications & Media Unit",
    description: "Professional media recording cameras, documentary kits, field broadcast gear, and studio equipment.",
    status: "Active",
  },
  {
    id: "CAT-DSP-009",
    code: "CAT-DSP-009",
    name: "Projectors & Displays",
    icon: "tv",
    classification: "Tangible Fixed Asset",
    glAccountCode: "1551 - Presentation & Large Display Systems",
    subcategories: ["Laser Projectors", "Interactive Smart Panels", "Conference Large Displays", "Motorised Screens"],
    usefulLifeYears: 4,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 25,
    residualPercentage: 5,
    responsibleDepartment: "IT & Communications Directorate",
    description: "Conference and training presentation systems, smart interactive interactive panels, and digital signage.",
    status: "Active",
  },
  {
    id: "CAT-SLR-010",
    code: "CAT-SLR-010",
    name: "Solar & Renewable Energy",
    icon: "solar_power",
    classification: "Tangible Fixed Asset",
    glAccountCode: "1535 - Renewable Energy & Solar Installations",
    subcategories: ["Monocrystalline Solar Panels", "Hybrid Inverters", "Lithium Battery Storage (LiFePO4)", "Solar Water Pumps"],
    usefulLifeYears: 10,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 10,
    residualPercentage: 5,
    responsibleDepartment: "Facilities & Estates Directorate",
    description: "Photovoltaic solar generation arrays, hybrid inverters, energy storage battery banks, and solar pumping assets.",
    status: "Active",
  },
  {
    id: "CAT-COM-011",
    code: "CAT-COM-011",
    name: "Communication Equipment",
    icon: "cell_tower",
    classification: "Controlled Asset",
    glAccountCode: "1560 - Telecommunications & Radio Systems",
    subcategories: ["HF/VHF Base Transceivers", "Two-Way Handheld Radios", "Satellite Phones (Thuraya / Iridium)", "VSAT Terminals"],
    usefulLifeYears: 5,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 20,
    residualPercentage: 5,
    responsibleDepartment: "Security & Field Logistics",
    description: "Long-range base communications, two-way UHF/VHF handheld radios, satellite emergency phones, and antennas.",
    status: "Active",
  },
  {
    id: "CAT-MED-012",
    code: "CAT-MED-012",
    name: "Medical & Lab Equipment",
    icon: "medical_services",
    classification: "Tangible Fixed Asset",
    glAccountCode: "1570 - Health, Medical & Clinical Diagnostic Assets",
    subcategories: ["Diagnostic Analyzers", "Centrifuges & Incubators", "Portable Ultrasound Scanners", "Solar Vaccine Coolers"],
    usefulLifeYears: 5,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 20,
    residualPercentage: 5,
    responsibleDepartment: "Health Programmes Directorate",
    description: "Diagnostic clinical instruments, laboratory testing centrifuges, cold-chain immunization fridges, and medical devices.",
    status: "Active",
  },
  {
    id: "CAT-OTH-013",
    code: "CAT-OTH-013",
    name: "Other Equipment",
    icon: "handyman",
    classification: "Capital Equipment",
    glAccountCode: "1590 - Miscellaneous Fixed Capital Equipment",
    subcategories: ["Specialized Workshop Tools", "Borehole Drilling Gear", "Surveying Instruments", "Perimeter Security Systems"],
    usefulLifeYears: 5,
    depreciationMethod: "Straight Line",
    annualDepreciationRate: 20,
    residualPercentage: 5,
    responsibleDepartment: "Procurement & Asset Unit",
    description: "Specialized field tools, hydrogeological testing equipment, surveying gear, and compound security apparatus.",
    status: "Active",
  },
];

// ─────────────────────────────────────────────────────────────
//  PROCUREMENT INTEGRATED SETTINGS
// ─────────────────────────────────────────────────────────────

export interface ProcurementSettings {
  _id?: any;
  capitalisationThreshold: number; // Default 5000 NLe
  valuationMethod: "FIFO" | "Weighted Average";
  expiryWarningDays: number; // Default 60 days
  currency: string;
  depreciationRates: Record<
    string,
    {
      usefulLifeYears: number;
      method: "Straight Line" | "Reducing Balance";
      residualPercent: number;
    }
  >;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_PROCUREMENT_SETTINGS: ProcurementSettings = {
  capitalisationThreshold: 5000,
  valuationMethod: "FIFO",
  expiryWarningDays: 60,
  currency: "NLe",
  depreciationRates: {
    "IT Equipment & Technology": { usefulLifeYears: 3, method: "Straight Line", residualPercent: 5 },
    "Vehicles & Transport": { usefulLifeYears: 5, method: "Straight Line", residualPercent: 10 },
    "Furniture & Fittings": { usefulLifeYears: 7, method: "Straight Line", residualPercent: 5 },
    "Communication & Media": { usefulLifeYears: 3, method: "Straight Line", residualPercent: 5 },
    "Power & Generators": { usefulLifeYears: 5, method: "Straight Line", residualPercent: 10 },
    "Office Equipment": { usefulLifeYears: 4, method: "Straight Line", residualPercent: 5 },
    "Medical & Health Equipment": { usefulLifeYears: 5, method: "Straight Line", residualPercent: 5 },
  },
  updatedAt: new Date().toISOString(),
};
