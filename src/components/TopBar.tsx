"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MODULES } from "@/lib/modules";
import { CredentialsModal } from "./CredentialsModal";
import { getUser, logout, type AuthUser } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";

interface TopBarProps {
  onMenuClick: () => void;
}

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [
    { label: "Hub", href: "/" },
  ];

  if (segments[0]) {
    const mod = MODULES.find((m) => m.slug === segments[0]);
    if (mod) {
      crumbs.push({ label: mod.shortLabel, href: `/${mod.slug}` });
    }
  }

  if (segments[1]) {
    const mod = MODULES.find((m) => m.slug === segments[0]);
    const sub = mod?.subApps.find((s) => s.id === segments[1]);
    if (sub) {
      crumbs.push({ label: sub.label.replace(" (Admin Only)", ""), href: `/${segments[0]}/${segments[1]}` });
    }
  }

  return crumbs;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = buildBreadcrumbs(pathname);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [credsOpen, setCredsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(3);
  const [docNotifs, setDocNotifs] = useState<any[]>([]);
  const [accessNotifs, setAccessNotifs] = useState<any[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (u) {
      const headers: Record<string, string> = {
        "x-bcf-user-role": u.role || "",
        "x-bcf-username": u.username || "",
        "x-bcf-email": u.email || "",
      };
      fetch("/api/documents/notifications", { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.notifications) {
            setDocNotifs(data.notifications.slice(0, 3));
          }
        })
        .catch(() => {});

      fetch("/api/access/notifications", { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.notifications) {
            setAccessNotifs(data.notifications.slice(0, 5));
            if (data.unreadCount !== undefined) {
              setUnreadNotifs((prev) => prev + data.unreadCount);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) {
        setNotifsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    logout();
    router.replace("/login");
  };

  const [accessDeniedMsg, setAccessDeniedMsg] = useState<string | null>(null);

  useEffect(() => {
    const msg = typeof window !== "undefined" ? sessionStorage.getItem("bcf_access_denied_msg") : null;
    if (msg) {
      setAccessDeniedMsg(msg);
      sessionStorage.removeItem("bcf_access_denied_msg");
      const timer = setTimeout(() => setAccessDeniedMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <>
      {accessDeniedMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-rose-700 text-white font-bold text-xs shadow-xl border border-rose-500 animate-bounce">
          <span className="material-symbols-outlined text-[18px]">lock</span>
          <span>{accessDeniedMsg}</span>
          <button onClick={() => setAccessDeniedMsg(null)} className="ml-2 hover:opacity-80 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Layer 1: Global Top Bar (one only, fixed at top) */}
      <header
        id="global-top-bar"
        className="fixed top-0 left-0 right-0 z-30 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-3 sm:px-5 gap-3 lg:pl-[256px] transition-colors"
      >
        {/* Left: Mobile hamburger menu toggle */}
        <button
          id="mobile-sidebar-toggle"
          onClick={onMenuClick}
          aria-label="Toggle navigation menu"
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        {/* Left: BCF Logo & Organisation Short Name */}
        <Link
          href="/"
          id="topbar-logo-link"
          className="flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0"
        >
          <img
            src="/bcf-logo.jpg"
            alt="BCF-SL Logo"
            className="h-7 w-auto object-contain rounded"
          />
          <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
            BCF-SL
          </span>
        </Link>

        {/* Subtle vertical separator */}
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0 hidden sm:block" />

        {/* Centre / Left: ONE Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          {/* Desktop & Tablet full breadcrumb trail */}
          <div className="hidden sm:flex items-center gap-1 min-w-0 flex-1 text-xs">
            {crumbs.map((crumb, idx) => {
              const isLast = idx === crumbs.length - 1;
              return (
                <span key={`${crumb.href}-${idx}`} className="flex items-center gap-1 min-w-0">
                  {idx > 0 && (
                    <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">
                      chevron_right
                    </span>
                  )}
                  {isLast ? (
                    <span
                      className="font-bold text-slate-900 dark:text-white truncate"
                      aria-current="page"
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </div>

          {/* Phone responsive breadcrumb (Parent link > Current page text) */}
          <div className="flex sm:hidden items-center gap-1 min-w-0 flex-1 text-xs">
            {crumbs.length > 1 ? (
              <>
                <Link
                  href={crumbs[crumbs.length - 2].href}
                  className="font-medium text-slate-500 dark:text-slate-400 truncate max-w-[100px]"
                >
                  {crumbs[crumbs.length - 2].label}
                </Link>
                <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">
                  chevron_right
                </span>
                <span className="font-bold text-slate-900 dark:text-white truncate" aria-current="page">
                  {crumbs[crumbs.length - 1].label}
                </span>
              </>
            ) : (
              <span className="font-bold text-slate-900 dark:text-white truncate" aria-current="page">
                Hub
              </span>
            )}
          </div>
        </nav>

        {/* Right: Theme Toggle, Notifications bell & User avatar menu */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
          {/* Theme Mode Toggle (Accessible on all devices) */}
          <div className="shrink-0 flex items-center">
            <ThemeToggle />
          </div>

          {/* Notification bell & Dropdown */}
          <div className="relative" ref={notifsRef}>
            <button
              id="notifications-btn"
              onClick={() => {
                setNotifsOpen((o) => !o);
                setUserMenuOpen(false);
              }}
              aria-label="Notifications"
              className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadNotifs > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </button>

            {notifsOpen && (
              <div
                className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 flex flex-col gap-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">Institutional Alerts</span>
                    {unreadNotifs > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        {unreadNotifs} new
                      </span>
                    )}
                  </div>
                  {unreadNotifs > 0 && (
                    <button
                      type="button"
                      onClick={() => setUnreadNotifs(0)}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">verified</span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white text-[11px]">System Status: All Services Live</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Database synchronization and institutional API gateways operational across all 10 modules.
                      </p>
                      <span className="text-[9px] font-mono text-slate-400 mt-1 block">Just now</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-blue-600 text-[18px] shrink-0 mt-0.5">school</span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white text-[11px]">Learning Portal Enrollment Active</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Semester 1, 2027 enrollment open for all accredited Coursera, Udemy, and Microsoft courses.
                      </p>
                      <span className="text-[9px] font-mono text-slate-400 mt-1 block">1 hour ago</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">account_balance_wallet</span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white text-[11px]">Automated Loan Eligibility Online</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Staff loan policy duration calculator synced with the central employee registry.
                      </p>
                      <span className="text-[9px] font-mono text-slate-400 mt-1 block">Today</span>
                    </div>
                  </div>

                  {accessNotifs.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                          Access Control Alerts
                        </span>
                        <Link
                          href="/access/notifications"
                          onClick={() => setNotifsOpen(false)}
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                        >
                          View all
                        </Link>
                      </div>
                      {accessNotifs.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            setNotifsOpen(false);
                            if (user) {
                              fetch("/api/access/notifications", {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  "x-bcf-user-role": user.role || "",
                                  "x-bcf-username": user.username || "",
                                  "x-bcf-email": user.email || "",
                                },
                                body: JSON.stringify({ notificationId: n.id }),
                              }).catch(() => {});
                            }
                            if (n.title.includes("Action Required")) {
                              router.push(`/access/access-approval?req=${n.requestNumber}`);
                            } else {
                              router.push(`/access/my-requests?req=${n.requestNumber}`);
                            }
                          }}
                          className={`p-2 mb-1.5 rounded-xl border flex items-start gap-2 cursor-pointer transition ${
                            !n.isRead
                              ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[16px] shrink-0 mt-0.5">
                            vpn_key
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-[11px] truncate">
                              {n.title}
                            </p>
                            <p className="text-[10px] text-slate-600 dark:text-slate-300 line-clamp-2">
                              {n.message}
                            </p>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">
                              {n.requestNumber} · {new Date(n.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {docNotifs.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                        Documents &amp; Policies Alerts
                      </span>
                      {docNotifs.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            setNotifsOpen(false);
                            router.push(`/documents-policies/${n.tab}`);
                          }}
                          className="p-2 mb-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/80 transition"
                        >
                          <span className="material-symbols-outlined text-blue-600 text-[16px] shrink-0 mt-0.5">
                            {n.action === "Added" ? "upload_file" : "delete"}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-[11px] truncate">
                              {n.action}: {n.itemTitle}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              {n.tab} · By {n.actorName}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">BCF-SL Security Monitor</span>
                  <button
                    type="button"
                    onClick={() => setNotifsOpen(false)}
                    className="font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Avatar & Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              id="user-avatar-btn"
              onClick={() => setUserMenuOpen((o) => !o)}
              suppressHydrationWarning
              aria-label={`User profile: ${user?.name ?? "Administrator"}`}
              title={`${user?.name ?? "Administrator"} · ${user?.role ?? "Super Admin"}`}
              className="w-9 h-9 rounded-full ring-2 ring-slate-200 dark:ring-slate-700
                         transition-transform hover:scale-105 shrink-0 flex items-center justify-center
                         text-white text-[12px] font-bold cursor-pointer"
              style={{ background: "linear-gradient(135deg, #7B2FBE, #15803d)" }}
            >
              {user?.initials ?? "SA"}
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-64 max-w-xs bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                {/* User Info */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {user?.name ?? "Albert Joseph Bandama"}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user?.email ?? "admin@bcf-sl.org"}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                      {user?.role ?? "Super Admin"}
                    </span>
                    {user?.department && (
                      <span className="text-[10px] text-slate-400 truncate">
                        {user.department}
                      </span>
                    )}
                  </div>
                </div>

                {/* View System Credentials */}
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    setCredsOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium text-slate-700 dark:text-slate-200 cursor-pointer text-left"
                >
                  <span className="material-symbols-outlined text-[18px] text-indigo-600 dark:text-indigo-400">
                    key
                  </span>
                  <span>View System Credentials</span>
                </button>

                {/* Sign Out */}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition font-semibold cursor-pointer border-t border-slate-100 dark:border-slate-800 pt-2 text-left"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    logout
                  </span>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Credentials Modal */}
      <CredentialsModal
        isOpen={credsOpen}
        onClose={() => setCredsOpen(false)}
      />
    </>
  );
}
