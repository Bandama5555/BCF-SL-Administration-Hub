"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "./AppLayout";
import { IframeViewer } from "./IframeViewer";
import { AdminAuthGuard } from "./AdminAuthGuard";
import { type Module, type SubApp } from "@/lib/modules";
import { getUser, type AuthUser } from "@/lib/auth";
import { normalizeRole, getAccessibleSubApps, hasSubAppAccess } from "@/lib/permissions";
import { checkDocumentPermission } from "@/lib/documentPermissions";
import { DocumentsModuleView } from "./documents/DocumentsModuleView";
import { DocumentsNotificationBell } from "./documents/DocumentsNotificationBell";
import { DocumentsUploadModal } from "./documents/DocumentsUploadModal";
import { InventoryManagementView } from "./procurement/InventoryManagementView";
import { AssetManagementView } from "./procurement/AssetManagementView";
import { AccessRequestModuleView } from "./access/AccessRequestModuleView";
import { AccessApprovalModuleView } from "./access/AccessApprovalModuleView";
import { AccessRevokeView } from "./access/AccessRevokeView";
import { AccessMasterView } from "./access/AccessMasterView";
import { PasswordResetAdminView } from "./admin/PasswordResetAdminView";

interface SubAppContentProps {
  module: Module;
  subApp: SubApp;
}

