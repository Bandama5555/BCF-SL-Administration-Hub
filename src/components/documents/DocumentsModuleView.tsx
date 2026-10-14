"use client";

import React, { useState, useEffect, useMemo } from "react";
import { type DocumentItem, contractHasEndDate, CONTRACT_TYPES } from "@/lib/documentTypes";
import { type DocumentTab } from "@/lib/documentPermissions";
import { getUser, type AuthUser } from "@/lib/auth";
import { normalizeRole, type RoleCode } from "@/lib/permissions";
import { isExpiringSoon, getDaysUntilExpiry } from "@/lib/contractUtils";

interface DocumentsModuleViewProps {
  currentTab: DocumentTab;
  onOpenUploadModal?: () => void;
  onRefreshTrigger?: number;
}

export function DocumentsModuleView({
  currentTab,
  onOpenUploadModal,
  onRefreshTrigger = 0,
}: DocumentsModuleViewProps) {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<{
    canView?: boolean;
    canDownload?: boolean;
    canUpload?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canRestore?: boolean;
    canViewDownloadHistory?: boolean;
  }>({});

  const [user, setUser] = useState<AuthUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "TITLE" | "SIZE" | "EXPIRY">("NEWEST");

  // Contract-specific filters (for Admin roles)
  const [contractEmployeeFilter, setContractEmployeeFilter] = useState("ALL");
  const [contractTypeFilter, setContractTypeFilter] = useState("ALL");
  const [contractStatusFilter, setContractStatusFilter] = useState("ALL");

  // Selected item for View Details Modal
  const [selectedItem, setSelectedItem] = useState<DocumentItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<DocumentItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editContractType, setEditContractType] = useState<string>("");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editEndDate, setEditEndDate] = useState<string>("");
  const [editContractStatus, setEditContractStatus] = useState<string>("");
  const [editFile, setEditFile] = useState<{ fileName: string; fileData: string; fileSize: number; fileType: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete Modal State
  const [deletingItem, setDeletingItem] = useState<DocumentItem | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Restore State (Super Admin Only)
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const roleCode = normalizeRole(user?.role, user?.username, user?.email);
  const isStaff = roleCode === "ST";
  const isContractsTab = currentTab === "employee-contracts";
  const isDeletedTab = currentTab === "deleted-items";

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const headers: Record<string, string> = {};
      if (user) {
        headers["x-bcf-user-role"] = user.role || roleCode;
        headers["x-bcf-username"] = user.username || "";
        headers["x-bcf-email"] = user.email || "";
        headers["x-bcf-name"] = user.name || "";
        if (user.employeeId) headers["x-bcf-employee-id"] = user.employeeId;
      }

      // Automatically seed if collection is empty
      await fetch("/api/documents/seed").catch(() => {});

      const res = await fetch(`/api/documents?tab=${currentTab}`, { headers });
      if (!res.ok) {
        if (res.status === 403) {
          setError("You do not have access to that page.");
          return;
        }
        throw new Error(`Failed to load items: ${res.statusText}`);
      }

      const data = await res.json();
      setItems(data.items || []);
      setPermissions(data.permissions || {});
    } catch (err: any) {
      console.error("Fetch documents error:", err);
      setError(err.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [currentTab, user?.role, onRefreshTrigger]);

  // Open full details (fetches single document details with base64 for preview)
  const openItemDetails = async (item: DocumentItem) => {
    setSelectedItem(item);
    setDetailLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (user) {
        headers["x-bcf-user-role"] = user.role || roleCode;
        headers["x-bcf-username"] = user.username || "";
        headers["x-bcf-email"] = user.email || "";
        headers["x-bcf-name"] = user.name || "";
        if (user.employeeId) headers["x-bcf-employee-id"] = user.employeeId;
      }
      const res = await fetch(`/api/documents/${item.id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSelectedItem(data.item);
      }
    } catch (err) {
      console.warn("Failed to fetch complete item details:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Trigger download with full tracking
  const handleDownload = async (item: DocumentItem) => {
    if (item.status === "Deleted") {
      alert("This document is archived/deleted and cannot be downloaded.");
      return;
    }

    try {
      const headers: Record<string, string> = {};
      if (user) {
        headers["x-bcf-user-role"] = user.role || roleCode;
        headers["x-bcf-username"] = user.username || "";
        headers["x-bcf-email"] = user.email || "";
        headers["x-bcf-name"] = user.name || "";
        if (user.employeeId) headers["x-bcf-employee-id"] = user.employeeId;
      }

      const res = await fetch(`/api/documents/${item.id}/download`, { headers });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "You do not have access to that page.");
        return;
      }

      // Convert response blob to download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.fileName || "document.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Refresh items to update download count and history
      fetchItems();
      if (selectedItem && selectedItem.id === item.id) {
        openItemDetails(item);
      }
    } catch (err) {
      console.error("Download error:", err);
      alert("An error occurred during file download.");
    }
  };

  // Open Edit Modal
  const openEditModal = (item: DocumentItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDesc(item.description);
    setEditStatus(item.subStatus || "");
    setEditTags((item.tags || []).join(", "));
    const cType = item.contractType || "Permanent";
    setEditContractType(cType);
    setEditStartDate(item.startDate || "");
    setEditEndDate(contractHasEndDate(cType) ? item.endDate || "" : "");
    setEditContractStatus(
      !contractHasEndDate(cType) && item.contractStatus === "Expired"
        ? "Active"
        : item.contractStatus || "Active"
    );
    setEditSummary("");
    setEditFile(null);
  };

  // Submit Edit
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      setEditSaving(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user) {
        headers["x-bcf-user-role"] = user.role || roleCode;
        headers["x-bcf-username"] = user.username || "";
        headers["x-bcf-email"] = user.email || "";
        headers["x-bcf-name"] = user.name || "";
        if (user.employeeId) headers["x-bcf-employee-id"] = user.employeeId;
      }

      if (editingItem.category === "employee-contracts") {
        if (!editContractType) {
          alert("Contract type is required.");
          setEditSaving(false);
          return;
        }
        if (!editStartDate) {
          alert("Start date is required.");
          setEditSaving(false);
          return;
        }
        const hasEnd = contractHasEndDate(editContractType);
        if (hasEnd) {
          if (!editEndDate) {
            alert(`End date is required for ${editContractType} contracts.`);
            setEditSaving(false);
            return;
          }
          if (new Date(editEndDate).getTime() <= new Date(editStartDate).getTime()) {
            alert("End date must be after the start date.");
            setEditSaving(false);
            return;
          }
        }
      }

      const body: any = {
        title: editTitle,
        description: editDesc,
        subStatus: editStatus,
        tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
        changeSummary: editSummary || (isContractsTab ? "Contract details amended." : "Revised version update."),
        newFile: editFile,
      };

      if (editingItem.category === "employee-contracts") {
        const hasEnd = contractHasEndDate(editContractType);
        body.contractType = editContractType;
        body.startDate = editStartDate;
        body.endDate = hasEnd ? editEndDate : null;
        body.contractStatus = !hasEnd && editContractStatus === "Expired" ? "Active" : editContractStatus;
      }

      const res = await fetch(`/api/documents/${editingItem.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to update document.");
        return;
      }

      setEditingItem(null);
      fetchItems();
    } catch (err) {
      console.error("Edit error:", err);
      alert("Failed to save document updates.");
    } finally {
      setEditSaving(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (item: DocumentItem) => {
    setDeletingItem(item);
    setDeleteReason("");
    setDeleteError("");
  };

  // Submit Soft Delete
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    if (!deleteReason.trim()) {
      setDeleteError("Please enter a mandatory justification reason for deleting this item.");
      return;
    }

    try {
      setDeleteSubmitting(true);
      setDeleteError("");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user) {
        headers["x-bcf-user-role"] = user.role || roleCode;
        headers["x-bcf-username"] = user.username || "";
        headers["x-bcf-email"] = user.email || "";
        headers["x-bcf-name"] = user.name || "";
        if (user.employeeId) headers["x-bcf-employee-id"] = user.employeeId;
      }

      const res = await fetch(`/api/documents/${deletingItem.id}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setDeleteError(errData.error || "Failed to delete item.");
        return;
      }

      setDeletingItem(null);
      fetchItems();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete item.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Restore Soft-Deleted Item (Super Admin only)
  const handleRestore = async (item: DocumentItem) => {
    if (!confirm(`Restore "${item.title}" back to active official records?`)) return;

    try {
      setRestoringId(item.id);
      const headers: Record<string, string> = {};
      if (user) {
        headers["x-bcf-user-role"] = user.role || roleCode;
        headers["x-bcf-username"] = user.username || "";
        headers["x-bcf-email"] = user.email || "";
        headers["x-bcf-name"] = user.name || "";
      }

      const res = await fetch(`/api/documents/${item.id}/restore`, {
        method: "POST",
        headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to restore document.");
        return;
      }

      alert("Item restored successfully.");
      fetchItems();
    } catch (err) {
      console.error("Restore error:", err);
      alert("Failed to restore item.");
    } finally {
      setRestoringId(null);
    }
  };

  // Unique employees for dropdown filter (Admins only)
  const uniqueEmployees = useMemo(() => {
    if (!isContractsTab || isStaff) return [];
    const map = new Map<string, string>();
    items.forEach((item) => {
      if (item.employeeId) {
        map.set(item.employeeId, item.employeeName || item.employeeId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items, isContractsTab, isStaff]);

  // Filtering & Sorting
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Staff Privacy Filter: Staff sees only their own contract (already filtered by API)
        if (isStaff && isContractsTab) {
          return true;
        }

        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.employeeName && item.employeeName.toLowerCase().includes(q)) ||
          (item.employeeId && item.employeeId.toLowerCase().includes(q)) ||
          item.uploadedBy.name.toLowerCase().includes(q) ||
          (item.tags || []).some((t) => t.toLowerCase().includes(q));

        if (!matchesQuery) return false;

        // Contract specific filters
        if (isContractsTab) {
          if (contractEmployeeFilter !== "ALL" && item.employeeId !== contractEmployeeFilter) {
            return false;
          }
          if (contractTypeFilter !== "ALL" && item.contractType !== contractTypeFilter) {
            return false;
          }
          if (contractStatusFilter !== "ALL") {
            if (contractStatusFilter === "EXPIRING_SOON") {
              if (!contractHasEndDate(item.contractType) || !isExpiringSoon(item.endDate, item.contractType)) return false;
            } else if (contractStatusFilter === "Expired") {
              if (!contractHasEndDate(item.contractType) || item.contractStatus !== "Expired") return false;
            } else if (item.contractStatus !== contractStatusFilter) {
              return false;
            }
          }
        }

        if (typeFilter !== "ALL") {
          const ext = (item.fileExt || "").toLowerCase();
          if (typeFilter === "PDF" && ext !== "pdf") return false;
          if (typeFilter === "WORD" && !["doc", "docx"].includes(ext)) return false;
          if (typeFilter === "EXCEL" && !["xls", "xlsx"].includes(ext)) return false;
          if (typeFilter === "IMAGE" && !["png", "jpg", "jpeg"].includes(ext)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "NEWEST") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === "OLDEST") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === "TITLE") return a.title.localeCompare(b.title);
        if (sortBy === "SIZE") return (b.fileSize || 0) - (a.fileSize || 0);
        if (sortBy === "EXPIRY") {
          const dateA = contractHasEndDate(a.contractType) && a.endDate ? new Date(a.endDate).getTime() : Infinity;
          const dateB = contractHasEndDate(b.contractType) && b.endDate ? new Date(b.endDate).getTime() : Infinity;
          return dateA - dateB;
        }
        return 0;
      });
  }, [
    items,
    searchQuery,
    typeFilter,
    sortBy,
    isStaff,
    isContractsTab,
    contractEmployeeFilter,
    contractTypeFilter,
    contractStatusFilter,
  ]);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const getContractTypeBadgeColor = (type?: string) => {
    switch (type) {
      case "Permanent":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "Fixed-Term Contract":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "Part-Time":
        return "bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border-sky-200 dark:border-sky-800";
      case "Casual":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      case "Consultant":
        return "bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border-teal-200 dark:border-teal-800";
      case "Volunteer":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "Intern":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const getFileBadgeColor = (ext: string) => {
    switch (ext.toLowerCase()) {
      case "pdf":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "doc":
      case "docx":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 text-center bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl">
        <span className="material-symbols-outlined text-rose-600 text-5xl mb-3">lock</span>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">Access Restricted</h2>
        <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed mb-6">{error}</p>
        <button
          onClick={() => window.location.replace("/")}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
        >
          Return to Dashboard Hub
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: STAFF VIEW FOR EMPLOYEE CONTRACTS ("My Contract")
  // ─────────────────────────────────────────────────────────────────────────────
  if (isContractsTab && isStaff) {
    return (
      <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto w-full">
        {/* Staff Privacy Header */}
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-6 rounded-2xl shadow-lg border border-purple-800">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-3xl text-purple-300">
              verified_user
            </span>
            <div>
              <h2 className="text-xl font-extrabold">My Contract</h2>
              <p className="text-purple-200 text-xs">
                Confidential employment records and appointment agreements linked to your employee file.
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-purple-800/80 flex items-center justify-between text-[11px] text-purple-300">
            <span>Staff Account: {user?.name} ({user?.employeeId || "BCF Staff"})</span>
            <span>Security: Personal &amp; Confidential Data Gate Active</span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <span className="material-symbols-outlined text-4xl text-purple-600 animate-spin mb-2">
              sync
            </span>
            <p className="text-xs text-slate-500">Loading your official contract records...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <span className="material-symbols-outlined text-5xl text-slate-400 mb-3">
              assignment_ind
            </span>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
              No contract on file
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              There is currently no active contract document filed under your employee record. Please contact the HR Management Department if you require assistance.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:border-purple-300 dark:hover:border-purple-800 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getContractTypeBadgeColor(item.contractType)}`}>
                        {item.contractType || "Contract"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {contractHasEndDate(item.contractType)
                          ? (item.contractStatus || item.status)
                          : (item.contractStatus === "Expired" ? "Active" : item.contractStatus || "Active")}
                      </span>
                      {contractHasEndDate(item.contractType) && isExpiringSoon(item.endDate, item.contractType) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">hourglass_bottom</span>
                          Expiring soon ({getDaysUntilExpiry(item.endDate, item.contractType)}d left)
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Start Date</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(item.startDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">End Date</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {contractHasEndDate(item.contractType) && item.endDate ? formatDate(item.endDate) : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Filed By</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{item.uploadedBy.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Filing Date</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(item.uploadedBy.date)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openItemDetails(item)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View Modal for Staff (Hides Download History per Privacy Rule) */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Official Employment Contract
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5">
                    {selectedItem.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Contract Description</span>
                    <p className="text-slate-800 dark:text-slate-200">{selectedItem.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Contract Type</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItem.contractType || "Permanent"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Status</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedItem.contractStatus || "Active"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Start Date</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(selectedItem.startDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">End Date</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItem.endDate ? formatDate(selectedItem.endDate) : "Permanent"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Uploader</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItem.uploadedBy.name} ({selectedItem.uploadedBy.role})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Upload Date</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(selectedItem.uploadedBy.date)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-700 text-2xl">description</span>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{selectedItem.fileName}</span>
                      <span className="text-[10px] text-slate-400">{formatFileSize(selectedItem.fileSize)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedItem)}
                    className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    Download
                  </button>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: ADMIN & GOVERNANCE VIEW (HR, Super Admin, CEO, Internal Audit, etc.)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full">
      {/* Search, Filter & Quick Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 w-full min-w-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isContractsTab
                ? "Search contracts by employee name, staff ID, title, or type..."
                : `Search ${currentTab.replace("-", " ")} by title, tags, description, or uploader...`
            }
            className="w-full pl-9 pr-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
          {/* Contract Specific Filters for Admins */}
          {isContractsTab && (
            <>
              {/* Employee Filter */}
              <select
                value={contractEmployeeFilter}
                onChange={(e) => setContractEmployeeFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Employees ({uniqueEmployees.length})</option>
                {uniqueEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.id})
                  </option>
                ))}
              </select>

              {/* Contract Type Filter */}
              <select
                value={contractTypeFilter}
                onChange={(e) => setContractTypeFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="Permanent">Permanent</option>
                <option value="Fixed-Term Contract">Fixed-Term Contract</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Casual">Casual</option>
                <option value="Consultant">Consultant</option>
                <option value="Volunteer">Volunteer</option>
                <option value="Intern">Intern</option>
              </select>

              {/* Status Filter (with Expiring Soon) */}
              <select
                value={contractStatusFilter}
                onChange={(e) => setContractStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="EXPIRING_SOON">Expiring soon (&le; 60d)</option>
                <option value="Expired">Expired</option>
                <option value="Terminated">Terminated</option>
                <option value="Superseded">Superseded</option>
              </select>
            </>
          )}

          {/* General Format Filter (when not on contracts tab) */}
          {!isContractsTab && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All File Formats</option>
              <option value="PDF">PDF Documents</option>
              <option value="WORD">Word (.docx)</option>
              <option value="EXCEL">Excel (.xlsx)</option>
              <option value="IMAGE">Images (PNG/JPG)</option>
            </select>
          )}

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
          >
            <option value="NEWEST">Newest First</option>
            <option value="OLDEST">Oldest First</option>
            <option value="TITLE">Title (A - Z)</option>
            {isContractsTab && <option value="EXPIRY">Expiry Date (Earliest)</option>}
            <option value="SIZE">File Size (Largest)</option>
          </select>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-3xl text-purple-600 animate-spin mb-2">
              sync
            </span>
            <p className="text-xs text-slate-500 font-medium">Fetching repository records...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">
              folder_off
            </span>
            <p className="text-xs text-slate-500 font-medium">
              No matching {isContractsTab ? "employee contracts" : "documents"} found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
                  {isContractsTab && <th className="py-3 px-4">Employee</th>}
                  <th className="py-3 px-4">Document Title &amp; Details</th>
                  {isContractsTab && <th className="py-3 px-4">Contract Type</th>}
                  {isContractsTab && <th className="py-3 px-4">Dates</th>}
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Uploaded By</th>
                  <th className="py-3 px-4">File</th>
                  {isDeletedTab && <th className="py-3 px-4">Deleted Info &amp; Reason</th>}
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => {
                  const hasEnd = contractHasEndDate(item.contractType);
                  const expiring = isContractsTab && hasEnd && isExpiringSoon(item.endDate, item.contractType);
                  const daysLeft = isContractsTab && hasEnd ? getDaysUntilExpiry(item.endDate, item.contractType) : null;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group"
                    >
                      {/* Employee Column (Contracts Tab Only) */}
                      {isContractsTab && (
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-extrabold text-xs">
                              {(item.employeeName || item.employeeId || "ST").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {item.employeeName || item.employeeId}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {item.employeeId} · {item.employeeDept || "Staff"}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Title & Description */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="font-extrabold text-slate-900 dark:text-white leading-snug">
                          {item.title}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.tags.map((t, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Contract Type (Contracts Tab Only) */}
                      {isContractsTab && (
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getContractTypeBadgeColor(item.contractType)}`}>
                            {item.contractType || "Contract"}
                          </span>
                        </td>
                      )}

                      {/* Contract Dates (Contracts Tab Only) */}
                      {isContractsTab && (
                        <td className="py-3.5 px-4 whitespace-nowrap text-[11px]">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatDate(item.startDate)} &rarr; {hasEnd && item.endDate ? formatDate(item.endDate) : "—"}
                          </div>
                          {hasEnd && item.endDate && (
                            <div className="text-[10px] text-slate-400">
                              {daysLeft !== null && daysLeft >= 0 ? `${daysLeft} days remaining` : "Expired"}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Status Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {item.status === "Deleted" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              Deleted
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              {!hasEnd && item.contractStatus === "Expired"
                                ? "Active"
                                : item.contractStatus || item.subStatus || "Active"}
                            </span>
                          )}

                          {/* Expiring Soon Informational Badge */}
                          {expiring && item.status !== "Deleted" && hasEnd && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[11px]">hourglass_bottom</span>
                              Expiring soon
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Uploaded By */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-700 dark:text-slate-200">
                            {item.uploadedBy.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                              {item.uploadedBy.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {item.uploadedBy.role} · {formatDate(item.uploadedBy.date)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* File Details */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${getFileBadgeColor(
                              item.fileExt || "pdf"
                            )}`}
                          >
                            {(item.fileExt || "DOC").toUpperCase()}
                          </span>
                          <div>
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 block truncate max-w-[140px]">
                              {item.fileName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatFileSize(item.fileSize)} · v{item.currentVersion || 1}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Deleted Info Column */}
                      {isDeletedTab && (
                        <td className="py-3.5 px-4 max-w-xs">
                          {item.deletedInfo ? (
                            <div>
                              <div className="font-bold text-rose-700 dark:text-rose-400 text-[11px]">
                                By: {item.deletedInfo.deletedBy.name} ({item.deletedInfo.deletedBy.role})
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {formatDate(item.deletedInfo.deletedAt)}
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 italic mt-0.5 line-clamp-2">
                                "{item.deletedInfo.reason}"
                              </p>
                              {item.employeeName && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] bg-purple-100 text-purple-800 font-mono">
                                  Employee: {item.employeeName} ({item.employeeId})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => openItemDetails(item)}
                            title="View Full Metadata & Audit History"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                          >
                            View
                          </button>

                          {/* Download Button (Only active items) */}
                          {item.status !== "Deleted" && permissions.canDownload && (
                            <button
                              type="button"
                              onClick={() => handleDownload(item)}
                              title="Download file (logged in audit history)"
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[15px]">download</span>
                              Download
                            </button>
                          )}

                          {/* Edit Button */}
                          {item.status !== "Deleted" && permissions.canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title="Edit metadata or upload revised version"
                              className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                            >
                              Edit
                            </button>
                          )}

                          {/* Delete Button */}
                          {item.status !== "Deleted" && permissions.canDelete && (
                            <button
                              type="button"
                              onClick={() => openDeleteModal(item)}
                              title="Soft delete item (requires mandatory reason)"
                              className="px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-bold transition cursor-pointer"
                            >
                              Delete
                            </button>
                          )}

                          {/* Restore Button (Super Admin Only on Deleted Items) */}
                          {isDeletedTab && permissions.canRestore && (
                            <button
                              type="button"
                              onClick={() => handleRestore(item)}
                              disabled={restoringId === item.id}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">restore_from_trash</span>
                              {restoringId === item.id ? "Restoring..." : "Restore"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── VIEW DETAILS MODAL ─── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {selectedItem.category === "employee-contracts" ? "Employee Contract Record" : "Official Record Details"}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5">
                  {selectedItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Expiring Soon Banner - strictly ONLY for contract types that have an end date */}
              {contractHasEndDate(selectedItem.contractType) &&
                isExpiringSoon(selectedItem.endDate, selectedItem.contractType) &&
                selectedItem.status !== "Deleted" && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <span className="material-symbols-outlined text-xl">hourglass_bottom</span>
                    <span className="font-bold">
                      This contract is expiring soon ({getDaysUntilExpiry(selectedItem.endDate, selectedItem.contractType)} days remaining until {formatDate(selectedItem.endDate)}).
                    </span>
                  </div>
                )}

              {/* Description & Details */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Description &amp; Details
                </span>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed text-xs">
                  {selectedItem.description}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                  {selectedItem.employeeId && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Employee</span>
                      <span className="font-bold text-purple-700 dark:text-purple-300">
                        {selectedItem.employeeName || selectedItem.employeeId} ({selectedItem.employeeId})
                      </span>
                    </div>
                  )}
                  {selectedItem.contractType && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Contract Type</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedItem.contractType}
                      </span>
                    </div>
                  )}
                  {selectedItem.category === "employee-contracts" && (
                    <>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Start Date</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatDate(selectedItem.startDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">End Date</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {contractHasEndDate(selectedItem.contractType) ? formatDate(selectedItem.endDate) : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Contract Status</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedItem.contractStatus || "Active"}
                        </span>
                      </div>
                    </>
                  )}
                  <div>
                    <span className="text-slate-400 block text-[10px]">Uploaded By</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedItem.uploadedBy.name} ({selectedItem.uploadedBy.role})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Upload Date</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {formatDate(selectedItem.uploadedBy.date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Downloads</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedItem.downloadCount || 0} times
                    </span>
                  </div>
                </div>
              </div>

              {/* Version History */}
              {selectedItem.versions && selectedItem.versions.length > 0 && (
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                    Version History ({selectedItem.versions.length} versions logged)
                  </span>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedItem.versions.map((ver, i) => (
                      <div key={i} className="p-3 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              v{ver.versionNumber}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {ver.fileName}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {ver.changeSummary}
                          </p>
                        </div>
                        <div className="text-right text-[10px] text-slate-400 shrink-0">
                          <div>{ver.editedBy.name} ({ver.editedBy.role})</div>
                          <div className="font-mono">{formatDate(ver.editedAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download History: Visible ONLY to HR, SA, CEO, IAR (Hidden from Staff & Finance) */}
              {permissions.canViewDownloadHistory && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Audit Trail: Full Download History ({selectedItem.downloadCount || 0})
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Access Restricted by Institutional Policy
                    </span>
                  </div>

                  {!selectedItem.downloadHistory || selectedItem.downloadHistory.length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-slate-400 text-xs">
                      No downloads have been recorded yet for this item.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedItem.downloadHistory.map((dl, i) => (
                        <div key={i} className="p-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400 text-[16px]">
                              person
                            </span>
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {dl.name}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1.5">
                                ({dl.role})
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatDate(dl.date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                Official BCF-SL Institutional Archive Record
              </span>
              <div className="flex items-center gap-2">
                {selectedItem.status !== "Deleted" && permissions.canDownload && (
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedItem)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    Download
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT MODAL ─── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Update Official Record
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  Edit: {editingItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Title (Required)
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Description / Reference Note (Required)
                </label>
                <textarea
                  rows={3}
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Contract specific fields in Edit Modal */}
              {editingItem.category === "employee-contracts" && (
                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-xl space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Contract Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editContractType}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          setEditContractType(nextType);
                          if (!contractHasEndDate(nextType)) {
                            setEditEndDate("");
                            if (editContractStatus === "Expired") {
                              setEditContractStatus("Active");
                            }
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                      >
                        <option value="" disabled>Select Type...</option>
                        {CONTRACT_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Contract Status
                      </label>
                      <select
                        value={editContractStatus}
                        onChange={(e) => setEditContractStatus(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                      >
                        <option value="Active">Active</option>
                        {contractHasEndDate(editContractType) && (
                          <option value="Expired">Expired</option>
                        )}
                        <option value="Terminated">Terminated</option>
                        <option value="Superseded">Superseded</option>
                      </select>
                    </div>
                  </div>

                  <div className={`grid ${contractHasEndDate(editContractType) ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Start Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                    {contractHasEndDate(editContractType) && (
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          End Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={editEndDate}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Replace File */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Replace File (Optional · Increments to v{(editingItem.currentVersion || 1) + 1})
                </label>
                <input
                  type="file"
                  accept={editingItem.category === "employee-contracts" ? ".pdf,.doc,.docx" : ".pdf,.doc,.docx,.xls,.xlsx"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setEditFile({
                          fileName: f.name,
                          fileData: reader.result as string,
                          fileSize: f.size,
                          fileType: f.type,
                        });
                      };
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 cursor-pointer"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Revision Summary Log (Required for version record)
                </label>
                <input
                  type="text"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  placeholder="e.g. Contract renewed for FY2026 / amended salary and terms"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE MODAL ─── */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 flex items-center gap-3">
              <span className="material-symbols-outlined text-rose-600 text-2xl">
                warning
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-rose-900 dark:text-rose-200">
                  Confirm Soft Delete
                </h3>
                <span className="text-[10px] text-rose-600 dark:text-rose-400">
                  Item will be moved to Deleted Items Log
                </span>
              </div>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <p className="text-slate-700 dark:text-slate-300">
                Are you sure you want to soft-delete <strong>"{deletingItem.title}"</strong>?
              </p>

              {deleteError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-[11px] font-medium">
                  {deleteError}
                </div>
              )}

              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Mandatory Deletion Justification <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Enter specific audit reason for archiving/deleting this record..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {deleteSubmitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
