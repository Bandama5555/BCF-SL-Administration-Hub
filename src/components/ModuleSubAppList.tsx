"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, type AuthUser } from "@/lib/auth";
import { normalizeRole, getAccessibleSubApps, hasModuleAccess } from "@/lib/permissions";
import { SubAppCard } from "./SubAppCard";
import { type Module } from "@/lib/modules";

interface Props {
  module: Module;
}

export function ModuleSubAppList({ module }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setMounted(true);
  }, []);

  const roleCode = normalizeRole(user?.role, user?.username, user?.email, user?.department, user?.position);

  // User permission level
  const subApps = getAccessibleSubApps(roleCode, module.slug);

  if (mounted && subApps.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
        <span className="material-symbols-outlined text-amber-600 text-3xl mb-2">lock</span>
        <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm">Access Restricted</h3>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
          You do not have access to that page.
        </p>
      </div>
    );
  }

  return (
    <section aria-label={`${module.label} screens`}>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-[15px] font-bold"
          style={{ color: "var(--on-surface)" }}
        >
          Available Screens & Tools
        </h2>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
          {subApps.length} screen{subApps.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {subApps.map((sub, i) => (
          <SubAppCard key={sub.id} module={module} subApp={sub} index={i} />
        ))}
      </div>
    </section>
  );
}
