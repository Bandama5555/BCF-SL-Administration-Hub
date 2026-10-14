"use client";

import { useState, useRef, useEffect } from "react";

export interface PageAction {
  label: string;
  icon?: string;
  onClick: () => void;
  isPrimary?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: PageAction[];
  extraNode?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions = [], extraNode }: PageHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const primaryAction = actions.find((a) => a.isPrimary) || actions[0];
  const secondaryActions = actions.filter((a) => a !== primaryAction);

  return (
    <div
      id="page-header"
      className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2.5 sm:gap-4 shrink-0 transition-colors"
    >
      {/* Title & Subtitle */}
      <div className="min-w-0 flex-1">
        <h1 className="text-sm sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate leading-tight">
            {subtitle}
          </p>
        )}
      </div>

      {/* Action Buttons & Header Extra */}
      {(actions.length > 0 || extraNode) && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {extraNode}

          {/* Primary Action Button */}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="h-9 px-2.5 sm:px-3.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
            >
              {primaryAction.icon && (
                <span className="material-symbols-outlined text-[17px]">
                  {primaryAction.icon}
                </span>
              )}
              <span>{primaryAction.label}</span>
            </button>
          )}

          {/* Desktop Secondary Action Buttons */}
          <div className="hidden md:flex items-center gap-1.5">
            {secondaryActions.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                {action.icon && (
                  <span className="material-symbols-outlined text-[17px] text-slate-500 dark:text-slate-400">
                    {action.icon}
                  </span>
                )}
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          {/* Mobile "More" Menu Dropdown */}
          {secondaryActions.length > 0 && (
            <div className="relative md:hidden" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                aria-label="More actions"
                className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">more_vert</span>
              </button>

              {moreOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-40 text-xs">
                  {secondaryActions.map((action, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        action.onClick();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 font-medium"
                    >
                      {action.icon && (
                        <span className="material-symbols-outlined text-[16px] text-slate-400">
                          {action.icon}
                        </span>
                      )}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
