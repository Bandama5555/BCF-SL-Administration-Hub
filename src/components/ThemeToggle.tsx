"use client";

import { useTheme } from "./ThemeProvider";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-full skeleton" aria-hidden="true" />
    );
  }

  const isDark = resolvedTheme === "dark";

  const cycle = () => {
    if (theme === "system") setTheme(isDark ? "light" : "dark");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const icon =
    theme === "system"
      ? "brightness_auto"
      : isDark
      ? "dark_mode"
      : "light_mode";

  const label =
    theme === "system"
      ? "System theme (click to switch)"
      : isDark
      ? "Dark mode (click to switch)"
      : "Light mode (click to switch)";

  return (
    <button
      id="theme-toggle-btn"
      onClick={cycle}
      aria-label={label}
      title={label}
      className="w-9 h-9 flex items-center justify-center rounded-full 
                 hover:bg-[var(--surface-container)] transition-colors duration-200
                 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
    >
      <span className="material-symbols-outlined text-[22px]">{icon}</span>
    </button>
  );
}
