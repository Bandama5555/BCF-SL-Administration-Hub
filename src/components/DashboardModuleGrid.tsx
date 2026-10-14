"use client";

import { useEffect, useState, useMemo } from "react";
import { getUser, type AuthUser } from "@/lib/auth";
import { normalizeRole, getAccessibleModules, ROLE_DEFINITIONS } from "@/lib/permissions";
import { ModuleCard } from "./ModuleCard";
import { MODULES, type Module } from "@/lib/modules";

export function DashboardModuleGrid() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [grantsVersion, setGrantsVersion] = useState(0);

  useEffect(() => {
    setUser(getUser());
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleGrantsUpdated = () => setGrantsVersion((v) => v + 1);
    window.addEventListener("bcf_grants_updated", handleGrantsUpdated);
    window.addEventListener("storage", handleGrantsUpdated);
    return () => {
      window.removeEventListener("bcf_grants_updated", handleGrantsUpdated);
      window.removeEventListener("storage", handleGrantsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const email = user.email || "";
    fetch(`/api/access/grants?userOnly=true&email=${encodeURIComponent(email)}&staffId=${encodeURIComponent(user.employeeId || "")}`, {
      headers: {
        "x-bcf-email": email,
        "x-bcf-user-role": user.role || "",
        "x-bcf-username": user.username || "",
        "x-bcf-employee-id": user.employeeId || "",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (Array.isArray(data.grants)) {
            const activeUserGrants = data.grants
              .filter((g: any) => g.status === "Active")
              .map((g: any) => ({
                moduleSlug: g.moduleSlug,
                tabId: g.tabId,
                rights: g.rightsGranted,
              }));
            sessionStorage.setItem("bcf_user_grants", JSON.stringify(activeUserGrants));
            localStorage.setItem("bcf_user_grants", JSON.stringify(activeUserGrants));
          }
          if (Array.isArray(data.revocations)) {
            const activeRevocations = data.revocations.map((r: any) => ({
              moduleSlug: r.moduleSlug || r.module,
              tabId: r.tabId,
              scope: r.scope,
            }));
            sessionStorage.setItem("bcf_user_revocations", JSON.stringify(activeRevocations));
            localStorage.setItem("bcf_user_revocations", JSON.stringify(activeRevocations));
          }
          setGrantsVersion((v) => v + 1);
        }
      })
      .catch(() => {});
  }, [user]);

  const roleCode = normalizeRole(user?.role, user?.username, user?.email, user?.department, user?.position);
  const roleInfo = ROLE_DEFINITIONS[roleCode];

  // Strictly authorized modules for this role (dynamically updated with active grants)
  const modules: Module[] = useMemo(() => {
    return getAccessibleModules(roleCode);
  }, [roleCode, grantsVersion]);

  return (
    <section aria-label="Administration Modules">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2
            className="text-[17px] sm:text-[18px] font-bold flex flex-wrap items-center gap-2"
            style={{ color: "var(--on-surface)" }}
          >
            <span>Authorized Administration Modules</span>
            {mounted && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black tracking-wide uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                {roleInfo.name} ({roleCode})
              </span>
            )}
          </h2>
          <p className="text-xs text-[var(--on-surface-variant)] mt-1">
            Role-Based Access: Displaying only the {modules.length} modules and pages authorized for your credentials.
          </p>
        </div>

        <span
          className="text-[12px] font-bold px-3 py-1 rounded-full self-start sm:self-auto"
          style={{
            color: "var(--on-surface-variant)",
            background: "var(--surface-container)",
          }}
        >
          {modules.length} active module{modules.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((mod, i) => (
          <ModuleCard key={mod.id} module={mod} index={i} roleCode={roleCode} />
        ))}
      </div>
    </section>
  );
}
