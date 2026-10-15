"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getUser, AuthUser } from "@/lib/auth";

interface ResetRequest {
  id: string;
  request_number: string;
  user_id: string;
  staff_name: string;
  staff_id: string;
  department: string;
  email: string;
  requested_at: string;
  ip: string;
  country: string;
  city: string;
  os: string;
  device_model: string;
  browser: string;
  otp_attempts: number;
  otp_verified_at?: string;
  otp_expires_at?: string;
  otp_status: string;
  password_changed: boolean;
  password_changed_at?: string;
  outcome: string;
  login_status: string;
  flags: string[];
  is_suspicious: boolean;
  created_at: string;
}

interface Metrics {
  requestsToday: number;
  requests7Days: number;
  requests30Days: number;
  completedResets: number;
  abandonedOrExpired: number;
  lockedFailedOtp: number;
  repeatedRequests: number;
  loginsRevoked: number;
}

interface RequestDetail {
  request: ResetRequest & { mustChangePassword?: boolean; masked_email?: string };
  events: Array<{
    id: string;
    event: string;
    at: string;
    details?: any;
    ip?: string;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    dateTime: string;
    result: string;
    newValue: string;
  }>;
  revocationHistory: Array<{
    id: string;
    reason_code: string;
    reason_text: string;
    revoked_by: { name: string; email: string };
    revoked_at: string;
    status: string;
    restored_by?: { name: string };
    restored_at?: string;
    restore_reason?: string;
  }>;
}

