"use client";

import React, { useEffect } from "react";

export default function SubAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SubApp Error]:", error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-900">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl">warning</span>
      </div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
        Unable to load this section
      </h2>
      <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
        {error?.message || "An unexpected error occurred while rendering this page component."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-all"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}