export function SubAppContent({ module, subApp }: SubAppContentProps) {
  const router = useRouter();
  const [frameWin, setFrameWin] = useState<Window | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const roleCode = normalizeRole(user?.role, user?.username, user?.email, user?.department, user?.position);
  const accessibleSubApps = getAccessibleSubApps(roleCode, module.slug);

  // Guard against unpermitted direct sub-app views with real-time revocation reactivity
  useEffect(() => {
    const checkAccess = () => {
      if (!user) return;
      const isAdmin =
        (roleCode === "SA" || roleCode === "CEO") &&
        ((user.role || "").toLowerCase().includes("admin") ||
          (user.username || "").toLowerCase().includes("admin") ||
          (user.email || "").toLowerCase().includes("admin") ||
          user.role === "SA" ||
          user.role === "CEO");

      if (isAdmin) return;

      const permitted = hasSubAppAccess(roleCode, module.slug, subApp.id);
      if (!permitted) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("bcf_access_denied_msg", "You do not have access to that page.");
        }
        const currentAccessible = getAccessibleSubApps(roleCode, module.slug);
        if (currentAccessible.length > 0) {
          router.replace(`/${module.slug}/${currentAccessible[0].id}`);
        } else {
          router.replace("/");
        }
      }
    };

    checkAccess();
    window.addEventListener("bcf_grants_updated", checkAccess);
    window.addEventListener("storage", checkAccess);
    return () => {
      window.removeEventListener("bcf_grants_updated", checkAccess);
      window.removeEventListener("storage", checkAccess);
    };
  }, [user, roleCode, module.slug, subApp.id, router]);

  const triggerAction = (fnName: string) => {
    const iframe = document.querySelector("iframe") as HTMLIFrameElement | null;
    if (iframe) {
      try {
        iframe.contentWindow?.postMessage({ type: "BCF_ACTION", action: fnName }, "*");
        const win = iframe.contentWindow as any;
        if (win && typeof win[fnName] === "function") {
          win[fnName]();
          return;
        }
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          const btn = doc.querySelector(`button[onclick*="${fnName}"]`) as HTMLElement | null;
          if (btn) {
            btn.click();
            return;
          }
        }
      } catch (err) {
        console.warn("Action trigger error:", err);
      }
    }
    if (frameWin && typeof (frameWin as any)[fnName] === "function") {
      (frameWin as any)[fnName]();
    }
  };

  // Configure Page Actions (Layer 3)
  const actions = [];

  if (subApp.id === "beneficiaries-log") {
    actions.push(
      {
        label: "Enroll Beneficiary",
        icon: "person_add",
        isPrimary: true,
        onClick: () => triggerAction("openEnrollModal"),
      },
      {
        label: "Log Allocation",
        icon: "add_box",
        isPrimary: false,
        onClick: () => triggerAction("openAllocationModal"),
      },
      {
        label: "Export CSV",
        icon: "file_download",
        isPrimary: false,
        onClick: () => triggerAction("exportDataCSV"),
      },
      {
        label: "Beneficiaries Analytics",
        icon: "insights",
        isPrimary: false,
        onClick: () => router.push(`/${module.slug}/beneficiaries-analytics`),
      }
    );
  } else if (subApp.id === "donors-directory") {
    actions.push(
      {
        label: "Log Donation",
        icon: "add",
        isPrimary: true,
        onClick: () => router.push(`/${module.slug}/log-donation`),
      },
      {
        label: "Export Directory",
        icon: "file_download",
        isPrimary: false,
        onClick: () => triggerAction("exportDirectoryCSV"),
      }
    );
  } else if (subApp.id === "staff-directory") {
    actions.push(
      {
        label: "Register New Staff",
        icon: "person_add",
        isPrimary: true,
        onClick: () => {
          router.push("/employees/register-staff");
        },
      },
      {
        label: "Export Directory",
        icon: "file_download",
        isPrimary: false,
        onClick: () => {
          const iframe = document.querySelector("iframe");
          const win = iframe?.contentWindow as any;
          if (win && typeof win.exportStaffCSV === "function") {
            win.exportStaffCSV();
            return;
          }
          try {
            const raw = localStorage.getItem("bcf_staff_registry");
            const data = raw ? JSON.parse(raw) : [];
            let csv = "data:text/csv;charset=utf-8,";
            csv += "Employee ID,Full Name,Department,Classification,Management Level,Job Level,Phone,Email\n";
            data.forEach((e: any) => {
              csv += `"${e.employeeId || ''}","${(e.fullName || '').replace(/"/g, '""')}","${(e.department || '').replace(/"/g, '""')}","${(e.classification || '').replace(/"/g, '""')}","${(e.mgmtLevel || '').replace(/"/g, '""')}","${(e.jobLevel || '').replace(/"/g, '""')}","${(e.phone || e.workPhone || '').replace(/"/g, '""')}","${(e.email || e.workEmail || '').replace(/"/g, '""')}"\n`;
            });
            const encodedUri = encodeURI(csv);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `BCF_SL_Staff_Directory_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch (err) {
            console.error("Export fallback failed:", err);
          }
        },
      }
    );
  } else if (subApp.id === "loan-application") {
    actions.push({
      label: "Apply for Loan",
      icon: "request_quote",
      isPrimary: true,
      onClick: () => {
        const iframe = document.querySelector("iframe");
        const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
        const target = doc?.getElementById("loan-application-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
          const firstInput = target.querySelector("input, select") as HTMLElement | null;
          firstInput?.focus();
        } else {
          triggerAction("openLoanModal");
        }
      },
    });
  } else if (subApp.id === "purchase-requisition") {
    actions.push({
      label: "New Requisition",
      icon: "add_shopping_cart",
      isPrimary: true,
      onClick: () => triggerAction("openRequisitionModal"),
    });
  }

  // Configure Internal Page Tabs (Layer 4)
  // Display only strictly authorized sub-apps in this module
  const availableSubApps = accessibleSubApps;

  let tabs: Array<{ id: string; label: string; icon?: string; badge?: string | number; href?: string }> | undefined = undefined;
  let currentActiveTab = subApp.id;

  if (availableSubApps.length > 1) {
    tabs = availableSubApps.map((sub) => ({
      id: sub.id,
      label: sub.label.replace(" (Admin Only)", ""),
      icon: sub.icon,
      badge: sub.adminOnly ? "Admin" : undefined,
      href: `/${module.slug}/${sub.id}`,
    }));
    currentActiveTab = subApp.id;
  }

  const handleTabChange = (tabId: string) => {
    if (tabId !== subApp.id) {
      router.push(`/${module.slug}/${tabId}`);
    }
  };

  // Special Native Rendering: Documents & Policies Module (No iframe, native React UI)
  if (module.slug === "documents-policies") {
    const canUpload = checkDocumentPermission(roleCode, subApp.id as any, "upload");
    const docActions = [];
    if (canUpload && subApp.id !== "deleted-items") {
      docActions.push({
        label: "Upload Document",
        icon: "cloud_upload",
        isPrimary: true,
        onClick: () => setUploadModalOpen(true),
      });
    }

    return (
      <AppLayout
        title={subApp.label}
        subtitle={subApp.description}
        actions={docActions}
        headerExtra={
          <DocumentsNotificationBell
            userRole={roleCode}
            userName={user?.username}
            userEmail={user?.email}
          />
        }
        tabs={tabs}
        activeTab={currentActiveTab}
        onTabChange={handleTabChange}
      >
        <DocumentsModuleView
          currentTab={subApp.id as any}
          onOpenUploadModal={() => setUploadModalOpen(true)}
          onRefreshTrigger={refreshTrigger}
        />
        <DocumentsUploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          defaultTab={subApp.id as any}
          onSuccess={() => setRefreshTrigger((c) => c + 1)}
        />
      </AppLayout>
    );
  }

  // Native Rendering: Procurement Module - Inventory & Asset Management
  if (module.slug === "procurement" && subApp.id === "inventory-management") {
    return (
      <AppLayout
        title="Inventory Management"
        subtitle="Track consumables, distributable programme materials, spare parts, stores and stock balance levels"
        tabs={tabs}
        activeTab={currentActiveTab}
        onTabChange={handleTabChange}
      >
        <InventoryManagementView />
      </AppLayout>
    );
  }

  if (module.slug === "procurement" && subApp.id === "asset-management") {
    return (
      <AppLayout
        title="Asset Management"
        subtitle="Comprehensive register, lifecycle tracking, custodial assignment, depreciation and disposal of capital assets"
        tabs={tabs}
        activeTab={currentActiveTab}
        onTabChange={handleTabChange}
      >
        <AssetManagementView />
      </AppLayout>
    );
  }

  // Native Rendering: Access Management Module (Single Unified Module)
  if (module.slug === "access" || module.slug === "access-request" || module.slug === "access-approval") {
    if (subApp.id === "access-approval" || subApp.id === "access-acceptance") {
      return (
        <AppLayout
          title={subApp.label}
          subtitle={subApp.description}
          tabs={tabs}
          activeTab={currentActiveTab}
          onTabChange={handleTabChange}
        >
          <AccessApprovalModuleView currentTab={subApp.id as any} />
        </AppLayout>
      );
    }

    if (subApp.id === "access-revoke") {
      return (
        <AppLayout
          title={subApp.label}
          subtitle={subApp.description}
          tabs={tabs}
          activeTab={currentActiveTab}
          onTabChange={handleTabChange}
        >
          <AccessRevokeView />
        </AppLayout>
      );
    }

    if (subApp.id === "access-master") {
      return (
        <AppLayout
          title={subApp.label}
          subtitle={subApp.description}
          tabs={tabs}
          activeTab={currentActiveTab}
          onTabChange={handleTabChange}
        >
          <AccessMasterView />
        </AppLayout>
      );
    }

    return (
      <AppLayout
        title={subApp.label}
        subtitle={subApp.description}
        tabs={tabs}
        activeTab={currentActiveTab}
        onTabChange={handleTabChange}
      >
        <AccessRequestModuleView currentTab={subApp.id as any} />
      </AppLayout>
    );
  }

  // Native Rendering: Super Admin Module - Reset Password Governance
  if (module.slug === "super-admin" && subApp.id === "reset-password") {
    return (
      <AppLayout
        title={subApp.label}
        subtitle={subApp.description}
        tabs={tabs}
        activeTab={currentActiveTab}
        onTabChange={handleTabChange}
      >
        <PasswordResetAdminView />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={subApp.label.replace(" (Admin Only)", "")}
      subtitle={subApp.description}
      actions={actions}
      tabs={tabs}
      activeTab={currentActiveTab}
      onTabChange={handleTabChange}
    >
      <AdminAuthGuard
        moduleSlug={module.slug}
        subAppId={subApp.id}
        subAppLabel={subApp.label}
        adminOnly={subApp.adminOnly}
      >
        <IframeViewer
          key={`${module.slug}-${subApp.id}-${subApp.htmlPath}`}
          htmlPath={subApp.htmlPath}
          title={subApp.label}
          onFrameLoaded={(win) => setFrameWin(win)}
        />
      </AdminAuthGuard>
    </AppLayout>
  );
}
