"use client";

import { useEffect, useState } from "react";

interface ModuleKpiDisplayProps {
  moduleSlug: string;
  defaultLabel: string;
  defaultValue: string;
  defaultTrend: string;
}

export function ModuleKpiDisplay({
  moduleSlug,
  defaultLabel,
  defaultValue,
  defaultTrend,
}: ModuleKpiDisplayProps) {
  const [kpiValue, setKpiValue] = useState(defaultValue);
  const [kpiTrend, setKpiTrend] = useState(defaultTrend);

  useEffect(() => {
    function syncLiveCounts() {
      if (moduleSlug === "beneficiaries") {
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

      if (moduleSlug === "donors") {
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

      if (moduleSlug === "programs") {
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
  }, [moduleSlug]);

  return (
    <div>
      <p
        className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
        style={{ color: "var(--outline)" }}
      >
        {defaultLabel}
      </p>
      <div className="flex items-baseline gap-2">
        <span
          className="text-[24px] font-extrabold leading-none"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: "var(--on-surface)",
          }}
        >
          {kpiValue}
        </span>
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{
            color: "var(--on-secondary-container)",
            background: "var(--secondary-container)",
          }}
        >
          {kpiTrend}
        </span>
      </div>
    </div>
  );
}
