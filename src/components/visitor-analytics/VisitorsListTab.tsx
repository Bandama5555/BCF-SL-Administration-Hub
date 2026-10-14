"use client";

import React, { useState, useEffect } from "react";
import { Visitor, VisitorSession, LoginAttempt, BlockedEntry } from "@/lib/visitorTypes";

interface VisitorsListTabProps {
  initialSearch?: string;
  initialCountry?: string;
  initialOs?: string;
  initialDeviceType?: string;
  initialSignedIn?: string;
  initialStatus?: string;
}

export function VisitorsListTab({
  initialSearch = "",
  initialCountry = "All",
  initialOs = "All",
  initialDeviceType = "All",
  initialSignedIn = "all",
  initialStatus = "All",
}: VisitorsListTabProps) {
  const [visitors, setVisitors] = useState<(Visitor & { shortDeviceId: string })[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(initialSearch);
  const [country, setCountry] = useState(initialCountry);
  const [os, setOs] = useState(initialOs);
  const [deviceType, setDeviceType] = useState(initialDeviceType);
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  const [status, setStatus] = useState(initialStatus);
  const [sortBy, setSortBy] = useState<"last_seen" | "first_seen" | "visit_count" | "name">("last_seen");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Profile Modal State
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Block Modal State
  const [blockTarget, setBlockTarget] = useState<any | null>(null);
  const [blockByEmail, setBlockByEmail] = useState(true);
  const [blockByDevice, setBlockByDevice] = useState(true);
  const [blockByIp, setBlockByIp] = useState(false);
  const [confirmIpWarning, setConfirmIpWarning] = useState(false);
  const [reasonCode, setReasonCode] = useState<any>("Suspicious activity");
  const [reasonText, setReasonText] = useState("");
  const [duration, setDuration] = useState<"Permanent" | string>("Permanent");
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  // Export CSV Modal State
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMasked, setExportMasked] = useState(true);
  const [exportReason, setExportReason] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        sortBy,
        sortOrder,
      });
      if (search) params.append("search", search);
      if (country !== "All") params.append("country", country);
      if (os !== "All") params.append("os", os);
      if (deviceType !== "All") params.append("deviceType", deviceType);
      if (signedIn !== "all") params.append("signedIn", signedIn);
      if (status !== "All") params.append("status", status);

      const res = await fetch(`/api/visitor-analytics/visitors?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setVisitors(data.visitors || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("Fetch visitors error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, [page, search, country, os, deviceType, signedIn, status, sortBy, sortOrder]);

  const handleOpenProfile = async (vId: string) => {
    setSelectedVisitorId(vId);
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/visitor-analytics/visitors?id=${vId}`);
      const data = await res.json();
      if (data.success && data.profile) {
        setProfileData(data.profile);
      }
    } catch (err) {
      console.error("Profile load error:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleOpenBlock = (v: any) => {
    setBlockTarget(v);
    setBlockByEmail(!!(v.latest_email && v.latest_email !== "Anonymous"));
    setBlockByDevice(true);
    setBlockByIp(false);
    setConfirmIpWarning(false);
    setReasonCode("Suspicious activity");
    setReasonText("");
    setDuration("Permanent");
  };

  const handleSubmitBlock = async () => {
    if (!blockTarget || !reasonText.trim()) return;
    if (blockByIp && !confirmIpWarning) return;

    setBlockSubmitting(true);
    try {
      const res = await fetch("/api/visitor-analytics/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockBy: { email: blockByEmail, device: blockByDevice, ip: blockByIp },
          email: blockTarget.latest_email !== "Anonymous" ? blockTarget.latest_email : undefined,
          deviceIdHash: blockTarget.device_id_hash,
          ip: blockTarget.latest_ip,
          reasonCode,
          reasonText,
          duration,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBlockTarget(null);
        fetchVisitors();
      } else {
        alert(data.error || "Failed to block visitor");
      }
    } catch (err: any) {
      alert(err.message || "Block action failed");
    } finally {
      setBlockSubmitting(false);
    }
  };

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
          type: "visitors",
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
      a.download = `BCF_Visitor_Registry_${exportMasked ? "Masked" : "Full"}.csv`;
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

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Top Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, email, IP, Device ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setExportOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export CSV
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Identity</label>
            <select
              value={signedIn}
              onChange={(e) => { setSignedIn(e.target.value); setPage(1); }}
              className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Visitors</option>
              <option value="signed-in">Signed-In Only</option>
              <option value="anonymous">Anonymous Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Country</label>
            <select
              value={country}
              onChange={(e) => { setCountry(e.target.value); setPage(1); }}
              className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="All">All Countries</option>
              <option value="Sierra Leone">Sierra Leone</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="United States">United States</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Operating System</label>
            <select
              value={os}
              onChange={(e) => { setOs(e.target.value); setPage(1); }}
              className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="All">All OS</option>
              <option value="Windows">Windows</option>
              <option value="macOS">macOS</option>
              <option value="Android">Android</option>
              <option value="iOS">iOS</option>
              <option value="Linux">Linux</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Device Type</label>
            <select
              value={deviceType}
              onChange={(e) => { setDeviceType(e.target.value); setPage(1); }}
              className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="All">All Devices</option>
              <option value="Desktop">Desktop</option>
              <option value="Mobile">Mobile</option>
              <option value="Tablet">Tablet</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Sort By</label>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split("-") as any;
                setSortBy(sb);
                setSortOrder(so);
              }}
              className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="last_seen-desc">Last Seen (Newest)</option>
              <option value="last_seen-asc">Last Seen (Oldest)</option>
              <option value="visit_count-desc">Most Visits</option>
              <option value="first_seen-asc">First Seen (Earliest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Visitors Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Visitor Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">IP Address</th>
                <th className="p-3">Location</th>
                <th className="p-3">Device ID</th>
                <th className="p-3">OS</th>
                <th className="p-3">Model</th>
                <th className="p-3">Browser</th>
                <th className="p-3">Last Seen</th>
                <th className="p-3 text-center">Visits</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400">
                    Loading visitor records...
                  </td>
                </tr>
              ) : visitors.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400">
                    No visitors match the current search or filters.
                  </td>
                </tr>
              ) : (
                visitors.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      {v.latest_name || "Anonymous"}
                    </td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                      {v.latest_email || "Anonymous"}
                    </td>
                    <td className="p-3 font-mono">
                      {v.latest_ip || "127.0.0.1"}
                    </td>
                    <td className="p-3">
                      {v.latest_location || "Sierra Leone"}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                      {v.shortDeviceId}
                    </td>
                    <td className="p-3">{v.latest_os || "Desktop"}</td>
                    <td className="p-3 text-[11px] text-slate-500 max-w-[120px] truncate" title={v.latest_device_model}>
                      {v.latest_device_model || "PC"}
                    </td>
                    <td className="p-3 text-[11px]">{v.latest_browser || "Web Browser"}</td>
                    <td className="p-3 text-[11px] text-slate-400">
                      {new Date(v.last_seen).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-3 text-center font-bold">
                      {v.visit_count}
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        v.status === "Blocked"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenProfile(v.id)}
                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-[11px] text-slate-700 dark:text-slate-200 transition"
                        >
                          View
                        </button>
                        {v.status !== "Blocked" && (
                          <button
                            onClick={() => handleOpenBlock(v)}
                            className="px-2.5 py-1 rounded bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 font-semibold text-[11px] transition"
                          >
                            Block
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {visitors.length} of {total} visitor records</span>
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

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* VISITOR PROFILE MODAL */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {selectedVisitorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-500">badge</span>
                  Visitor Profile Intelligence
                </h3>
                <p className="text-xs text-slate-500">Full telemetry, linked devices, and activity history</p>
              </div>
              <button
                onClick={() => setSelectedVisitorId(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {profileLoading ? (
                <p className="text-center py-8 text-slate-400">Loading profile data...</p>
              ) : profileData ? (
                <>
                  {/* Visitor Particulars Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Full Name</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">{profileData.visitor.latest_name || "Anonymous"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Account Email</p>
                      <p className="font-mono text-slate-900 dark:text-white mt-0.5">{profileData.visitor.latest_email || "Anonymous"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Status</p>
                      <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        profileData.visitor.status === "Blocked"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {profileData.visitor.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Device ID Hash</p>
                      <p className="font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{profileData.visitor.shortDeviceId}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">IP &amp; Location</p>
                      <p className="mt-0.5">{profileData.visitor.latest_ip} ({profileData.visitor.latest_location})</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Visits</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">{profileData.visitor.visit_count} sessions</p>
                    </div>
                  </div>

                  {/* Other Emails & Devices Linked */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <h4 className="font-bold text-slate-900 dark:text-white">Linked Emails ({profileData.linkedEmails?.length || 0})</h4>
                      <div className="space-y-1">
                        {profileData.linkedEmails && profileData.linkedEmails.length > 0 ? (
                          profileData.linkedEmails.map((em: string) => (
                            <p key={em} className="font-mono text-slate-600 dark:text-slate-300">&bull; {em}</p>
                          ))
                        ) : (
                          <p className="text-slate-400">No authenticated emails linked yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <h4 className="font-bold text-slate-900 dark:text-white">Other Devices for Same User ({profileData.linkedDevices?.length || 0})</h4>
                      <div className="space-y-1">
                        {profileData.linkedDevices && profileData.linkedDevices.length > 0 ? (
                          profileData.linkedDevices.map((d: any) => (
                            <p key={d.deviceIdHash} className="font-mono text-indigo-600 dark:text-indigo-400">
                              &bull; Device: {d.shortId} (last seen {new Date(d.lastSeen).toLocaleDateString()})
                            </p>
                          ))
                        ) : (
                          <p className="text-slate-400">No additional devices registered.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sessions & Pageviews Timeline */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 dark:text-white">Recent Sessions Timeline</h4>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {profileData.sessions && profileData.sessions.length > 0 ? (
                        profileData.sessions.map((s: VisitorSession) => (
                          <div key={s.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {s.source} Session &bull; {s.browser} on {s.os}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                IP: {s.ip} ({s.city}, {s.country}) &bull; ISP: {s.isp}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {s.pages_visited?.map((p, idx) => (
                                  <span key={idx} className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-400">No detailed sessions logged.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedVisitorId(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* BLOCK VISITOR MODAL */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {blockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-4 p-6 text-xs">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <span className="material-symbols-outlined text-[24px]">block</span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Block Visitor &amp; Enforce Restrictions
              </h3>
            </div>
            <p className="text-slate-500 leading-relaxed">
              Restrict this entity from accessing the public website and Administration Hub. Blocked attempts will be intercepted on the server with a neutral restricted notice.
            </p>

            {/* Educational Disclaimer per Section 8 */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
              <strong>Advisory:</strong> A determined user can change browser, device or network. Blocking by email and device reduces repeat access but cannot make it impossible.
            </div>

            {/* Block Vectors */}
            <div className="space-y-2 border-y border-slate-200 dark:border-slate-800 py-3">
              <p className="font-bold text-slate-800 dark:text-slate-200">Select Block Vectors *</p>

              {blockTarget.latest_email && blockTarget.latest_email !== "Anonymous" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockByEmail}
                    onChange={(e) => setBlockByEmail(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Block Account Email: <strong>{blockTarget.latest_email}</strong></span>
                </label>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={blockByDevice}
                  onChange={(e) => setBlockByDevice(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span>Block Device ID Hash: <strong className="font-mono">{blockTarget.shortDeviceId}</strong></span>
              </label>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockByIp}
                    onChange={(e) => setBlockByIp(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Block IP Address: <strong>{blockTarget.latest_ip || "127.0.0.1"}</strong></span>
                </label>

                {blockByIp && (
                  <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 space-y-1.5">
                    <p className="text-[11px] font-semibold">
                      ⚠ IPs are often shared (e.g. offices, mobile carriers, cafes), this may block innocent users.
                    </p>
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmIpWarning}
                        onChange={(e) => setConfirmIpWarning(e.target.checked)}
                        className="rounded text-rose-600"
                      />
                      <span>I understand and confirm blocking this IP address</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Reason Code & Details */}
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Reason Code *</label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value="Suspicious activity">Suspicious activity</option>
                  <option value="Repeated failed logins">Repeated failed logins</option>
                  <option value="Unauthorized access attempt">Unauthorized access attempt</option>
                  <option value="Abuse or spam">Abuse or spam</option>
                  <option value="Security concern">Security concern</option>
                  <option value="Requested by management">Requested by management</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Required Justification Details *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explain why this visitor is being blocked..."
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value="Permanent">Permanent</option>
                  <option value={new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]}>7 Days</option>
                  <option value={new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]}>30 Days</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setBlockTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={blockSubmitting || !reasonText.trim() || (blockByIp && !confirmIpWarning)}
                onClick={handleSubmitBlock}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-50 transition cursor-pointer"
              >
                {blockSubmitting ? "Enforcing Block..." : "Confirm & Apply Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* EXPORT CSV MODAL */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">file_download</span>
              Export Visitor Registry CSV
            </h3>

            <p className="text-slate-500 leading-relaxed">
              Export visitor telemetry to CSV for audit and executive reporting.
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
                  <p className="text-[11px] text-slate-400">Masks partial email and IP address to protect visitor privacy.</p>
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
                    placeholder="Enter official institutional purpose for full unmasked export..."
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
