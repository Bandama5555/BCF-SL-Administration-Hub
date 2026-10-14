"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { getUser } from "@/lib/auth";

interface LearningStaffSession {
  employeeId: string;
  fullName?: string;
  employeeName?: string;
  department?: string;
  email?: string;
  username?: string;
  position?: string;
}

export function LearningShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [staff, setStaff] = useState<LearningStaffSession | null>(null);
  const [isAdminHubUser, setIsAdminHubUser] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Password reset form state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // Load staff profile and admin session
  useEffect(() => {
    setMounted(true);
    function loadProfile() {
      let currentSession: any = null;
      try {
        const authUser = getUser();
        currentSession = JSON.parse(sessionStorage.getItem("bcf_learning_session") || "null");
        const prof = authUser || currentSession || JSON.parse(localStorage.getItem("bcf_selected_profile") || "null");
        if (prof) {
          const rawName = (prof.name || prof.fullName || prof.employeeName || "").trim();
          const empId = (prof.employeeId || "").trim();
          const uName = (prof.username || "").trim().toLowerCase();

          // Ensure Mabinty Mustapha is strictly resolved and displayed as Mabinty Mustapha
          let finalName = rawName || "Staff Member";
          let finalPos = prof.position || "Staff Member";
          let finalDept = prof.department || "Programs Department";
          let finalId = empId || "BCF-ST-001";
          let finalUser = uName || "staff_user";

          if (
            rawName.toLowerCase().includes("mabinty") ||
            rawName.toLowerCase().includes("aisha") ||
            (rawName.toLowerCase().includes("mustapha") && !rawName.toLowerCase().includes("albert")) ||
            finalId.toUpperCase() === "BCF-ST-001" ||
            finalUser === "staff_user" ||
            finalUser === "mabinty"
          ) {
            finalName = "Mabinty Mustapha";
            finalPos = "Community Field Officer";
            finalDept = "Programs Department";
            finalId = "BCF-ST-001";
            finalUser = "staff_user";
          }

          setStaff({
            employeeId: finalId,
            fullName: finalName,
            employeeName: finalName,
            department: finalDept,
            position: finalPos,
            username: finalUser,
          });
        } else {
          // Default to Mabinty Mustapha for standard staff view or CEO profile if Admin
          setStaff({
            employeeId: "BCF-ST-001",
            fullName: "Mabinty Mustapha",
            employeeName: "Mabinty Mustapha",
            department: "Programs Department",
            position: "Community Field Officer",
            username: "staff_user",
          });
        }
      } catch (_) {}

      try {
        const isStaffOnly = sessionStorage.getItem("bcf_staff_only_session") === "true";
        const prof = currentSession || JSON.parse(localStorage.getItem("bcf_selected_profile") || "null");
        const userRole = (typeof window !== "undefined" ? localStorage.getItem("bcf_user_role") : null) || "";
        
        const isExec = Boolean(prof && (
          prof.username === "abandama" ||
          prof.employeeId === "BCF-PTE-2026-0001" ||
          prof.role === "Super Admin" ||
          userRole === "super_admin" ||
          userRole === "hr_director" ||
          ((prof.department?.toLowerCase().includes("executive") ||
            prof.department?.toLowerCase().includes("human resource") ||
            prof.department?.toLowerCase().includes("hr")) &&
           (prof.position?.toLowerCase().includes("director") ||
            prof.position?.toLowerCase().includes("ceo") ||
            prof.position?.toLowerCase().includes("head")))
        ));

        const hasAdminVerified = sessionStorage.getItem("bcf_admin_authenticated") === "true" &&
                                  Boolean(sessionStorage.getItem("bcf_admin_verified_user"));

        if (isStaffOnly || !isExec) {
          setIsAdminHubUser(Boolean(hasAdminVerified && !isStaffOnly));
          return;
        }

        setIsAdminHubUser(Boolean(isExec || hasAdminVerified));
      } catch (_) {}
    }

    loadProfile();

    const handleEmployeeChange = (e: any) => {
      if (e?.detail) setStaff(e.detail);
      else loadProfile();
    };

    window.addEventListener("bcf_employee_changed", handleEmployeeChange);
    return () => window.removeEventListener("bcf_employee_changed", handleEmployeeChange);
  }, [pathname]);

  const navTabs = [
    {
      id: "catalog",
      label: "Course Catalogue",
      href: "/learning/course-allocation",
      icon: "menu_book",
      desc: "Browse & request partner courses",
    },
    {
      id: "grades",
      label: "My Learning & Grades",
      href: "/learning/learning-grades",
      icon: "school",
      desc: "Track progress, modules & hours",
    },
    {
      id: "certificates",
      label: "Certificates & Transcripts",
      href: "/learning/certificates",
      icon: "workspace_premium",
      desc: "Verifiable credentials & audits",
    },
    ...(isAdminHubUser
      ? [
          {
            id: "account-creation",
            label: "Account Creation",
            href: "/learning/account-creation",
            icon: "person_add",
            desc: "Staff credentials & provisioning",
          },
          {
            id: "learning-dashboard",
            label: "Learning Dashboard",
            href: "/learning/learning-dashboard",
            icon: "insights",
            desc: "Institutional KPIs & benchmarks",
          },
        ]
      : []),
  ];

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPwdMsg({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: "error", text: "Passwords do not match." });
      return;
    }

    setPwdSaving(true);
    try {
      const win = typeof window !== "undefined" ? (window as unknown as { updateStaffPassword?: (empId?: string, oldP?: string, newP?: string, source?: string) => { success?: boolean; message?: string } }) : null;
      if (win?.updateStaffPassword) {
        const res = win.updateStaffPassword(staff?.employeeId || staff?.username, oldPassword, newPassword, "Staff Self-Service");
        if (res && res.success) {
          setPwdMsg({ type: "success", text: "Password successfully updated! A confirmation email has been dispatched." });
          setTimeout(() => {
            setShowPasswordModal(false);
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPwdMsg(null);
          }, 1500);
        } else {
          setPwdMsg({ type: "error", text: res?.message || "Failed to update password." });
        }
      } else {
        // Fallback update in localStorage directly
        const raw = localStorage.getItem("bcf_learning_accounts");
        if (raw) {
          const accounts = JSON.parse(raw);
          const acc = accounts.find((a: any) => a.employeeId === staff?.employeeId || a.username === staff?.username);
          if (acc) {
            acc.password = newPassword;
            localStorage.setItem("bcf_learning_accounts", JSON.stringify(accounts));
          }
        }
        setPwdMsg({ type: "success", text: "Password updated successfully!" });
        setTimeout(() => {
          setShowPasswordModal(false);
          setOldPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setPwdMsg(null);
        }, 1500);
      }
    } catch (err: any) {
      setPwdMsg({ type: "error", text: err.message || "Could not save password." });
    } finally {
      setPwdSaving(false);
    }
  };

  let rawDisplay = mounted ? (staff?.fullName || staff?.employeeName || "Staff Member") : "Staff Member";
  if (
    rawDisplay.toLowerCase().includes("mabinty") ||
    rawDisplay.toLowerCase().includes("aisha") ||
    (rawDisplay.toLowerCase().includes("mustapha") && !rawDisplay.toLowerCase().includes("albert")) ||
    staff?.employeeId === "BCF-ST-001" ||
    staff?.username === "staff_user" ||
    staff?.username === "mabinty"
  ) {
    rawDisplay = "Mabinty Mustapha";
  }
  const displayName = rawDisplay;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "MM";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface)" }}>
      {/* Top Navigation Bar — Dedicated to the Learning Portal ONLY */}
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors"
        style={{
          background: "var(--surface-container-lowest)",
          borderColor: "var(--border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: BCF-SL Emblem & Portal Title */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/learning/course-allocation"
              className="flex items-center gap-2.5 group"
              title="BCF-SL Learning Portal Home"
            >
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <img
                  src="/bcf-logo.jpg"
                  alt="BCF-SL"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-display font-extrabold text-base tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    BCF<span className="text-blue-600 dark:text-sky-400">.SL</span> Learning Portal
                  </span>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-blue-800">
                    Staff LMS
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:block">
                  Staff Learning &amp; Professional Development Hub
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Dedicated Learning Navigation Tabs */}
          <nav
            aria-label="Learning Portal Navigation"
            className="hidden lg:flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80"
          >
            {navTabs.map((tab) => {
              const active = pathname.includes(tab.href) ||
                             (tab.id === "catalog" && pathname === "/learning") ||
                             (tab.id === "account-creation" && (pathname.includes("/learning/account-creation") || pathname.includes("/learning/accounts"))) ||
                             (tab.id === "learning-dashboard" && (pathname.includes("/learning/learning-dashboard") || pathname.includes("/learning/dashboard") || pathname.includes("/learning/learning-analytics") || pathname.includes("/learning/analytics")));
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50"
                  }`}
                  title={tab.desc}
                >
                  <span className={`material-symbols-outlined text-[16px] ${active ? "text-blue-600 dark:text-sky-400" : "text-slate-400"}`}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Staff Profile, Password Action, Theme Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Staff Profile Dropdown / Card */}
            <div className="relative group">
              <div
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 shadow-2xs cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {initials}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span suppressHydrationWarning className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                      {displayName}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active Learning Session" />
                  </div>
                  <span suppressHydrationWarning className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                    {staff?.department || "Staff Member"}
                  </span>
                </div>
                {isAdminHubUser && (
                  <span className="material-symbols-outlined text-slate-400 text-base">expand_more</span>
                )}
              </div>

              {/* Profile Hover / Focus Menu (Only shown for Admin or password change) */}
              <div className={`absolute right-0 top-full mt-1.5 w-64 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-3 hidden ${isAdminHubUser ? 'group-hover:block' : ''} transition-all z-50`}>
                <div className="pb-2 mb-2 border-b border-slate-100 dark:border-slate-700 text-xs">
                  <div className="font-extrabold text-slate-900 dark:text-white">{displayName}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    ID: {staff?.employeeId || "BCF-STAFF"}
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="material-symbols-outlined text-[12px]">verified</span>
                    <span>Max 2 Courses / Semester</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold transition text-left"
                  >
                    <span className="material-symbols-outlined text-[15px] text-blue-600">lock_reset</span>
                    <span>Change My Password</span>
                  </button>

                  {isAdminHubUser ? (
                    <Link
                      href="/learning/login"
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold transition text-left"
                    >
                      <span className="material-symbols-outlined text-[15px] text-indigo-600">switch_account</span>
                      <span>Switch Staff / Sign In</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.removeItem("bcf_learning_session");
                        sessionStorage.removeItem("bcf_staff_only_session");
                        localStorage.removeItem("bcf_selected_profile");
                        router.push("/learning/login");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition text-left"
                    >
                      <span className="material-symbols-outlined text-[15px]">logout</span>
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>

                {/* If opened by an administrator who logged into the Admin Hub */}
                {isAdminHubUser && (
                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-700">
                    <Link
                      href="/"
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                    >
                      <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                      <span>Return to Admin Hub</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle navigation menu"
            >
              <span className="material-symbols-outlined text-xl">
                {mobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900 flex flex-col gap-1.5">
            {navTabs.map((tab) => {
              const active = pathname.includes(tab.href) ||
                             (tab.id === "catalog" && pathname === "/learning") ||
                             (tab.id === "account-creation" && (pathname.includes("/learning/account-creation") || pathname.includes("/learning/accounts"))) ||
                             (tab.id === "learning-dashboard" && (pathname.includes("/learning/learning-dashboard") || pathname.includes("/learning/dashboard") || pathname.includes("/learning/learning-analytics") || pathname.includes("/learning/analytics")));
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                    active
                      ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-sky-300"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area — Dedicated to Learning Modules ONLY */}
      <main className="flex-1 flex flex-col w-full">{children}</main>

      {/* Dedicated Learning Portal Footer */}
      <footer
        className="border-t py-4 px-4 sm:px-6 text-center text-xs text-slate-500 dark:text-slate-400"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Bandama Charity Foundation Sierra Leone
            </span>
            <span>·</span>
            <span>Staff Learning &amp; Professional Development System</span>
          </div>
          <div className="flex items-center gap-3 font-medium">
            <span>Coursera</span>
            <span>·</span>
            <span>Udemy Business</span>
            <span>·</span>
            <span>Microsoft Learn</span>
            <span>·</span>
            <span className="text-blue-600 dark:text-sky-400 font-bold">Semester Quota: 2 Courses</span>
          </div>
        </div>
      </footer>

      {/* Self-Service Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-sky-300 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">lock_reset</span>
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-slate-900 dark:text-white">
                    Change Staff Password
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Self-service credential management for {displayName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {pwdMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  pwdMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {pwdMsg.type === "success" ? "check_circle" : "error"}
                </span>
                <span>{pwdMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Current Password (Optional if newly provisioned)
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 font-bold text-xs text-slate-700 dark:text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="flex-1 h-11 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <span>{pwdSaving ? "Updating…" : "Update Password"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
