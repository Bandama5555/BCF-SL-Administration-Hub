"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  type AssetRecord,
  type AssetCategory,
  type AssetStatus,
  type AssetAssignment,
  type AssetTransfer,
  type AssetMaintenance,
  type AssetInspection,
  type AssetDisposal,
  type AssetIncident,
  type CategoryRegisterItem,
  DEFAULT_ASSET_CATEGORIES,
} from "@/lib/inventoryAssetTypes";
import { getUser, type AuthUser } from "@/lib/auth";
import { normalizeRole, type RoleCode } from "@/lib/permissions";

type SubSection =
  | "dashboard"
  | "register"
  | "categories"
  | "tagging"
  | "assignments"
  | "transfers"
  | "maintenance"
  | "inspections"
  | "incidents"
  | "disposals"
  | "depreciation"
  | "reports"
  | "audit";

const CATEGORIES: AssetCategory[] = [
  "IT Equipment & Technology",
  "Laptops & Notebooks",
  "Servers & Network Equipment",
  "Printers & Scanners",
  "Vehicles & Transport",
  "Generators & Power",
  "Office Furniture & Fixtures",
  "Cameras & Audio-Visual",
  "Projectors & Displays",
  "Solar & Renewable Energy",
  "Communication Equipment",
  "Medical & Lab Equipment",
  "Other Equipment",
];

