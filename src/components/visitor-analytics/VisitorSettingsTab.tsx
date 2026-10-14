"use client";

import React, { useState, useEffect } from "react";
import { VisitorSettings } from "@/lib/visitorTypes";

export function VisitorSettingsTab() {
  const [settings, setSettings] = useState<VisitorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Retention cleanup state
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  // Right to be forgotten (Delete person record) state
  const [deleteTarget, setDeleteTarget] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/visitor-analytics/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error("Fetch settings error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/visitor-analytics/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        alert(data.error || "Failed to update settings");
      }
    } catch (err: any) {
      alert("Save error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunCleanup = async () => {
    if (!confirm("Run immediate retention maintenance cleanup? This will permanently purge or anonymize records older than the retention period.")) {
      return;
    }
    setCleanupRunning(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/visitor-analytics/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup", months: settings?.retention_months || 12 }),
      });
      const data = await res.json();
      if (data.success) {
        setCleanupResult(data.message || "Retention job completed successfully.");
      } else {
        alert(data.error || "Cleanup failed");
      }
    } catch (err: any) {
      alert("Cleanup error: " + err.message);
    } finally {
      setCleanupRunning(false);
    }
  };

  const handleDeletePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget || !deleteReason.trim()) {
      alert("Please provide the person's email/device and justification reason.");
      return;
    }
    if (!confirm(`Permanently erase all visitor and session records for "${deleteTarget}"? This action is immutable and logged to the audit trail.`)) {
      return;
    }

    setDeleteRunning(true);
    setDeleteMessage(null);
    try {
      const res = await fetch("/api/visitor-analytics/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-person",
          identifier: deleteTarget,
          reason: deleteReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDeleteMessage(data.message || "Records successfully erased.");
        setDeleteTarget("");
        setDeleteReason("");
      } else {
        alert(data.error || "Deletion failed");
      }
    } catch (err: any) {
      alert("Delete error: " + err.message);
    } finally {
      setDeleteRunning(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading institutional settings...</div>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto w-full text-xs">
      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          Visitor Analytics settings successfully updated and applied.
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Retention Policy Section */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">auto_delete</span>
                Data Retention &amp; Automatic Maintenance
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Configure how long session and visitor records are preserved</p>
            </div>
            <button
              type="button"
              disabled={cleanupRunning}
              onClick={handleRunCleanup}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold text-xs transition cursor-pointer"
            >
              {cleanupRunning ? "Running Cleanup..." : "Run Retention Cleanup Now"}
            </button>
          </div>

          {cleanupResult && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-700 dark:text-emerald-300 text-[11px]">
              {cleanupResult}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Data Retention Period (Months)
              </label>
              <select
                value={settings.retention_months}
                onChange={(e) => setSettings({ ...settings, retention_months: parseInt(e.target.value, 10) })}
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months (Recommended Institutional Default)</option>
                <option value={24}>24 Months</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Records older than this timeframe are automatically purged or anonymized.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Bot &amp; Crawler Filtering
              </label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.bot_filtering}
                  onChange={(e) => setSettings({ ...settings, bot_filtering: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Exclude automated search engines &amp; spiders from main visitor counts
                </span>
              </label>
              <p className="text-[10px] text-slate-400 mt-1">
                When active, bots are aggregated separately in the &quot;Bots Filtered&quot; metric.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Notice & Transparency Section */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-500">policy</span>
              Privacy Notice &amp; Compliance Disclosure
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Text displayed on public website banner and login interface</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Mandatory Notice Text
              </label>
              <textarea
                rows={2}
                value={settings.notice_text}
                onChange={(e) => setSettings({ ...settings, notice_text: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Privacy Policy URL / Route
              </label>
              <input
                type="text"
                value={settings.privacy_policy_url}
                onChange={(e) => setSettings({ ...settings, privacy_policy_url: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Alert Thresholds & Routing Section */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500">notifications_active</span>
              Security Alert Thresholds &amp; Dispatch
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Automated detection triggers for brute force and geographic velocity anomalies</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Failed Logins Threshold (Attempts)
              </label>
              <input
                type="number"
                min={2}
                max={20}
                value={settings.alert_failed_login_threshold}
                onChange={(e) => setSettings({ ...settings, alert_failed_login_threshold: parseInt(e.target.value, 10) || 5 })}
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Raises high-severity alert when exceeded (default: 5 attempts).</p>
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Monitoring Window (Minutes)
              </label>
              <input
                type="number"
                min={5}
                max={60}
                value={settings.alert_failed_login_window_mins}
                onChange={(e) => setSettings({ ...settings, alert_failed_login_window_mins: parseInt(e.target.value, 10) || 10 })}
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Timeframe window for clustering failed attempts.</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.alert_in_app}
                onChange={(e) => setSettings({ ...settings, alert_in_app: e.target.checked })}
                className="rounded text-indigo-600"
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Dispatch in-app notifications to Super Admin header bell icon
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.alert_email_enabled}
                onChange={(e) => setSettings({ ...settings, alert_email_enabled: e.target.checked })}
                className="rounded text-indigo-600"
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Send security alert emails via BCF official Gmail SMTP service
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            {saving ? "Saving Changes..." : "Save Settings"}
          </button>
        </div>
      </form>

      {/* GDPR / Right-to-be-Forgotten Erasure Tool */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/40 shadow-2xs space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">delete_forever</span>
            Individual Visitor Record Erasure (Right to be Forgotten)
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Look up and permanently delete a person&apos;s visitor telemetry upon statutory request. All deletions are audit-logged.
          </p>
        </div>

        {deleteMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-700 dark:text-emerald-300 text-[11px]">
            {deleteMessage}
          </div>
        )}

        <form onSubmit={handleDeletePerson} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Target Email or Device ID *</label>
            <input
              type="text"
              required
              placeholder="e.g. user@example.com or VIS-xxxx"
              value={deleteTarget}
              onChange={(e) => setDeleteTarget(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Audit Justification Reason *</label>
            <input
              type="text"
              required
              placeholder="e.g. Statutory GDPR request #2026-04"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={deleteRunning || !deleteTarget.trim() || !deleteReason.trim()}
              className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs disabled:opacity-50 transition cursor-pointer"
            >
              {deleteRunning ? "Purging..." : "Erase Records Permanently"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
