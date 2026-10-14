"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getUser, type AuthUser } from "@/lib/auth";
import { AccessRight, RevokeReasonCode } from "@/lib/accessTypes";
import { normalizeRole, RoleCode } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";

interface ApprovalTrail {
  requester: string;
  requestedAt: string;
  directorApproval?: { name: string; date: string; comment?: string } | null;
  itDirectorApproval?: { name: string; date: string; comment?: string } | null;
  superAdminGrant?: { name: string; date: string; comment?: string } | null;
}

interface DetailedGrant {
  id: string;
  requestId: string;
  requestNumber: string;
  module: string;
  moduleSlug: string;
  tab: string;
  tabId: string;
  rights: AccessRight[];
  status: "Active" | "Expired" | "Revoked";
  isSensitive: boolean;
  grantedAt: string;
  acceptedAt?: string;
  endDate?: string | null;
  isPermanent: boolean;
  grantedBy: string;
  requesterName: string;
  approvalTrail: ApprovalTrail;
  revocationDetails?: {
    revokedBy: string;
    revokedAt: string;
    reasonCode?: string;
    reasonText?: string;
    rightsRemoved?: AccessRight[];
  } | null;
}

interface BaselineAccessItem {
  module: string;
  moduleSlug: string;
  tab: string;
  tabId: string;
  level: string;
  rights: AccessRight[];
}

interface StaffMasterProfile {
  staffId: string;
  staffName: string;
  email: string;
  department: string;
  position: string;
  director: string;
  roleCode: RoleCode;
  modulesCount: number;
  modulesList: string[];
  tabsCount: number;
  rightsSummary: AccessRight[];
  lastGranted: string;
  status: "Active" | "Expiring soon" | "Revoked";
  grants: DetailedGrant[];
  baselineAccess: BaselineAccessItem[];
}

interface TabStaffItem {
  grantId: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  department: string;
  position: string;
  rights: AccessRight[];
  grantedAt: string;
  endDate: string | null;
  isPermanent: boolean;
  status: string;
}

interface TabRegisterEntry {
  module: string;
  moduleSlug: string;
  tab: string;
  tabId: string;
  isSensitive: boolean;
  staffList: TabStaffItem[];
}

interface ModuleCountEntry {
  moduleName: string;
  moduleSlug: string;
  totalStaffWithAccess: number;
  activeGrants: number;
  revokedGrants: number;
  tabs: Array<{
    tabId: string;
    tabName: string;
    staffCount: number;
    activeCount: number;
    revokedCount: number;
    isSensitive: boolean;
  }>;
}

