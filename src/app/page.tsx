import type { Metadata } from "next";
import { MODULES } from "@/lib/modules";
import { AppLayout } from "@/components/AppLayout";
import { DashboardModuleGrid } from "@/components/DashboardModuleGrid";

export const metadata: Metadata = {
  title: "BCF-SL Administration Hub",
  description:
    "Unified dashboard for all BCF-SL administration modules: employees, donors, finance, loans, procurement, programs, and more.",
};

export default function DashboardPage() {
  const totalSubApps = MODULES.reduce((sum, m) => sum + m.subApps.length, 0);

  return (
    <AppLayout
      title="BCF-SL Administration Hub"
      subtitle="Unified command centre for Bandama Charity Foundation Sierra Leone."
    >
      <div className="px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Quick Institutional Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          {[
            { icon: "apps", label: "Modules", value: MODULES.length },
            { icon: "open_in_new", label: "App Screens", value: totalSubApps },
            { icon: "location_on", label: "Location", value: "Freetown, SL" },
            { icon: "verified", label: "System Status", value: "All Systems Live" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2.5 min-w-0">
              <span className="material-symbols-outlined text-slate-500 text-[20px] shrink-0">
                {stat.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate leading-none">
                  {stat.label}
                </p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* RBAC-filtered module cards grid */}
        <DashboardModuleGrid />
      </div>
    </AppLayout>
  );
}
