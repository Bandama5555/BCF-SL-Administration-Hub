"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout, getUser, type AuthUser } from "@/lib/auth";
import { normalizeRole, getAccessibleModules, getAccessibleSubApps } from "@/lib/permissions";
import { MODULES, type Module, type SubApp } from "@/lib/modules";
import { CredentialsModal } from "./CredentialsModal";
import clsx from "clsx";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [credsOpen, setCredsOpen] = useState(false);
  const [userToggledModules, setUserToggledModules] = useState<Record<string, boolean>>({});
  const [grantsVersion, setGrantsVersion] = useState(0);

  useEffect(() => {
    setUser(getUser());
  }, []);

  // Fetch active user grants from server and keep sidebar tabs synchronized
  const fetchUserGrants = () => {
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
              .filter((g: any) => {
                if (g.status !== "Active") return false;
                const matchesEmail = email && g.userEmail && g.userEmail.toLowerCase() === email.toLowerCase();
                const matchesEmpId = user.employeeId && (g.staffId === user.employeeId || g.userId === user.employeeId);
                return matchesEmail || matchesEmpId;
              })
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
  };

  useEffect(() => {
    fetchUserGrants();
  }, [user]);

  // Listen for grant updates across tabs and windows
  useEffect(() => {
    const handleGrantsUpdated = () => {
      fetchUserGrants();
    };
    window.addEventListener("bcf_grants_updated", handleGrantsUpdated);
    window.addEventListener("storage", handleGrantsUpdated);
    return () => {
      window.removeEventListener("bcf_grants_updated", handleGrantsUpdated);
      window.removeEventListener("storage", handleGrantsUpdated);
    };
  }, [user]);

  const roleCode = normalizeRole(user?.role, user?.username, user?.email, user?.department, user?.position);
  const displayModules = useMemo(() => {
    return getAccessibleModules(roleCode);
  }, [roleCode, grantsVersion]);

  const toggleModule = (slug: string, currentExpanded: boolean) => {
    setUserToggledModules((prev) => ({
      ...prev,
      [slug]: !currentExpanded,
    }));
  };

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-xs"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Layer 2: Left Sidebar (one only) */}
      <aside
        id="main-sidebar"
        role="navigation"
        aria-label="Navigation sidebar"
        className={clsx(
          "fixed top-0 left-0 z-50 h-full flex flex-col",
          "w-[256px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800",
          "transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        {/* Sidebar Header: BCF Logo + org name + mobile close button */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <img
              src="/bcf-logo.jpg"
              alt="BCF-SL"
              className="h-8 w-auto object-contain rounded"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white leading-none">
                BCF-SL
              </span>
              <span className="text-[10px] text-slate-400 font-medium leading-tight">
                Administration Hub
              </span>
            </div>
          </Link>

          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation list */}
        <div
          className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 touch-pan-y overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Dashboard Home Link */}
          <Link
            href="/"
            onClick={onClose}
            id="nav-hub-home"
            className={clsx(
              "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all",
              pathname === "/"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            <span>Dashboard Hub</span>
          </Link>

          <div className="pt-2 pb-1 px-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Modules &amp; Pages
            </span>
          </div>

          {/* Collapsible Module Groups */}
          {displayModules.map((mod) => {
            const isModuleActive = pathname.startsWith(`/${mod.slug}`);
            const isExpanded = userToggledModules[mod.slug] !== undefined
              ? userToggledModules[mod.slug]
              : isModuleActive;
            const subApps = getAccessibleSubApps(roleCode, mod.slug);
            const displaySubApps: SubApp[] = subApps;

            return (
              <div key={mod.id} className="rounded-xl overflow-hidden">
                <div
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left",
                    isModuleActive
                      ? "text-slate-900 dark:text-white bg-slate-100/80 dark:bg-slate-800/60"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setUserToggledModules((prev) => ({ ...prev, [mod.slug]: true }));
                      const targetSub = displaySubApps[0];
                      if (targetSub) {
                        router.push(`/${mod.slug}/${targetSub.id}`);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <span className="material-symbols-outlined text-[18px] text-slate-500 shrink-0">
                      {mod.icon}
                    </span>
                    <span className="truncate">{mod.shortLabel}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleModule(mod.slug, isExpanded);
                    }}
                    aria-label={`Toggle ${mod.shortLabel} submenu`}
                    className="flex items-center gap-1 shrink-0 ml-1 p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <span className="text-[10px] text-slate-400 font-mono">
                      {displaySubApps.length}
                    </span>
                    <span
                      className={clsx(
                        "material-symbols-outlined text-[16px] text-slate-400 transition-transform duration-200",
                        isExpanded ? "rotate-180" : "rotate-0"
                      )}
                    >
                      expand_more
                    </span>
                  </button>
                </div>

                {/* Sub-pages under this module */}
                {isExpanded && displaySubApps.length > 0 && (
                  <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-slate-200/80 dark:border-slate-800 ml-4 my-0.5">
                    {displaySubApps.map((sub, sIdx) => {
                      const isPageActive =
                        pathname === `/${mod.slug}/${sub.id}` ||
                        (pathname === `/${mod.slug}` && sIdx === 0);
                      return (
                        <Link
                          key={sub.id}
                          href={`/${mod.slug}/${sub.id}`}
                          onClick={onClose}
                          id={`nav-${mod.slug}-${sub.id}`}
                          className={clsx(
                            "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all",
                            isPageActive
                              ? "bg-emerald-600 text-white font-bold shadow-2xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                          aria-current={isPageActive ? "page" : undefined}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-[15px] shrink-0 opacity-80">
                              {sub.icon}
                            </span>
                            <span className="truncate">{sub.label.replace(" (Admin Only)", "")}</span>
                          </div>

                          {sub.adminOnly && (
                            <span
                              className={clsx(
                                "text-[9px] px-1 py-0.2 rounded font-extrabold uppercase shrink-0",
                                isPageActive
                                  ? "bg-white/20 text-white"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              )}
                            >
                              Admin
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: System Credentials & Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-1 bg-slate-50/60 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={() => setCredsOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400">
              key
            </span>
            <span>System Credentials</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Global Credentials Modal */}
      <CredentialsModal
        isOpen={credsOpen}
        onClose={() => setCredsOpen(false)}
      />
    </>
  );
}