export function AccessMasterView() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Master Data
  const [kpis, setKpis] = useState({
    totalStaffWithGrants: 0,
    activeGrantsCount: 0,
    pendingRequestsCount: 0,
    expiringIn30DaysCount: 0,
    revokedThisMonthCount: 0,
    sensitiveTabGrantsCount: 0,
  });
  const [staffProfiles, setStaffProfiles] = useState<StaffMasterProfile[]>([]);
  const [tabRegister, setTabRegister] = useState<TabRegisterEntry[]>([]);
  const [moduleCounts, setModuleCounts] = useState<ModuleCountEntry[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // View Mode: "staff" | "tab" | "module"
  const [activeView, setActiveView] = useState<"staff" | "tab" | "module">("staff");

  // Show role-based baseline access toggle
  const [showRoleBasedAccess, setShowRoleBasedAccess] = useState(false);

  // Filter toolbar state
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [tabFilter, setTabFilter] = useState("");
  const [rightsFilter, setRightsFilter] = useState<AccessRight | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [durationFilter, setDurationFilter] = useState("");
  const [sensitiveOnly, setSensitiveOnly] = useState(false);

  // Detail Drawer / Modal for Staff Profile
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<StaffMasterProfile | null>(null);

  // Single Revoke trigger from Staff Profile
  const [grantToRevoke, setGrantToRevoke] = useState<DetailedGrant | null>(null);
  const [singleRevokeReason, setSingleRevokeReason] = useState<RevokeReasonCode>("Role change");
  const [singleRevokeDetails, setSingleRevokeDetails] = useState("");
  const [submittingSingleRevoke, setSubmittingSingleRevoke] = useState(false);

  // View 2: By Tab State
  const [selectedTabModuleSlug, setSelectedTabModuleSlug] = useState<string>("");
  const [selectedTabId, setSelectedTabId] = useState<string>("");
  const [selectedStaffForBulkRevoke, setSelectedStaffForBulkRevoke] = useState<string[]>([]);
  const [bulkRevokeModalOpen, setBulkRevokeModalOpen] = useState(false);
  const [bulkRevokeReason, setBulkRevokeReason] = useState<RevokeReasonCode>("Access no longer needed");
  const [bulkRevokeDetails, setBulkRevokeDetails] = useState("");
  const [submittingBulkRevoke, setSubmittingBulkRevoke] = useState(false);

  // Print Mode State
  const [printModalOpen, setPrintModalOpen] = useState(false);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const roleCode: RoleCode = normalizeRole(user?.role, user?.username, user?.email);
  const isSuperAdmin = roleCode === "SA";
  const canExportReport = roleCode === "SA" || roleCode === "IT";

  const getHeaders = () => ({
    "Content-Type": "application/json",
    "x-bcf-user-role": user?.role || "",
    "x-bcf-username": user?.username || "",
    "x-bcf-email": user?.email || "",
    "x-bcf-name": user?.name || "",
    "x-bcf-employee-id": user?.employeeId || "",
  });

  const fetchMasterData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/access/master", { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setKpis(data.kpis);
        setStaffProfiles(data.staffProfiles || []);
        setTabRegister(data.tabRegister || []);
        setModuleCounts(data.moduleCounts || []);
        setIsReadOnly(Boolean(data.isReadOnly));

        // Default By Tab selectors
        if (data.tabRegister?.length > 0 && !selectedTabModuleSlug) {
          setSelectedTabModuleSlug(data.tabRegister[0].moduleSlug);
          setSelectedTabId(data.tabRegister[0].tabId);
        }
      }
    } catch (err) {
      console.error("Failed to load Access Master data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMasterData();
    }
  }, [user]);

  // Unique departments for filter dropdown
  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    staffProfiles.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set).sort();
  }, [staffProfiles]);

  // Filtered Staff Profiles
  const filteredStaffProfiles = useMemo(() => {
    return staffProfiles.filter((s) => {
      const matchSearch =
        !searchQuery ||
        s.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.staffId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.position.toLowerCase().includes(searchQuery.toLowerCase());

      const matchDept = !deptFilter || s.department === deptFilter;
      const matchModule = !moduleFilter || s.modulesList.includes(moduleFilter);
      const matchStatus = !statusFilter || s.status.toLowerCase() === statusFilter.toLowerCase();
      const matchRights = !rightsFilter || s.rightsSummary.includes(rightsFilter as AccessRight);

      // Sensitive filter
      const matchSensitive = !sensitiveOnly || s.grants.some((g) => g.isSensitive && g.status === "Active");

      // Duration filter
      const matchDuration =
        !durationFilter ||
        (durationFilter === "Permanent" && s.grants.some((g) => g.isPermanent)) ||
        (durationFilter === "Temporary" && s.grants.some((g) => !g.isPermanent));

      return matchSearch && matchDept && matchModule && matchStatus && matchRights && matchSensitive && matchDuration;
    });
  }, [
    staffProfiles,
    searchQuery,
    deptFilter,
    moduleFilter,
    statusFilter,
    rightsFilter,
    sensitiveOnly,
    durationFilter,
  ]);

  // Current tab register entry for View 2
  const currentTabEntry = useMemo(() => {
    return tabRegister.find((t) => t.moduleSlug === selectedTabModuleSlug && t.tabId === selectedTabId) || null;
  }, [tabRegister, selectedTabModuleSlug, selectedTabId]);

  // Single Revoke Handler (from Staff Profile modal)
  const handleExecuteSingleRevoke = async () => {
    if (!grantToRevoke || !selectedStaffProfile) return;
    setSubmittingSingleRevoke(true);
    try {
      const res = await fetch("/api/access/revoke", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          grantId: grantToRevoke.id,
          grantIds: [grantToRevoke.id],
          staffId: selectedStaffProfile.staffId,
          staffName: selectedStaffProfile.staffName,
          staffEmail: selectedStaffProfile.email,
          scope: "Tab",
          tabId: grantToRevoke.tabId,
          tab: grantToRevoke.tab,
          moduleSlug: grantToRevoke.moduleSlug,
          module: grantToRevoke.module,
          reason_code: singleRevokeReason,
          reason_text: singleRevokeDetails,
          effective_at: "Immediately",
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Prune from client cache immediately
        try {
          const raw = sessionStorage.getItem("bcf_user_grants") || localStorage.getItem("bcf_user_grants");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const pruned = parsed.filter((g: any) => g.tabId !== grantToRevoke.tabId);
              sessionStorage.setItem("bcf_user_grants", JSON.stringify(pruned));
              localStorage.setItem("bcf_user_grants", JSON.stringify(pruned));
            }
          }
        } catch (_) {}

        setGrantToRevoke(null);
        setSelectedStaffProfile(null);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("bcf_grants_updated"));
        }
        fetchMasterData();
      } else {
        alert(data.error || "Failed to revoke access.");
      }
    } catch (err: any) {
      alert(err.message || "Error revoking access.");
    } finally {
      setSubmittingSingleRevoke(false);
    }
  };

  // Bulk Revoke Handler (from View 2 By Tab)
  const handleExecuteBulkRevoke = async () => {
    if (!currentTabEntry || selectedStaffForBulkRevoke.length === 0) return;
    setSubmittingBulkRevoke(true);
    try {
      const bulkItems = selectedStaffForBulkRevoke.map((staffId) => {
        const staffItem = currentTabEntry.staffList.find((s) => s.staffId === staffId);
        return {
          staffId,
          grantId: staffItem?.grantId,
          tabId: currentTabEntry.tabId,
          moduleSlug: currentTabEntry.moduleSlug,
          staffEmail: staffItem?.staffEmail,
        };
      });

      const res = await fetch("/api/access/revoke", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          isBulk: true,
          bulkItems,
          scope: "Tab",
          tabId: currentTabEntry.tabId,
          tab: currentTabEntry.tab,
          moduleSlug: currentTabEntry.moduleSlug,
          module: currentTabEntry.module,
          reason_code: bulkRevokeReason,
          reason_text: bulkRevokeDetails,
          effective_at: "Immediately",
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Prune from client cache immediately
        try {
          const raw = sessionStorage.getItem("bcf_user_grants") || localStorage.getItem("bcf_user_grants");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const pruned = parsed.filter((g: any) => g.tabId !== currentTabEntry.tabId);
              sessionStorage.setItem("bcf_user_grants", JSON.stringify(pruned));
              localStorage.setItem("bcf_user_grants", JSON.stringify(pruned));
            }
          }
        } catch (_) {}

        setBulkRevokeModalOpen(false);
        setSelectedStaffForBulkRevoke([]);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("bcf_grants_updated"));
        }
        fetchMasterData();
      } else {
        alert(data.error || "Failed to execute bulk revocation.");
      }
    } catch (err: any) {
      alert(err.message || "Error executing bulk revocation.");
    } finally {
      setSubmittingBulkRevoke(false);
    }
  };

  // CSV Export for Access Master
  const exportMasterCsv = () => {
    if (staffProfiles.length === 0) return;
    const headers = [
      "Staff ID",
      "Staff Name",
      "Email",
      "Department",
      "Position",
      "Director",
      "Status",
      "Granted Modules Count",
      "Granted Tabs Count",
      "Rights Summary",
      "Last Granted Date",
    ];

    const rows = filteredStaffProfiles.map((s) => [
      `"${s.staffId}"`,
      `"${s.staffName}"`,
      `"${s.email}"`,
      `"${s.department}"`,
      `"${s.position}"`,
      `"${s.director}"`,
      `"${s.status}"`,
      s.modulesCount,
      s.tabsCount,
      `"${s.rightsSummary.join(", ")}"`,
      s.lastGranted,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bcf_access_master_register_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-blue-700 via-sky-700 to-indigo-800 rounded-2xl p-6 text-white shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-sky-200 text-3xl">verified_user</span>
            <h1 className="text-2xl font-black tracking-tight">Access Master Register</h1>
            {isReadOnly && (
              <span className="bg-amber-400 text-neutral-900 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                View-Only Mode
              </span>
            )}
          </div>
          <p className="text-sm text-sky-100 mt-1 max-w-2xl">
            Authoritative master register of all personnel granted administrative access rights across the foundation.
            Includes full multi-tier approval audit chains and baseline role comparison.
          </p>
        </div>

        {/* Top Control Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Baseline Role Access Toggle */}
          <label className="flex items-center gap-2 bg-white/10 hover:bg-white/15 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 text-xs font-semibold cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={showRoleBasedAccess}
              onChange={(e) => setShowRoleBasedAccess(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500"
            />
            <span>Show role-based access</span>
          </label>

          {canExportReport && (
            <>
              <button
                type="button"
                onClick={exportMasterCsv}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => setPrintModalOpen(true)}
                className="bg-white hover:bg-sky-50 text-sky-900 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Access Report
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Dashboard Cards (Top) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Staff with Access", value: kpis.totalStaffWithGrants, icon: "group", color: "blue" },
          { label: "Active Grants", value: kpis.activeGrantsCount, icon: "check_circle", color: "emerald" },
          { label: "Pending Requests", value: kpis.pendingRequestsCount, icon: "pending_actions", color: "amber" },
          { label: "Expiring in 30 Days", value: kpis.expiringIn30DaysCount, icon: "timer", color: "orange" },
          { label: "Revoked This Month", value: kpis.revokedThisMonthCount, icon: "block", color: "rose" },
          { label: "Sensitive-Tab Grants", value: kpis.sensitiveTabGrantsCount, icon: "shield_lock", color: "purple" },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 rounded-xl shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">{kpi.label}</span>
              <span className="material-symbols-outlined text-lg">{kpi.icon}</span>
            </div>
            <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* View Mode Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          {[
            { id: "staff", label: "View 1: By Staff (Default)", icon: "badge" },
            { id: "tab", label: "View 2: By Tab", icon: "tab" },
            { id: "module", label: "View 3: By Module", icon: "view_quilt" },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setActiveView(v.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeView === v.id
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
            >
              <span className="material-symbols-outlined text-base">{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
          {activeView === "staff" && `${filteredStaffProfiles.length} Staff records matching`}
          {activeView === "tab" && `${tabRegister.length} Active tabs registered`}
          {activeView === "module" && `${MODULES.length} Foundation modules`}
        </span>
      </div>

      {/* View 1: By Staff (Default Table View) */}
      {activeView === "staff" && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
            {/* Search */}
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search staff name, ID, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Department */}
            <div>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
              >
                <option value="">All Departments</option>
                {allDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Module */}
            <div>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
              >
                <option value="">All Modules</option>
                {MODULES.map((m) => (
                  <option key={m.slug} value={m.label}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Expiring soon">Expiring soon</option>
                <option value="Revoked">Revoked</option>
              </select>
            </div>

            {/* Duration */}
            <div>
              <select
                value={durationFilter}
                onChange={(e) => setDurationFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
              >
                <option value="">All Durations</option>
                <option value="Permanent">Permanent</option>
                <option value="Temporary">Temporary</option>
              </select>
            </div>

            {/* Sensitive Checkbox */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={sensitiveOnly}
                  onChange={(e) => setSensitiveOnly(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>Sensitive only</span>
              </label>
            </div>
          </div>

          {/* Staff Table */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Staff Name & ID</th>
                    <th className="p-3">Department & Position</th>
                    <th className="p-3">Director</th>
                    <th className="p-3">Modules with Access</th>
                    <th className="p-3">Tabs</th>
                    <th className="p-3">Rights Summary</th>
                    <th className="p-3">Last Granted</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-neutral-500">
                        Loading Access Master register...
                      </td>
                    </tr>
                  ) : filteredStaffProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-neutral-400">
                        No staff access records found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStaffProfiles.map((s) => (
                      <tr
                        key={s.staffId}
                        onClick={() => setSelectedStaffProfile(s)}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                      >
                        <td className="p-3">
                          <span className="font-bold text-neutral-900 dark:text-neutral-100 block">{s.staffName}</span>
                          <span className="text-[11px] text-neutral-500 font-mono block">{s.staffId}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold block">{s.department}</span>
                          <span className="text-[11px] text-neutral-500 block">{s.position}</span>
                        </td>
                        <td className="p-3 text-neutral-700 dark:text-neutral-300 font-medium">{s.director}</td>
                        <td className="p-3">
                          <span className="font-bold text-sky-700 dark:text-sky-400 block">{s.modulesCount} modules</span>
                          <span className="text-[10px] text-neutral-500 truncate block max-w-xs" title={s.modulesList.join(", ")}>
                            {s.modulesList.join(", ")}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-neutral-700 dark:text-neutral-300">{s.tabsCount}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {s.rightsSummary.map((r) => (
                              <span
                                key={r}
                                className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-neutral-500 text-[11px]">
                          {s.lastGranted ? new Date(s.lastGranted).toLocaleDateString() : "-"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              s.status === "Active"
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                                : s.status === "Expiring soon"
                                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStaffProfile(s);
                            }}
                            className="text-sky-600 dark:text-sky-400 hover:underline font-bold text-xs"
                          >
                            View Profile
                          </button>
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

      {/* View 2: By Tab (With Bulk Revoke for Super Admin) */}
      {activeView === "tab" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                  1. Select Module
                </label>
                <select
                  value={selectedTabModuleSlug}
                  onChange={(e) => {
                    setSelectedTabModuleSlug(e.target.value);
                    const matchedTabs = tabRegister.filter((t) => t.moduleSlug === e.target.value);
                    if (matchedTabs.length > 0) {
                      setSelectedTabId(matchedTabs[0].tabId);
                    }
                    setSelectedStaffForBulkRevoke([]);
                  }}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100"
                >
                  {MODULES.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                  2. Select Tab
                </label>
                <select
                  value={selectedTabId}
                  onChange={(e) => {
                    setSelectedTabId(e.target.value);
                    setSelectedStaffForBulkRevoke([]);
                  }}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100"
                >
                  {tabRegister
                    .filter((t) => t.moduleSlug === selectedTabModuleSlug)
                    .map((t) => (
                      <option key={t.tabId} value={t.tabId}>
                        {t.tab} {t.isSensitive ? "★ (Sensitive Tab)" : ""} [{t.staffList.length} staff]
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Tab Header & Sensitive Flag */}
            {currentTabEntry && (
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                    {currentTabEntry.tab} ({currentTabEntry.module})
                  </span>
                  {currentTabEntry.isSensitive && (
                    <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded font-bold uppercase text-[10px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">shield_lock</span>
                      Sensitive Tab
                    </span>
                  )}
                  <span className="text-neutral-500 font-medium">
                    Total granted staff: {currentTabEntry.staffList.length}
                  </span>
                </div>

                {/* Bulk Revoke Action Bar (Super Admin Only) */}
                {isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    {selectedStaffForBulkRevoke.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setBulkRevokeModalOpen(true)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">block</span>
                        Bulk Revoke ({selectedStaffForBulkRevoke.length} staff selected)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Staff on this tab table */}
          {currentTabEntry ? (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 font-bold uppercase tracking-wider">
                  <tr>
                    {isSuperAdmin && (
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={
                            currentTabEntry.staffList.length > 0 &&
                            selectedStaffForBulkRevoke.length === currentTabEntry.staffList.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStaffForBulkRevoke(currentTabEntry.staffList.map((s) => s.staffId));
                            } else {
                              setSelectedStaffForBulkRevoke([]);
                            }
                          }}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                      </th>
                    )}
                    <th className="p-3">Staff Name & ID</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Rights Granted</th>
                    <th className="p-3">Granted Date</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200">
                  {currentTabEntry.staffList.map((st) => {
                    const isChecked = selectedStaffForBulkRevoke.includes(st.staffId);
                    return (
                      <tr key={st.grantId} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        {isSuperAdmin && (
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStaffForBulkRevoke((prev) => [...prev, st.staffId]);
                                } else {
                                  setSelectedStaffForBulkRevoke((prev) => prev.filter((id) => id !== st.staffId));
                                }
                              }}
                              className="rounded text-rose-600 focus:ring-rose-500"
                            />
                          </td>
                        )}
                        <td className="p-3">
                          <span className="font-bold block">{st.staffName}</span>
                          <span className="text-[11px] text-neutral-500 font-mono block">{st.staffId}</span>
                        </td>
                        <td className="p-3">{st.department}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {st.rights.map((r) => (
                              <span
                                key={r}
                                className="bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-neutral-500 text-[11px]">
                          {st.grantedAt ? new Date(st.grantedAt).toLocaleDateString() : "-"}
                        </td>
                        <td className="p-3 text-neutral-500 text-[11px]">
                          {st.isPermanent ? "Permanent" : st.endDate ? new Date(st.endDate).toLocaleDateString() : "Permanent"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              st.status === "Active"
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                                : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                            }`}
                          >
                            {st.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center text-neutral-400 text-xs">
              No staff members currently have granted access to the selected tab.
            </div>
          )}
        </div>
      )}

      {/* View 3: By Module (Counts Table) */}
      {activeView === "module" && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Module Name</th>
                  <th className="p-3">Total Staff with Access</th>
                  <th className="p-3">Active Grants</th>
                  <th className="p-3">Revoked Grants</th>
                  <th className="p-3">Tab Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200">
                {moduleCounts.map((mc) => (
                  <tr key={mc.moduleSlug} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="p-3">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 block">{mc.moduleName}</span>
                      <span className="text-[11px] text-neutral-500 font-mono block">{mc.moduleSlug}</span>
                    </td>
                    <td className="p-3 font-bold text-sky-700 dark:text-sky-400">{mc.totalStaffWithAccess}</td>
                    <td className="p-3 font-semibold text-emerald-700 dark:text-emerald-400">{mc.activeGrants}</td>
                    <td className="p-3 font-semibold text-rose-700 dark:text-rose-400">{mc.revokedGrants}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {mc.tabs
                          .filter((t) => t.staffCount > 0)
                          .map((t) => (
                            <span
                              key={t.tabId}
                              className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 rounded text-[10px] text-neutral-700 dark:text-neutral-300"
                            >
                              {t.tabName}: <strong className="text-sky-600">{t.staffCount}</strong>
                            </span>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Staff Access Profile Modal / Drawer */}
      {selectedStaffProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-start justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Staff Access Profile
                </span>
                <h2 className="text-xl font-black text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {selectedStaffProfile.staffName}
                </h2>
                <p className="text-xs text-neutral-500 font-mono">
                  {selectedStaffProfile.staffId} • {selectedStaffProfile.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffProfile(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 material-symbols-outlined text-2xl"
              >
                close
              </button>
            </div>

            {/* Profile Meta Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
              <div>
                <span className="text-neutral-500 block">Department:</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">{selectedStaffProfile.department}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Position:</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">{selectedStaffProfile.position}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Department Director:</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">{selectedStaffProfile.director}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Role Code:</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200 font-mono">
                  {selectedStaffProfile.roleCode}
                </span>
              </div>
            </div>

            {/* Granted Modules & Tabs Register */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-600 text-base">rule</span>
                Active & Granted Access Permissions
              </h3>

              <div className="space-y-3">
                {selectedStaffProfile.grants.map((g) => (
                  <div
                    key={g.id}
                    className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 text-xs space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                          {g.module} &gt; {g.tab}
                        </span>
                        {g.isSensitive && (
                          <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded text-[10px] font-bold">
                            Sensitive
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            g.status === "Active"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                              : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                          }`}
                        >
                          {g.status}
                        </span>
                      </div>

                      {/* Revoke Button (Super Admin Only) */}
                      {isSuperAdmin && g.status === "Active" && (
                        <button
                          type="button"
                          onClick={() => setGrantToRevoke(g)}
                          className="px-3 py-1 bg-red-100 dark:bg-red-950/60 hover:bg-red-200 text-red-800 dark:text-red-300 rounded-lg font-bold text-xs flex items-center gap-1 self-start md:self-auto"
                        >
                          <span className="material-symbols-outlined text-sm">block</span>
                          Revoke Access
                        </button>
                      )}
                    </div>

                    {/* Rights Badges */}
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500">Rights:</span>
                      <div className="flex gap-1">
                        {g.rights.map((r) => (
                          <span
                            key={r}
                            className="bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded font-bold text-[10px]"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                      <span className="text-neutral-500 ml-3">Duration:</span>
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">
                        {g.isPermanent ? "Permanent" : g.endDate ? `Expires: ${new Date(g.endDate).toLocaleDateString()}` : "Permanent"}
                      </span>
                      <span className="text-neutral-500 ml-3">Request #:</span>
                      <span className="font-mono text-neutral-700 dark:text-neutral-300">{g.requestNumber}</span>
                    </div>

                    {/* Approval Trail */}
                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-neutral-600 dark:text-neutral-400">
                      <div>
                        <span className="text-neutral-400 block">Stage 1: Dept Director</span>
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {g.approvalTrail.directorApproval?.name || "Approved"}
                        </span>
                        <span className="text-neutral-400 block text-[10px]">
                          {g.approvalTrail.directorApproval?.date
                            ? new Date(g.approvalTrail.directorApproval.date).toLocaleString()
                            : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block">Stage 2: IT Director</span>
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {g.approvalTrail.itDirectorApproval?.name || "Approved"}
                        </span>
                        <span className="text-neutral-400 block text-[10px]">
                          {g.approvalTrail.itDirectorApproval?.date
                            ? new Date(g.approvalTrail.itDirectorApproval.date).toLocaleString()
                            : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block">Stage 3: Super Admin Grant</span>
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {g.approvalTrail.superAdminGrant?.name || g.grantedBy}
                        </span>
                        <span className="text-neutral-400 block text-[10px]">
                          {g.approvalTrail.superAdminGrant?.date
                            ? new Date(g.approvalTrail.superAdminGrant.date).toLocaleString()
                            : "-"}
                        </span>
                      </div>
                    </div>

                    {/* Revocation Details (if revoked) */}
                    {g.revocationDetails && (
                      <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-red-800 dark:text-red-300 text-[11px]">
                        <strong>Revoked by:</strong> {g.revocationDetails.revokedBy} on{" "}
                        {new Date(g.revocationDetails.revokedAt).toLocaleString()}
                        <br />
                        <strong>Reason:</strong> {g.revocationDetails.reasonCode} - {g.revocationDetails.reasonText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Baseline Role Access (Shown when Toggle is ON) */}
            {showRoleBasedAccess && (
              <div className="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">security</span>
                    Baseline Role-Based Matrix Access (Read-Only)
                  </h3>
                  <span className="text-[11px] bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded font-bold">
                    Inherent from Role: {selectedStaffProfile.roleCode}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  These permissions are inherent baseline rights from the organization permission matrix and cannot be
                  revoked through the Access Revoke form. To modify these, adjust the role in User Management.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {selectedStaffProfile.baselineAccess.map((b) => (
                    <div
                      key={`${b.moduleSlug}-${b.tabId}`}
                      className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-neutral-800 dark:text-neutral-200 block">{b.tab}</span>
                        <span className="text-[10px] text-neutral-500 block">{b.module}</span>
                      </div>
                      <span className="bg-purple-100 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 px-2 py-0.5 rounded font-bold text-[10px]">
                        Level: {b.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single Grant Revoke Confirmation Modal */}
      {grantToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100">Revoke Tab Access</h3>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              Revoking access to <strong>{grantToRevoke.tab}</strong> for{" "}
              <strong>{selectedStaffProfile?.staffName}</strong>. This permission will be removed immediately.
            </p>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Revocation Reason *
              </label>
              <select
                value={singleRevokeReason}
                onChange={(e) => setSingleRevokeReason(e.target.value as RevokeReasonCode)}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100"
              >
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

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Reason Details / Justification Notes
              </label>
              <textarea
                rows={2}
                value={singleRevokeDetails}
                onChange={(e) => setSingleRevokeDetails(e.target.value)}
                placeholder="Details for this revocation..."
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submittingSingleRevoke}
                onClick={() => setGrantToRevoke(null)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingSingleRevoke}
                onClick={handleExecuteSingleRevoke}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow"
              >
                {submittingSingleRevoke ? "Revoking..." : "Confirm Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Revoke Modal (from View 2 By Tab) */}
      {bulkRevokeModalOpen && currentTabEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <span className="material-symbols-outlined text-3xl">block</span>
              <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100">Bulk Revoke Access</h3>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              You are revoking access to <strong>{currentTabEntry.tab}</strong> for{" "}
              <strong>{selectedStaffForBulkRevoke.length} staff members</strong> simultaneously with a shared reason.
            </p>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Shared Revocation Reason *
              </label>
              <select
                value={bulkRevokeReason}
                onChange={(e) => setBulkRevokeReason(e.target.value as RevokeReasonCode)}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100"
              >
                <option value="Access no longer needed">Access no longer needed</option>
                <option value="Role change">Role change</option>
                <option value="Transferred">Transferred</option>
                <option value="Resigned or terminated">Resigned or terminated</option>
                <option value="Misuse">Misuse</option>
                <option value="Access expired">Access expired</option>
                <option value="Security concern">Security concern</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Shared Explanation / Details
              </label>
              <textarea
                rows={2}
                value={bulkRevokeDetails}
                onChange={(e) => setBulkRevokeDetails(e.target.value)}
                placeholder="Shared context regarding this bulk revocation..."
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submittingBulkRevoke}
                onClick={() => setBulkRevokeModalOpen(false)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingBulkRevoke}
                onClick={handleExecuteBulkRevoke}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow"
              >
                {submittingBulkRevoke ? "Processing Bulk Revoke..." : "Execute Bulk Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print-friendly Report Modal */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-sky-600">description</span>
                <div>
                  <h2 className="text-xl font-black">Official Foundation Access Governance Report</h2>
                  <p className="text-xs text-neutral-500">
                    Generated: {new Date().toLocaleString()} • Certified by BCF-SL IT & Security Administration
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold shadow"
                >
                  Print Document
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalOpen(false)}
                  className="px-3 py-2 border rounded-xl text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                <div>
                  <strong>Total Registered Personnel:</strong> {kpis.totalStaffWithGrants}
                </div>
                <div>
                  <strong>Active System Grants:</strong> {kpis.activeGrantsCount}
                </div>
                <div>
                  <strong>High-Security Tab Grants:</strong> {kpis.sensitiveTabGrantsCount}
                </div>
              </div>

              <table className="w-full text-left text-xs border border-neutral-200">
                <thead className="bg-neutral-100 font-bold">
                  <tr>
                    <th className="p-2 border">Staff ID & Name</th>
                    <th className="p-2 border">Department</th>
                    <th className="p-2 border">Position</th>
                    <th className="p-2 border">Granted Modules</th>
                    <th className="p-2 border">Active Tabs</th>
                    <th className="p-2 border">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaffProfiles.map((s) => (
                    <tr key={s.staffId} className="border-t">
                      <td className="p-2 border font-bold">
                        {s.staffName} ({s.staffId})
                      </td>
                      <td className="p-2 border">{s.department}</td>
                      <td className="p-2 border">{s.position}</td>
                      <td className="p-2 border">{s.modulesList.join(", ")}</td>
                      <td className="p-2 border">{s.tabsCount}</td>
                      <td className="p-2 border font-bold">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