export function PasswordResetAdminView() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({
    requestsToday: 0,
    requests7Days: 0,
    requests30Days: 0,
    completedResets: 0,
    abandonedOrExpired: 0,
    lockedFailedOtp: 0,
    repeatedRequests: 0,
    loginsRevoked: 0,
  });

  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [flagFilter, setFlagFilter] = useState("ALL");
  const [loginStatusFilter, setLoginStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Detail Modal
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<RequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Revoke Modal
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [targetUserToRevoke, setTargetUserToRevoke] = useState<{
    userId: string;
    name: string;
    staffId: string;
    department: string;
    email: string;
  } | null>(null);
  const [revokeReasonCode, setRevokeReasonCode] = useState<string>("Suspicious reset");
  const [revokeReasonDetails, setRevokeReasonDetails] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Restore Modal
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [targetUserToRestore, setTargetUserToRestore] = useState<{
    userId: string;
    name: string;
    staffId: string;
  } | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Success Notification Banner
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const fetchResets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (outcomeFilter !== "ALL") params.set("outcome", outcomeFilter);
      if (deptFilter !== "ALL") params.set("department", deptFilter);
      if (flagFilter === "FLAGGED") params.set("flagged", "true");
      if (flagFilter === "CLEAN") params.set("flagged", "false");
      if (loginStatusFilter !== "ALL") params.set("loginStatus", loginStatusFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("limit", "25");

      const res = await fetch(`/api/admin/password-resets?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("You do not have access to that page.");
        }
        throw new Error("Failed to load password reset requests.");
      }

      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        setRequests(data.requests);
        setDepartments(data.departments || []);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
      } else {
        throw new Error(data.error || "Failed to load requests.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [search, outcomeFilter, deptFilter, flagFilter, loginStatusFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchResets();
  }, [fetchResets]);

  // Load detail view
  const openDetailModal = async (requestId: string) => {
    setSelectedDetailId(requestId);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/admin/password-resets/${requestId}`);
      const data = await res.json();
      if (data.success) {
        setDetailData(data);
      }
    } catch (err) {
      console.error("Failed to load details:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle Revoke Submit
  const handleConfirmRevoke = async () => {
    if (!targetUserToRevoke) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const res = await fetch("/api/admin/password-resets/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserToRevoke.userId,
          reasonCode: revokeReasonCode,
          reasonText: revokeReasonDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Revocation failed.");
      }

      setRevokeModalOpen(false);
      setNotification(`Login access for ${targetUserToRevoke.name} (${targetUserToRevoke.staffId}) has been revoked.`);
      setTimeout(() => setNotification(null), 6000);
      fetchResets();
      if (selectedDetailId) openDetailModal(selectedDetailId);
    } catch (err: any) {
      setRevokeError(err.message);
    } finally {
      setRevoking(false);
    }
  };

  // Handle Restore Submit
  const handleConfirmRestore = async () => {
    if (!targetUserToRestore) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const res = await fetch("/api/admin/password-resets/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserToRestore.userId,
          restoreReason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Restoration failed.");
      }

      setRestoreModalOpen(false);
      setNotification(
        `Login access restored for ${targetUserToRestore.name}. Mandatory password change enforced on next sign-in.`
      );
      setTimeout(() => setNotification(null), 6000);
      fetchResets();
      if (selectedDetailId) openDetailModal(selectedDetailId);
    } catch (err: any) {
      setRestoreError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  // Force Password Change directly
  const handleForcePasswordChange = async (userId: string, name: string) => {
    if (!confirm(`Enforce mandatory password change for ${name} upon their next sign-in?`)) return;
    try {
      const res = await fetch("/api/admin/password-resets/force-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason: "Administrative security requirement" }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Mandatory password change enforced for ${name}.`);
        setTimeout(() => setNotification(null), 5000);
        fetchResets();
        if (selectedDetailId) openDetailModal(selectedDetailId);
      } else {
        alert(data.error || "Failed to enforce password change.");
      }
    } catch (err: any) {
      alert(err.message || "Request failed.");
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    window.location.href = "/api/admin/password-resets/export";
  };

  if (error && error.includes("You do not have access to that page")) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-900 shadow-sm">
          <span className="material-symbols-outlined text-5xl text-rose-600 mb-2">shield_lock</span>
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="mt-2 text-sm text-rose-700">You do not have access to that page.</p>
          <p className="mt-1 text-xs text-rose-500">This security incident has been recorded in the immutable audit log.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400 text-3xl">lock_reset</span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Staff Password Reset & Login Governance
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Governance of staff forgotten-password reset requests, 5-digit email OTP telemetry, suspicious flags, and administrative login revocation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition"
          >
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">download</span>
            Export CSV (Masked)
          </button>
          <button
            onClick={() => fetchResets()}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition"
            title="Refresh Data"
          >
            <span className={`material-symbols-outlined text-[20px] ${loading ? "animate-spin" : ""}`}>refresh</span>
          </button>
        </div>
      </div>

      {/* Alert Notification */}
      {notification && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            <span className="text-sm font-semibold">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Dashboard KPI Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Reset Requests Today */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Today</span>
            <span className="material-symbols-outlined text-blue-600 text-[20px]">today</span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{metrics.requestsToday}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            7d: <strong className="text-slate-700 dark:text-slate-300">{metrics.requests7Days}</strong> &bull; 30d: <strong className="text-slate-700 dark:text-slate-300">{metrics.requests30Days}</strong>
          </div>
        </div>

        {/* Completed Resets */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.completedResets}</div>
          <div className="text-[11px] text-slate-500 mt-1">Successful new passwords</div>
        </div>

        {/* Abandoned or Expired */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Expired / Abandoned</span>
            <span className="material-symbols-outlined text-amber-500 text-[20px]">timer_off</span>
          </div>
          <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{metrics.abandonedOrExpired}</div>
          <div className="text-[11px] text-slate-500 mt-1">10-min OTP timeouts</div>
        </div>

        {/* Locked after Failed OTP */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Locked (Failed)</span>
            <span className="material-symbols-outlined text-rose-600 text-[20px]">lock_clock</span>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{metrics.lockedFailedOtp}</div>
          <div className="text-[11px] text-slate-500 mt-1">&ge;5 wrong attempts (30m)</div>
        </div>

        {/* Repeated Requests */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Repeated</span>
            <span className="material-symbols-outlined text-purple-600 text-[20px]">history</span>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{metrics.repeatedRequests}</div>
          <div className="text-[11px] text-slate-500 mt-1">&ge;3 requests in 24h</div>
        </div>

        {/* Logins Revoked */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Revoked</span>
            <span className="material-symbols-outlined text-red-600 text-[20px]">block</span>
          </div>
          <div className="text-2xl font-black text-red-700 dark:text-red-400">{metrics.loginsRevoked}</div>
          <div className="text-[11px] text-slate-500 mt-1">Suspended logins</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search Name, Staff ID, Email, IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Outcome Filter */}
          <div>
            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Outcomes</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
              <option value="Expired">Expired</option>
              <option value="Locked">Locked</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Flagged Suspicious Filter */}
          <div>
            <select
              value={flagFilter}
              onChange={(e) => {
                setFlagFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Flag Statuses</option>
              <option value="FLAGGED">Suspicious Only</option>
              <option value="CLEAN">Clean Only</option>
            </select>
          </div>

          {/* Login Status Filter */}
          <div>
            <select
              value={loginStatusFilter}
              onChange={(e) => {
                setLoginStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Login Statuses</option>
              <option value="Active">Active Login</option>
              <option value="Revoked">Revoked Login</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Requests Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Requested At</th>
                <th className="py-3 px-4">IP & Location</th>
                <th className="py-3 px-4">Device</th>
                <th className="py-3 px-4">OTP Status</th>
                <th className="py-3 px-4">Password Changed</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">Login Status</th>
                <th className="py-3 px-4">Flags</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                      <span>Loading password reset telemetry...</span>
                    </div>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl block mb-2 text-slate-300">search_off</span>
                    No password reset requests match the specified criteria.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const isRevoked = r.login_status === "Revoked" || r.login_status === "Suspended";
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        r.is_suspicious ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                      }`}
                    >
                      {/* Request ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {r.request_number}
                      </td>

                      {/* Staff */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">{r.staff_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {r.staff_id} &bull; <span className="font-sans text-slate-500">{r.department}</span>
                        </div>
                      </td>

                      {/* Masked Email */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {r.email}
                      </td>

                      {/* Requested At */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        <div>
                          {new Date(r.requested_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(r.requested_at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          UTC
                        </div>
                      </td>

                      {/* IP, Location */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-800 dark:text-slate-200">{r.ip}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.city}, {r.country}
                        </div>
                      </td>

                      {/* Device */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        <div>{r.os}</div>
                        <div className="text-[10px] text-slate-400">
                          {r.browser} &bull; {r.device_model}
                        </div>
                      </td>

                      {/* OTP Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            r.otp_verified_at
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : r.outcome === "Locked"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : r.otp_status === "Expired"
                              ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {r.otp_status}
                        </span>
                      </td>

                      {/* Password Changed */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {r.password_changed ? (
                          <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            <span>Yes</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>

                      {/* Outcome */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            r.outcome === "Completed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : r.outcome === "Locked"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : r.outcome === "Expired"
                              ? "bg-slate-50 text-slate-600 border border-slate-200"
                              : r.outcome === "Cancelled"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-sky-50 text-sky-700 border border-sky-200"
                          }`}
                        >
                          {r.outcome}
                        </span>
                      </td>

                      {/* Login Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isRevoked
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {isRevoked ? "Revoked" : "Active"}
                        </span>
                      </td>

                      {/* Flags */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {r.is_suspicious ? (
                          <div className="flex flex-col gap-1">
                            {r.flags.map((f) => (
                              <span
                                key={f}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white tracking-wide"
                              >
                                <span className="material-symbols-outlined text-[12px]">warning</span>
                                {f.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Normal</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-1">
                        {/* View Button */}
                        <button
                          onClick={() => openDetailModal(r.id)}
                          className="px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-[11px] transition inline-flex items-center gap-1"
                          title="View Request Timeline"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          View
                        </button>

                        {/* Revoke or Restore */}
                        {isRevoked ? (
                          <button
                            onClick={() => {
                              setTargetUserToRestore({
                                userId: r.user_id,
                                name: r.staff_name,
                                staffId: r.staff_id,
                              });
                              setRestoreReason("");
                              setRestoreModalOpen(true);
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-semibold text-[11px] transition inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-800"
                          >
                            <span className="material-symbols-outlined text-[15px]">lock_open</span>
                            Restore Login
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setTargetUserToRevoke({
                                userId: r.user_id,
                                name: r.staff_name,
                                staffId: r.staff_id,
                                department: r.department,
                                email: r.email,
                              });
                              setRevokeReasonCode("Suspicious reset");
                              setRevokeReasonDetails("");
                              setRevokeModalOpen(true);
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-semibold text-[11px] transition inline-flex items-center gap-1 border border-rose-200 dark:border-rose-800"
                          >
                            <span className="material-symbols-outlined text-[15px]">block</span>
                            Revoke Login
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="py-3 px-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-700 dark:text-slate-300">{requests.length}</strong> of{" "}
            <strong className="text-slate-700 dark:text-slate-300">{totalCount}</strong> reset requests
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Previous
            </button>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MODAL 1: REQUEST DETAIL & TIMELINE
      ══════════════════════════════════════════ */}
      {selectedDetailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-2xl">history_edu</span>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Reset Lifecycle Timeline & Telemetry
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {detailData?.request.request_number || selectedDetailId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailId(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 dark:text-slate-300">
              {detailLoading ? (
                <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                  <span>Loading full request timeline...</span>
                </div>
              ) : detailData ? (
                <>
                  {/* User Profile Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Staff Name</div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {detailData.request.staff_name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{detailData.request.staff_id}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Department</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {detailData.request.department}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{detailData.request.masked_email || detailData.request.email}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Client Location</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {detailData.request.city}, {detailData.request.country}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">IP: {detailData.request.ip}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Account Status</div>
                      <div className="mt-0.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            detailData.request.login_status === "Revoked"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {detailData.request.login_status}
                        </span>
                      </div>
                      {detailData.request.mustChangePassword && (
                        <div className="text-[10px] text-amber-600 font-bold mt-1">Must change pass</div>
                      )}
                    </div>
                  </div>

                  {/* Suspicious Flags Banner if any */}
                  {detailData.request.flags && detailData.request.flags.length > 0 && (
                    <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 flex items-start gap-3">
                      <span className="material-symbols-outlined text-rose-600 text-xl shrink-0 mt-0.5">warning</span>
                      <div>
                        <strong className="block text-xs font-bold text-rose-800 dark:text-rose-300">
                          Security Alert: Automated Suspicious Flags Detected
                        </strong>
                        <ul className="mt-1 list-disc list-inside space-y-0.5 text-[11px]">
                          {detailData.request.flags.map((flag) => (
                            <li key={flag}>
                              <span className="font-semibold">{flag.replace(/_/g, " ")}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Lifecycle Timeline */}
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
                      Execution Events Timeline
                    </h4>
                    <div className="space-y-3 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                      {detailData.events.map((evt, idx) => (
                        <div key={evt.id || idx} className="flex items-start gap-3 relative">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 border-2 border-emerald-600 dark:border-emerald-500 flex items-center justify-center shrink-0 z-10">
                            <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-300 text-[14px]">
                              {evt.event === "Requested"
                                ? "contact_support"
                                : evt.event === "CodeSent"
                                ? "send"
                                : evt.event === "CodeVerified"
                                ? "verified"
                                : evt.event === "CodeFailed"
                                ? "error"
                                : evt.event === "PasswordChanged"
                                ? "lock_reset"
                                : evt.event === "SessionsEnded"
                                ? "logout"
                                : "info"}
                            </span>
                          </div>
                          <div className="flex-1 bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 dark:text-white">{evt.event}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(evt.at).toLocaleString("en-GB")}
                              </span>
                            </div>
                            {evt.details && (
                              <p className="mt-1 text-[11px] text-slate-500 font-mono">
                                {JSON.stringify(evt.details)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Audit Entries */}
                  {detailData.auditLogs.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-2">
                        Associated Audit Records
                      </h4>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                        {detailData.auditLogs.map((log) => (
                          <div key={log.id} className="p-2.5 flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">{log.action}</div>
                              <div className="text-[11px] text-slate-500">{log.newValue}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {log.result}
                              </span>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {new Date(log.dateTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Bar inside Modal */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                    <button
                      onClick={() =>
                        handleForcePasswordChange(detailData.request.user_id, detailData.request.staff_name)
                      }
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-semibold text-xs transition"
                    >
                      Force Password Change at Next Sign In
                    </button>
                    {detailData.request.login_status === "Revoked" ? (
                      <button
                        onClick={() => {
                          setTargetUserToRestore({
                            userId: detailData.request.user_id,
                            name: detailData.request.staff_name,
                            staffId: detailData.request.staff_id,
                          });
                          setRestoreReason("");
                          setRestoreModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                      >
                        <span className="material-symbols-outlined text-[16px]">lock_open</span>
                        Restore Login
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setTargetUserToRevoke({
                            userId: detailData.request.user_id,
                            name: detailData.request.staff_name,
                            staffId: detailData.request.staff_id,
                            department: detailData.request.department,
                            email: detailData.request.email,
                          });
                          setRevokeReasonCode("Suspicious reset");
                          setRevokeReasonDetails("");
                          setRevokeModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                      >
                        <span className="material-symbols-outlined text-[16px]">block</span>
                        Revoke Login
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL 2: REVOKE LOGIN CONFIRMATION
      ══════════════════════════════════════════ */}
      {revokeModalOpen && targetUserToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-rose-50/70 dark:bg-rose-950/30 flex items-center gap-3">
              <span className="material-symbols-outlined text-rose-600 text-2xl">warning</span>
              <div>
                <h3 className="font-extrabold text-base text-rose-900 dark:text-rose-200">
                  Revoke Staff Login Access
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-400">
                  This action will terminate all active sessions and block further resets.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {revokeError && (
                <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 font-semibold">
                  {revokeError}
                </div>
              )}

              {/* Target Staff Summary */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <div>
                  <strong>Staff:</strong> {targetUserToRevoke.name} ({targetUserToRevoke.staffId})
                </div>
                <div>
                  <strong>Department:</strong> {targetUserToRevoke.department}
                </div>
                <div>
                  <strong>Impact:</strong> User will see neutral restricted message:{" "}
                  <em>&quot;Your account is restricted. Please contact the BCF-SL administrator.&quot;</em>
                </div>
              </div>

              {/* Reason Category */}
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Revocation Reason Category <span className="text-rose-600">*</span>
                </label>
                <select
                  value={revokeReasonCode}
                  onChange={(e) => setRevokeReasonCode(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="Suspicious reset">Suspicious reset</option>
                  <option value="Account takeover suspected">Account takeover suspected</option>
                  <option value="Unusual location">Unusual location</option>
                  <option value="User reported">User reported</option>
                  <option value="Left organisation">Left organisation</option>
                  <option value="Other">Other with details</option>
                </select>
              </div>

              {/* Detailed Justification */}
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Detailed Justification / Notes <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={revokeReasonDetails}
                  onChange={(e) => setRevokeReasonDetails(e.target.value)}
                  placeholder="Explain why this account's login is being revoked..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              {/* Stakeholder Notification Notice */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
                <strong>Enforcement Notice:</strong> Department Director, HR Director, and IT Director will be immediately notified via security dispatch. An immutable entry will be recorded in the audit trail.
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRevokeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevoke}
                  disabled={revoking || !revokeReasonDetails.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition disabled:opacity-50 flex items-center gap-1.5 shadow"
                >
                  {revoking ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Enacting Revoke...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">block</span>
                      <span>Confirm Revoke</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL 3: RESTORE LOGIN CONFIRMATION
      ══════════════════════════════════════════ */}
      {restoreModalOpen && targetUserToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-2xl">lock_open</span>
              <div>
                <h3 className="font-extrabold text-base text-emerald-900 dark:text-emerald-200">
                  Restore User Login Access
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Re-enables account and forces mandatory password change on next sign-in.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {restoreError && (
                <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 font-semibold">
                  {restoreError}
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <div>
                  <strong>Staff:</strong> {targetUserToRestore.name} ({targetUserToRestore.staffId})
                </div>
                <div>
                  <strong>Next Sign-in Policy:</strong> The user will be required to change their password upon their very first sign-in after restoration.
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Reason for Restoration <span className="text-emerald-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="e.g. Identity verified by administrator, staff member reported resolved issue..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRestoreModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={restoring || restoreReason.trim().length < 5}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50 flex items-center gap-1.5 shadow"
                >
                  {restoring ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">lock_open</span>
                      <span>Confirm Restore</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
