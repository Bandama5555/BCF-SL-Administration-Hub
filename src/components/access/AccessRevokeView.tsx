"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getUser, type AuthUser } from "@/lib/auth";
import { AccessGrant, AccessRevocation, AccessRight, RevokeReasonCode, RevokeScope } from "@/lib/accessTypes";
import { normalizeRole, RoleCode, ACCESS_MATRIX } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";

interface ActiveStaffMember {
  staffId: string;
  name: string;
  email: string;
  department: string;
  position: string;
  director: string;
  directorEmail?: string;
  activeGrants: AccessGrant[];
}

export function AccessRevokeView() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [staffList, setStaffList] = useState<ActiveStaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [revocations, setRevocations] = useState<AccessRevocation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Form State
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [revokeScope, setRevokeScope] = useState<RevokeScope>("Tab"); // "Module" | "Tab" | "Rights"
  const [selectedModuleSlug, setSelectedModuleSlug] = useState<string>("");
  const [selectedTabIds, setSelectedTabIds] = useState<string[]>([]);
  const [selectedTabForRights, setSelectedTabForRights] = useState<string>("");
  const [rightsToRemove, setRightsToRemove] = useState<AccessRight[]>([]);
  const [reasonCode, setReasonCode] = useState<RevokeReasonCode | "">("");
  const [reasonText, setReasonText] = useState("");
  const [effectiveType, setEffectiveType] = useState<"Immediately" | "Date">("Immediately");
  const [effectiveDate, setEffectiveDate] = useState("");

  // UI / Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // History filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyModuleFilter, setHistoryModuleFilter] = useState("");
  const [historyReasonFilter, setHistoryReasonFilter] = useState("");

  useEffect(() => {
    setUser(getUser());
  }, []);

  const roleCode: RoleCode = normalizeRole(user?.role, user?.username, user?.email);
  const isSuperAdmin = roleCode === "SA";

  const getHeaders = () => ({
    "Content-Type": "application/json",
    "x-bcf-user-role": user?.role || "",
    "x-bcf-username": user?.username || "",
    "x-bcf-email": user?.email || "",
    "x-bcf-name": user?.name || "",
    "x-bcf-employee-id": user?.employeeId || "",
  });

  const fetchStaffWithAccess = async () => {
    if (!user) return;
    setLoadingStaff(true);
    try {
      const res = await fetch("/api/access/staff-active", { headers: getHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.staff)) {
        setStaffList(data.staff);
      }
    } catch (err) {
      console.error("Failed to load staff list:", err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const fetchRevokeHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/access/revocations", { headers: getHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.revocations)) {
        setRevocations(data.revocations);
      }
    } catch (err) {
      console.error("Failed to load revocation history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (user && isSuperAdmin) {
      fetchStaffWithAccess();
      fetchRevokeHistory();
    }
  }, [user, isSuperAdmin]);

  // Selected staff profile
  const selectedStaff = useMemo(() => {
    return staffList.find((s) => s.staffId === selectedStaffId) || null;
  }, [staffList, selectedStaffId]);

  // Unique modules granted to selected staff
  const staffGrantedModules = useMemo(() => {
    if (!selectedStaff) return [];
    const moduleMap = new Map<string, { slug: string; name: string; grants: AccessGrant[] }>();
    selectedStaff.activeGrants.forEach((g) => {
      if (!moduleMap.has(g.moduleSlug)) {
        moduleMap.set(g.moduleSlug, {
          slug: g.moduleSlug,
          name: g.module,
          grants: [],
        });
      }
      moduleMap.get(g.moduleSlug)!.grants.push(g);
    });
    return Array.from(moduleMap.values());
  }, [selectedStaff]);

  // Tabs available under the selected module for this staff
  const currentModuleTabs = useMemo(() => {
    if (!selectedStaff || !selectedModuleSlug) return [];
    return selectedStaff.activeGrants.filter((g) => g.moduleSlug === selectedModuleSlug);
  }, [selectedStaff, selectedModuleSlug]);

  // Auto-select first module when staff changes
  useEffect(() => {
    if (staffGrantedModules.length > 0) {
      setSelectedModuleSlug(staffGrantedModules[0].slug);
      setSelectedTabIds([]);
      setSelectedTabForRights(staffGrantedModules[0].grants[0]?.tabId || "");
    } else {
      setSelectedModuleSlug("");
      setSelectedTabIds([]);
      setSelectedTabForRights("");
    }
  }, [selectedStaffId, staffGrantedModules]);

  // When selected tab for rights changes, reset rights to remove
  useEffect(() => {
    setRightsToRemove([]);
  }, [selectedTabForRights]);

  // Rights of the specific tab chosen for partial removal
  const currentTabGrantsForRights = useMemo(() => {
    if (!selectedStaff || !selectedTabForRights) return [];
    const g = selectedStaff.activeGrants.find((item) => item.tabId === selectedTabForRights);
    return g?.rightsGranted || [];
  }, [selectedStaff, selectedTabForRights]);

  // Validation
  const isSelfRevoke = useMemo(() => {
    if (!selectedStaff || !user) return false;
    return (
      selectedStaff.staffId === user.employeeId ||
      selectedStaff.email.toLowerCase() === (user.email || "").toLowerCase()
    );
  }, [selectedStaff, user]);

  const requiresDetails = useMemo(() => {
    return reasonCode === "Misuse" || reasonCode === "Security concern" || reasonCode === "Other";
  }, [reasonCode]);

  const isFormValid = useMemo(() => {
    if (!selectedStaffId) return false;
    if (isSelfRevoke) return false;
    if (!reasonCode) return false;
    if (requiresDetails && !reasonText.trim()) return false;
    if (effectiveType === "Date" && !effectiveDate) return false;

    if (revokeScope === "Module" && !selectedModuleSlug) return false;
    if (revokeScope === "Tab" && selectedTabIds.length === 0) return false;
    if (revokeScope === "Rights" && (!selectedTabForRights || rightsToRemove.length === 0)) return false;

    return true;
  }, [
    selectedStaffId,
    isSelfRevoke,
    reasonCode,
    requiresDetails,
    reasonText,
    effectiveType,
    effectiveDate,
    revokeScope,
    selectedModuleSlug,
    selectedTabIds,
    selectedTabForRights,
    rightsToRemove,
  ]);

  // Handle Revoke Submission
  const handleExecuteRevoke = async () => {
    if (!isFormValid || !selectedStaff) return;
    setSubmitting(true);
    setFeedbackMessage(null);

    try {
      const payload: any = {
        staffId: selectedStaff.staffId,
        staffName: selectedStaff.name,
        staffEmail: selectedStaff.email,
        department: selectedStaff.department,
        position: selectedStaff.position,
        directorEmail: selectedStaff.directorEmail,
        scope: revokeScope,
        moduleSlug: selectedModuleSlug,
        module: staffGrantedModules.find((m) => m.slug === selectedModuleSlug)?.name || selectedModuleSlug,
        reason_code: reasonCode,
        reason_text: reasonText,
        effective_at: effectiveType === "Immediately" ? "Immediately" : effectiveDate,
      };

      if (revokeScope === "Module") {
        payload.grantIds = currentModuleTabs.map((t) => t.id);
      } else if (revokeScope === "Tab") {
        payload.selectedTabIds = selectedTabIds;
        payload.grantIds = currentModuleTabs.filter((t) => selectedTabIds.includes(t.tabId)).map((t) => t.id);
      } else if (revokeScope === "Rights") {
        const targetGrant = currentModuleTabs.find((t) => t.tabId === selectedTabForRights);
        payload.grantId = targetGrant?.id;
        payload.tabId = selectedTabForRights;
        payload.tab = targetGrant?.tab;
        payload.rightsToRemove = rightsToRemove;
      }

      const res = await fetch("/api/access/revoke", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setFeedbackMessage({
          type: "success",
          text: data.message || "Access revoked successfully. Permissions updated immediately.",
        });
        setConfirmModalOpen(false);

        // Prune revoked grants from client session storage and local storage immediately
        try {
          const rawGrants = sessionStorage.getItem("bcf_user_grants") || localStorage.getItem("bcf_user_grants");
          if (rawGrants) {
            const parsed = JSON.parse(rawGrants);
            if (Array.isArray(parsed)) {
              let pruned = parsed;
              if (revokeScope === "Module") {
                pruned = parsed.filter((g: any) => g.moduleSlug !== selectedModuleSlug);
              } else if (revokeScope === "Tab") {
                pruned = parsed.filter((g: any) => !selectedTabIds.includes(g.tabId));
              } else if (revokeScope === "Rights" && rightsToRemove.length > 0) {
                pruned = parsed.map((g: any) => {
                  if (g.tabId === selectedTabForRights) {
                    return {
                      ...g,
                      rights: (g.rights || []).filter((r: string) => !rightsToRemove.includes(r as any)),
                    };
                  }
                  return g;
                });
              }
              sessionStorage.setItem("bcf_user_grants", JSON.stringify(pruned));
              localStorage.setItem("bcf_user_grants", JSON.stringify(pruned));
            }
          }
        } catch (_) {}

        // Reset form selections
        setSelectedStaffId("");
        setSelectedTabIds([]);
        setRightsToRemove([]);
        setReasonCode("");
        setReasonText("");

        // Trigger real-time session update across all components and windows
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("bcf_grants_updated"));
        }

        // Refresh data
        fetchStaffWithAccess();
        fetchRevokeHistory();
      } else {
        setFeedbackMessage({
          type: "error",
          text: data.error || "Failed to execute access revocation.",
        });
        setConfirmModalOpen(false);
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.message || "An unexpected error occurred during revocation.",
      });
      setConfirmModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // CSV Export for Revoke History
  const exportHistoryCsv = () => {
    if (revocations.length === 0) return;
    const headers = [
      "Revocation ID",
      "Staff Name",
      "Staff ID",
      "Department",
      "Module",
      "Tab",
      "Scope",
      "Rights Removed",
      "Reason Code",
      "Reason Details",
      "Revoked By",
      "Effective Date",
      "Revoked At",
    ];

    const rows = revocations.map((r) => [
      r.id,
      `"${r.staffName || ""}"`,
      `"${r.staff_id || ""}"`,
      `"${r.department || ""}"`,
      `"${r.module || ""}"`,
      `"${r.tab || "All Tabs"}"`,
      r.scope,
      `"${(r.rights_removed || []).join(", ")}"`,
      `"${r.reason_code || ""}"`,
      `"${(r.reason_text || "").replace(/"/g, '""')}"`,
      `"${r.revoked_by || ""}"`,
      r.effective_at,
      r.revoked_at,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bcf_access_revocations_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered History
  const filteredRevocations = useMemo(() => {
    return revocations.filter((r) => {
      const matchSearch =
        !historySearch ||
        r.staffName?.toLowerCase().includes(historySearch.toLowerCase()) ||
        r.staff_id?.toLowerCase().includes(historySearch.toLowerCase()) ||
        r.module?.toLowerCase().includes(historySearch.toLowerCase()) ||
        r.tab?.toLowerCase().includes(historySearch.toLowerCase()) ||
        r.reason_text?.toLowerCase().includes(historySearch.toLowerCase());

      const matchModule = !historyModuleFilter || r.module === historyModuleFilter;
      const matchReason = !historyReasonFilter || r.reason_code === historyReasonFilter;

      return matchSearch && matchModule && matchReason;
    });
  }, [revocations, historySearch, historyModuleFilter, historyReasonFilter]);

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-red-600 text-5xl mb-2">lock</span>
          <h2 className="text-xl font-bold text-red-800 dark:text-red-300">Access Restricted</h2>
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            You do not have access to that page. Access Revocation is strictly restricted to Super Administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-red-700 via-rose-700 to-amber-700 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-300 text-3xl">remove_moderator</span>
            <h1 className="text-2xl font-black tracking-tight">Access Revocation Console</h1>
          </div>
          <p className="text-sm text-rose-100 mt-1 max-w-2xl">
            Revoke granted permissions by entire module, selected tabs, or individual rights. Revocations execute in an
            immediate database transaction, notify staff and directors, and invalidate active sessions instantaneously.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-xs font-semibold text-rose-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-300 text-base">bolt</span>
          <span>Instant Session Invalidation Active</span>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl">
              {feedbackMessage.type === "success" ? "check_circle" : "error"}
            </span>
            <span className="text-sm font-medium">{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs hover:underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Revocation Form Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm p-6 md:p-8">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-rose-600">block</span>
          Configure Access Revocation
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Form Column (Inputs) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Staff Picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">
                1. Select Staff Member <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">-- Choose staff member with active access --</option>
                  {staffList.map((s) => (
                    <option key={s.staffId} value={s.staffId}>
                      {s.name} ({s.staffId}) — {s.department} [{s.activeGrants.length} active tab grants]
                    </option>
                  ))}
                </select>
              </div>

              {isSelfRevoke && (
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <span className="material-symbols-outlined text-base">warning</span>
                  Super Admin cannot revoke their own access.
                </div>
              )}
            </div>

            {/* Read-Only Staff Summary Details */}
            {selectedStaff && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-neutral-50 dark:bg-neutral-800/60 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
                <div>
                  <span className="text-neutral-500 block">Staff ID</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">{selectedStaff.staffId}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Department</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">{selectedStaff.department}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Position</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">{selectedStaff.position}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Department Director</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">{selectedStaff.director}</span>
                </div>
              </div>
            )}

            {/* Step 2: Revoke By Mode */}
            {selectedStaff && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">
                  2. Revoke Mode <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "Module", label: "Entire Module", icon: "view_quilt", desc: "Remove all tabs in module" },
                    { id: "Tab", label: "Selected Tab(s)", icon: "tab", desc: "Tick specific tabs" },
                    { id: "Rights", label: "Specific Rights", icon: "tune", desc: "E.g. Remove Write, keep Read" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setRevokeScope(mode.id as RevokeScope)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        revokeScope === mode.id
                          ? "border-rose-600 bg-rose-50/60 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200 ring-2 ring-rose-500/20"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="material-symbols-outlined text-lg">{mode.icon}</span>
                        {revokeScope === mode.id && (
                          <span className="material-symbols-outlined text-base text-rose-600">check_circle</span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold block">{mode.label}</span>
                        <span className="text-[10px] text-neutral-500 block leading-tight">{mode.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Step: Module & Tab Selectors based on Revoke Mode */}
            {selectedStaff && (
              <div className="space-y-4 bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                {/* Module Selector */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Select Target Module
                  </label>
                  <select
                    value={selectedModuleSlug}
                    onChange={(e) => {
                      setSelectedModuleSlug(e.target.value);
                      setSelectedTabIds([]);
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100"
                  >
                    {staffGrantedModules.map((m) => (
                      <option key={m.slug} value={m.slug}>
                        {m.name} ({m.grants.length} active tab grants)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scope = "Module": Display what will be removed */}
                {revokeScope === "Module" && selectedModuleSlug && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-xs space-y-1">
                    <span className="font-bold text-red-800 dark:text-red-300 block">
                      Tabs that will be completely removed from this module:
                    </span>
                    <ul className="list-disc list-inside text-red-700 dark:text-red-400 space-y-0.5">
                      {currentModuleTabs.map((g) => (
                        <li key={g.tabId}>
                          <span className="font-semibold">{g.tab}</span> (Rights: {g.rightsGranted?.join(", ")})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Scope = "Tab": Checkboxes for tabs */}
                {revokeScope === "Tab" && selectedModuleSlug && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      Tick tabs to revoke:
                    </label>
                    <div className="space-y-2">
                      {currentModuleTabs.map((g) => {
                        const checked = selectedTabIds.includes(g.tabId);
                        return (
                          <label
                            key={g.tabId}
                            className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                              checked
                                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                                : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTabIds((prev) => [...prev, g.tabId]);
                                  } else {
                                    setSelectedTabIds((prev) => prev.filter((id) => id !== g.tabId));
                                  }
                                }}
                                className="rounded text-rose-600 focus:ring-rose-500"
                              />
                              <span className="font-bold">{g.tab}</span>
                            </div>
                            <span className="text-[11px] bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 rounded text-neutral-700 dark:text-neutral-300">
                              Rights: {g.rightsGranted?.join(", ")}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Scope = "Rights": Specific Rights removal on single tab */}
                {revokeScope === "Rights" && selectedModuleSlug && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Select Target Tab:
                      </label>
                      <select
                        value={selectedTabForRights}
                        onChange={(e) => setSelectedTabForRights(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100"
                      >
                        {currentModuleTabs.map((g) => (
                          <option key={g.tabId} value={g.tabId}>
                            {g.tab} (Currently has: {g.rightsGranted?.join(", ")})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                        Select rights to REMOVE (remaining rights will be preserved):
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {currentTabGrantsForRights.map((right) => {
                          const isRemoving = rightsToRemove.includes(right);
                          return (
                            <button
                              key={right}
                              type="button"
                              onClick={() => {
                                if (isRemoving) {
                                  setRightsToRemove((prev) => prev.filter((r) => r !== right));
                                } else {
                                  setRightsToRemove((prev) => [...prev, right]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                isRemoving
                                  ? "bg-red-600 border-red-700 text-white shadow-sm"
                                  : "bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400"
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {isRemoving ? "delete" : "check"}
                              </span>
                              {right} {isRemoving ? "(Removing)" : "(Keep)"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Reason Dropdown (Required) */}
            {selectedStaff && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">
                  3. Revocation Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value as RevokeReasonCode)}
                  className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">-- Choose reason --</option>
                  <option value="Role change">Role change</option>
                  <option value="Transferred">Transferred</option>
                  <option value="Resigned or terminated">Resigned or terminated</option>
                  <option value="Misuse">Misuse (Details required)</option>
                  <option value="Access no longer needed">Access no longer needed</option>
                  <option value="Access expired">Access expired</option>
                  <option value="Security concern">Security concern (Details required)</option>
                  <option value="Other">Other (Details required)</option>
                </select>

                {/* Conditional Reason Details Textbox */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Reason Details / Justification Notes{" "}
                    {requiresDetails ? (
                      <span className="text-red-500 font-bold">* (Strictly Required for {reasonCode})</span>
                    ) : (
                      <span className="text-neutral-400">(Optional)</span>
                    )}
                  </label>
                  <textarea
                    rows={3}
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder={
                      requiresDetails
                        ? `Please provide full contextual details and justification for ${reasonCode}...`
                        : "Additional notes regarding this revocation..."
                    }
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Effective Date */}
            {selectedStaff && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-2">
                  4. Effective Date
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    <input
                      type="radio"
                      name="effectiveType"
                      checked={effectiveType === "Immediately"}
                      onChange={() => setEffectiveType("Immediately")}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    Immediately (Default)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    <input
                      type="radio"
                      name="effectiveType"
                      checked={effectiveType === "Date"}
                      onChange={() => setEffectiveType("Date")}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    On Chosen Date
                  </label>
                </div>
                {effectiveType === "Date" && (
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="mt-2 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-neutral-100"
                  />
                )}
              </div>
            )}
          </div>

          {/* Right Summary Column */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-neutral-50 dark:bg-neutral-800/40 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-lg">receipt_long</span>
                Revocation Summary
              </h3>

              {selectedStaff ? (
                <div className="space-y-3 text-xs divide-y divide-neutral-200 dark:divide-neutral-700">
                  <div className="pt-2">
                    <span className="text-neutral-500 block">Target Staff:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                      {selectedStaff.name} ({selectedStaff.staffId})
                    </span>
                    <span className="text-neutral-500 block text-[11px]">{selectedStaff.department}</span>
                  </div>

                  <div className="pt-2">
                    <span className="text-neutral-500 block">Scope:</span>
                    <span className="font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">
                      {revokeScope === "Module"
                        ? `Entire Module: ${staffGrantedModules.find((m) => m.slug === selectedModuleSlug)?.name || selectedModuleSlug}`
                        : revokeScope === "Tab"
                        ? `${selectedTabIds.length} Selected Tab(s)`
                        : `Partial Rights on ${currentModuleTabs.find((t) => t.tabId === selectedTabForRights)?.tab || selectedTabForRights}`}
                    </span>
                  </div>

                  {revokeScope === "Tab" && selectedTabIds.length > 0 && (
                    <div className="pt-2">
                      <span className="text-neutral-500 block">Tabs to be Revoked:</span>
                      <ul className="list-disc list-inside font-medium text-neutral-700 dark:text-neutral-300 space-y-0.5 mt-1">
                        {currentModuleTabs
                          .filter((t) => selectedTabIds.includes(t.tabId))
                          .map((t) => (
                            <li key={t.tabId}>{t.tab}</li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {revokeScope === "Rights" && rightsToRemove.length > 0 && (
                    <div className="pt-2">
                      <span className="text-neutral-500 block">Rights Being Removed:</span>
                      <div className="flex gap-1.5 mt-1">
                        {rightsToRemove.map((r) => (
                          <span
                            key={r}
                            className="bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 px-2 py-0.5 rounded font-bold text-[11px]"
                          >
                            -{r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <span className="text-neutral-500 block">Reason:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">
                      {reasonCode || "Not selected yet"}
                    </span>
                    {reasonText && <p className="text-neutral-600 dark:text-neutral-400 italic mt-0.5">{reasonText}</p>}
                  </div>

                  <div className="pt-2">
                    <span className="text-neutral-500 block">Effective:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">
                      {effectiveType === "Immediately" ? "Immediately upon confirmation" : effectiveDate || "Pending date"}
                    </span>
                  </div>

                  <div className="pt-2">
                    <span className="text-neutral-500 block">Notifications:</span>
                    <span className="text-neutral-600 dark:text-neutral-400 block text-[11px]">
                      • Staff Member ({selectedStaff.email})
                      <br />• Department Director ({selectedStaff.director})
                      {(selectedModuleSlug && revokeScope === "Module") ||
                      reasonCode === "Security concern" ||
                      reasonCode === "Misuse" ? (
                        <>
                          <br />• IT Director (High Security/Module Alert)
                        </>
                      ) : null}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-neutral-400">
                  <span className="material-symbols-outlined text-4xl mb-2 text-neutral-300 dark:text-neutral-600">
                    person_search
                  </span>
                  <p className="text-xs">Select a staff member from the list to preview revocation summary.</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                disabled={!isFormValid || submitting}
                onClick={() => setConfirmModalOpen(true)}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                  isFormValid && !submitting
                    ? "bg-red-600 hover:bg-red-700 text-white cursor-pointer active:scale-[0.99]"
                    : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
                }`}
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Confirm Revoke
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100">Confirm Access Revocation</h3>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Are you sure you want to revoke access for <strong className="text-neutral-900 dark:text-white">{selectedStaff?.name}</strong>?
            </p>
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-800 dark:text-red-300 space-y-1">
              <div>
                <strong>Scope:</strong> {revokeScope}
              </div>
              <div>
                <strong>Reason:</strong> {reasonCode}
              </div>
              <div>
                <strong>Action:</strong> Target tab permissions will be instantly stripped and session refreshed immediately.
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-sm font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleExecuteRevoke}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md flex items-center gap-2"
              >
                {submitting ? "Processing..." : "Yes, Revoke Access Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke History Section */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-neutral-500">history_edu</span>
              Revocation Audit History
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Permanent immutable ledger of all access permissions revoked across the BCF-SL Administration System.
            </p>
          </div>
          <button
            type="button"
            onClick={exportHistoryCsv}
            className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold flex items-center gap-2 self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>
        </div>

        {/* History Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search staff, ID, module, tab, or reason..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
          <select
            value={historyModuleFilter}
            onChange={(e) => setHistoryModuleFilter(e.target.value)}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100"
          >
            <option value="">All Modules</option>
            {MODULES.map((m) => (
              <option key={m.slug} value={m.label}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={historyReasonFilter}
            onChange={(e) => setHistoryReasonFilter(e.target.value)}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100"
          >
            <option value="">All Reasons</option>
            <option value="Role change">Role change</option>
            <option value="Transferred">Transferred</option>
            <option value="Resigned or terminated">Resigned or terminated</option>
            <option value="Misuse">Misuse</option>
            <option value="Access no longer needed">Access no longer needed</option>
            <option value="Access expired">Access expired</option>
            <option value="Security concern">Security concern</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Staff Member</th>
                <th className="p-3">Module & Tab</th>
                <th className="p-3">Scope & Rights Removed</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Revoked By</th>
                <th className="p-3">Effective Date</th>
                <th className="p-3">Recorded At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200">
              {loadingHistory ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-neutral-500">
                    Loading revocation audit history...
                  </td>
                </tr>
              ) : filteredRevocations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-neutral-400">
                    No revocation records found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRevocations.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="p-3">
                      <span className="font-bold block">{r.staffName || r.staff_id}</span>
                      <span className="text-[11px] text-neutral-500 block">{r.staff_id} • {r.department}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold block">{r.module}</span>
                      <span className="text-[11px] text-neutral-500 block">{r.tab || "All Tabs (Module-wide)"}</span>
                    </td>
                    <td className="p-3">
                      <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded font-bold text-[10px] uppercase inline-block mb-1">
                        {r.scope}
                      </span>
                      <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
                        {(r.rights_removed || []).join(", ") || "All Rights"}
                      </div>
                    </td>
                    <td className="p-3 max-w-xs">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">{r.reason_code}</span>
                      {r.reason_text && (
                        <p className="text-[11px] text-neutral-500 italic truncate" title={r.reason_text}>
                          {r.reason_text}
                        </p>
                      )}
                    </td>
                    <td className="p-3 font-medium text-neutral-700 dark:text-neutral-300">
                      {r.revoked_by || "Super Admin"}
                    </td>
                    <td className="p-3 text-neutral-600 dark:text-neutral-400">
                      {r.effective_at ? new Date(r.effective_at).toLocaleDateString() : "Immediate"}
                    </td>
                    <td className="p-3 text-neutral-500 text-[11px]">
                      {r.revoked_at ? new Date(r.revoked_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
