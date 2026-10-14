"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
  href?: string;
}

interface PageTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function PageTabs({ tabs, activeTab, onTabChange }: PageTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const activeEl = containerRef.current.querySelector('[aria-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [activeTab]);

  if (!tabs || tabs.length <= 1) return null;

  return (
    <div
      id="page-tabs"
      role="tablist"
      ref={containerRef}
      className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-6 py-1.5 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap no-scrollbar shrink-0 scroll-smooth touch-pan-x"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const className = `min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 shrink-0 cursor-pointer select-none ${
          isActive
            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800"
        }`;

        const content = (
          <>
            {tab.icon && (
              <span className={`material-symbols-outlined text-[16px] ${isActive ? "text-white dark:text-slate-900" : "text-slate-400"}`}>
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </>
        );

        if (tab.href) {
          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={className}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={className}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
