"use client";

/**
 * VisitorTracker.tsx
 * Silent client-side beacon for BCF-SL Visitor Analytics.
 * Fires on every page navigation and sends telemetry to /api/visitor-analytics/track.
 * Works for both the public website and the administration hub.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Lightweight browser fingerprint signal (no canvas, no audio – purely metadata)
function buildFingerprint(): string {
  try {
    const signals = [
      navigator.language || "",
      navigator.hardwareConcurrency?.toString() || "",
      screen.colorDepth?.toString() || "",
      screen.width?.toString() || "",
      screen.height?.toString() || "",
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      navigator.platform || "",
    ].join("|");
    // Simple djb2 hash to produce a fingerprint string without crypto
    let hash = 5381;
    for (let i = 0; i < signals.length; i++) {
      hash = (hash * 33) ^ signals.charCodeAt(i);
    }
    return `fp_${(hash >>> 0).toString(16)}`;
  } catch {
    return "";
  }
}

function readDeviceCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)bcf_vid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function getStoredUser(): { staffId?: string; name?: string; email?: string; role?: string } | null {
  try {
    const raw = sessionStorage.getItem("bcf_user");
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

async function sendBeacon(page: string) {
  try {
    const user = getStoredUser();
    const privacyAccepted =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("bcf_privacy_accepted") === "true"
        : true;

    const payload = {
      deviceId: readDeviceCookie(),
      fingerprint: buildFingerprint(),
      page,
      referrer: document.referrer || "Direct",
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language || "en-US",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Freetown",
      source: page.startsWith("/admin") || page === "/" || page.startsWith("/login")
        ? "Hub"
        : "Website",
      privacyAccepted,
      user: user
        ? { staffId: user.staffId, name: user.name, email: user.email, role: user.role }
        : null,
    };

    const res = await fetch("/api/visitor-analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // keepalive so the request survives page unload
      keepalive: true,
    });

    if (res.ok) {
      const data = await res.json();
      // Cache session ID for multi-page session correlation
      if (data.sessionId && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("bcf_session_id", data.sessionId);
      }
      // Store device hash for subsequent calls
      if (data.deviceIdHash && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("bcf_device_hash", data.deviceIdHash);
      }
      // If blocked, the proxy/middleware will have already redirected — this is
      // a client-side safety valve to log the event.
      if (data.isBlocked) {
        console.warn("[BCF Analytics] This device is restricted.");
      }
    }
  } catch {
    // Tracking must never break the app
  }
}

export function VisitorTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;
    if (pathname === lastTracked.current) return;
    lastTracked.current = pathname;

    // Small delay to ensure page title/head is committed
    const tid = setTimeout(() => {
      sendBeacon(pathname);
    }, 300);

    return () => clearTimeout(tid);
  }, [pathname]);

  // No visual output — this is a pure analytics beacon
  return null;
}
