"use client";

import React, { useState, useEffect } from "react";
import { LoginAttempt } from "@/lib/visitorTypes";

interface LoginActivityTabProps {
  onBlockTarget?: (target: { email: string; ip: string; deviceIdHash: string }) => void;
}

export function LoginActivityTab({ onBlockTarget }: LoginActivityTabProps) {
  const [attempts, setAttempts] = useState<(LoginAttempt & { isRepeatedFailure?: boolean; emailFailures?: number })[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("All");

  // Export Modal State
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMasked, setExportMasked] = useState(true);
  const [exportReason, setExportReason] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  // Quick Block Modal State
  const [quickBlockTarget, setQuickBlockTarget] = useState<any | null>(null);
  const [reasonCode, setReasonCode] = useState<any>("Repeated failed logins");
  const [reasonText, setReasonText] = useState("");
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
      });
      if (search) params.append("search", search);
      if (resultFilter !== "All") params.append("result", resultFilter);

      const res = await fetch(`/api/visitor-analytics/login-activity?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAttempts(data.attempts || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("Login attempts fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, [page, search, resultFilter]);

  const handleExportCsv = async () => {
    if (!exportMasked && !exportReason.trim()) {
      alert("Please provide a business justification reason for unmasked full export.");
      return;
    }
    setExportLoading(true);
    try {
      const res = await fetch("/api/visitor-analytics/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "login-activity",
          masked: exportMasked,
          reason: exportReason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Export failed");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BCF_Login_Activity_${exportMasked ? "Masked" : "Full"}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch (err: any) {
      alert("Export failed: " + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleConfirmQuickBlock = async () => {
    if (!quickBlockTarget || !reasonText.trim()) return;
    setBlockSubmitting(true);
    try {
      const res = await fetch("/api/visitor-analytics/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockBy: { email: true, device: true, ip: false },
          email: quickBlockTarget.email,
          deviceIdHash: quickBlockTarget.device_id_hash,
          ip: quickBlockTarget.ip,
          reasonCode,
          reasonText,
          duration: "Permanent",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuickBlockTarget(null);
        fetchAttempts();
        alert("Entity successfully blocked and restricted.");
      } else {
        alert(data.error || "Failed to block");
      }
    } catch (err: any) {
      alert(err.message || "Block action failed");
    } finally {
      setBlockSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Top Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by email, IP, Device ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400">Result:</span>
            {["All", "Success", "Failed"].map((res) => (
              <button
                key={res}
                onClick={() => {
                  setResultFilter(res);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                  resultFilter === res
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setExportOpen(true)}
          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export Login Log CSV
        </button>
      </div>

      {/* Login Attempts Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Account Email</th>
                <th className="p-3">Result</th>
                <th className="p-3">Failure Reason</th>
                <th className="p-3">IP Address</th>
                <th className="p-3">Location</th>
                <th className="p-3">Device Model</th>
                <th className="p-3">OS &amp; Browser</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Loading login activity records...
                  </td>
                </tr>
              ) : attempts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No authentication attempts recorded.
                  </td>
                </tr>
              ) : (
                attempts.map((a) => (
                  <tr
                    key={a.id}
                    className={`transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                      a.isRepeatedFailure ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                    }`}
                  >
                    <td className="p-3 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(a.attempted_at).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                      {new Date(a.attempted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                      {a.email}
                      {a.isRepeatedFailure && (
                        <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500 text-white uppercase tracking-wider">
                          Repeat Failures ({a.emailFailures})
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        a.result === "Success"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                      }`}>
                        {a.result}
                      </span>
                    </td>
                    <td className="p-3 text-[11px] text-slate-500 font-medium">
                      {a.failure_reason ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{a.failure_reason}</span>
                      ) : (
                        <span className="text-slate-400">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3 font-mono">{a.ip}</td>
                    <td className="p-3">{a.location}</td>
                    <td className="p-3 text-slate-500">{a.device_model}</td>
                    <td className="p-3 text-[11px]">
                      {a.os} &bull; {a.browser}
                    </td>
                    <td className="p-3 text-right">
                      {a.result === "Failed" && (
                        <button
                          onClick={() => {
                            setQuickBlockTarget(a);
                            setReasonCode("Repeated failed logins");
                            setReasonText(`Blocked due to failed login attempt on ${new Date(a.attempted_at).toLocaleString()}`);
                          }}
                          className="px-2.5 py-1 rounded bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 font-semibold text-[11px] transition cursor-pointer"
                        >
                          Block
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {attempts.length} of {total} attempts</span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Quick Block Modal from Row */}
      {quickBlockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 text-rose-600">
              <span className="material-symbols-outlined">block</span>
              Block Failed Authentication Entity
            </h3>
            <p className="text-slate-500">
              Block email <strong className="font-mono text-slate-900 dark:text-white">{quickBlockTarget.email}</strong> and associated device from site access.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Reason Code *</label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value="Repeated failed logins">Repeated failed logins</option>
                  <option value="Unauthorized access attempt">Unauthorized access attempt</option>
                  <option value="Suspicious activity">Suspicious activity</option>
                  <option value="Security concern">Security concern</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Reason Details *</label>
                <textarea
                  rows={2}
                  required
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setQuickBlockTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={blockSubmitting || !reasonText.trim()}
                onClick={handleConfirmQuickBlock}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-50 transition cursor-pointer"
              >
                {blockSubmitting ? "Enforcing Block..." : "Confirm Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export CSV Modal */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">file_download</span>
              Export Login Activity CSV
            </h3>

            <p className="text-slate-500 leading-relaxed">
              Export security login telemetry for institutional compliance and audits.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportMasked}
                  onChange={(e) => setExportMasked(e.target.checked)}
                  className="rounded text-indigo-600 mt-0.5"
                />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Mask Sensitive Telemetry (Default)</span>
                  <p className="text-[11px] text-slate-400">Masks partial email and IP addresses.</p>
                </div>
              </label>

              {!exportMasked && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="block font-bold text-amber-600 dark:text-amber-400">
                    Full Unmasked Export Justification *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Document required justification reason for unmasked export..."
                    value={exportReason}
                    onChange={(e) => setExportReason(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setExportOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={exportLoading || (!exportMasked && !exportReason.trim())}
                onClick={handleExportCsv}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50 transition cursor-pointer"
              >
                {exportLoading ? "Generating CSV..." : "Download CSV"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
