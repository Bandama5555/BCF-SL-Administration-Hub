"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated, getUser, logout } from "@/lib/auth";
import { normalizeRole, hasSubAppAccess, hasModuleAccess, getRoleLandingPage, ROLE_DEFINITIONS, type RoleCode } from "@/lib/permissions";

const PUBLIC_PATHS = ["/login"];

/**
 * AuthGuard — wraps children in a route protection check.
 *
 * Automatically monitors active staff account status in real-time.
 * If a staff member is suspended by the Super Administrator, they are
 * immediately logged out across all tabs/devices and redirected to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  // Trigger immediate automatic logout if account is suspended
  const triggerSuspensionLogout = () => {
    logout();
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "bcf_logout_reason",
        "Your staff account has been suspended by the administrator. You have been automatically logged out."
      );
    }
    router.replace("/login?reason=suspended");
  };

  useEffect(() => {
    const authed = isAuthenticated();
    const isPublic = PUBLIC_PATHS.includes(pathname);

    if (!authed && !isPublic) {
      const target = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
      window.location.replace(`/login${target}`);
      return;
    }

    if (authed && pathname === "/login") {
      router.replace("/");
      return;
    }

    // Role-Based Access Control (RBAC) Route Enforcement
    if (authed && pathname !== "/") {
      const user = getUser();
      const roleCode = normalizeRole(user?.role, user?.username, user?.email, user?.department, user?.position);

      const isAdmin =
        roleCode === "SA" ||
        roleCode === "CEO" ||
        (user?.role || "").toLowerCase().includes("admin") ||
        (user?.username || "").toLowerCase().includes("admin") ||
        (user?.email || "").toLowerCase().includes("admin") ||
        (typeof window !== "undefined" &&
          (sessionStorage.getItem("bcf_admin_session") === "true" ||
            sessionStorage.getItem("bcf_admin_authenticated") === "true"));

      // Super Admin and Admin bypass all route restrictions
      if (!isAdmin) {
        const segments = pathname.split("/").filter(Boolean);
        const moduleSlug = segments[0];
        const subAppId = segments[1];

        let denied = false;

        if (subAppId) {
          // Direct sub-app route check
          denied = !hasSubAppAccess(roleCode, moduleSlug, subAppId);
        } else if (moduleSlug) {
          // Module hub route check
          denied = !hasModuleAccess(roleCode, moduleSlug);
        }

        if (denied) {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("bcf_access_denied_msg", "You do not have access to that page.");
          }
          // Log access denial to security audit log
          try {
            fetch("/api/auth/audit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "UNAUTHORIZED_ACCESS_BLOCKED",
                user: user?.username || user?.email || "Unknown",
                role: roleCode,
                path: pathname,
                timestamp: new Date().toISOString(),
              }),
            }).catch(() => {});
          } catch {}

          const landing = getRoleLandingPage(roleCode);
          router.replace(landing);
          return;
        }
      }
    }
    setChecking(false);
  }, [pathname, router]);

  // Real-time suspension monitor: automatically logs out suspended staff
  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return;

    const user = getUser();
    if (!user) return;

    // Helper to test if a target event matches current user
    const checkUserSuspended = (target: { userId?: string; username?: string; email?: string; employeeId?: string }) => {
      const uEmail = (user.email || "").toLowerCase();
      const uUser = (user.username || "").toLowerCase();
      const uEmp = (user.employeeId || "").toLowerCase();

      return Boolean(
        (target.email && target.email.toLowerCase() === uEmail) ||
        (target.username && target.username.toLowerCase() === uUser) ||
        (target.employeeId && target.employeeId.toLowerCase() === uEmp) ||
        (target.userId && target.userId.toLowerCase() === (user as any).userId?.toLowerCase())
      );
    };

    // Verify active status with server
    const verifyStatusWithServer = async () => {
      const identifier = user.username || user.email || user.employeeId;
      if (!identifier) return;

      try {
        const res = await fetch(`/api/auth/status?id=${encodeURIComponent(identifier)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.success && data.suspended) {
          triggerSuspensionLogout();
        }
      } catch {}
    };

    // Run verification on mount
    verifyStatusWithServer();

    // 1. BroadcastChannel for instant (<50ms) cross-tab auto-logout
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("bcf_auth_channel");
      bc.onmessage = (e) => {
        if (e.data?.type === "USER_SUSPENDED" && checkUserSuspended(e.data)) {
          triggerSuspensionLogout();
        }
      };
    } catch {}

    // 2. Storage event listener for cross-window auto-logout
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "bcf_suspended_event" && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          if (checkUserSuspended(payload)) {
            triggerSuspensionLogout();
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Periodic polling every 8 seconds for remote device auto-logout
    const interval = setInterval(verifyStatusWithServer, 8000);

    // 4. Verification on tab focus
    window.addEventListener("focus", verifyStatusWithServer);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", verifyStatusWithServer);
      if (bc) bc.close();
    };
  }, [pathname, router]);

  // On public paths (/login), never block — show immediately
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  if (checking) {
    // Minimal blank while redirect fires — no flash of content
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--surface)" }}
        aria-busy="true"
        aria-label="Checking authentication…"
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="px-2 py-1.5 rounded-xl bg-white shadow-md"
          >
            <img
              src="/bcf-logo.jpg"
              alt="Bandama Charity Foundation"
              className="h-9 w-auto object-contain"
            />
          </div>
          <div
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--primary)" }}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
