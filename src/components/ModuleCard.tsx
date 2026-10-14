"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { type Module } from "@/lib/modules";
import { getAccessibleSubApps, type RoleCode } from "@/lib/permissions";

interface ModuleCardProps {
  module: Module;
  index: number;
  roleCode?: RoleCode;
}

export function ModuleCard({ module, index, roleCode }: ModuleCardProps) {
  const [kpiValue, setKpiValue] = useState(module.kpiValue);
  const [kpiTrend, setKpiTrend] = useState(module.kpiTrend);

  useEffect(() => {
    function syncLiveCounts() {
      if (module.slug === "beneficiaries") {
        try {
          const raw = localStorage.getItem("bcf_sl_beneficiaries_database_v2");
          let count = 8;
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              count = parsed.length;
            }
          }
          setKpiValue(String(count));
          setKpiTrend(`${count} enrolled`);
          return;
        } catch {
          setKpiValue("8");
          setKpiTrend("8 enrolled");
        }
      }

      if (module.slug === "donors") {
        try {
          const raw = localStorage.getItem("bcf_donorlog_donations");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const verified = parsed.filter((d: { status?: string }) => d.status === "Verified");
              const count = verified.length > 0 ? verified.length : parsed.length;
              setKpiValue(String(count));
              setKpiTrend(`${count} verified`);
              return;
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      if (module.slug === "programs") {
        try {
          const raw = localStorage.getItem("bcf_programs_master_table");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const doneCount = parsed.filter((p: { remarks?: string }) => {
                const r = String(p.remarks || '').trim().toLowerCase();
                return r === 'completed' || r === 'done';
              }).length;
              const undoneCount = Math.max(0, parsed.length - doneCount);
              setKpiValue(String(parsed.length));
              setKpiTrend(`${doneCount} done • ${undoneCount} undone`);
              return;
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    syncLiveCounts();
    window.addEventListener("storage", syncLiveCounts);

    let bcBeneficiaries: BroadcastChannel | null = null;
    let bcDonors: BroadcastChannel | null = null;
    let bcPrograms: BroadcastChannel | null = null;

    try {
      bcBeneficiaries = new BroadcastChannel("bcf_beneficiaries_channel");
      bcBeneficiaries.onmessage = () => syncLiveCounts();
    } catch {}

    try {
      bcDonors = new BroadcastChannel("bcf_donors_channel");
      bcDonors.onmessage = () => syncLiveCounts();
    } catch {}

    try {
      bcPrograms = new BroadcastChannel("bcf_programs_sync_channel");
      bcPrograms.onmessage = () => syncLiveCounts();
    } catch {}

    return () => {
      window.removeEventListener("storage", syncLiveCounts);
      if (bcBeneficiaries) bcBeneficiaries.close();
      if (bcDonors) bcDonors.close();
      if (bcPrograms) bcPrograms.close();
    };
  }, [module.slug]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
    >
      {(() => {
        const targetSub = roleCode
          ? getAccessibleSubApps(roleCode, module.slug)[0]
          : module.subApps.find((s) => !s.hidden);
        const targetHref = targetSub ? `/${module.slug}/${targetSub.id}` : `/${module.slug}`;

        return (
          <Link
            href={targetHref}
            id={`module-card-${module.slug}`}
            aria-label={`Open ${module.label}`}
            className="group block rounded-2xl overflow-hidden transition-all duration-200 
                       hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]"
            style={{
              background: "var(--surface-container-lowest)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Gradient accent strip */}
            <div
              className={`h-1.5 w-full bg-gradient-to-r ${module.color} opacity-90 group-hover:opacity-100 transition-opacity`}
            />

        <div className="p-5">
          {/* Icon + label row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${module.color}`}
            >
              <span className="material-symbols-outlined text-white text-[22px]">
                {module.icon}
              </span>
            </div>
            <span
              className="material-symbols-outlined text-[20px] opacity-0 group-hover:opacity-100 
                         transition-opacity mt-0.5"
              style={{ color: "var(--on-surface-variant)" }}
            >
              arrow_forward
            </span>
          </div>

          {/* Module title */}
          <h2
            className="text-[15px] font-bold leading-tight mb-1.5 group-hover:text-[var(--primary)] transition-colors"
            style={{ color: "var(--on-surface)" }}
          >
            {module.label}
          </h2>

          {/* Description */}
          <p
            className="text-[12px] leading-relaxed line-clamp-2 mb-4"
            style={{ color: "var(--on-surface-variant)" }}
          >
            {module.description}
          </p>

          {/* KPI divider */}
          <div
            className="pt-3 mt-auto"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
               style={{ color: "var(--outline)" }}>
              {module.kpiLabel}
            </p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-[22px] font-extrabold leading-none tracking-tight"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  color: "var(--on-surface)",
                }}
              >
                {kpiValue}
              </span>
              <span
                className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  color: "var(--on-secondary-container)",
                  background: "var(--secondary-container)",
                }}
              >
                {kpiTrend}
              </span>
            </div>
          </div>

          {/* Sub-app count badge */}
          <div className="mt-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]"
                  style={{ color: "var(--outline)" }}>
              apps
            </span>
            <span className="text-[11px]" style={{ color: "var(--outline)" }}>
              {module.subApps.length} screen{module.subApps.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </Link>
        );
      })()}
    </motion.div>
  );
}
