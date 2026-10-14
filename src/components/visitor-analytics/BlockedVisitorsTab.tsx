"use client";

import React, { useState, useEffect } from "react";
import { BlockedEntry } from "@/lib/visitorTypes";

export function BlockedVisitorsTab() {
  const [activeBlocks, setActiveBlocks] = useState<BlockedEntry[]>([]);
  const [blockHistory, setBlockHistory] = useState<BlockedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"active" | "history">("active");
  const [search, setSearch] = useState("");

  // Unblock Modal State
  const [unblockTarget, setUnblockTarget] = useState<BlockedEntry | null>(null);
  const [unblockReason, setUnblockReason] = useState("");
  const [unblockSubmitting, setUnblockSubmitting] = useState(false);

  // Edit Duration Modal State
  const [editDurationTarget, setEditDurationTarget] = useState<BlockedEntry | null>(null);
  const [newDuration, setNewDuration] = useState("Permanent");
  const [durationSubmitting, setDurationSubmitting] = useState(false);

  const fetchBlocks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/visitor-analytics/blocks");
      const data = await res.json();
      if (data.success) {
        setActiveBlocks(data.activeBlocks || []);
        setBlockHistory(data.blockHistory || []);
      }
    } catch (err) {
      console.error("Fetch blocks error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, []);

  const handleConfirmUnblock = async () => {
    if (!unblockTarget || !unblockReason.trim()) return;
    setUnblockSubmitting(true);
    try {
      const res = await fetch(`/api/visitor-analytics/blocks?id=${unblockTarget.id}&reason=${encodeURIComponent(unblockReason)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setUnblockTarget(null);
        setUnblockReason("");
        fetchBlocks();
      } else {
        alert(data.error || "Unblock failed");
      }
    } catch (err: any) {
      alert("Unblock action error: " + err.message);
    } finally {
      setUnblockSubmitting(false);
    }
  };

  const handleConfirmEditDuration = async () => {
    if (!editDurationTarget) return;
    setDurationSubmitting(true);
    try {
      const res = await fetch("/api/visitor-analytics/blocks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId: editDurationTarget.id,
          duration: newDuration,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditDurationTarget(null);
        fetchBlocks();
      } else {
        alert(data.error || "Failed to update duration");
      }
    } catch (err: any) {
      alert("Duration update error: " + err.message);
    } finally {
      setDurationSubmitting(false);
    }
  };

  const displayedList = (viewMode === "active" ? activeBlocks : blockHistory).filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.display_value.toLowerCase().includes(s) ||
      b.reason_code.toLowerCase().includes(s) ||
      b.reason_text.toLowerCase().includes(s) ||
      b.blocked_by.name.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Educational Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px] shrink-0 mt-0.5">
          info
        </span>
        <p className="leading-relaxed">
          <strong>Institutional Governance Advisory:</strong> A determined user can change browser, device or network. Blocking by email and device reduces repeat access but cannot make it impossible. Enforced server-side on every inbound request and verified during authentication.
        </p>
      </div>

      {/* Control Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setViewMode("active")}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              viewMode === "active"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Active Blocks ({activeBlocks.length})
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              viewMode === "history"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Block History ({blockHistory.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search blocklist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Block Type</th>
                <th className="p-3">Target Entity Value</th>
                <th className="p-3">Reason Code</th>
                <th className="p-3">Justification Details</th>
                <th className="p-3">Blocked By</th>
                <th className="p-3">Date Imposed</th>
                <th className="p-3">Duration</th>
                <th className="p-3 text-center">Attempts Prevented</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    Loading block records...
                  </td>
                </tr>
              ) : displayedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    {viewMode === "active" ? "No active blocks found. System is clear." : "No block history records found."}
                  </td>
                </tr>
              ) : (
                displayedList.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3">
                      <span className="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {b.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {b.display_value}
                    </td>
                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                      {b.reason_code}
                    </td>
                    <td className="p-3 text-slate-500 max-w-[200px] truncate" title={b.reason_text}>
                      {b.reason_text}
                    </td>
                    <td className="p-3 text-[11px]">
                      {b.blocked_by.name} ({b.blocked_by.role})
                    </td>
                    <td className="p-3 text-[11px] text-slate-400">
                      {new Date(b.blocked_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="p-3 text-[11px]">
                      {b.expires_at ? `Until ${new Date(b.expires_at).toLocaleDateString()}` : "Permanent"}
                    </td>
                    <td className="p-3 text-center font-bold text-rose-600 dark:text-rose-400">
                      {b.blocked_attempts_count || 0}
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        b.status === "Active"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {b.status === "Active" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditDurationTarget(b);
                              setNewDuration(b.expires_at ? b.expires_at.split("T")[0] : "Permanent");
                            }}
                            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-[11px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setUnblockTarget(b);
                              setUnblockReason("");
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-600 font-semibold text-[11px] transition"
                          >
                            Unblock
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unblock Modal */}
      {unblockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 text-emerald-600">
              <span className="material-symbols-outlined">lock_open</span>
              Lift Visitor Block Restriction
            </h3>
            <p className="text-slate-500">
              Restore access for {unblockTarget.type} <strong className="font-mono text-slate-900 dark:text-white">{unblockTarget.display_value}</strong>.
            </p>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Documented Unblock Justification Reason *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Explain why this block is being lifted (recorded in audit trail)..."
                value={unblockReason}
                onChange={(e) => setUnblockReason(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setUnblockTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={unblockSubmitting || !unblockReason.trim()}
                onClick={handleConfirmUnblock}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 transition cursor-pointer"
              >
                {unblockSubmitting ? "Restoring Access..." : "Confirm & Unblock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Duration Modal */}
      {editDurationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">edit_calendar</span>
              Update Block Duration
            </h3>
            <p className="text-slate-500">
              Update expiration timeframe for {editDurationTarget.type} <strong className="font-mono">{editDurationTarget.display_value}</strong>.
            </p>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Duration Setting</label>
              <select
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value="Permanent">Permanent</option>
                <option value={new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]}>7 Days</option>
                <option value={new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]}>30 Days</option>
                <option value={new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0]}>90 Days</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setEditDurationTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={durationSubmitting}
                onClick={handleConfirmEditDuration}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50 transition cursor-pointer"
              >
                {durationSubmitting ? "Saving..." : "Update Duration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
