"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
  resolvedTheme: "light" | "dark";
  themes: string[];
  systemTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
  themes: ["light", "dark", "system"],
  systemTheme: "light",
});

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<string>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Read stored preference and detect system theme on client mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("bcf_theme") || localStorage.getItem("theme");
      if (stored) {
        setThemeState(stored);
      } else if (defaultTheme) {
        setThemeState(defaultTheme);
      }
    } catch (_) {}

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemTheme(mq.matches ? "dark" : "light");

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [defaultTheme]);

  const resolvedTheme: "light" | "dark" = useMemo(() => {
    if (theme === "system" && enableSystem) {
      return systemTheme;
    }
    return theme === "dark" ? "dark" : "light";
  }, [theme, enableSystem, systemTheme]);

  // Apply theme class to <html> element smoothly
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [resolvedTheme, mounted]);

  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("bcf_theme", newTheme);
      localStorage.setItem("theme", newTheme);
    } catch (_) {}
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      themes: ["light", "dark", "system"],
      systemTheme,
    }),
    [theme, resolvedTheme, systemTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

