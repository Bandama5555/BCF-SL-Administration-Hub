"use client";

export function Footer() {
  return (
    <footer
      id="app-footer"
      className="mt-auto border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 shrink-0"
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="font-medium text-[11px]">
          Bandama Charity Foundation (BCF-SL) &middot; Data Protection &amp; Safeguarding Compliant
        </span>
      </div>
      <div className="text-[11px] text-slate-400 dark:text-slate-500">
        &copy; {new Date().getFullYear()} BCF-SL Administration Hub &middot; Freetown, Sierra Leone
      </div>
    </footer>
  );
}
