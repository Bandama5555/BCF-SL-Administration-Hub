"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { VisitorDashboardTab } from "./VisitorDashboardTab";
import { VisitorsListTab } from "./VisitorsListTab";
import { LoginActivityTab } from "./LoginActivityTab";
import { BlockedVisitorsTab } from "./BlockedVisitorsTab";
import { VisitorSettingsTab } from "./VisitorSettingsTab";

interface VisitorAnalyticsModuleViewProps {
  currentTab: "dashboard" | "visitors" | "login-activity" | "blocked-visitors" | "settings";
}

export function VisitorAnalyticsModuleView({ currentTab }: VisitorAnalyticsModuleViewProps) {
  const router = useRouter();

  // Filters passed down when clicking cards / alerts from dashboard
  const [visitorFilter, setVisitorFilter] = useState<any>({});

  const handleNavigateToVisitors = (filter?: any) => {
    if (filter) {
      setVisitorFilter(filter);
    }
    router.push("/visitor-analytics/visitors");
  };

  const handleNavigateToBlocked = () => {
    router.push("/visitor-analytics/blocked-visitors");
  };

  const handleNavigateToLogin = () => {
    router.push("/visitor-analytics/login-activity");
  };

  return (
    <div className="flex-1 flex flex-col w-full min-h-0 bg-slate-50/50 dark:bg-slate-950 transition-colors">
      {currentTab === "dashboard" && (
        <VisitorDashboardTab
          onNavigateToVisitors={handleNavigateToVisitors}
          onNavigateToBlocked={handleNavigateToBlocked}
          onNavigateToLogin={handleNavigateToLogin}
        />
      )}

      {currentTab === "visitors" && (
        <VisitorsListTab
          initialSearch={visitorFilter.search || ""}
          initialCountry={visitorFilter.country || "All"}
          initialOs={visitorFilter.os || "All"}
          initialDeviceType={visitorFilter.deviceType || "All"}
          initialSignedIn={visitorFilter.signedIn || "all"}
          initialStatus={visitorFilter.status || "All"}
        />
      )}

      {currentTab === "login-activity" && (
        <LoginActivityTab />
      )}

      {currentTab === "blocked-visitors" && (
        <BlockedVisitorsTab />
      )}

      {currentTab === "settings" && (
        <VisitorSettingsTab />
      )}
    </div>
  );
}
