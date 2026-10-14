"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { normalizeRole } from "@/lib/permissions";

interface AdminAuthGuardProps {
  children: React.ReactNode;
  moduleSlug: string;
  subAppId: string;
  subAppLabel: string;
  adminOnly?: boolean;
}

export function AdminAuthGuard({
  children,
  moduleSlug,
  subAppId,
  subAppLabel,
  adminOnly = false,
}: AdminAuthGuardProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!adminOnly);
  const [isChecking, setIsChecking] = useState<boolean>(adminOnly);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStaff, setActiveStaff] = useState<{
    name: string;
    position: string;
    department: string;
  } | null>(null);

  useEffect(() => {
    if (!adminOnly) {
      setIsAuthenticated(true);
      setIsChecking(false);
      return;
    }

    try {
      const hubUser = getUser();
      const learningSess = JSON.parse(sessionStorage.getItem("bcf_learning_session") || "null");
      const activeProf = JSON.parse(localStorage.getItem("bcf_selected_profile") || "null");
      const activeUser = hubUser || learningSess || activeProf;

      const isStaffOnly = sessionStorage.getItem("bcf_staff_only_session") === "true";
      const hasAdminAuth = sessionStorage.getItem("bcf_admin_authenticated") === "true";
      const verifiedAdmin = sessionStorage.getItem("bcf_admin_verified_user");

      // 1. Check main Hub authenticated session: Super Admin, CEO, HR, IT directors have automatic full access
      if (hubUser && !isStaffOnly) {
        const roleCode = normalizeRole(hubUser.role, hubUser.username, hubUser.email);
        if (roleCode === "SA" || roleCode === "CEO" || roleCode === "HR" || roleCode === "IT") {
          setActiveStaff({
            name: hubUser.name || "Albert Joseph Bandama",
            position: hubUser.position || "Super Administrator",
            department: hubUser.department || "Executive Management",
          });
          setIsAuthenticated(true);
          setIsChecking(false);
          return;
        }
      }

      if (activeUser) {
        setActiveStaff({
          name: activeUser.fullName || activeUser.employeeName || activeUser.username || "Staff Member",
          position: activeUser.position || "Staff",
          department: activeUser.department || "General",
        });

        const uName = (activeUser.username || "").toLowerCase();
        const uEmail = (activeUser.email || "").toLowerCase();
        const uEmp = (activeUser.employeeId || "").toLowerCase();

        const isSuperAdmin =
          uName === "abandama" ||
          uName === "admin" ||
          uEmail === "admin@bcfsl.org" ||
          uEmail === "admin@bcf-sl.org" ||
          uEmp === "bcf-pte-2026-0001";
        
        const isHRDirector =
          (activeUser.department?.toLowerCase().includes("executive") ||
           activeUser.department?.toLowerCase().includes("human resource") ||
           activeUser.department?.toLowerCase().includes("hr")) &&
          (activeUser.position?.toLowerCase().includes("director") ||
           activeUser.position?.toLowerCase().includes("ceo") ||
           activeUser.position?.toLowerCase().includes("head"));

        // If the logged-in user is genuinely CEO or HR Director and not in restricted staff mode:
        if ((isSuperAdmin || isHRDirector) && !isStaffOnly) {
          setIsAuthenticated(true);
          setIsChecking(false);
          return;
        }

        // If regular staff, they are ONLY allowed if verified by an explicit admin credential prompt
        if (hasAdminAuth && verifiedAdmin && !isStaffOnly) {
          setIsAuthenticated(true);
          setIsChecking(false);
          return;
        }
      } else {
        // No user profile logged in: check if admin verified
        if (hasAdminAuth && verifiedAdmin && !isStaffOnly) {
          setIsAuthenticated(true);
          setIsChecking(false);
          return;
        }
      }
    } catch (_) {}

    // Regular staff must provide administrator credentials:
    setIsAuthenticated(false);
    setIsChecking(false);
  }, [adminOnly, subAppId]);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/learning/admin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success && data.user) {
        // Grant admin rights for this session
        sessionStorage.setItem("bcf_admin_authenticated", "true");
        sessionStorage.setItem("bcf_admin_verified_user", data.user.username || "abandama");
        sessionStorage.removeItem("bcf_staff_only_session");
        sessionStorage.setItem("bcf_learning_session", JSON.stringify(data.user));
        localStorage.setItem("bcf_selected_profile", JSON.stringify(data.user));

        // Sync with parent & dispatch event
        try {
          window.dispatchEvent(
            new CustomEvent("bcf_admin_verified", { detail: data.user })
          );
        } catch (_) {}

        setIsAuthenticated(true);
      } else {
        setErrorMsg(
          data.error ||
            "Access Denied: Incorrect administrator credentials. Please check your username and password."
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reach authorization server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickPrefill = () => {
    setUsername("admin@bcfsl.org");
    setPassword("ChangeMe123!");
    setErrorMsg("");
  };

  const handleLockSession = () => {
    sessionStorage.removeItem("bcf_admin_authenticated");
    sessionStorage.removeItem("bcf_admin_verified_user");
    sessionStorage.setItem("bcf_staff_only_session", "true");
    setIsAuthenticated(false);
  };

  if (isChecking) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <span className="material-symbols-outlined text-3xl animate-spin text-blue-600">
            progress_activity
          </span>
          <p className="text-xs font-semibold">Verifying administrative access privileges...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, display the secure administrator credential challenge screen
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 min-h-[calc(100vh-140px)] bg-slate-50 dark:bg-slate-950/60">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 flex flex-col gap-5">
          {/* Top Security Emblem */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shrink-0">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                <span className="material-symbols-outlined text-[12px]">lock</span>
                <span>Restricted Administrator Console</span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1 leading-snug">
                Administrator Verification Required
              </h2>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Access to <strong className="text-slate-900 dark:text-white">{subAppLabel}</strong> is restricted strictly to authorized BCF-SL Administrators. Regular staff members must authenticate with administrator credentials to proceed.
          </p>

          {/* Active staff profile indicator */}
          {activeStaff && (
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-slate-400">Current Staff Profile</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{activeStaff.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{activeStaff.position} · {activeStaff.department}</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 shrink-0">
                Staff Quota Mode
              </span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-shake">
              <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Credential Form */}
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200" htmlFor="admin-username">
                Administrator Username or Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 text-lg">
                  account_circle
                </span>
                <input
                  id="admin-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. abandama"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200" htmlFor="admin-password">
                Administrator Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 text-lg">
                  key
                </span>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Prefill for Albert Joseph Bandama */}
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-400 font-medium">CEO / Master Admin:</span>
              <button
                type="button"
                onClick={handleQuickPrefill}
                className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[13px]">bolt</span>
                <span>Use Albert J Bandama</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 disabled:opacity-75 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">
                      progress_activity
                    </span>
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">verified_user</span>
                    <span>Verify &amp; Unlock Administrator Console</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => router.push(`/${moduleSlug}/course-allocation`)}
                className="w-full h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Return to Course Catalogue</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Once authenticated, render children with an active admin indicator
  return (
    <div className="flex flex-col flex-1 w-full relative">
      {/* Subtle Admin Active Status Pill */}
      {adminOnly && (
        <div className="flex items-center justify-between px-3 sm:px-6 py-1 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold">Administrator Access Active:</span>
            <span>Unlocked for Staff Account Creation, Analytics &amp; Governance</span>
          </div>
          <button
            onClick={handleLockSession}
            title="Lock administrative access and require credentials again"
            className="hover:underline font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">lock</span>
            <span>Lock Admin Console</span>
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