export function AssetManagementView() {
  const [activeSection, setActiveSection] = useState<SubSection>("dashboard");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canFull, setCanFull] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  // Categories Register States
  const [categoriesList, setCategoriesList] = useState<CategoryRegisterItem[]>(DEFAULT_ASSET_CATEGORIES);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [categoryClassFilter, setCategoryClassFilter] = useState("ALL");
  const [categoryDeprFilter, setCategoryDeprFilter] = useState("ALL");
  const [categoryViewMode, setCategoryViewMode] = useState<"table" | "cards">("table");
  const [selectedCategoryForDrilldown, setSelectedCategoryForDrilldown] = useState<CategoryRegisterItem | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [categoryModalForm, setCategoryModalForm] = useState({
    code: "",
    name: "",
    icon: "category",
    classification: "Tangible Fixed Asset" as "Tangible Fixed Asset" | "Controlled Asset" | "Intangible Asset" | "Capital Equipment",
    glAccountCode: "1510 - Fixed Assets",
    subcategoriesText: "",
    usefulLifeYears: 5,
    depreciationMethod: "Straight Line" as "Straight Line" | "Reducing Balance" | "None",
    annualDepreciationRate: 20,
    residualPercentage: 5,
    responsibleDepartment: "Operations & Administration",
    description: "",
    status: "Active" as "Active" | "Under Review" | "Phased Out",
  });

  // Selection & Modals
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(null);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [isDisposalModalOpen, setIsDisposalModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [targetAssetForAction, setTargetAssetForAction] = useState<AssetRecord | null>(null);

  // Forms
  const [newAssetForm, setNewAssetForm] = useState({
    name: "",
    category: "Laptops & Notebooks" as AssetCategory,
    subcategory: "Standard Business Laptops",
    description: "",
    brand: "",
    model: "",
    serialNumber: "",
    department: "Executive & Administration",
    programme: "Institutional Capacity Building",
    location: "BCF Head Office, Freetown",
    assetCost: 18500,
    depreciationMethod: "Straight Line" as const,
    usefulLifeYears: 4,
    residualValue: 1000,
    poNumber: "BCF-PO-2026-0088",
    grnNumber: "BCF-GRN-2026-0088",
    supplier: "Sierra Business Solutions Ltd",
    donor: "Core Institutional Fund",
  });

  const [assignForm, setAssignForm] = useState({
    employeeId: "BCF-EMP-0012",
    employeeName: "Mariama Kargbo",
    department: "Programs Department",
    position: "Senior Field Coordinator",
    location: "Bo Field Office",
    conditionAtIssue: "Excellent / New in Box",
    expectedReturnDate: "",
    remarks: "Issued for field operations.",
  });

  const [transferForm, setTransferForm] = useState({
    fromEntity: "",
    toEntity: "Internal Audit Directorate",
    previousLocation: "",
    newLocation: "Makeni District Office",
    reason: "Operational redeployment",
    remarks: "Transfer approved by Director.",
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    type: "Routine" as const,
    serviceProvider: "Alpha Tech Solutions Freetown",
    date: new Date().toISOString().split("T")[0],
    problemReported: "Preventive maintenance & thermal check",
    workPerformed: "Cleaned internal fans, system diagnostics passed",
    labourCost: 350,
    totalCost: 350,
    warrantyStatus: "Under Warranty",
    nextServiceDate: new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0],
    technician: "Mohamed Kamara",
    remarks: "Completed within 24 hours.",
  });

  const [inspectionForm, setInspectionForm] = useState({
    inspectionDate: new Date().toISOString().split("T")[0],
    physicalLocation: "BCF Head Office, Freetown",
    condition: "Good" as const,
    serialNumberVerified: true,
    assetTagVerified: true,
    workingCondition: true,
    findings: "Asset physical integrity and tag verified.",
    recommendedAction: "Continue regular operation.",
  });

  const [disposalForm, setDisposalForm] = useState({
    reason: "End of economic useful life and obsolete technology.",
    method: "Scrapping" as const,
    disposalDate: new Date().toISOString().split("T")[0],
    disposalValue: 500,
    buyerRecipient: "Certified E-Waste Recycler SL",
    disposalEvidence: "Disposal Board Resolution #BCF-DSP-2026-04",
    authorizedOfficer: "Albert J Bandama (Super Admin)",
  });

  const [incidentForm, setIncidentForm] = useState({
    incidentType: "Lost" as "Lost" | "Stolen" | "Damaged",
    dateReported: new Date().toISOString().split("T")[0],
    location: "Koidu Field Base",
    circumstances: "Missing after field team transit.",
    policeReportNumber: "SLP-CR-2026-9042",
    internalInvestigation: "Formal inquiry initiated with logistics team.",
    recoveryStatus: "Pending" as const,
    managementDecision: "Escalated to Internal Audit & Risk Director.",
  });

  useEffect(() => {
    const u = getUser();
    setUser(u);
    const roleCode = normalizeRole(u?.role, u?.username, u?.email);
    setCanFull(roleCode === "SA" || roleCode === "PRC");
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const headers = { "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" };

      // Ensure seed data exists
      await fetch("/api/procurement/seed", { headers }).catch(() => {});

      const [assetsRes, dashRes, catRes] = await Promise.all([
        fetch("/api/procurement/assets", { headers }),
        fetch("/api/procurement/assets/dashboard", { headers }),
        fetch("/api/procurement/assets/categories", { headers }).catch(() => null),
      ]);

      if (assetsRes.ok) {
        const data = await assetsRes.json();
        setAssets(data.assets || []);
      }
      if (dashRes.ok) {
        const d = await dashRes.json();
        setMetrics(d.metrics || null);
      }
      if (catRes && catRes.ok) {
        const cData = await catRes.json();
        if (Array.isArray(cData.categories) && cData.categories.length > 0) {
          setCategoriesList(cData.categories);
        }
      }
    } catch (err) {
      console.error("Failed to load asset data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Match assets to categories intelligently
  const getCategoryAssets = (catName: string) => {
    const c = catName.toLowerCase().trim();
    return assets.filter((a) => {
      if (!a.category) return false;
      const ac = a.category.toLowerCase().trim();
      if (ac === c) return true;
      if (
        (c === "it equipment & technology" || c === "computers & it") &&
        (ac.includes("it equipment") || ac.includes("technology") || ac.includes("computer"))
      ) return true;
      if (c === "laptops & notebooks" && (ac.includes("laptop") || ac.includes("notebook"))) return true;
      if (c === "vehicles & transport" && (ac.includes("vehicle") || ac.includes("transport") || ac.includes("fleet"))) return true;
      if (c === "generators & power" && (ac.includes("generator") || ac.includes("power") || ac.includes("genset"))) return true;
      if (c === "office furniture & fixtures" && (ac.includes("furniture") || ac.includes("fixture") || ac.includes("fitting"))) return true;
      if (c === "solar & renewable energy" && (ac.includes("solar") || ac.includes("renewable"))) return true;
      if (c === "communication equipment" && (ac.includes("communication") || ac.includes("radio"))) return true;
      if (c === "medical & lab equipment" && (ac.includes("medical") || ac.includes("lab") || ac.includes("health"))) return true;
      return false;
    });
  };

  // Helper: Aggregate financial stats per category
  const getCategoryStats = (cat: CategoryRegisterItem) => {
    const catAssets = getCategoryAssets(cat.name);
    const totalCost = catAssets.reduce((sum, a) => sum + (a.assetCost || 0), 0);
    const totalNbv = catAssets.reduce((sum, a) => sum + (a.netBookValue || 0), 0);
    const totalDepr = Math.max(0, totalCost - totalNbv);
    const retainedPct = totalCost > 0 ? ((totalNbv / totalCost) * 100).toFixed(1) : "100.0";
    return {
      units: catAssets.length,
      totalCost,
      totalNbv,
      totalDepr,
      retainedPct,
      assets: catAssets,
    };
  };

  // Filtered Categories for Register
  const filteredCategories = useMemo(() => {
    return categoriesList.filter((cat) => {
      const q = categorySearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        cat.name.toLowerCase().includes(q) ||
        cat.code.toLowerCase().includes(q) ||
        cat.glAccountCode.toLowerCase().includes(q) ||
        cat.responsibleDepartment.toLowerCase().includes(q) ||
        cat.subcategories.some((s) => s.toLowerCase().includes(q));

      const matchClass =
        categoryClassFilter === "ALL" || cat.classification === categoryClassFilter;

      const matchDepr =
        categoryDeprFilter === "ALL" || cat.depreciationMethod === categoryDeprFilter;

      return matchSearch && matchClass && matchDepr;
    });
  }, [categoriesList, categorySearchQuery, categoryClassFilter, categoryDeprFilter]);

  // Actions for Categories Register
  const handleViewCategoryInRegister = (categoryName: string) => {
    setCategoryFilter(categoryName);
    setActiveSection("register");
  };

  const handleQuickRegisterAsset = (categoryName: string) => {
    setNewAssetForm((prev) => ({
      ...prev,
      category: categoryName as AssetCategory,
    }));
    setIsAddAssetOpen(true);
  };

  const handleOpenAddCategory = () => {
    const nextNum = categoriesList.length + 1;
    setCategoryModalForm({
      code: `CAT-AST-${String(nextNum).padStart(3, "0")}`,
      name: "",
      icon: "category",
      classification: "Tangible Fixed Asset",
      glAccountCode: "1590 - Miscellaneous Fixed Capital Equipment",
      subcategoriesText: "",
      usefulLifeYears: 5,
      depreciationMethod: "Straight Line",
      annualDepreciationRate: 20,
      residualPercentage: 5,
      responsibleDepartment: "Operations & Administration",
      description: "",
      status: "Active",
    });
    setIsAddCategoryOpen(true);
  };

  const handleOpenEditCategory = (cat: CategoryRegisterItem) => {
    setCategoryModalForm({
      code: cat.code,
      name: cat.name,
      icon: cat.icon || "category",
      classification: cat.classification,
      glAccountCode: cat.glAccountCode,
      subcategoriesText: cat.subcategories.join(", "),
      usefulLifeYears: cat.usefulLifeYears,
      depreciationMethod: cat.depreciationMethod,
      annualDepreciationRate: cat.annualDepreciationRate,
      residualPercentage: cat.residualPercentage,
      responsibleDepartment: cat.responsibleDepartment,
      description: cat.description,
      status: cat.status,
    });
    setIsEditCategoryOpen(true);
  };

  const handleSaveCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const subcats = categoryModalForm.subcategoriesText
        ? categoryModalForm.subcategoriesText.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const payload = {
        code: categoryModalForm.code,
        name: categoryModalForm.name,
        icon: categoryModalForm.icon || "category",
        classification: categoryModalForm.classification,
        glAccountCode: categoryModalForm.glAccountCode,
        subcategories: subcats,
        usefulLifeYears: Number(categoryModalForm.usefulLifeYears) || 5,
        depreciationMethod: categoryModalForm.depreciationMethod,
        annualDepreciationRate: Number(categoryModalForm.annualDepreciationRate) || 20,
        residualPercentage: Number(categoryModalForm.residualPercentage) || 5,
        responsibleDepartment: categoryModalForm.responsibleDepartment,
        description: categoryModalForm.description,
        status: categoryModalForm.status,
      };

      const res = await fetch("/api/procurement/assets/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bcf-user-role": roleCode,
          "x-bcf-name": u?.name || "",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save category");

      setCategoriesList((prev) => {
        const idx = prev.findIndex(
          (c) => c.code.toLowerCase() === payload.code.toLowerCase() || c.name.toLowerCase() === payload.name.toLowerCase()
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...payload, id: next[idx].id };
          return next;
        } else {
          return [...prev, { ...payload, id: payload.code }];
        }
      });

      setIsAddCategoryOpen(false);
      setIsEditCategoryOpen(false);
      alert(data.message || "Category policy saved successfully.");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchSearch =
        !searchQuery ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.assetTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.serialNumber && a.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.custodian && a.custodian.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCat = categoryFilter === "ALL" || a.category === categoryFilter;
      const matchStat = statusFilter === "ALL" || a.status === statusFilter;
      const matchDept = departmentFilter === "ALL" || a.department === departmentFilter;
      return matchSearch && matchCat && matchStat && matchDept;
    });
  }, [assets, searchQuery, categoryFilter, statusFilter, departmentFilter]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.department) set.add(a.department);
    });
    return Array.from(set);
  }, [assets]);

  // Handlers for mutations (guarded by canFull)
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull) return;
    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" },
        body: JSON.stringify(newAssetForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create asset");
      setIsAddAssetOpen(false);
      fetchData();
      alert(`Asset registered successfully with Tag: ${data.asset.assetTag}`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull || !targetAssetForAction) return;
    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/assets/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" },
        body: JSON.stringify({
          action: "ASSIGN",
          assetId: targetAssetForAction.id,
          ...assignForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign asset");
      setIsAssignModalOpen(false);
      setTargetAssetForAction(null);
      fetchData();
      alert(data.message || "Asset assigned successfully.");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleReturnToStorage = async (asset: AssetRecord) => {
    if (!canFull) return;
    if (!confirm(`Return ${asset.assetTag} (${asset.name}) back to Central Storage?`)) return;
    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/assets/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" },
        body: JSON.stringify({
          action: "RETURN_ASSIGNMENT",
          assetId: asset.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to return asset");
      fetchData();
      alert(data.message);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull || !targetAssetForAction) return;
    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/assets/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" },
        body: JSON.stringify({
          action: "TRANSFER",
          assetId: targetAssetForAction.id,
          fromEntity: transferForm.fromEntity || targetAssetForAction.department,
          toEntity: transferForm.toEntity,
          previousLocation: transferForm.previousLocation || targetAssetForAction.location,
          newLocation: transferForm.newLocation,
          reason: transferForm.reason,
          remarks: transferForm.remarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to transfer asset");
      setIsTransferModalOpen(false);
      setTargetAssetForAction(null);
      fetchData();
      alert(data.message || "Asset transferred.");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull || !targetAssetForAction) return;
    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/assets/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" },
        body: JSON.stringify({
          action: "MAINTENANCE",
          assetId: targetAssetForAction.id,
          ...maintenanceForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log maintenance");
      setIsMaintenanceModalOpen(false);
      setTargetAssetForAction(null);
      fetchData();
      alert(data.message || "Maintenance record saved.");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull || !targetAssetForAction) return;
    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/assets/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" },
        body: JSON.stringify({
          action: "INSPECTION",
          assetId: targetAssetForAction.id,
          ...inspectionForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log inspection");
      setIsInspectionModalOpen(false);
      setTargetAssetForAction(null);
      fetchData();
      alert(data.message || "Inspection record saved.");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDisposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull || !targetAssetForAction) return;
    if (
      !confirm(
        `Are you sure you want to officially dispose ${targetAssetForAction.assetTag}? The asset will remain in the register with status 'Disposed' and cannot be assigned thereafter.`
      )
    )
      return;
    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/assets/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" },
        body: JSON.stringify({
          action: "DISPOSE",
          assetId: targetAssetForAction.id,
          ...disposalForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record disposal");
      setIsDisposalModalOpen(false);
      setTargetAssetForAction(null);
      fetchData();
      alert(data.message || "Asset marked as Disposed.");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFull || !targetAssetForAction) return;
    try {
      const u = getUser();
      const roleCode = normalizeRole(u?.role, u?.username, u?.email);
      const res = await fetch("/api/procurement/assets/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bcf-user-role": roleCode, "x-bcf-name": u?.name || "" },
        body: JSON.stringify({
          action: "INCIDENT",
          assetId: targetAssetForAction.id,
          ...incidentForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log incident");
      setIsIncidentModalOpen(false);
      setTargetAssetForAction(null);
      fetchData();
      alert(data.message || "Incident logged.");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const exportCSV = (type: string) => {
    let rows: any[] = [];
    let filename = `bcf_${type}_export_${new Date().toISOString().split("T")[0]}.csv`;

    if (type === "asset_register") {
      rows = filteredAssets.map((a) => ({
        "Asset Tag": a.assetTag,
        Name: a.name,
        Category: a.category,
        "Serial Number": a.serialNumber || "N/A",
        Cost: a.assetCost,
        NBV: a.netBookValue,
        Status: a.status,
        Custodian: a.custodian || "Unassigned",
        Department: a.department,
        Location: a.location,
        "PO Number": a.poNumber,
        "GRN Number": a.grnNumber,
      }));
    } else if (type === "depreciation") {
      rows = filteredAssets.map((a) => ({
        "Asset Tag": a.assetTag,
        Name: a.name,
        Category: a.category,
        "Acquisition Date": a.acquisitionDate,
        Cost: a.assetCost,
        Method: a.depreciationMethod,
        "Useful Life (Yrs)": a.usefulLifeYears,
        "Periodic Depr": a.periodicDepreciation,
        "Acc Depr": a.accumulatedDepreciation,
        NBV: a.netBookValue,
      }));
    } else if (type === "categories_register") {
      rows = filteredCategories.map((c) => {
        const stats = getCategoryStats(c);
        return {
          "Category Code": c.code,
          "Category Name": c.name,
          Classification: c.classification,
          "GL Account Code": c.glAccountCode,
          Subcategories: c.subcategories.join("; "),
          "Units Tracked": stats.units,
          "Total Acquisition Cost (NLe)": stats.totalCost,
          "Net Book Value (NLe)": stats.totalNbv,
          "Useful Life": `${c.usefulLifeYears} Years`,
          "Depreciation Method": c.depreciationMethod,
          "Annual Depreciation Rate (%)": `${c.annualDepreciationRate}%`,
          "Residual Value (%)": `${c.residualPercentage}%`,
          "Responsible Department": c.responsibleDepartment,
          Status: c.status,
          Description: c.description,
        };
      });
    }

    if (!rows.length) {
      alert("No records to export.");
      return;
    }

    const headers = Object.keys(rows[0]).join(",");
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const subSections = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "register", label: "Asset Register", icon: "inventory" },
    { id: "categories", label: "Categories", icon: "category" },
    { id: "tagging", label: "Asset Tagging", icon: "qr_code_2" },
    { id: "assignments", label: "Assignments", icon: "badge" },
    { id: "transfers", label: "Transfers", icon: "swap_horiz" },
    { id: "maintenance", label: "Maintenance", icon: "build" },
    { id: "inspections", label: "Inspections", icon: "verified" },
    { id: "incidents", label: "Lost & Damaged", icon: "warning" },
    { id: "disposals", label: "Disposals", icon: "delete_sweep" },
    { id: "depreciation", label: "Depreciation", icon: "trending_down" },
    { id: "reports", label: "Reports", icon: "summarize" },
    { id: "audit", label: "Asset Audit", icon: "policy" },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar inside page */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-x-auto">
        <div className="flex border-b border-slate-200 px-4 gap-1 min-w-max">
          {subSections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id as SubSection)}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeSection === s.id
                  ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined text-base">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: DASHBOARD */}
      {activeSection === "dashboard" && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Assets</span>
                <span className="material-symbols-outlined text-blue-600 bg-blue-50 p-2 rounded-lg text-lg">
                  devices
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {metrics ? metrics.totalAssets : assets.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">Controlled & fixed capital assets</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Acquisition Cost</span>
                <span className="material-symbols-outlined text-emerald-600 bg-emerald-50 p-2 rounded-lg text-lg">
                  account_balance_wallet
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {metrics
                  ? `${Number(metrics.totalAssetCost ?? metrics.totalOriginalCost ?? 0).toLocaleString()} NLe`
                  : `${assets.reduce((acc, a) => acc + (a.assetCost || 0), 0).toLocaleString()} NLe`}
              </div>
              <p className="text-xs text-slate-500 mt-1">Historic purchase value</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Net Book Value (NBV)</span>
                <span className="material-symbols-outlined text-purple-600 bg-purple-50 p-2 rounded-lg text-lg">
                  trending_up
                </span>
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {metrics
                  ? `${Number(metrics.totalNetBookValue ?? 0).toLocaleString()} NLe`
                  : `${assets.reduce((acc, a) => acc + (a.netBookValue || 0), 0).toLocaleString()} NLe`}
              </div>
              <p className="text-xs text-slate-500 mt-1">After cumulative depreciation</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Assigned vs In Storage</span>
                <span className="material-symbols-outlined text-amber-600 bg-amber-50 p-2 rounded-lg text-lg">
                  group
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {assets.filter((a) => a.status === "Assigned").length}{" "}
                <span className="text-sm font-normal text-slate-500">
                  / {assets.filter((a) => a.status === "In Storage" || a.status === "Active").length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">In Custody / Available in Stores</p>
            </div>
          </div>

          {/* Status Breakdown & Category Allocation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs lg:col-span-1">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">pie_chart</span>
                Asset Status Distribution
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Assigned to Staff", status: "Assigned", color: "bg-blue-500" },
                  { label: "In Central Storage", status: "In Storage", color: "bg-emerald-500" },
                  { label: "Active Operational", status: "Active", color: "bg-teal-500" },
                  { label: "Under Maintenance", status: "Under Maintenance", color: "bg-amber-500" },
                  { label: "Damaged / Repair", status: "Damaged", color: "bg-orange-500" },
                  { label: "Lost / Stolen", status: "Lost", color: "bg-rose-500" },
                  { label: "Disposed / Written Off", status: "Disposed", color: "bg-slate-400" },
                ].map((item) => {
                  const count = assets.filter((a) => a.status === item.status).length;
                  const pct = assets.length ? Math.round((count / assets.length) * 100) : 0;
                  return (
                    <div key={item.label} className="text-xs">
                      <div className="flex justify-between font-medium text-slate-700 mb-1">
                        <span>{item.label}</span>
                        <span>
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">domain</span>
                Asset Allocation by Department
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="p-3">Department</th>
                      <th className="p-3 text-center">Asset Count</th>
                      <th className="p-3 text-right">Total Cost</th>
                      <th className="p-3 text-right">Net Book Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departments.map((dept) => {
                      const deptAssets = assets.filter((a) => a.department === dept);
                      const cost = deptAssets.reduce((s, a) => s + (a.assetCost || 0), 0);
                      const nbv = deptAssets.reduce((s, a) => s + (a.netBookValue || 0), 0);
                      return (
                        <tr key={dept} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-800">{dept}</td>
                          <td className="p-3 text-center">{deptAssets.length}</td>
                          <td className="p-3 text-right font-medium">{(cost || 0).toLocaleString()} NLe</td>
                          <td className="p-3 text-right font-bold text-emerald-700">{(nbv || 0).toLocaleString()} NLe</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: ASSET REGISTER */}
      {activeSection === "register" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[220px]">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search Tag, Name, Serial, Custodian..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Assigned">Assigned</option>
                <option value="In Storage">In Storage</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Damaged">Damaged</option>
                <option value="Lost">Lost</option>
                <option value="Disposed">Disposed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportCSV("asset_register")}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Export CSV
              </button>

              {/* MUTATION BUTTON - ONLY RENDER FOR FULL ACCESS (SA, PRC) */}
              {canFull && (
                <button
                  onClick={() => setIsAddAssetOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Register Asset
                </button>
              )}
            </div>
          </div>

          {/* Asset Register Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Asset Tag</th>
                    <th className="p-3">Name & Model</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Serial No</th>
                    <th className="p-3">Custodian</th>
                    <th className="p-3">Location</th>
                    <th className="p-3 text-right">Cost (NLe)</th>
                    <th className="p-3 text-right">NBV (NLe)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        No assets found matching the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-slate-400 text-sm">qr_code</span>
                          {asset.assetTag}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">{asset.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {asset.brand} {asset.model}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">{asset.category}</td>
                        <td className="p-3 font-mono text-slate-600">{asset.serialNumber || "—"}</td>
                        <td className="p-3 font-medium text-slate-700">{asset.custodian || "Unassigned"}</td>
                        <td className="p-3 text-slate-600">{asset.location}</td>
                        <td className="p-3 text-right font-medium">{(asset.assetCost || 0).toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-emerald-700">
                          {(asset.netBookValue || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              asset.status === "Active"
                                ? "bg-emerald-100 text-emerald-800"
                                : asset.status === "Assigned"
                                ? "bg-blue-100 text-blue-800"
                                : asset.status === "In Storage"
                                ? "bg-slate-100 text-slate-800"
                                : asset.status === "Under Maintenance"
                                ? "bg-amber-100 text-amber-800"
                                : asset.status === "Damaged"
                                ? "bg-orange-100 text-orange-800"
                                : asset.status === "Lost" || asset.status === "Stolen"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {asset.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedAsset(asset)}
                              className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded"
                              title="View Asset Lifecycle & Details"
                            >
                              <span className="material-symbols-outlined text-base">visibility</span>
                            </button>

                            {/* Action dropdown or quick action buttons for Full Access users */}
                            {canFull && asset.status !== "Disposed" && (
                              <>
                                {asset.status === "Assigned" ? (
                                  <button
                                    onClick={() => handleReturnToStorage(asset)}
                                    className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                                    title="Return to Storage"
                                  >
                                    <span className="material-symbols-outlined text-base">archive</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setTargetAssetForAction(asset);
                                      setIsAssignModalOpen(true);
                                    }}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Assign Asset"
                                  >
                                    <span className="material-symbols-outlined text-base">person_add</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setTargetAssetForAction(asset);
                                    setIsMaintenanceModalOpen(true);
                                  }}
                                  className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                                  title="Log Maintenance"
                                >
                                  <span className="material-symbols-outlined text-base">build</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setTargetAssetForAction(asset);
                                    setIsDisposalModalOpen(true);
                                  }}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                  title="Dispose Asset"
                                >
                                  <span className="material-symbols-outlined text-base">delete_sweep</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: CATEGORIES REGISTER */}
      {activeSection === "categories" && (
        <div className="space-y-6">
          {/* Top KPI Summary Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Asset Categories
                </p>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {categoriesList.length}
                </div>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  Institutional Standards
                </p>
              </div>
              <span className="material-symbols-outlined text-emerald-600 bg-emerald-50 p-2.5 rounded-xl text-xl">
                category
              </span>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Tracked Units
                </p>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {assets.length} <span className="text-xs font-normal text-slate-500">units</span>
                </div>
                <p className="text-[11px] text-blue-600 font-medium mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">devices</span>
                  Active in Operations
                </p>
              </div>
              <span className="material-symbols-outlined text-blue-600 bg-blue-50 p-2.5 rounded-xl text-xl">
                inventory_2
              </span>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Acquisition Valuation
                </p>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {assets.reduce((sum, a) => sum + (a.assetCost || 0), 0).toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">NLe</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Historical Purchase Cost
                </p>
              </div>
              <span className="material-symbols-outlined text-amber-600 bg-amber-50 p-2.5 rounded-xl text-xl">
                account_balance_wallet
              </span>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Net Book Value (NBV)
                </p>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  {assets.reduce((sum, a) => sum + (a.netBookValue || 0), 0).toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">NLe</span>
                </div>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span>
                  {(() => {
                    const cost = assets.reduce((s, a) => s + (a.assetCost || 0), 0);
                    const nbv = assets.reduce((s, a) => s + (a.netBookValue || 0), 0);
                    return cost > 0 ? `${((nbv / cost) * 100).toFixed(1)}% Retained Capital` : "100% Retained";
                  })()}
                </p>
              </div>
              <span className="material-symbols-outlined text-purple-600 bg-purple-50 p-2.5 rounded-xl text-xl">
                payments
              </span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search Category Code, Name, GL, Subcategories..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                {categorySearchQuery && (
                  <button
                    onClick={() => setCategorySearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              <select
                value={categoryClassFilter}
                onChange={(e) => setCategoryClassFilter(e.target.value)}
                className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-slate-700"
              >
                <option value="ALL">All Classifications</option>
                <option value="Tangible Fixed Asset">Tangible Fixed Asset</option>
                <option value="Controlled Asset">Controlled Asset</option>
                <option value="Capital Equipment">Capital Equipment</option>
                <option value="Intangible Asset">Intangible Asset</option>
              </select>

              <select
                value={categoryDeprFilter}
                onChange={(e) => setCategoryDeprFilter(e.target.value)}
                className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-slate-700"
              >
                <option value="ALL">All Depreciation Methods</option>
                <option value="Straight Line">Straight Line</option>
                <option value="Reducing Balance">Reducing Balance</option>
                <option value="None">None (Non-depreciable)</option>
              </select>

              {/* View Mode Toggle: Table Register vs Cards */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-auto md:ml-0">
                <button
                  onClick={() => setCategoryViewMode("table")}
                  title="Table Register View"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    categoryViewMode === "table"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">table_rows</span>
                  Table
                </button>
                <button
                  onClick={() => setCategoryViewMode("cards")}
                  title="Cards Grid View"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    categoryViewMode === "cards"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">grid_view</span>
                  Cards
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportCSV("categories_register")}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="Export Categories Register to CSV"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Export CSV
              </button>

              {/* Add Category (Only for Super Admin and Procurement Director) */}
              {canFull && (
                <button
                  onClick={handleOpenAddCategory}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Register Category
                </button>
              )}
            </div>
          </div>

          {/* VIEW MODE 1: OFFICIAL CATEGORIES REGISTER TABLE */}
          {categoryViewMode === "table" && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Category Code</th>
                      <th className="p-3">Category & Classification</th>
                      <th className="p-3">Key Subcategories</th>
                      <th className="p-3 text-center">Tracked Units</th>
                      <th className="p-3 text-right">Acquisition Cost (NLe)</th>
                      <th className="p-3 text-right">Net Book Value (NLe)</th>
                      <th className="p-3">Depreciation Policy</th>
                      <th className="p-3">GL Account Code</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">
                              search_off
                            </span>
                            <p className="font-semibold text-slate-700">No Asset Categories Found</p>
                            <p className="text-xs text-slate-400 mt-1">
                              Try clearing filters or search query to view all categories.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((cat) => {
                        const stats = getCategoryStats(cat);
                        return (
                          <tr key={cat.id || cat.code} className="hover:bg-slate-50/80 transition-colors">
                            {/* Category Code */}
                            <td className="p-3">
                              <span className="font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">
                                  {cat.icon || "category"}
                                </span>
                                {cat.code}
                              </span>
                            </td>

                            {/* Category Name & Classification */}
                            <td className="p-3">
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                {cat.name}
                              </div>
                              <div className="mt-0.5">
                                <span
                                  className={`inline-block text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                                    cat.classification === "Tangible Fixed Asset"
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : cat.classification === "Controlled Asset"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-purple-50 text-purple-700 border border-purple-200"
                                  }`}
                                >
                                  {cat.classification}
                                </span>
                              </div>
                            </td>

                            {/* Subcategories */}
                            <td className="p-3 max-w-[200px]">
                              <div className="flex flex-wrap gap-1">
                                {(cat.subcategories || []).slice(0, 2).map((sub, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 font-medium truncate max-w-[140px]"
                                    title={sub}
                                  >
                                    {sub}
                                  </span>
                                ))}
                                {(cat.subcategories || []).length > 2 && (
                                  <span
                                    className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-bold cursor-help"
                                    title={cat.subcategories.slice(2).join(", ")}
                                  >
                                    +{cat.subcategories.length - 2} more
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Units in Store / Active */}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleViewCategoryInRegister(cat.name)}
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
                                  stats.units > 0
                                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 ring-1 ring-emerald-300"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                                title={`Click to view ${stats.units} registered assets in ${cat.name}`}
                              >
                                {stats.units} {stats.units === 1 ? "unit" : "units"}
                              </button>
                            </td>

                            {/* Acquisition Cost */}
                            <td className="p-3 text-right font-mono font-semibold text-slate-800">
                              {stats.totalCost.toLocaleString()} NLe
                            </td>

                            {/* Net Book Value */}
                            <td className="p-3 text-right">
                              <div className="font-mono font-bold text-emerald-700">
                                {stats.totalNbv.toLocaleString()} NLe
                              </div>
                              {stats.totalCost > 0 && (
                                <div className="text-[10px] text-slate-400">
                                  {stats.retainedPct}% retained
                                </div>
                              )}
                            </td>

                            {/* Depreciation Policy */}
                            <td className="p-3">
                              <div className="text-slate-800 font-medium">
                                {cat.depreciationMethod}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Life: <span className="font-semibold text-slate-700">{cat.usefulLifeYears} Yrs</span> • Rate: <span className="font-semibold text-slate-700">{cat.annualDepreciationRate}%/yr</span>
                              </div>
                            </td>

                            {/* GL Account Code */}
                            <td className="p-3">
                              <span className="font-mono text-slate-600 text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                {cat.glAccountCode || "1590 - Fixed Assets"}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  cat.status === "Active"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {cat.status}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleViewCategoryInRegister(cat.name)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View Assets in Asset Register"
                                >
                                  <span className="material-symbols-outlined text-base">inventory</span>
                                </button>

                                <button
                                  onClick={() => setSelectedCategoryForDrilldown(cat)}
                                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Category Specifications & Asset Breakdown"
                                >
                                  <span className="material-symbols-outlined text-base">visibility</span>
                                </button>

                                {canFull && (
                                  <button
                                    onClick={() => handleOpenEditCategory(cat)}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Edit Category Depreciation Policy"
                                  >
                                    <span className="material-symbols-outlined text-base">tune</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: VISUAL CARDS GRID (ENHANCED VERSION OF ORIGINAL SCREENSHOT) */}
          {categoryViewMode === "cards" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategories.map((cat) => {
                const stats = getCategoryStats(cat);
                return (
                  <div
                    key={cat.id || cat.code}
                    className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Row: Icon, Title, Code & Units */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-emerald-600 bg-emerald-50 p-2 rounded-lg text-lg">
                            {cat.icon || "category"}
                          </span>
                          <div>
                            <span className="font-bold text-sm text-slate-900 block leading-tight">
                              {cat.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 font-semibold">
                              {cat.code}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleViewCategoryInRegister(cat.name)}
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full transition-colors ${
                            stats.units > 0
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                          title={`View ${stats.units} registered assets`}
                        >
                          {stats.units} {stats.units === 1 ? "unit" : "units"}
                        </button>
                      </div>

                      {/* Classification Badge */}
                      <div className="mb-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            cat.classification === "Tangible Fixed Asset"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : cat.classification === "Controlled Asset"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {cat.classification}
                        </span>
                      </div>

                      {/* Financial Valuation */}
                      <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-100 mb-3">
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="text-slate-500">Current Valuation:</span>
                          <span className="font-bold text-slate-900 font-mono">
                            {stats.totalNbv.toLocaleString()} NLe
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                          <span>Historic Cost:</span>
                          <span className="font-mono">{stats.totalCost.toLocaleString()} NLe</span>
                        </div>

                        {/* Progress Bar of Book Value */}
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, stats.totalCost > 0 ? (stats.totalNbv / stats.totalCost) * 100 : 0)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Subcategories tags */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(cat.subcategories || []).slice(0, 3).map((sub, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Metadata & Actions */}
                    <div>
                      <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2.5 flex justify-between items-center mb-3">
                        <span>Depreciation: <strong className="text-slate-700 font-medium">{cat.depreciationMethod}</strong></span>
                        <span>Avg Life: <strong className="text-slate-700 font-medium">{cat.usefulLifeYears} Yrs</strong></span>
                      </div>

                      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                        <button
                          onClick={() => handleViewCategoryInRegister(cat.name)}
                          className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">inventory</span>
                          View Assets
                        </button>
                        <button
                          onClick={() => setSelectedCategoryForDrilldown(cat)}
                          className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                          title="Category Details"
                        >
                          <span className="material-symbols-outlined text-sm">info</span>
                          Details
                        </button>
                        {canFull && (
                          <button
                            onClick={() => handleOpenEditCategory(cat)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                            title="Edit Category Policy"
                          >
                            <span className="material-symbols-outlined text-sm">tune</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: ASSET TAGGING & QR */}
      {activeSection === "tagging" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">BCF-SL Asset Tagging Registry</h3>
              <p className="text-xs text-slate-500">
                Official barcode and QR format: BCF-AST-YYYY-NNNNNN with physical asset tag printing
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              Print Asset Tags
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="bg-white rounded-xl p-4 border border-slate-300 shadow-xs flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className="w-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider py-1 rounded-t -mt-4 mb-3">
                  BCF-SL Property
                </div>
                <div className="font-mono text-sm font-extrabold text-slate-900 tracking-wider mb-2">
                  {asset.assetTag}
                </div>

                {/* QR Code Graphic Representation */}
                <div className="w-28 h-28 bg-slate-50 border-2 border-slate-800 rounded p-1 mb-2 flex items-center justify-center">
                  <span className="material-symbols-outlined text-6xl text-slate-900">qr_code_2</span>
                </div>

                <div className="font-semibold text-xs text-slate-800 line-clamp-1">{asset.name}</div>
                <div className="text-[10px] text-slate-500 mb-2">SN: {asset.serialNumber || "N/A"}</div>
                <div className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                  {asset.department}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: ASSIGNMENTS */}
      {activeSection === "assignments" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Staff Asset Custody Register</h3>
              <p className="text-xs text-slate-500">Track and manage custody, issuance and return of BCF-SL assets</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Asset Tag</th>
                    <th className="p-3">Asset Name</th>
                    <th className="p-3">Custodian</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Assignment Date</th>
                    <th className="p-3">Condition at Issue</th>
                    <th className="p-3 text-center">Status</th>
                    {canFull && <th className="p-3 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets
                    .filter((a) => a.status === "Assigned")
                    .map((asset) => {
                      const activeAsn = (asset.assignments || []).find((a) => a.active);
                      return (
                        <tr key={asset.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-slate-900">{asset.assetTag}</td>
                          <td className="p-3 font-semibold text-slate-800">{asset.name}</td>
                          <td className="p-3 font-medium text-blue-700">{asset.custodian}</td>
                          <td className="p-3 text-slate-600">{asset.department}</td>
                          <td className="p-3 text-slate-600">{activeAsn?.dateAssigned || asset.updatedAt}</td>
                          <td className="p-3 text-slate-600">{activeAsn?.conditionAtIssue || "Good"}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              Assigned
                            </span>
                          </td>
                          {canFull && (
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleReturnToStorage(asset)}
                                className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-[11px] font-semibold"
                              >
                                Return to Store
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: TRANSFERS */}
      {activeSection === "transfers" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Inter-Departmental & Office Transfers</h3>
            {canFull && (
              <button
                onClick={() => {
                  if (assets.length > 0) {
                    setTargetAssetForAction(assets[0]);
                    setIsTransferModalOpen(true);
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Initiate Transfer
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Transfer Ref</th>
                  <th className="p-3">Asset Tag</th>
                  <th className="p-3">From Entity</th>
                  <th className="p-3">To Entity</th>
                  <th className="p-3">Previous Loc</th>
                  <th className="p-3">New Loc</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets
                  .flatMap((a) => (a.transfers || []).map((t) => ({ ...t, assetTag: a.assetTag })))
                  .map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">{t.transferNumber}</td>
                      <td className="p-3 font-mono text-emerald-700">{t.assetTag}</td>
                      <td className="p-3 text-slate-700">{t.fromEntity}</td>
                      <td className="p-3 font-semibold text-slate-900">{t.toEntity}</td>
                      <td className="p-3 text-slate-500">{t.previousLocation}</td>
                      <td className="p-3 text-slate-800">{t.newLocation}</td>
                      <td className="p-3 text-slate-600">{t.transferDate}</td>
                      <td className="p-3 font-medium text-slate-700">{t.approvedBy}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 7: MAINTENANCE */}
      {activeSection === "maintenance" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Preventive & Corrective Maintenance Schedule</h3>
              <p className="text-xs text-slate-500">Service logs, upcoming maintenance reminders, and parts tracking</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Mnt Ref</th>
                  <th className="p-3">Asset Tag</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Service Provider</th>
                  <th className="p-3">Work Performed</th>
                  <th className="p-3 text-right">Cost (NLe)</th>
                  <th className="p-3">Next Service</th>
                  <th className="p-3">Technician</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets
                  .flatMap((a) => (a.maintenance || []).map((m) => ({ ...m, assetTag: a.assetTag })))
                  .map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">{m.maintenanceId}</td>
                      <td className="p-3 font-mono text-emerald-700">{m.assetTag}</td>
                      <td className="p-3 font-medium">{m.type}</td>
                      <td className="p-3 text-slate-700">{m.serviceProvider}</td>
                      <td className="p-3 text-slate-600">{m.workPerformed}</td>
                      <td className="p-3 text-right font-semibold text-slate-900">{(m.totalCost || 0).toLocaleString()}</td>
                      <td className="p-3 font-semibold text-amber-700">{m.nextServiceDate || "—"}</td>
                      <td className="p-3 text-slate-600">{m.technician}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 8: INSPECTIONS */}
      {activeSection === "inspections" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Physical Verification & Condition Audits</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Insp Ref</th>
                  <th className="p-3">Asset Tag</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Condition</th>
                  <th className="p-3 text-center">SN Verified</th>
                  <th className="p-3 text-center">Tag Verified</th>
                  <th className="p-3">Inspector</th>
                  <th className="p-3">Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets
                  .flatMap((a) => (a.inspections || []).map((insp) => ({ ...insp, assetTag: a.assetTag })))
                  .map((insp, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">{insp.inspectionId}</td>
                      <td className="p-3 font-mono text-emerald-700">{insp.assetTag}</td>
                      <td className="p-3 text-slate-600">{insp.inspectionDate}</td>
                      <td className="p-3 font-bold text-emerald-800">{insp.condition}</td>
                      <td className="p-3 text-center">
                        <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                      </td>
                      <td className="p-3 font-medium text-slate-800">{insp.inspector}</td>
                      <td className="p-3 text-slate-600">{insp.findings}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 9: INCIDENTS (LOST / STOLEN / DAMAGED) */}
      {activeSection === "incidents" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600">report_problem</span>
                Lost & Stolen Incident Records (Visible to Internal Audit & Risk Director)
              </h3>
              <p className="text-xs text-slate-500">
                Formal incident reporting with police blotter numbers and investigative determinations
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Incident Ref</th>
                  <th className="p-3">Asset Tag</th>
                  <th className="p-3">Date Reported</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Police Report No</th>
                  <th className="p-3">Investigation Status</th>
                  <th className="p-3">Recovery Status</th>
                  <th className="p-3">Officer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets
                  .flatMap((a) => (a.incidents || []).map((inc) => ({ ...inc, assetTag: a.assetTag })))
                  .map((inc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-rose-700">{inc.incidentNumber}</td>
                      <td className="p-3 font-mono text-slate-900">{inc.assetTag}</td>
                      <td className="p-3 text-slate-600">{inc.dateReported}</td>
                      <td className="p-3 text-slate-700">{inc.location}</td>
                      <td className="p-3 font-mono font-semibold text-slate-800">{inc.policeReportNumber || "—"}</td>
                      <td className="p-3 text-slate-600">{inc.internalInvestigation}</td>
                      <td className="p-3 font-bold text-amber-700">{inc.recoveryStatus}</td>
                      <td className="p-3 font-medium text-slate-800">{inc.responsibleOfficer}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 10: DISPOSALS */}
      {activeSection === "disposals" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Asset Disposal Register (Full Historical Retention)</h3>
              <p className="text-xs text-slate-500">
                Disposed assets are never hard deleted; kept with status Disposed and blocked from further assignment
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Disposal Ref</th>
                  <th className="p-3">Asset Tag</th>
                  <th className="p-3">Method</th>
                  <th className="p-3 text-right">Orig Cost (NLe)</th>
                  <th className="p-3 text-right">NBV (NLe)</th>
                  <th className="p-3 text-right">Disposal Value</th>
                  <th className="p-3">Disposal Date</th>
                  <th className="p-3">Authorized Officer</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets
                  .filter((a) => a.status === "Disposed" || Boolean(a.disposal))
                  .map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {a.disposal?.disposalId || `DSP-${a.assetTag}`}
                      </td>
                      <td className="p-3 font-mono text-emerald-700">{a.assetTag}</td>
                      <td className="p-3 font-semibold text-slate-800">{a.disposal?.method || "Scrapped"}</td>
                      <td className="p-3 text-right font-medium">{(a.assetCost || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-medium text-purple-700">
                        {Number(a.disposal?.netBookValue ?? a.netBookValue ?? 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {Number(a.disposal?.disposalValue ?? 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-slate-600">{a.disposal?.disposalDate || a.updatedAt}</td>
                      <td className="p-3 font-medium text-slate-700">{a.disposal?.authorizedOfficer || "Authorized"}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                          Disposed
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 11: DEPRECIATION */}
      {activeSection === "depreciation" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Depreciation Schedules & Net Book Value</h3>
              <p className="text-xs text-slate-500">Financial asset amortisation according to BCF-SL accounting standards</p>
            </div>
            <button
              onClick={() => exportCSV("depreciation")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Export Schedule
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">Asset Tag</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Acquired</th>
                  <th className="p-3">Method</th>
                  <th className="p-3 text-center">Useful Life</th>
                  <th className="p-3 text-right">Cost (NLe)</th>
                  <th className="p-3 text-right">Periodic Depr</th>
                  <th className="p-3 text-right">Acc Depr</th>
                  <th className="p-3 text-right">Net Book Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{asset.assetTag}</td>
                    <td className="p-3 font-semibold text-slate-800">{asset.name}</td>
                    <td className="p-3 text-slate-600">{asset.acquisitionDate}</td>
                    <td className="p-3 text-slate-600">{asset.depreciationMethod}</td>
                    <td className="p-3 text-center font-medium">{asset.usefulLifeYears} Years</td>
                    <td className="p-3 text-right font-medium">{asset.assetCost.toLocaleString()}</td>
                    <td className="p-3 text-right text-rose-600">
                      -{(asset.periodicDepreciation || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-rose-700 font-semibold">
                      -{asset.accumulatedDepreciation.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-700">
                      {asset.netBookValue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 12: REPORTS */}
      {activeSection === "reports" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-2">Management Asset Register</h4>
            <p className="text-xs text-slate-500 mb-4">
              Comprehensive report of all capital assets across all directorates, districts, and grant portfolios.
            </p>
            <button
              onClick={() => exportCSV("asset_register")}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Download Master Register CSV
            </button>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-2">Finance Depreciation Ledger</h4>
            <p className="text-xs text-slate-500 mb-4">
              Detailed breakdown of asset depreciation schedules, periodic charges, and net book values for external audit.
            </p>
            <button
              onClick={() => exportCSV("depreciation")}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Download Depreciation Schedule CSV
            </button>
          </div>
        </div>
      )}

      {/* SECTION 13: AUDIT */}
      {activeSection === "audit" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Asset Verification & Audit Trail</h3>
          <p className="text-xs text-slate-500">
            Immutable log of all asset creation, custodial assignment, physical transfers, disposals, and write-offs.
          </p>

          <div className="space-y-3">
            {assets.slice(0, 8).map((asset, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono font-bold text-emerald-700">{asset.assetTag}</span>
                  <span className="text-slate-400">{asset.createdAt}</span>
                </div>
                <div className="text-slate-700">
                  <span className="font-semibold">{asset.name}</span> — Status:{" "}
                  <span className="font-medium text-slate-900">{asset.status}</span>, Custodian:{" "}
                  <span className="font-medium text-blue-700">{asset.custodian || "Unassigned"}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Procurement ID: {asset.procurementId || "BCF-PRC-2026-0045"} | PO: {asset.poNumber} | GRN: {asset.grnNumber}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW ASSET (CanFull only) */}
      {isAddAssetOpen && canFull && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Register New Capital Asset</h3>
              <button onClick={() => setIsAddAssetOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Asset Name *</label>
                  <input
                    type="text"
                    required
                    value={newAssetForm.name}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, name: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. Dell Latitude 5440"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={newAssetForm.category}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, category: e.target.value as AssetCategory })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={newAssetForm.brand}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, brand: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. Dell"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={newAssetForm.model}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, model: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. Latitude 5440"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={newAssetForm.serialNumber}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, serialNumber: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="e.g. DL-884291-SL"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={newAssetForm.department}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, department: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Physical Location</label>
                  <input
                    type="text"
                    value={newAssetForm.location}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, location: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Asset Cost (NLe) *</label>
                  <input
                    type="number"
                    required
                    value={newAssetForm.assetCost}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, assetCost: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Useful Life (Years)</label>
                  <input
                    type="number"
                    value={newAssetForm.usefulLifeYears}
                    onChange={(e) =>
                      setNewAssetForm({ ...newAssetForm, usefulLifeYears: parseInt(e.target.value) || 3 })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Residual Value (NLe)</label>
                  <input
                    type="number"
                    value={newAssetForm.residualValue}
                    onChange={(e) =>
                      setNewAssetForm({ ...newAssetForm, residualValue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PO Number</label>
                  <input
                    type="text"
                    value={newAssetForm.poNumber}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, poNumber: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GRN Number</label>
                  <input
                    type="text"
                    value={newAssetForm.grnNumber}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, grnNumber: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={newAssetForm.supplier}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, supplier: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddAssetOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700"
                >
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN ASSET */}
      {isAssignModalOpen && canFull && targetAssetForAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Assign Asset to Staff</h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">
              {targetAssetForAction.assetTag} — {targetAssetForAction.name}
            </p>

            <form onSubmit={handleAssignSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Staff Member Name *</label>
                <input
                  type="text"
                  required
                  value={assignForm.employeeName}
                  onChange={(e) => setAssignForm({ ...assignForm, employeeName: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Employee ID *</label>
                <input
                  type="text"
                  required
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={assignForm.department}
                    onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={assignForm.location}
                    onChange={(e) => setAssignForm({ ...assignForm, location: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Condition at Issue</label>
                <input
                  type="text"
                  value={assignForm.conditionAtIssue}
                  onChange={(e) => setAssignForm({ ...assignForm, conditionAtIssue: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFER ASSET */}
      {isTransferModalOpen && canFull && targetAssetForAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Transfer Asset</h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">
              {targetAssetForAction.assetTag} — {targetAssetForAction.name}
            </p>

            <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">To Entity / Department *</label>
                <input
                  type="text"
                  required
                  value={transferForm.toEntity}
                  onChange={(e) => setTransferForm({ ...transferForm, toEntity: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Location *</label>
                <input
                  type="text"
                  required
                  value={transferForm.newLocation}
                  onChange={(e) => setTransferForm({ ...transferForm, newLocation: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Reason</label>
                <textarea
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700"
                >
                  Complete Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DISPOSAL OF ASSET */}
      {isDisposalModalOpen && canFull && targetAssetForAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Record Asset Disposal</h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">
              {targetAssetForAction.assetTag} — {targetAssetForAction.name}
            </p>

            <form onSubmit={handleDisposalSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Disposal Method *</label>
                <select
                  value={disposalForm.method}
                  onChange={(e) => setDisposalForm({ ...disposalForm, method: e.target.value as any })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  <option value="Scrapping">Scrapping / Decommission</option>
                  <option value="Sale">Sale / Auction</option>
                  <option value="Donation">Charitable Donation</option>
                  <option value="Transfer">Inter-agency Transfer</option>
                  <option value="Destruction">Controlled Destruction</option>
                  <option value="Return to supplier">Return to Supplier</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Disposal Reason *</label>
                <textarea
                  required
                  value={disposalForm.reason}
                  onChange={(e) => setDisposalForm({ ...disposalForm, reason: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  rows={2}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Disposal Value / Proceeds (NLe)</label>
                <input
                  type="number"
                  value={disposalForm.disposalValue}
                  onChange={(e) =>
                    setDisposalForm({ ...disposalForm, disposalValue: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Authorizing Officer</label>
                <input
                  type="text"
                  value={disposalForm.authorizedOfficer}
                  onChange={(e) => setDisposalForm({ ...disposalForm, authorizedOfficer: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsDisposalModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700"
                >
                  Confirm Disposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER / MODAL: VIEW ASSET DETAILS */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-extrabold text-slate-900">{selectedAsset.assetTag}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedAsset.status === "Active"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedAsset.status === "Assigned"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {selectedAsset.status}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-800">{selectedAsset.name}</h3>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <div className="text-slate-400 font-semibold">Category</div>
                <div className="font-bold text-slate-800">{selectedAsset.category}</div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold">Brand & Model</div>
                <div className="font-bold text-slate-800">
                  {selectedAsset.brand} {selectedAsset.model}
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold">Serial Number</div>
                <div className="font-mono font-bold text-slate-800">{selectedAsset.serialNumber || "—"}</div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold">Custodian</div>
                <div className="font-bold text-blue-700">{selectedAsset.custodian || "Unassigned"}</div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold">Acquisition Cost</div>
                <div className="font-bold text-slate-900">{Number(selectedAsset.assetCost || 0).toLocaleString()} NLe</div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold">Acc Depreciation</div>
                <div className="font-bold text-rose-600">
                  -{Number(selectedAsset.accumulatedDepreciation || 0).toLocaleString()} NLe
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold">Net Book Value</div>
                <div className="font-bold text-emerald-700">{Number(selectedAsset.netBookValue || 0).toLocaleString()} NLe</div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold">PO / GRN</div>
                <div className="font-mono text-slate-700">
                  {selectedAsset.poNumber} / {selectedAsset.grnNumber}
                </div>
              </div>
            </div>

            {/* Assignments History */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Assignment History</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2">Employee</th>
                      <th className="p-2">Department</th>
                      <th className="p-2">Date Assigned</th>
                      <th className="p-2">Condition</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedAsset.assignments || []).map((asn, i) => (
                      <tr key={i}>
                        <td className="p-2 font-medium">{asn.employeeName}</td>
                        <td className="p-2">{asn.department}</td>
                        <td className="p-2">{asn.dateAssigned}</td>
                        <td className="p-2">{asn.conditionAtIssue}</td>
                        <td className="p-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              asn.active ? "bg-blue-100 text-blue-800 font-bold" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {asn.active ? "Active" : "Returned"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-6 border-t border-slate-200">
              <button
                onClick={() => setSelectedAsset(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CATEGORY DRILLDOWN & ASSET SPECIFICATION SHEET */}
      {selectedCategoryForDrilldown && (() => {
        const stats = getCategoryStats(selectedCategoryForDrilldown);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
                    <span className="material-symbols-outlined text-2xl">
                      {selectedCategoryForDrilldown.icon || "category"}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded">
                        {selectedCategoryForDrilldown.code}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          selectedCategoryForDrilldown.classification === "Tangible Fixed Asset"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : selectedCategoryForDrilldown.classification === "Controlled Asset"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {selectedCategoryForDrilldown.classification}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {selectedCategoryForDrilldown.name}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCategoryForDrilldown(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Financial & Operational KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Units Tracked</span>
                  <span className="text-xl font-bold text-slate-900 mt-0.5 block">{stats.units}</span>
                  <span className="text-[10px] text-slate-500">In fleet & warehouse</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Acquisition Cost</span>
                  <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">
                    {stats.totalCost.toLocaleString()} NLe
                  </span>
                  <span className="text-[10px] text-slate-500">Historical cost</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Acc Depreciation</span>
                  <span className="text-xl font-bold text-rose-600 font-mono mt-0.5 block">
                    -{stats.totalDepr.toLocaleString()} NLe
                  </span>
                  <span className="text-[10px] text-slate-500">Cumulative written-off</span>
                </div>

                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Net Book Value</span>
                  <span className="text-xl font-bold text-emerald-700 font-mono mt-0.5 block">
                    {stats.totalNbv.toLocaleString()} NLe
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold">{stats.retainedPct}% retained</span>
                </div>
              </div>

              {/* Policy Specifications & General Ledger Mapping */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-emerald-600">account_tree</span>
                  Accounting Specification & Depreciation Policy
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block">GL Account Code</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedCategoryForDrilldown.glAccountCode || "1590 - Fixed Assets"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block">Depreciation Method</span>
                    <span className="font-bold text-slate-800">
                      {selectedCategoryForDrilldown.depreciationMethod}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block">Expected Useful Life</span>
                    <span className="font-bold text-slate-800">
                      {selectedCategoryForDrilldown.usefulLifeYears} Years
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block">Annual Depreciation Rate</span>
                    <span className="font-bold text-slate-800">
                      {selectedCategoryForDrilldown.annualDepreciationRate}% per annum
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block">Residual / Salvage Value</span>
                    <span className="font-bold text-slate-800">
                      {selectedCategoryForDrilldown.residualPercentage}% of acquisition cost
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block">Responsible Directorate</span>
                    <span className="font-bold text-slate-800">
                      {selectedCategoryForDrilldown.responsibleDepartment}
                    </span>
                  </div>
                </div>

                {selectedCategoryForDrilldown.description && (
                  <p className="text-xs text-slate-600 border-t border-slate-200/80 pt-2.5 mt-3">
                    {selectedCategoryForDrilldown.description}
                  </p>
                )}
              </div>

              {/* Subcategories Cloud */}
              <div className="mb-5">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block mb-2">
                  Recognised Subcategories ({selectedCategoryForDrilldown.subcategories.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCategoryForDrilldown.subcategories.map((sub, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>

              {/* Associated Registered Assets Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Registered Assets in Category ({stats.units})
                  </span>
                  {stats.units > 0 && (
                    <button
                      onClick={() => {
                        handleViewCategoryInRegister(selectedCategoryForDrilldown.name);
                        setSelectedCategoryForDrilldown(null);
                      }}
                      className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1"
                    >
                      Open in Asset Register
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </button>
                  )}
                </div>

                {stats.units === 0 ? (
                  <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                    <span className="material-symbols-outlined text-slate-400 text-2xl mb-1">
                      devices_off
                    </span>
                    <p className="text-xs font-semibold text-slate-700">No assets currently registered</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      No assets are catalogued under {selectedCategoryForDrilldown.name} yet.
                    </p>
                    {canFull && (
                      <button
                        onClick={() => {
                          const catName = selectedCategoryForDrilldown.name;
                          setSelectedCategoryForDrilldown(null);
                          handleQuickRegisterAsset(catName);
                        }}
                        className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                      >
                        Register First Asset
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Asset Tag</th>
                          <th className="p-2.5">Name & Model</th>
                          <th className="p-2.5">Serial No</th>
                          <th className="p-2.5">Custodian</th>
                          <th className="p-2.5">Location</th>
                          <th className="p-2.5 text-right">Cost (NLe)</th>
                          <th className="p-2.5 text-right">NBV (NLe)</th>
                          <th className="p-2.5 text-center">Status</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.assets.map((asset) => (
                          <tr key={asset.id} className="hover:bg-slate-50/70">
                            <td className="p-2.5 font-mono font-bold text-emerald-800">
                              {asset.assetTag}
                            </td>
                            <td className="p-2.5 font-semibold text-slate-800">
                              {asset.name}
                            </td>
                            <td className="p-2.5 font-mono text-slate-500">
                              {asset.serialNumber || "—"}
                            </td>
                            <td className="p-2.5 text-slate-700">
                              {asset.custodian || "Unassigned"}
                            </td>
                            <td className="p-2.5 text-slate-600 text-[11px]">
                              {asset.location}
                            </td>
                            <td className="p-2.5 text-right font-mono">
                              {Number(asset.assetCost || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                              {Number(asset.netBookValue || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  asset.status === "Active" || asset.status === "Assigned"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {asset.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => {
                                  setSelectedCategoryForDrilldown(null);
                                  setSelectedAsset(asset);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="View Asset Card"
                              >
                                <span className="material-symbols-outlined text-sm">visibility</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center pt-4 mt-6 border-t border-slate-200">
                {canFull ? (
                  <button
                    onClick={() => {
                      const catName = selectedCategoryForDrilldown.name;
                      setSelectedCategoryForDrilldown(null);
                      handleQuickRegisterAsset(catName);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Register Asset in this Category
                  </button>
                ) : (
                  <div />
                )}

                <button
                  onClick={() => setSelectedCategoryForDrilldown(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                >
                  Close Specification Sheet
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: ADD / EDIT ASSET CATEGORY & POLICY */}
      {(isAddCategoryOpen || isEditCategoryOpen) && canFull && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">
                    {isEditCategoryOpen ? "tune" : "category"}
                  </span>
                  {isEditCategoryOpen
                    ? `Configure Category Policy: ${categoryModalForm.name}`
                    : "Register New Asset Category"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isEditCategoryOpen
                    ? "Update depreciation method, useful life parameters and accounting classification."
                    : "Define institutional asset classification, subcategories and accounting standards."}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddCategoryOpen(false);
                  setIsEditCategoryOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveCategorySubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category Code *</label>
                  <input
                    type="text"
                    required
                    value={categoryModalForm.code}
                    onChange={(e) =>
                      setCategoryModalForm({ ...categoryModalForm, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. CAT-AGR-014"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={categoryModalForm.name}
                    onChange={(e) =>
                      setCategoryModalForm({ ...categoryModalForm, name: e.target.value })
                    }
                    placeholder="e.g. Heavy Agricultural Machinery"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Accounting Classification *</label>
                  <select
                    value={categoryModalForm.classification}
                    onChange={(e) =>
                      setCategoryModalForm({
                        ...categoryModalForm,
                        classification: e.target.value as any,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Tangible Fixed Asset">Tangible Fixed Asset</option>
                    <option value="Controlled Asset">Controlled Asset</option>
                    <option value="Capital Equipment">Capital Equipment</option>
                    <option value="Intangible Asset">Intangible Asset</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GL Account Code *</label>
                  <input
                    type="text"
                    required
                    value={categoryModalForm.glAccountCode}
                    onChange={(e) =>
                      setCategoryModalForm({ ...categoryModalForm, glAccountCode: e.target.value })
                    }
                    placeholder="e.g. 1580 - Agricultural & Project Machinery"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Subcategories (comma separated)
                  </label>
                  <input
                    type="text"
                    value={categoryModalForm.subcategoriesText}
                    onChange={(e) =>
                      setCategoryModalForm({ ...categoryModalForm, subcategoriesText: e.target.value })
                    }
                    placeholder="e.g. Tractors, Harvesters, Irrigation Systems, Seed Drills"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Separate multiple subcategories with commas.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Depreciation Method *</label>
                  <select
                    value={categoryModalForm.depreciationMethod}
                    onChange={(e) =>
                      setCategoryModalForm({
                        ...categoryModalForm,
                        depreciationMethod: e.target.value as any,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Straight Line">Straight Line</option>
                    <option value="Reducing Balance">Reducing Balance</option>
                    <option value="None">None (Non-depreciable)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Useful Life (Years) *</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={categoryModalForm.usefulLifeYears}
                    onChange={(e) => {
                      const yrs = Number(e.target.value) || 1;
                      const rate = +(100 / yrs).toFixed(1);
                      setCategoryModalForm({
                        ...categoryModalForm,
                        usefulLifeYears: yrs,
                        annualDepreciationRate: rate,
                      });
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Annual Depreciation Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={categoryModalForm.annualDepreciationRate}
                    onChange={(e) =>
                      setCategoryModalForm({
                        ...categoryModalForm,
                        annualDepreciationRate: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Residual / Salvage Value (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={categoryModalForm.residualPercentage}
                    onChange={(e) =>
                      setCategoryModalForm({
                        ...categoryModalForm,
                        residualPercentage: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Responsible Directorate</label>
                  <select
                    value={categoryModalForm.responsibleDepartment}
                    onChange={(e) =>
                      setCategoryModalForm({
                        ...categoryModalForm,
                        responsibleDepartment: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Operations & Administration">Operations & Administration</option>
                    <option value="IT & Communications Directorate">IT & Communications Directorate</option>
                    <option value="Facilities & Estates Directorate">Facilities & Estates Directorate</option>
                    <option value="Operations & Fleet Management">Operations & Fleet Management</option>
                    <option value="Health Programmes Directorate">Health Programmes Directorate</option>
                    <option value="Communications & Media Unit">Communications & Media Unit</option>
                    <option value="Security & Field Logistics">Security & Field Logistics</option>
                    <option value="Procurement & Asset Unit">Procurement & Asset Unit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category Status</label>
                  <select
                    value={categoryModalForm.status}
                    onChange={(e) =>
                      setCategoryModalForm({
                        ...categoryModalForm,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Phased Out">Phased Out</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Description & Policy Notes</label>
                  <textarea
                    rows={2}
                    value={categoryModalForm.description}
                    onChange={(e) =>
                      setCategoryModalForm({ ...categoryModalForm, description: e.target.value })
                    }
                    placeholder="Institutional scope, capital asset qualifications, custody requirements..."
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCategoryOpen(false);
                    setIsEditCategoryOpen(false);
                  }}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-xs"
                >
                  {isEditCategoryOpen ? "Save Policy Changes" : "Register Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
