"use client";

import React, { useState, useEffect } from "react";
import { DashboardMetrics, SecurityAlert, Visitor } from "@/lib/visitorTypes";

interface VisitorDashboardTabProps {
  onNavigateToVisitors: (filter?: {
    country?: string;
    os?: string;
    deviceType?: string;
    signedIn?: string;
    status?: string;
    search?: string;
  }) => void;
  onNavigateToBlocked: () => void;
  onNavigateToLogin: () => void;
}

export function VisitorDashboardTab({
  onNavigateToVisitors,
  onNavigateToBlocked,
  onNavigateToLogin,
}: VisitorDashboardTabProps) {
  const [range, setRange] = useState<"today" | "7d" | "30d" | "90d" | "custom">("30d");
  const [source, setSource] = useState<"All" | "Website" | "Hub">("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        range,
        source,
      });
      if (range === "custom" && startDate) params.append("startDate", startDate);
      if (range === "custom" && endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/visitor-analytics/dashboard?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError("You do not have access to that page.");
        } else {
          setError("Failed to fetch dashboard metrics.");
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
      } else {
        setError(data.error || "Failed to load metrics");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [range, source, startDate, endDate]);

  if (error) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400">
        <span className="material-symbols-outlined text-4xl mb-2">lock</span>
        <h3 className="text-base font-bold">{error}</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Filter Toolbar: Range & Source */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        {/* Date Range Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "today", label: "Today" },
            { id: "7d", label: "7 Days" },
            { id: "30d", label: "30 Days" },
            { id: "90d", label: "90 Days" },
            { id: "custom", label: "Custom Range" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setRange(item.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                range === item.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
          {range === "custom" && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs bg-transparent dark:text-white"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs bg-transparent dark:text-white"
              />
            </div>
          )}
        </div>

        {/* Source Toggle: All / Website / Hub */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          {[
            { id: "All", label: "All Traffic" },
            { id: "Website", label: "Public Website" },
            { id: "Hub", label: "Administration Hub" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSource(item.id as any)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                source === item.id
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 9 Key Performance Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* 1. Total Visits */}
        <div
          onClick={() => onNavigateToVisitors()}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer hover:border-indigo-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Total Visits</span>
            <span className="material-symbols-outlined text-indigo-500 text-[20px]">visibility</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {metrics?.totalVisits ?? (loading ? "..." : 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Recorded sessions</p>
        </div>

        {/* 2. Unique Visitors */}
        <div
          onClick={() => onNavigateToVisitors()}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer hover:border-indigo-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Unique Visitors</span>
            <span className="material-symbols-outlined text-purple-500 text-[20px]">fingerprint</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {metrics?.uniqueVisitors ?? (loading ? "..." : 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Distinct devices</p>
        </div>

        {/* 3. New vs Returning */}
        <div
          onClick={() => onNavigateToVisitors()}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer hover:border-indigo-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">New vs Returning</span>
            <span className="material-symbols-outlined text-teal-500 text-[20px]">repeat</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {metrics ? `${metrics.newVisitors} / ${metrics.returningVisitors}` : "..."}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">First-time / repeat</p>
        </div>

        {/* 4. Signed-In vs Anonymous */}
        <div
          onClick={() => onNavigateToVisitors({ signedIn: "signed-in" })}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer hover:border-indigo-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Signed-In / Anon</span>
            <span className="material-symbols-outlined text-blue-500 text-[20px]">how_to_reg</span>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {metrics ? `${metrics.signedInVisitors} / ${metrics.anonymousVisitors}` : "..."}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Identified accounts</p>
        </div>

        {/* 5. Active Now (last 5 min) */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              Active Now
            </span>
            <span className="material-symbols-outlined text-emerald-500 text-[20px]">sensors</span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {metrics?.activeNow ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Last 5 minutes</p>
        </div>

        {/* 6. Failed Login Attempts */}
        <div
          onClick={() => onNavigateToLogin()}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer hover:border-amber-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Failed Logins</span>
            <span className="material-symbols-outlined text-amber-500 text-[20px]">lock_reset</span>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {metrics?.failedLoginsCount ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Security auth failures</p>
        </div>

        {/* 7. Blocked Attempts */}
        <div
          onClick={() => onNavigateToBlocked()}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer hover:border-rose-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Blocked Hits</span>
            <span className="material-symbols-outlined text-rose-500 text-[20px]">shield</span>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {metrics?.blockedAttemptsCount ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Prevented intrusions</p>
        </div>

        {/* 8. Currently Blocked Visitors */}
        <div
          onClick={() => onNavigateToBlocked()}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer hover:border-rose-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Active Blocks</span>
            <span className="material-symbols-outlined text-rose-600 text-[20px]">block</span>
          </div>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1">
            {metrics?.currentlyBlockedCount ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Enforced blocklist</p>
        </div>

        {/* 9. Bots Filtered */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Bots Filtered</span>
            <span className="material-symbols-outlined text-slate-500 text-[20px]">smart_toy</span>
          </div>
          <p className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
            {metrics?.botsFilteredCount ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Automated crawlers</p>
        </div>
      </div>

      {/* Security Alerts Panel */}
      {metrics && metrics.alerts && metrics.alerts.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[22px]">
                warning
              </span>
              <h3 className="font-extrabold text-sm tracking-tight text-amber-800 dark:text-amber-300">
                Security Intelligence Alerts ({metrics.alerts.length})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-400">
              Click an alert to filter records
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {metrics.alerts.map((alt) => (
              <div
                key={alt.id}
                onClick={() => {
                  if (alt.target) onNavigateToVisitors({ search: alt.target });
                  else if (alt.ip) onNavigateToVisitors({ search: alt.ip });
                  else onNavigateToVisitors();
                }}
                className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/90 border border-amber-500/30 hover:border-amber-500 cursor-pointer transition shadow-2xs flex items-start gap-3"
              >
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[18px] mt-0.5 shrink-0">
                  {alt.type === "blocked_attempt" ? "shield" : alt.type === "failed_logins" ? "lock" : "travel_explore"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {alt.title}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                    {alt.message}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(alt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; Click to inspect
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Grid: Row 1 - Visits Over Time & Country Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visits Over Time */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Visits Over Time</h3>
              <p className="text-xs text-slate-500">Daily session trends within selected date range</p>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-md">
              {metrics?.visitsOverTime?.reduce((s, v) => s + v.visits, 0) || 0} Total Hits
            </span>
          </div>

          {/* Simple Visual Line / Bar Graph */}
          <div className="h-44 w-full flex items-end gap-1.5 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
            {metrics?.visitsOverTime && metrics.visitsOverTime.length > 0 ? (
              metrics.visitsOverTime.map((d, i) => {
                const max = Math.max(...metrics.visitsOverTime.map((x) => x.visits), 1);
                const heightPct = Math.max(Math.round((d.visits / max) * 100), 8);
                return (
                  <div
                    key={i}
                    title={`${d.date}: ${d.visits} visits (${d.unique} unique)`}
                    className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                    onClick={() => onNavigateToVisitors()}
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full rounded-t-sm bg-gradient-to-t from-indigo-600 to-purple-500 group-hover:from-indigo-500 group-hover:to-pink-400 transition"
                    />
                  </div>
                );
              })
            ) : (
              <div className="w-full text-center text-xs text-slate-400 py-12">
                No session telemetry available for this period.
              </div>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 px-2 font-mono">
            <span>{metrics?.visitsOverTime?.[0]?.date || "Start"}</span>
            <span>{metrics?.visitsOverTime?.[metrics.visitsOverTime.length - 1]?.date || "End"}</span>
          </div>
        </div>

        {/* Visitors by Country & City */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Visitors by Country</h3>
            <p className="text-xs text-slate-500">Top inbound locations from IP geolocation</p>
          </div>

          <div className="space-y-3">
            {metrics?.visitorsByCountry && metrics.visitorsByCountry.length > 0 ? (
              metrics.visitorsByCountry.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onNavigateToVisitors({ country: item.country })}
                  className="space-y-1 cursor-pointer group"
                >
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {item.city}, {item.country}
                    </span>
                    <span>{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className="h-full bg-indigo-600 rounded-full transition-all"
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No country telemetry yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts Grid: Row 2 - Technology Breakdown (OS, Device Type, Browser) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* By OS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span className="material-symbols-outlined text-indigo-500 text-[18px]">laptop</span>
            Operating System
          </h3>
          <div className="space-y-2">
            {metrics?.visitorsByOS?.map((os, i) => (
              <div
                key={i}
                onClick={() => onNavigateToVisitors({ os: os.name })}
                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
              >
                <span className="text-slate-600 dark:text-slate-300 font-medium">{os.name}</span>
                <span className="font-bold text-slate-900 dark:text-white">{os.count} ({os.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* By Device Type */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span className="material-symbols-outlined text-purple-500 text-[18px]">devices</span>
            Device Category
          </h3>
          <div className="space-y-2">
            {metrics?.visitorsByDeviceType?.map((dev, i) => (
              <div
                key={i}
                onClick={() => onNavigateToVisitors({ deviceType: dev.name })}
                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
              >
                <span className="text-slate-600 dark:text-slate-300 font-medium">{dev.name}</span>
                <span className="font-bold text-slate-900 dark:text-white">{dev.count} ({dev.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* By Browser */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span className="material-symbols-outlined text-pink-500 text-[18px]">public</span>
            Web Browser
          </h3>
          <div className="space-y-2">
            {metrics?.visitorsByBrowser?.map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="text-slate-600 dark:text-slate-300 font-medium">{b.name}</span>
                <span className="font-bold text-slate-900 dark:text-white">{b.count} ({b.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Top Pages & Top Referrers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Pages */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Top Visited Pages</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {metrics?.topPages?.map((p, i) => (
              <div key={i} className="py-2 flex items-center justify-between">
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[280px]">{p.page}</span>
                <span className="font-bold text-slate-900 dark:text-white">{p.views} views</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Referrers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Top Referrers</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {metrics?.topReferrers?.map((r, i) => (
              <div key={i} className="py-2 flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 truncate max-w-[280px]">{r.referrer}</span>
                <span className="font-bold text-slate-900 dark:text-white">{r.count} inbound</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Recent Visitors (10) & Recent Blocked Attempts (10) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Visitors */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Recent Visitors</h3>
            <button
              onClick={() => onNavigateToVisitors()}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View Full List &rarr;
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {metrics?.recentVisitors?.slice(0, 8).map((v) => (
              <div
                key={v.id}
                onClick={() => onNavigateToVisitors({ search: v.id })}
                className="py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-lg cursor-pointer"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{v.latest_name || "Anonymous"}</p>
                  <p className="text-[11px] text-slate-400">{v.latest_location} &bull; {v.latest_os}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    v.status === "Blocked"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                  }`}>
                    {v.status}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">{v.visit_count} visits</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Blocked Attempts */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Recent Blocked Attempts</h3>
            <button
              onClick={() => onNavigateToBlocked()}
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
            >
              View Block History &rarr;
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {metrics?.recentBlockedAttempts && metrics.recentBlockedAttempts.length > 0 ? (
              metrics.recentBlockedAttempts.slice(0, 8).map((b) => (
                <div key={b.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-rose-600 dark:text-rose-400 font-mono">{b.emailTried || b.ip}</p>
                    <p className="text-[11px] text-slate-400">{b.reason} &bull; {b.location}</p>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(b.attempted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No blocked attempts recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
