"use client";

import React from "react";
import { PageHeader, type PageAction } from "./PageHeader";
import { PageTabs, type TabItem } from "./PageTabs";
import { Footer } from "./Footer";

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  actions?: PageAction[];
  headerExtra?: React.ReactNode;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode;
}

/**
 * AppLayout — Unified single-layout component applied to EVERY module and page.
 * Enforces the strict 5-layer hierarchy:
 *   Layer 1: Global Top Bar (rendered by outer Shell)
 *   Layer 2: Left Sidebar (rendered by outer Shell)
 *   Layer 3: Page Header (title, subtitle, primary/secondary action buttons)
 *   Layer 4: Page Tabs (only if the page has internal sub-sections)
 *   Layer 5: Page Content + Institutional Footer
 */
export function AppLayout({
  title,
  subtitle,
  actions = [],
  headerExtra,
  tabs = [],
  activeTab = "",
  onTabChange = () => {},
  children,
}: AppLayoutProps) {
  return (
    <div className="flex-1 flex flex-col w-full min-h-0 bg-white dark:bg-slate-900 transition-colors">
      {/* Layer 3: Page Header (one per page, inside content area) */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={actions}
        extraNode={headerExtra}
      />

      {/* Layer 4: Page Tabs (only if the page has internal sub-sections) */}
      {tabs.length > 0 && (
        <PageTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}

      {/* Layer 5: Page Content */}
      <div className="flex-1 flex flex-col w-full min-h-0">
        {children}
      </div>

      {/* Institutional Compliance Footer */}
      <Footer />
    </div>
  );
}
