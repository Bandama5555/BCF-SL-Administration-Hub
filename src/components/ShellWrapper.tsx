"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "./Shell";

const NO_SHELL_PATHS = ["/login"];

/**
 * ShellWrapper — renders the unified BCF-SL Administration Hub Shell
 * with full Sidebar, TopBar, and navigation across all 10 modules.
 * Ensures the outer left navigation bar is ALWAYS shown, and prevents
 * any nested duplicate navbars from ever appearing inside iframes.
 */
export function ShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isInIframe, setIsInIframe] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return window.self !== window.top;
      } catch (_) {
        return true;
      }
    }
    return false;
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.self !== window.top) {
        setIsInIframe(true);
        // Break out of the iframe so Next.js always runs exclusively at the top level
        window.top?.location.replace(window.location.href);
      }
    } catch (_) {
      setIsInIframe(true);
    }
  }, []);

  // If running inside an embedded iframe, NEVER render the outer shell sidebar/topbar!
  if (isInIframe) {
    return <>{children}</>;
  }

  const useShell = !NO_SHELL_PATHS.includes(pathname);

  if (!useShell) {
    return <>{children}</>;
  }

  return <Shell>{children}</Shell>;
}
