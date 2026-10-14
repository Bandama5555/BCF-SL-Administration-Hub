"use client";

import { useState, useEffect } from "react";

interface HealthData {
  success: boolean;
  connected: boolean;
  status: "connected" | "disconnected" | "placeholder_credentials";
  database: string;
  cluster: string;
  sanitizedUri: string;
  latencyMs?: number;
  collections?: { name: string; documentCount: number }[];
  totalDocuments?: number;
  error?: string;
  backendService?: {
    connected: boolean;
    status: string;
    service?: string;
    version?: string;
    url?: string;
    uptimeSeconds?: number;
    error?: string;
  };
}

export function MongoStatusBadge() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/db/health");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setData({
        success: false,
        connected: false,
        status: "disconnected",
        database: "bcf_administrative_hub",
        cluster: "administrativehub.e9xkgcl.mongodb.net",
        sanitizedUri: "mongodb+srv://****@administrativehub.e9xkgcl.mongodb.net",
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 45000);
    return () => clearInterval(interval);
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await fetch("/api/db/seed", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setSeedMsg("✅ Database successfully seeded with standard institutional collections!");
        fetchHealth();
      } else {
        setSeedMsg(`⚠️ ${json.message || json.error}`);
      }
    } catch (err: any) {
      setSeedMsg(`❌ Seed error: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  const isConnected = data?.connected === true;
  const isPlaceholder = data?.status === "placeholder_credentials";

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs hover:scale-102"
        style={{
          background: isConnected
            ? "rgba(16, 185, 129, 0.1)"
            : isPlaceholder
              ? "rgba(245, 158, 11, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
          borderColor: isConnected
            ? "rgba(16, 185, 129, 0.3)"
            : isPlaceholder
              ? "rgba(245, 158, 11, 0.3)"
              : "rgba(239, 68, 68, 0.3)",
          color: isConnected ? "#059669" : isPlaceholder ? "#d97706" : "#dc2626",
        }}
        title="MongoDB Atlas Backend Connection"
      >
        <span
          className={`w-2 h-2 rounded-full ${isConnected
              ? "bg-emerald-500 animate-pulse"
              : isPlaceholder
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
        />
        <span className="material-symbols-outlined text-[15px]">database</span>
        <span className="hidden sm:inline">
          {loading
            ? "MongoDB..."
            : isConnected
              ? `MongoDB Atlas (${data?.latencyMs ?? 0}ms)`
              : isPlaceholder
                ? "MongoDB (Config Required)"
                : "MongoDB Offline"}
        </span>
      </button>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm"
                  style={{ background: "linear-gradient(135deg, #10b981, #047857)" }}
                >
                  <span className="material-symbols-outlined text-2xl">database</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    MongoDB Atlas Backend Connection
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    BCF-SL Administrative Hub Data Layer
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Express API Backend Service Status Card */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-xl">
                  dns
                </span>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <span>Express Backend Service</span>
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        data?.backendService?.connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      }`}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {data?.backendService?.url || "http://localhost:5000"} • {data?.backendService?.service || "Express API"} (v{data?.backendService?.version || "1.0.0"})
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {data?.backendService?.connected ? "CONNECTED" : "FALLBACK"}
              </span>
            </div>

            {/* Connection Status Banner */}
            <div
              className="p-4 rounded-2xl border flex items-start gap-3"
              style={{
                background: isConnected
                  ? "rgba(16, 185, 129, 0.08)"
                  : isPlaceholder
                    ? "rgba(245, 158, 11, 0.08)"
                    : "rgba(239, 68, 68, 0.08)",
                borderColor: isConnected
                  ? "rgba(16, 185, 129, 0.25)"
                  : isPlaceholder
                    ? "rgba(245, 158, 11, 0.25)"
                    : "rgba(239, 68, 68, 0.25)",
              }}
            >
              <span
                className="material-symbols-outlined text-2xl shrink-0"
                style={{
                  color: isConnected ? "#059669" : isPlaceholder ? "#d97706" : "#dc2626",
                }}
              >
                {isConnected
                  ? "check_circle"
                  : isPlaceholder
                    ? "warning"
                    : "error"}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="font-bold text-xs uppercase tracking-wide"
                  style={{
                    color: isConnected ? "#059669" : isPlaceholder ? "#d97706" : "#dc2626",
                  }}
                >
                  {isConnected
                    ? "Live MongoDB Atlas Connected"
                    : isPlaceholder
                      ? "Credentials Pending in frontend/.env"
                      : "MongoDB Disconnected"}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {isConnected
                    ? `Connected to cluster ${data?.cluster} • DB: ${data?.database} • Ping Latency: ${data?.latencyMs}ms`
                    : isPlaceholder
                      ? "The MongoDB URI in frontend/.env contains <db_username> and <db_password> placeholders. The system is operating in resilient fallback mode."
                      : data?.error || "Unable to reach MongoDB cluster."}
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Cluster Host
                </span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {data?.cluster || "administrativehub.e9xkgcl.mongodb.net"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Database Name
                </span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {data?.database || "bcf_administrative_hub"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Configured URI (Sanitized)
                </span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all block">
                  {data?.sanitizedUri || "mongodb+srv://****@administrativehub.e9xkgcl.mongodb.net"}
                </span>
              </div>
            </div>

            {/* Collections Status */}
            {isConnected && data?.collections && data.collections.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Active Collections ({data.collections.length})</span>
                  <span>Total Docs: {data.totalDocuments ?? 0}</span>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {data.collections.map((c) => (
                    <div
                      key={c.name}
                      className="px-3 py-1.5 flex items-center justify-between bg-white dark:bg-slate-800"
                    >
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {c.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {c.documentCount} docs
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instruction Box for User if credentials needed */}
            {isPlaceholder && (
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-blue-600">info</span>
                  How to activate live Atlas database:
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Open <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">frontend/.env</code> and replace <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">&lt;db_username&gt;</code> and <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">&lt;db_password&gt;</code> with your MongoDB Atlas database user and password.
                </p>
              </div>
            )}

            {seedMsg && (
              <div className="p-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {seedMsg}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={fetchHealth}
                disabled={loading}
                className="flex-1 h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                <span>Refresh Ping</span>
              </button>

              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <span className="material-symbols-outlined text-base">cloud_sync</span>
                <span>{seeding ? "Seeding..." : "Seed Database"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
