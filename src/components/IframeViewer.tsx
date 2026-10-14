"use client";
 
import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MODULES } from "@/lib/modules";

// Map relative/normalized HTML paths to Next.js routes
const HTML_TO_ROUTE_MAP: Record<string, string> = {};
MODULES.forEach((m) => {
  m.subApps.forEach((s) => {
    const norm = s.htmlPath.toLowerCase().replace(/\\/g, "/");
    HTML_TO_ROUTE_MAP[norm] = `/${m.slug}/${s.id}`;
    const parts = norm.split("/");
    if (parts.length >= 2) {
      const shortKey = parts.slice(-2).join("/");
      HTML_TO_ROUTE_MAP[shortKey] = `/${m.slug}/${s.id}`;
    }
  });
});

interface IframeViewerProps {
  /** Path relative to /public/apps/ e.g. "stitch_employee.../staff_directory/code.html" */
  htmlPath: string;
  title: string;
  onFrameLoaded?: (contentWindow: Window | null) => void;
}

export function IframeViewer({ htmlPath, title, onFrameLoaded }: IframeViewerProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    setMounted(true);

    const STORAGE_COLLECTION_MAP: Record<string, { col: string; key: string }> = {
      bcf_staff_registry: { col: "employees", key: "employeeId" },
      bcf_user_accounts: { col: "user_accounts", key: "userId" },
      bcf_audit_logs: { col: "audit_logs", key: "auditId" },
      bcf_staff_loans: { col: "staff_loans", key: "loanId" },
      bcf_loan_applications: { col: "staff_loans", key: "id" },
      bcf_leave_requests: { col: "leave_requests", key: "id" },
      bcf_leave_registry: { col: "leave_requests", key: "id" },
      bcf_donors: { col: "donors", key: "id" },
      bcf_donations: { col: "donations", key: "id" },
      bcf_procurement_suppliers: { col: "procurement", key: "id" },
      bcf_purchase_orders: { col: "procurement", key: "id" },
      bcf_purchase_requisitions: { col: "procurement", key: "id" },
      bcf_partners: { col: "partnerships", key: "id" },
      bcf_deals: { col: "deal_pipeline", key: "id" },
      bcf_programs: { col: "programs", key: "id" },
      bcf_beneficiaries: { col: "beneficiaries", key: "id" },
      bcf_learning_accounts: { col: "learning_accounts", key: "accountId" },
      bcf_learning_enrollments: { col: "learning_enrollments", key: "id" },
    };

    let syncTimer: any = null;
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || !e.newValue) return;
      const mapping = STORAGE_COLLECTION_MAP[e.key];
      if (!mapping) return;

      clearTimeout(syncTimer);
      syncTimer = setTimeout(async () => {
        try {
          const parsed = JSON.parse(e.newValue!);
          const docs = Array.isArray(parsed) ? parsed : [parsed];
          if (docs.length > 0) {
            await fetch("/api/db/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                collection: mapping.col,
                documents: docs,
                keyField: mapping.key,
              }),
            });

            if (e.key === "bcf_staff_registry") {
              await fetch("/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(docs),
              });
            }
          }
        } catch (_) {}
      }, 400);
    };

    const handleMessage = async (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      try {
        if (e.data.type === "BCF_SYNC_EMPLOYEE" && e.data.payload) {
          await fetch("/api/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(e.data.payload),
          });
        } else if (e.data.type === "BCF_SYNC_COLLECTION" && e.data.collection && e.data.documents) {
          await fetch("/api/db/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              collection: e.data.collection,
              documents: e.data.documents,
              keyField: e.data.keyField || "id",
            }),
          });
        }
      } catch (_) {}
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  useEffect(() => {
    setStatus("loaded");
  }, [htmlPath]);

  const src = `/apps/${htmlPath}`;

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.currentTarget;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        // Ensure responsive viewport meta tag is present inside embedded app
        if (!doc.querySelector('meta[name="viewport"]')) {
          const meta = doc.createElement("meta");
          meta.name = "viewport";
          meta.content = "width=device-width, initial-scale=1.0, maximum-scale=5.0";
          doc.head.appendChild(meta);
        }

        // Hide duplicate headers, duplicate logos, redundant top strips inside embedded page
        const existing = doc.getElementById("bcf-parent-cleanup-style");
        if (!existing) {
          const style = doc.createElement("style");
          style.id = "bcf-parent-cleanup-style";
          style.textContent = `
            /* Hide duplicate top brand logos and title blocks inside embedded pages */
            header img[alt*="Logo"],
            header img[src*="logo"],
            header img[alt*="Bandama"],
            header img[alt*="BCF"],
            header .flex:has(> img[alt*="Logo"]),
            header .flex:has(> img[src*="logo"]),
            header .flex:has(> img[alt*="Bandama"]),
            header .flex:has(> img[alt*="BCF"]),
            nav[aria-label="Breadcrumb"],
            .bcf-duplicate-header {
              display: none !important;
            }
            /* Keep internal tab bars and workbook sheets visible and non-sticky */
            header.sticky,
            header.fixed {
              position: static !important;
              box-shadow: none !important;
            }
            /* Adjust main padding so content starts smoothly */
            main,
            body > main,
            body > div > main {
              padding-top: 0.5rem !important;
              margin-top: 0 !important;
            }
            /* Seamless window-level scroll on Android, Samsung Internet & iOS */
            html, body {
              overflow-y: visible !important;
              height: auto !important;
              min-height: 100% !important;
              -webkit-overflow-scrolling: touch !important;
              touch-action: pan-y !important;
              background-color: transparent !important;
              max-width: 100vw !important;
              box-sizing: border-box !important;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              -webkit-tap-highlight-color: transparent !important;
            }
            /* Prevent wide tables and cards from overflowing viewport without horizontal scrolling */
            table {
              max-width: 100% !important;
            }
            .overflow-x-auto, [class*="overflow-x-"] {
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch !important;
              touch-action: pan-x pan-y !important;
            }
          `;
          doc.head.appendChild(style);
        }

        // Measure and sync full content height with hysteresis to prevent oscillation loops
        let lastH = 0;
        let isSyncing = false;
        const syncHeight = () => {
          try {
            const docEl = doc.documentElement;
            const b = doc.body;
            if (docEl && b) {
              const h = Math.max(
                docEl.scrollHeight,
                b.scrollHeight,
                docEl.offsetHeight,
                b.offsetHeight
              );
              // Only update if difference is noticeable (> 12px) to prevent 1px oscillating loops
              if (h > 150 && Math.abs(h - lastH) > 12) {
                lastH = h;
                iframe.style.height = `${h + 16}px`;
              }
            }
          } catch (_) {}
        };

        syncHeight();
        setTimeout(syncHeight, 200);

        if (typeof ResizeObserver !== "undefined" && doc.body) {
          const ro = new ResizeObserver(() => {
            if (!isSyncing) {
              isSyncing = true;
              requestAnimationFrame(() => {
                syncHeight();
                isSyncing = false;
              });
            }
          });
          ro.observe(doc.body);
        }

        // Intercept relative internal link clicks inside iframe so parent router stays in sync
        if (!(doc as any).__bcfClickInterceptorAttached) {
          (doc as any).__bcfClickInterceptorAttached = true;
          doc.addEventListener(
            "click",
            (evt: MouseEvent) => {
              const target = (evt.target as HTMLElement).closest("a");
              if (!target) return;
              const href = target.getAttribute("href");
              if (
                !href ||
                href.startsWith("#") ||
                href.startsWith("javascript:") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("http://") ||
                href.startsWith("https://")
              ) {
                return;
              }
              try {
                const url = new URL(href, iframe.contentWindow?.location.href || window.location.href);
                let p = url.pathname;
                if (p.startsWith("/apps/")) {
                  p = p.slice("/apps/".length);
                }
                p = decodeURIComponent(p).toLowerCase().replace(/\\/g, "/");
                let matchedRoute = HTML_TO_ROUTE_MAP[p];
                if (!matchedRoute) {
                  const segs = p.split("/");
                  if (segs.length >= 2) {
                    matchedRoute = HTML_TO_ROUTE_MAP[segs.slice(-2).join("/")];
                  }
                }
                if (matchedRoute) {
                  evt.preventDefault();
                  evt.stopPropagation();
                  router.push(matchedRoute);
                  return;
                }
              } catch (_) {}
            },
            true
          );
        }
        // Sync active authentication session into iframe storage and dispatch sync message
        try {
          const authRaw = sessionStorage.getItem("bcf_sl_auth") || localStorage.getItem("bcf_sl_auth");
          if (authRaw && iframe.contentWindow) {
            iframe.contentWindow.sessionStorage.setItem("bcf_sl_auth", authRaw);
            iframe.contentWindow.localStorage.setItem("bcf_sl_auth", authRaw);
            const parsed = JSON.parse(authRaw);
            const u = parsed?.user || parsed;
            const r = (u?.role || "").toUpperCase();
            const uname = (u?.username || "").toLowerCase();
            const em = (u?.email || "").toLowerCase();
            const name = (u?.name || "").toLowerCase();
            let effectiveRole = "staff";
            if (
              r === "SA" ||
              r === "SUPER ADMIN" ||
              r === "SUPER ADMINISTRATOR" ||
              uname === "admin" ||
              uname === "abandama" ||
              em === "admin@bcfsl.org" ||
              em === "admin@bcf-sl.org" ||
              name.includes("bandama")
            ) {
              effectiveRole = "super_admin";
            } else if (r === "HR" || r === "HR DIRECTOR" || uname === "hr_director") {
              effectiveRole = "hr_director";
            } else if (r === "CEO" || uname === "ceo_user") {
              effectiveRole = "ceo";
            } else if (r === "FIN" || r === "FINANCE" || uname === "fin_director") {
              effectiveRole = "finance_director";
            } else if (r === "IAR" || r === "INTERNAL AUDIT" || uname === "iar_director") {
              effectiveRole = "audit_director";
            }
            iframe.contentWindow.sessionStorage.setItem("bcf_user_role", effectiveRole);
            iframe.contentWindow.localStorage.setItem("bcf_user_role", effectiveRole);
            localStorage.setItem("bcf_user_role", effectiveRole);
            sessionStorage.setItem("bcf_user_role", effectiveRole);
            iframe.contentWindow.postMessage({ type: "BCF_AUTH_SYNC", payload: parsed, role: effectiveRole }, "*");
          }
        } catch (_) {}
      }
      if (onFrameLoaded && iframe.contentWindow) {
        onFrameLoaded(iframe.contentWindow);
      }
    } catch (_) {}
    setStatus("loaded");
  }, [onFrameLoaded, router]);

  const handleError = useCallback(() => setStatus("error"), []);

  return (
    <div className="relative w-full flex-1 flex flex-col bg-white dark:bg-slate-900">
      {/* Fast top loading indicator when page is fetching (non-blocking) */}
      {!mounted && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-emerald-500 to-blue-600 animate-pulse z-10 pointer-events-none" />
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center gap-4 bg-white dark:bg-slate-900 p-8 text-center min-h-[300px]">
          <span className="material-symbols-outlined text-5xl text-slate-400">
            broken_image
          </span>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Failed to load page content
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Please refresh or ensure local app assets are available.
            </p>
          </div>
        </div>
      )}

      {/* Embedded page iframe */}
      {mounted && (
        <iframe
          src={src}
          title={title}
          suppressHydrationWarning
          onLoad={handleLoad}
          onError={handleError}
          scrolling="no"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-top-navigation allow-top-navigation-by-user-activation"
          className="w-full border-0 block min-h-[calc(100vh-140px)]"
          aria-label={title}
        />
      )}
    </div>
  );
}
