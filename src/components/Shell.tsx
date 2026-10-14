"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col w-full overflow-x-hidden">
      {/* Layer 2: Fixed Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Layer 1: Fixed Global Top Bar */}
      <TopBar onMenuClick={() => setSidebarOpen(true)} />

      {/* Main Content Area: offset by 256px sidebar on desktop and 56px topbar */}
      <main
        id="main-content"
        className="pt-14 lg:pl-[256px] min-h-screen flex-1 flex flex-col w-full transition-all duration-200 overflow-x-hidden"
      >
        {children}
      </main>
    </div>
  );
}
