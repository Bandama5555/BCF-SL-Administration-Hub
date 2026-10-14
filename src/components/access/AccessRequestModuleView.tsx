"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUser, type AuthUser } from "@/lib/auth";
import {
  AccessCatalogueItem,
  AccessRequest,
  AccessNotification,
  AccessRight,
  AccessSettings,
} from "@/lib/accessTypes";

interface Props {
  currentTab: "access-application" | "my-requests" | "notifications";
}

const ALL_RIGHTS: AccessRight[] = ["Read", "Write", "View", "Upload", "Download"];

export const OFFICIAL_DEPARTMENTS: string[] = [
  "Finance Department",
  "Health & Safety Department",
  "Human Resources Management Department",
  "Information Technology (IT) Department",
  "Internal Risk & Audits Department",
  "Legal & Communication Department",
  "Procurement Department",
  "Programs Department",
  "Executive Management",
];

export function AccessRequestModuleView({ currentTab }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reqParam = searchParams.get("req");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogue, setCatalogue] = useState<AccessCatalogueItem[]>([]);
  const [settings, setSettings] = useState<AccessSettings | null>(null);

  // Form state
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]); // tabIds
  const [selectedRights, setSelectedRights] = useState<AccessRight[]>(["Read", "Write"]);
  const [durationType, setDurationType] = useState<"Permanent" | "Temporary">("Permanent");
  const [endDate, setEndDate] = useState("");
  const [justification, setJustification] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Department & Director state (Official 9 Departments)
  const [departments, setDepartments] = useState<string[]>(OFFICIAL_DEPARTMENTS);
  const [departmentDirectors, setDepartmentDirectors] = useState<
    Record<string, { id: string; name: string; email: string; position: string; roleCode: string; department?: string }[]>
  >({});
  const [fallbackDirector, setFallbackDirector] = useState<{
    id: string;
    name: string;
    email: string;
    position: string;
    roleCode: string;
    department?: string;
  } | null>(null);
  const [allDirectors, setAllDirectors] = useState<
    { id: string; name: string; email: string; position: string; roleCode: string; department: string }[]
  >([]);
  const [executiveManagementMembers, setExecutiveManagementMembers] = useState<
    { id: string; name: string; email: string; position: string; roleCode: string; department?: string }[]
  >([]);
  const [selectedExecId, setSelectedExecId] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState(OFFICIAL_DEPARTMENTS[0]);
  const [selectedDirectorId, setSelectedDirectorId] = useState("");

  // Helper to normalize department names for comparison
  const normalizeDeptCompare = (dept?: string | null) => {
    if (!dept) return "";
    return dept.toLowerCase().replace(/\bdepartment\b/g, "").replace(/\bdept\b/g, "").replace(/[^a-z0-9]/g, "").trim();
  };

  // Helper to canonicalize department to official 9 institutional departments
  const canonicalizeDept = (dept?: string | null): string => {
    if (!dept) return OFFICIAL_DEPARTMENTS[0];
    const norm = normalizeDeptCompare(dept);
    const matched = OFFICIAL_DEPARTMENTS.find((d) => {
      const dNorm = normalizeDeptCompare(d);
      return dNorm === norm || dNorm.includes(norm) || norm.includes(dNorm);
    });
    if (matched) return matched;
    if (norm.includes("health") || norm.includes("safety")) return "Health & Safety Department";
    if (norm.includes("legal") || norm.includes("communication")) return "Legal & Communication Department";
    if (norm.includes("risk") || norm.includes("audit")) return "Internal Risk & Audits Department";
    if (norm.includes("procure") || norm.includes("logistics")) return "Procurement Department";
    if (norm.includes("it") || norm.includes("ict") || norm.includes("tech") || norm.includes("information")) return "Information Technology (IT) Department";
    if (norm.includes("hr") || norm.includes("human")) return "Human Resources Management Department";
    if (norm.includes("finance") || norm.includes("fin")) return "Finance Department";
    if (norm.includes("program") || norm.includes("prog")) return "Programs Department";
    if (norm.includes("executive") || norm.includes("ceo") || norm.includes("admin")) return "Executive Management";
    return dept;
  };

  // Module switch confirmation modal
  const [pendingModule, setPendingModule] = useState<string | null>(null);
  const [showModuleConfirmModal, setShowModuleConfirmModal] = useState(false);

  // My Requests state
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  // Staff Confirmation state
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<AccessNotification[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  // Load user
  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (u?.department) {
      setSelectedDepartment(canonicalizeDept(u.department));
    }
  }, []);

  const getHeaders = () => {
    return {
      "Content-Type": "application/json",
      "x-bcf-user-role": user?.role || "",
      "x-bcf-username": user?.username || "",
      "x-bcf-email": user?.email || "",
      "x-bcf-name": user?.name || "",
      "x-bcf-department": user?.department || "",
      "x-bcf-employee-id": user?.employeeId || "",
    };
  };

  // Fetch catalogue
  useEffect(() => {
    if (!user) return;
    fetch(`/api/access/catalogue?email=${encodeURIComponent(user.email)}&role=${encodeURIComponent(user.role)}`, {
      headers: getHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCatalogue(data.catalogue || []);
          setSettings(data.settings || null);
          if (data.catalogue && data.catalogue.length > 0 && !selectedModule) {
            const firstMod = data.catalogue[0].module;
            setSelectedModule(firstMod);
          }
        }
      })
      .catch((err) => console.error("Catalogue load error:", err))
      .finally(() => setLoading(false));
  }, [user]);

  // Fetch departments & directors directory
  useEffect(() => {
    fetch("/api/access/departments")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const list = (data.departments && data.departments.length > 0)
            ? data.departments
            : OFFICIAL_DEPARTMENTS;
          setDepartments(list);
          setDepartmentDirectors(data.departmentDirectors || {});
          setFallbackDirector(data.fallbackDirector || null);
          setAllDirectors(data.allDirectors || []);
          setExecutiveManagementMembers(data.executiveManagementMembers || []);
        }
      })
      .catch((err) => console.error("Departments load error:", err));
  }, []);

  // Preselect applicant's own department when user or departments load
  useEffect(() => {
    if (user?.department) {
      setSelectedDepartment(canonicalizeDept(user.department));
    } else if (departments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(departments[0]);
    }
  }, [user, departments]);

  // Fetch requests
  const fetchRequests = () => {
    if (!user) return;
    setRequestsLoading(true);
    fetch("/api/access/requests", { headers: getHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRequests(data.requests || []);
          if (reqParam) {
            const matched = (data.requests || []).find(
              (r: AccessRequest) => r.requestNumber === reqParam || r.id === reqParam
            );
            if (matched) {
              setSelectedRequest(matched);
            }
          }
        }
      })
      .catch((err) => console.error("Requests load error:", err))
      .finally(() => setRequestsLoading(false));
  };

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user, reqParam]);

  // Fetch notifications
  const fetchNotifications = () => {
    if (!user) return;
    fetch("/api/access/notifications", { headers: getHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadNotifsCount(data.unreadCount || 0);
        }
      })
      .catch((err) => console.error("Notifs load error:", err));
  };

  useEffect(() => {
    if (user && currentTab === "notifications") {
      fetchNotifications();
    }
  }, [user, currentTab]);

  // Unique modules list from catalogue
  const availableModules = useMemo(() => {
    const map = new Map<string, string>();
    catalogue.forEach((c) => {
      map.set(c.module, c.moduleSlug);
    });
    return Array.from(map.entries()).map(([module, moduleSlug]) => ({ module, moduleSlug }));
  }, [catalogue]);

  // Tabs for currently selected module
  const moduleTabs = useMemo(() => {
    return catalogue.filter((c) => c.module === selectedModule);
  }, [catalogue, selectedModule]);

  // Selectable tabs (excluding tabs the user already possesses full access to)
  const selectableTabs = useMemo(() => {
    return moduleTabs.filter((t: any) => !t.hasFullAccess);
  }, [moduleTabs]);

  // Directors for currently selected department
  const currentDeptDirectors = useMemo(() => {
    if (!selectedDepartment) return [];
    const norm = selectedDepartment.toLowerCase().trim();
    // 1. From departmentDirectors mapping
    const key = Object.keys(departmentDirectors).find(
      (k) => k.toLowerCase().trim() === norm
    );
    const fromMap = key ? departmentDirectors[key] || [] : [];

    // 2. From allDirectors list matching department
    const fromAll = allDirectors.filter(
      (d) => (d.department || "").toLowerCase().trim() === norm
    );

    // Merge & deduplicate by ID / Email
    const merged = [...fromMap];
    for (const d of fromAll) {
      if (!merged.some((m) => m.id === d.id || m.email.toLowerCase() === d.email.toLowerCase())) {
        merged.push(d);
      }
    }
    return merged;
  }, [selectedDepartment, departmentDirectors, allDirectors]);

  // Other registered directors across the organization outside the selected department
  const otherDirectors = useMemo(() => {
    const currentKeys = new Set(
      currentDeptDirectors.map((d) => (d.email || d.id).toLowerCase().trim())
    );
    return allDirectors.filter(
      (d) => !currentKeys.has((d.email || d.id).toLowerCase().trim())
    );
  }, [allDirectors, currentDeptDirectors]);

  // Complete available directors list for fast lookup
  const availableDirectorsList = useMemo(() => {
    const list = [...currentDeptDirectors, ...otherDirectors];
    if (fallbackDirector && !list.some((d) => d.id === fallbackDirector.id || d.email === fallbackDirector.email)) {
      list.push(fallbackDirector as any);
    }
    return list;
  }, [currentDeptDirectors, otherDirectors, fallbackDirector]);

  // Determine applicant's route: A (Staff: 3 stages), B (Directors: 2 stages), C (IT Director: 1 stage)
  const applicantRoute = useMemo<{
    route: "A" | "B" | "C";
    routeName: string;
    totalStages: number;
    routeNote: string;
  }>(() => {
    if (!user) {
      return {
        route: "A",
        routeName: "Route A: Staff (3 stages)",
        totalStages: 3,
        routeNote:
          "As a staff member, your request goes to your Department Director, then to the IT Director, then to Super Admin for final approval.",
      };
    }
    const normRole = (user.role || "").toUpperCase();
    const normPos = (user.position || "").toLowerCase();

    // Route C: IT Director
    if (normRole === "IT" || normPos.includes("it director")) {
      return {
        route: "C",
        routeName: "Route C: IT Director (1 stage)",
        totalStages: 1,
        routeNote: "As the IT Director, your request goes straight to Super Admin for final approval.",
      };
    }

    // Route B: Directors (all Directors except IT Director)
    const isDirector =
      ["HR", "FIN", "PRC", "PRG", "IAR"].includes(normRole) ||
      normPos.includes("director");

    if (isDirector) {
      return {
        route: "B",
        routeName: "Route B: Director (2 stages)",
        totalStages: 2,
        routeNote:
          "As a Director, your request goes to the IT Director, then to Super Admin for final approval. Executive Management is informed.",
      };
    }

    // Route A: Staff
    return {
      route: "A",
      routeName: "Route A: Staff (3 stages)",
      totalStages: 3,
      routeNote:
        "As a staff member, your request goes to your Department Director, then to the IT Director, then to Super Admin for final approval.",
    };
  }, [user]);

  // Executive Management members for Route B (exclude applicant if applicant is in Executive Management)
  const filteredExecMembers = useMemo(() => {
    if (!user) return executiveManagementMembers;
    const userEmail = (user.email || "").toLowerCase().trim();
    const userId = (user.employeeId || "").toLowerCase().trim();
    return executiveManagementMembers.filter(
      (m) =>
        m.email.toLowerCase().trim() !== userEmail &&
        m.id.toLowerCase().trim() !== userId
    );
  }, [executiveManagementMembers, user]);

  const activeSelectedExecMember = useMemo(() => {
    if (filteredExecMembers.length === 0) return null;
    return filteredExecMembers.find((m) => m.id === selectedExecId) || filteredExecMembers[0];
  }, [filteredExecMembers, selectedExecId]);

  useEffect(() => {
    if (filteredExecMembers.length > 0 && (!selectedExecId || !filteredExecMembers.some((m) => m.id === selectedExecId))) {
      setSelectedExecId(filteredExecMembers[0].id);
    }
  }, [filteredExecMembers, selectedExecId]);

  // For Route A: Department Director of selected department
  const activeSelectedDeptDirector = useMemo(() => {
    if (currentDeptDirectors.length === 0) {
      return fallbackDirector;
    }
    if (selectedDirectorId) {
      const match = currentDeptDirectors.find((d) => d.id === selectedDirectorId);
      if (match) return match;
    }
    return currentDeptDirectors[0];
  }, [currentDeptDirectors, selectedDirectorId, fallbackDirector]);

  useEffect(() => {
    if (currentDeptDirectors.length > 0) {
      setSelectedDirectorId(currentDeptDirectors[0].id);
    } else if (fallbackDirector) {
      setSelectedDirectorId(fallbackDirector.id);
    }
  }, [currentDeptDirectors, fallbackDirector]);

  // Check if any selected tab is sensitive
  const hasSelectedSensitive = useMemo(() => {
    return moduleTabs.some((t) => selectedTabs.includes(t.tabId) && t.sensitive);
  }, [moduleTabs, selectedTabs]);

  const handleTabToggle = (tabId: string) => {
    setSelectedTabs((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]
    );
  };

  const handleSelectAllTabs = () => {
    setSelectedTabs(selectableTabs.map((t) => t.tabId));
  };

  const handleClearTabs = () => {
    setSelectedTabs([]);
  };

  const handleRemoveChip = (tabId: string) => {
    setSelectedTabs((prev) => prev.filter((id) => id !== tabId));
  };

  const handleRightToggle = (right: AccessRight) => {
    setSelectedRights((prev) =>
      prev.includes(right) ? prev.filter((r) => r !== right) : [...prev, right]
    );
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccessMsg(null);

    // Client-side department mismatch check
    const userDept = user?.department || "";
    if (
      selectedDepartment &&
      userDept &&
      selectedDepartment.trim().toLowerCase() !== userDept.trim().toLowerCase()
    ) {
      setFormError("This is not your department. Contact HR to update your record.");
      return;
    }

    if (selectedTabs.length === 0) {
      setFormError("Please select at least one tab from the list.");
      return;
    }
    if (selectedRights.length === 0) {
      setFormError("Please select at least one access right (Read, Write, View, Upload, Download).");
      return;
    }
    if (durationType === "Temporary" && !endDate) {
      setFormError("End date is required for temporary access requests.");
      return;
    }
    if (!justification.trim()) {
      setFormError("Justification is required.");
      return;
    }
    if (hasSelectedSensitive && justification.trim().length < 50) {
      setFormError(
        `Sensitive tabs require at least 50 characters of detailed justification (currently ${justification.trim().length}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const selectedTabObjs = moduleTabs
        .filter((t) => selectedTabs.includes(t.tabId))
        .map((t) => ({ tab: t.tab, tabId: t.tabId }));

      const currentModObj = availableModules.find((m) => m.module === selectedModule);

      const res = await fetch("/api/access/requests", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          department: selectedDepartment,
          directorId:
            applicantRoute.route === "B"
              ? activeSelectedExecMember?.id
              : activeSelectedDeptDirector?.id,
          directorEmail:
            applicantRoute.route === "B"
              ? activeSelectedExecMember?.email
              : activeSelectedDeptDirector?.email,
          executiveManagementId:
            applicantRoute.route === "B" ? activeSelectedExecMember?.id : undefined,
          executiveManagementEmail:
            applicantRoute.route === "B" ? activeSelectedExecMember?.email : undefined,
          module: selectedModule,
          moduleSlug: currentModObj?.moduleSlug,
          tabs: selectedTabObjs,
          rightsRequested: selectedRights,
          durationType,
          endDate: durationType === "Temporary" ? endDate : undefined,
          justification,
          document: documentUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit application.");
      }

      setSubmitSuccessMsg(
        `Application ${data.requestNumber} (${data.request?.routeName || applicantRoute.routeName}) submitted successfully! Current status: ${data.request?.status || "Pending Approval"}.`
      );
      // Reset form fields
      setSelectedTabs([]);
      setJustification("");
      setDocumentUrl("");
      setEndDate("");
      fetchRequests();
    } catch (err: any) {
      setFormError(err.message || "An error occurred during submission.");
    } finally {
      setSubmitting(false);
    }
  };

  // Staff Confirmation action
  const handleConfirmAccess = async () => {
    if (!selectedRequest) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/access/requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ action: "Confirm" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to confirm access.");
      }
      // Refresh active user grants cache for instant sidebar update
      if (typeof window !== "undefined") {
        fetch("/api/access/grants", { headers: getHeaders() })
          .then((r) => r.json())
          .then((gd) => {
            if (gd.success && gd.grants) {
              const activeUserGrants = gd.grants
                .filter((g: any) => g.status === "Active" && g.userEmail === user?.email)
                .map((g: any) => ({
                  moduleSlug: g.moduleSlug,
                  tabId: g.tabId,
                  rights: g.rightsGranted,
                }));
              sessionStorage.setItem("bcf_user_grants", JSON.stringify(activeUserGrants));
              localStorage.setItem("bcf_user_grants", JSON.stringify(activeUserGrants));
            }
          })
          .catch(() => {});
      }
      fetchRequests();
      setSelectedRequest(null);
      alert("Access has been successfully confirmed and activated! The granted tabs are now live.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setConfirming(false);
    }
  };

  // Staff Decline action
  const handleDeclineAccess = async () => {
    if (!selectedRequest || !declineReason.trim()) {
      alert("A reason is required to decline granted access.");
      return;
    }
    try {
      const res = await fetch(`/api/access/requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ action: "Decline", reason: declineReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to decline access.");
      }
      setShowDeclineModal(false);
      setDeclineReason("");
      setSelectedRequest(null);
      fetchRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Cancel request (Stage 1 only)
  const handleCancelRequest = async (reqId: string) => {
    if (!confirm("Are you sure you want to cancel this pending access application?")) return;
    try {
      const res = await fetch(`/api/access/requests/${reqId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ action: "Cancel", reason: "Cancelled by applicant" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to cancel request.");
      }
      fetchRequests();
      if (selectedRequest?.id === reqId) setSelectedRequest(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Mark all notifications read
  const handleMarkAllNotifsRead = async () => {
    try {
      await fetch("/api/access/notifications", {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ markAll: true }),
      });
      fetchNotifications();
    } catch (e) {}
  };

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus =
        statusFilter === "all" || r.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesDept =
        deptFilter === "all" || r.department.toLowerCase() === deptFilter.toLowerCase();
      const matchesSearch =
        !searchFilter ||
        r.requestNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.module.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.requesterName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.items.some((i) => i.tab.toLowerCase().includes(searchFilter.toLowerCase()));

      return matchesStatus && matchesDept && matchesSearch;
    });
  }, [requests, statusFilter, deptFilter, searchFilter]);

  // Departments list for filtering
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set);
  }, [requests]);

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          TAB 1: ACCESS APPLICATION
          ───────────────────────────────────────────────────────────── */}
      {currentTab === "access-application" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800 gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">post_add</span>
                  Access Application Form
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Request access permissions to any tab in the BCF SL Administration Hub.
                </p>
              </div>
              <div className="text-right flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Auto Ref: BCF-ACC-2026-XXXXXX
                </span>
              </div>
            </div>

            {submitSuccessMsg && (
              <div className="mt-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-xl shrink-0 mt-0.5">
                  check_circle
                </span>
                <div className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
                  <p className="font-bold">Application Submitted Successfully</p>
                  <p className="mt-1">{submitSuccessMsg}</p>
                  <button
                    onClick={() => router.push("/access/my-requests")}
                    className="mt-2 text-xs font-bold underline cursor-pointer"
                  >
                    View in My Requests &rarr;
                  </button>
                </div>
              </div>
            )}

            {formError && (
              <div className="mt-5 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3">
                <span className="material-symbols-outlined text-red-600 text-xl shrink-0 mt-0.5">
                  error
                </span>
                <div className="text-xs sm:text-sm text-red-800 dark:text-red-300">
                  <p className="font-bold">Application Submission Error</p>
                  <p className="mt-1">{formError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitApplication} className="mt-6 space-y-6">
              {/* 1. Applicant details (automatic, read-only) */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Applicant Details (Automatic &bull; Read-Only)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">Application Number</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      BCF-ACC-{new Date().getFullYear()}-AUTO
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Date</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Requested By</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {user?.name || "Staff Member"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Staff ID</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {user?.employeeId || "BCF-ST-001"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Position</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {user?.position || user?.role || "Staff"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Department & Director (Route-Enforced) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Department */}
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {departments.length > 0 ? (
                      departments.map((d) => (
                        <option key={d} value={d}>
                          {d} {user?.department && normalizeDeptCompare(d) === normalizeDeptCompare(user.department) ? "(Your Department)" : ""}
                        </option>
                      ))
                    ) : (
                      <option value={user?.department ? canonicalizeDept(user.department) : "Executive Management"}>
                        {user?.department ? canonicalizeDept(user.department) : "Executive Management"}
                      </option>
                    )}
                  </select>
                  {selectedDepartment && user?.department && normalizeDeptCompare(selectedDepartment) !== normalizeDeptCompare(user.department) ? (
                    <p className="mt-1.5 text-xs font-bold text-red-500 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">warning</span>
                      This is not your department. Contact HR to update your record.
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Preselected from your Staff Directory record.
                    </p>
                  )}
                </div>

                {/* 2. Director (Automatically Populated & Read-Only) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {applicantRoute.route === "B" ? "Executive Management" : "Director"} <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      Auto-Populated &bull; Read-Only
                    </span>
                  </div>

                  {/* Route C: IT Director */}
                  {applicantRoute.route === "C" ? (
                    <div className="p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 text-xs shadow-inner min-h-[96px] flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-base shrink-0">
                            verified
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                            Not required (full access)
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                          Route C: 1 Stage
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                        As the IT Director, your application bypasses department and IT review and goes straight to Super Admin for final approval.
                      </p>
                    </div>
                  ) : applicantRoute.route === "B" ? (
                    /* Route B: Directors -> Executive Management member */
                    <div className="space-y-2">
                      {filteredExecMembers.length > 1 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-500">Choose Executive:</span>
                          <select
                            value={selectedExecId}
                            onChange={(e) => setSelectedExecId(e.target.value)}
                            className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                          >
                            {filteredExecMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} &bull; {m.position}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 text-xs shadow-inner min-h-[96px] flex flex-col justify-between">
                        {activeSelectedExecMember ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-base shrink-0">
                                  corporate_fare
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                                  {activeSelectedExecMember.name}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 shrink-0 truncate max-w-[150px]">
                                {activeSelectedExecMember.position}
                              </span>
                            </div>

                            <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700/60 flex flex-col gap-0.5 text-[11px]">
                              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                <span>Staff ID: <strong className="font-mono text-slate-700 dark:text-slate-300">{activeSelectedExecMember.id}</strong></span>
                                <span className="text-purple-700 dark:text-purple-400 font-semibold text-[10px]">
                                  Executive Management
                                </span>
                              </div>
                              <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 text-[10px] sm:text-[11px] truncate mt-0.5">
                                <span className="material-symbols-outlined text-xs shrink-0">info</span>
                                Notification: <span className="font-mono">{activeSelectedExecMember.email}</span> (For information only)
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="py-4 text-center text-slate-500 font-semibold">
                            Not required
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Route A: Staff Member -> Department Director */
                    <div className="space-y-2">
                      {currentDeptDirectors.length > 1 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-500">Choose Director:</span>
                          <select
                            value={selectedDirectorId}
                            onChange={(e) => setSelectedDirectorId(e.target.value)}
                            className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                          >
                            {currentDeptDirectors.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.position})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 text-xs shadow-inner min-h-[96px] flex flex-col justify-between">
                        {currentDeptDirectors.length === 0 ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="material-symbols-outlined text-amber-600 text-base shrink-0">
                                  report_problem
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                  No Director assigned, request will go to {fallbackDirector?.name || "CEO"}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 shrink-0">
                                Flagged to Super Admin
                              </span>
                            </div>
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                              This department has no assigned Director. Routed to institutional fallback ({fallbackDirector?.position || "CEO"}).
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-base shrink-0">
                                  verified_user
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                                  {activeSelectedDeptDirector?.name || "Department Director"}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                                {activeSelectedDeptDirector?.position || "Department Director"}
                              </span>
                            </div>

                            <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700/60 flex flex-col gap-0.5 text-[11px]">
                              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                <span>Staff ID: <strong className="font-mono text-slate-700 dark:text-slate-300">{activeSelectedDeptDirector?.id || "N/A"}</strong></span>
                                <span className="truncate max-w-[130px]">Stage 1 Approver</span>
                              </div>
                              <p className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 text-[10px] sm:text-[11px] truncate mt-0.5">
                                <span className="material-symbols-outlined text-xs shrink-0">forward_to_inbox</span>
                                Approval notification: <strong className="font-mono truncate">{activeSelectedDeptDirector?.email}</strong>
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* One-line note under field explaining the route */}
                  <p className="mt-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-blue-500">route</span>
                    {applicantRoute.routeNote}
                  </p>
                </div>
              </div>

              {/* 3. Module & Tabs */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                  Module <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedModule}
                  onChange={(e) => {
                    const nextMod = e.target.value;
                    if (selectedTabs.length > 0 && nextMod !== selectedModule) {
                      setPendingModule(nextMod);
                      setShowModuleConfirmModal(true);
                    } else {
                      setSelectedModule(nextMod);
                      setSelectedTabs([]);
                    }
                  }}
                  className="w-full sm:w-80 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {availableModules.map((m) => (
                    <option key={m.module} value={m.module}>
                      {m.module}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tabs selection (multi-select, immediately beneath Module) */}
              <div>
                <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Tab(s) of {selectedModule} <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {selectedTabs.length} of {selectableTabs.length} tabs selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllTabs}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={handleClearTabs}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {moduleTabs.map((tab) => {
                    const isSelected = selectedTabs.includes(tab.tabId);
                    const alreadyHas = (tab as any).hasFullAccess;
                    return (
                      <div
                        key={tab.tabId}
                        onClick={() => !alreadyHas && handleTabToggle(tab.tabId)}
                        className={`p-3 rounded-xl border text-xs transition cursor-pointer flex items-start gap-2.5 ${
                          alreadyHas
                            ? "bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed"
                            : isSelected
                            ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-100 shadow-sm"
                            : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={alreadyHas}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate text-slate-900 dark:text-white">
                            {tab.tab}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {tab.sensitive && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">shield</span>
                                Sensitive
                              </span>
                            )}
                            {alreadyHas && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                Already have access
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Sensitive access warning banner if sensitive tab is picked */}
              {hasSelectedSensitive && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 text-xl shrink-0 mt-0.5">
                    warning
                  </span>
                  <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                    <p className="font-bold">Sensitive Access Request</p>
                    <p className="mt-0.5 leading-relaxed">
                      You have selected one or more sensitive tabs containing confidential institutional or employee data.
                      A comprehensive justification of <strong>at least 50 characters</strong> is required and will be retained in the permanent security audit trail.
                    </p>
                  </div>
                </div>
              )}

              {/* 4. Access Rights Checkboxes (Read, Write, View, Upload, Download) */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-2">
                  Access Rights Requested <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {ALL_RIGHTS.map((right) => {
                    const isChecked = selectedRights.includes(right);
                    return (
                      <label
                        key={right}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${
                          isChecked
                            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300"
                            : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRightToggle(right)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        {right}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Note: Delete, approve, and restore actions can never be granted through access requests and remain restricted to executive RBAC matrices.
                </p>
              </div>

              {/* 5. Duration (Permanent / Temporary) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                    Duration <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="duration"
                        value="Permanent"
                        checked={durationType === "Permanent"}
                        onChange={() => setDurationType("Permanent")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      Permanent
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="duration"
                        value="Temporary"
                        checked={durationType === "Temporary"}
                        onChange={() => setDurationType("Temporary")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      Temporary
                    </label>
                  </div>
                </div>

                {durationType === "Temporary" && (
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 6. Justification with dynamic character counter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Justification / Business Need <span className="text-red-500">*</span>
                  </label>
                  <span
                    className={`text-xs font-mono font-bold ${
                      hasSelectedSensitive && justification.length < 50
                        ? "text-amber-500"
                        : "text-slate-400"
                    }`}
                  >
                    {justification.length} chars {hasSelectedSensitive && "(min 50 required)"}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="State the official institutional purpose, operational assignment, or project deliverable requiring this access..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* 7. Supporting Document (Optional) */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                  Supporting Document URL / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  placeholder="https://... or Internal Memo Ref / Project Charter"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* 8. Selected Tabs Summary Chips (Removable with 'x') */}
              {selectedTabs.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Selected Tabs Summary ({selectedTabs.length}):
                    </span>
                    <button
                      type="button"
                      onClick={handleClearTabs}
                      className="text-[11px] font-bold text-red-500 hover:underline cursor-pointer"
                    >
                      Remove all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTabs.map((tabId) => {
                      const found = moduleTabs.find((t) => t.tabId === tabId);
                      const name = found ? found.tab : tabId;
                      return (
                        <span
                          key={tabId}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                        >
                          {name}
                          {found?.sensitive && (
                            <span className="material-symbols-outlined text-[12px] text-amber-600">shield</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveChip(tabId)}
                            className="text-blue-600 dark:text-blue-300 hover:text-red-500 dark:hover:text-red-400 ml-0.5 cursor-pointer font-black text-sm"
                            title="Remove tab"
                          >
                            &times;
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTabs([]);
                    setJustification("");
                    setDocumentUrl("");
                    setFormError(null);
                  }}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">send</span>
                      Submit Application
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Module change confirmation modal */}
            {showModuleConfirmModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-500 text-2xl">warning</span>
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                        Confirm Module Change
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        Changing the module will clear your selected tabs. Continue?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModuleConfirmModal(false);
                        setPendingModule(null);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (pendingModule) {
                          setSelectedModule(pendingModule);
                          setSelectedTabs([]);
                        }
                        setShowModuleConfirmModal(false);
                        setPendingModule(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Applications Under Form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-base">history</span>
                Recent Applications
              </h3>
              <button
                onClick={() => router.push("/access/my-requests")}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Go to My Requests &rarr;
              </button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-2.5 px-3">Application Ref</th>
                    <th className="py-2.5 px-3">Module</th>
                    <th className="py-2.5 px-3">Tab(s)</th>
                    <th className="py-2.5 px-3">Rights</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {requests.slice(0, 5).map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => {
                        setSelectedRequest(r);
                        router.push(`/access/my-requests?req=${r.requestNumber}`);
                      }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {r.requestNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-900 dark:text-white font-semibold">
                        {r.module}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {r.items.map((it) => it.tab).join(", ")}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {r.items[0]?.rightsRequested?.join(", ")}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === "Active"
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                            : r.status.includes("Pending")
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                            : r.status === "Granted (awaiting confirmation)"
                            ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">
                        No previous applications found. Submit your first request above!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: MY REQUESTS
          ───────────────────────────────────────────────────────────── */}
      {currentTab === "my-requests" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
                  search
                </span>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search number, module, tab..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <option value="all">All Statuses</option>
                <option value="Pending Department Director">Pending Dept Director</option>
                <option value="Pending IT Director">Pending IT Director</option>
                <option value="Pending Super Admin">Pending Super Admin</option>
                <option value="Granted (awaiting confirmation)">Granted (Awaiting Confirmation)</option>
                <option value="Active">Active</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Declined">Declined</option>
                <option value="Revoked">Revoked</option>
              </select>

              {/* Department Filter for Executives */}
              {departmentsList.length > 1 && (
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <option value="all">All Departments</option>
                  {departmentsList.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={fetchRequests}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh
            </button>
          </div>

          {/* Requests Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-extrabold uppercase border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Application Ref</th>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Tabs Requested</th>
                    <th className="py-3 px-4">Rights</th>
                    <th className="py-3 px-4">Current Stage</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredRequests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition"
                      onClick={() => setSelectedRequest(req)}
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 block">
                          {req.requestNumber}
                        </span>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {req.routeName || (req.route === "B" ? "Route B: Director (2 stages)" : req.route === "C" ? "Route C: IT Director (1 stage)" : "Route A: Staff (3 stages)")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {req.requesterName}
                        </span>
                        <span className="text-[10px] text-slate-400">{req.department}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {req.module}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {req.items.map((i) => i.tab).join(", ")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {req.items[0]?.rightsGranted?.join(", ") ||
                            req.items[0]?.rightsRequested?.join(", ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">
                        Stage {req.currentStage} of {req.totalStages || (req.route === "B" ? 2 : req.route === "C" ? 1 : 3)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === "Active"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                              : req.status.includes("Pending")
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                              : req.status === "Granted (awaiting confirmation)"
                              ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 animate-pulse"
                              : req.status === "Rejected"
                              ? "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {req.status.includes("Pending") &&
                            req.currentStage === 1 &&
                            req.requesterEmail.toLowerCase() === user?.email.toLowerCase() && (
                              <button
                                onClick={() => handleCancelRequest(req.id)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 dark:bg-red-950/40 text-red-600 hover:bg-red-100 transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          <button
                            onClick={() => setSelectedRequest(req)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
                          >
                            Timeline &rarr;
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRequests.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No access requests match your active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Request Detail & Timeline Modal */}
          {selectedRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {selectedRequest.requestNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                        {selectedRequest.routeName || (selectedRequest.route === "B" ? "Route B: Director (2 stages)" : selectedRequest.route === "C" ? "Route C: IT Director (1 stage)" : "Route A: Staff (3 stages)")}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                      Access Request Details &amp; Approval Timeline
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-5 text-xs">
                  {/* Executive Management Info Only Banner */}
                  {user && (
                    (selectedRequest.executive_management_id && user.employeeId === selectedRequest.executive_management_id) ||
                    (selectedRequest.executiveManagementEmail && user.email.toLowerCase() === selectedRequest.executiveManagementEmail.toLowerCase())
                  ) && (
                    <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-purple-600 text-lg shrink-0 mt-0.5">
                        info
                      </span>
                      <div>
                        <p className="font-bold text-purple-900 dark:text-purple-200 text-xs">
                          Executive Management &bull; Read-Only Information View
                        </p>
                        <p className="text-[11px] text-purple-800 dark:text-purple-300 mt-0.5 leading-relaxed">
                          You are named as Executive Management on this Director application for information only. You cannot approve, reject, grant or edit this request.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Route Overview & Stages Progression */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-indigo-600">route</span>
                        Approval Stages Route
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                        {selectedRequest.routeName || (selectedRequest.route === "B" ? "Route B: Director (2 stages)" : selectedRequest.route === "C" ? "Route C: IT Director (1 stage)" : "Route A: Staff (3 stages)")}
                      </span>
                    </div>

                    {/* Stage Steps Graphic */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                      {selectedRequest.route === "C" ? (
                        <>
                          <div className={`p-2 rounded-lg border ${selectedRequest.status === "Pending Super Admin" ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 font-bold text-amber-800 dark:text-amber-300" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600"}`}>
                            <span className="block font-bold">Stage 1</span>
                            <span>Super Admin Grant</span>
                          </div>
                          <div className={`p-2 rounded-lg border ${selectedRequest.status === "Active" ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 font-bold text-emerald-800 dark:text-emerald-300" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600"}`}>
                            <span className="block font-bold">Activation</span>
                            <span>IT Director Confirmed</span>
                          </div>
                        </>
                      ) : selectedRequest.route === "B" ? (
                        <>
                          <div className={`p-2 rounded-lg border ${selectedRequest.currentStage === 1 && selectedRequest.status === "Pending IT Director" ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 font-bold text-amber-800 dark:text-amber-300" : selectedRequest.currentStage > 1 || selectedRequest.status === "Active" || selectedRequest.status === "Granted (awaiting confirmation)" ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 font-bold text-emerald-800 dark:text-emerald-300" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600"}`}>
                            <span className="block font-bold">Stage 1</span>
                            <span>IT Director Approval</span>
                          </div>
                          <div className={`p-2 rounded-lg border ${selectedRequest.currentStage === 2 && selectedRequest.status === "Pending Super Admin" ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 font-bold text-amber-800 dark:text-amber-300" : selectedRequest.status === "Active" || selectedRequest.status === "Granted (awaiting confirmation)" ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 font-bold text-emerald-800 dark:text-emerald-300" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600"}`}>
                            <span className="block font-bold">Stage 2</span>
                            <span>Super Admin Grant</span>
                          </div>
                          <div className={`p-2 rounded-lg border ${selectedRequest.status === "Active" ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 font-bold text-emerald-800 dark:text-emerald-300" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600"}`}>
                            <span className="block font-bold">Activation</span>
                            <span>Director Confirmed</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={`p-2 rounded-lg border ${selectedRequest.currentStage === 1 && selectedRequest.status === "Pending Department Director" ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 font-bold text-amber-800 dark:text-amber-300" : selectedRequest.currentStage > 1 || selectedRequest.status === "Active" || selectedRequest.status === "Granted (awaiting confirmation)" ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 font-bold text-emerald-800 dark:text-emerald-300" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600"}`}>
                            <span className="block font-bold">Stage 1</span>
                            <span>Dept Director</span>
                          </div>
                          <div className={`p-2 rounded-lg border ${selectedRequest.currentStage === 2 && selectedRequest.status === "Pending IT Director" ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 font-bold text-amber-800 dark:text-amber-300" : selectedRequest.currentStage > 2 || selectedRequest.status === "Active" || selectedRequest.status === "Granted (awaiting confirmation)" ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 font-bold text-emerald-800 dark:text-emerald-300" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600"}`}>
                            <span className="block font-bold">Stage 2</span>
                            <span>IT Director</span>
                          </div>
                          <div className={`p-2 rounded-lg border ${selectedRequest.currentStage === 3 && selectedRequest.status === "Pending Super Admin" ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 font-bold text-amber-800 dark:text-amber-300" : selectedRequest.status === "Active" || selectedRequest.status === "Granted (awaiting confirmation)" ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 font-bold text-emerald-800 dark:text-emerald-300" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600"}`}>
                            <span className="block font-bold">Stage 3</span>
                            <span>Super Admin Grant</span>
                          </div>
                          <div className={`p-2 rounded-lg border ${selectedRequest.status === "Active" ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 font-bold text-emerald-800 dark:text-emerald-300" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600"}`}>
                            <span className="block font-bold">Activation</span>
                            <span>Staff Confirmed</span>
                          </div>
                        </>
                      )}
                    </div>

                    {selectedRequest.route === "B" && selectedRequest.executiveManagementName && (
                      <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-1">
                        Executive Management: <strong>{selectedRequest.executiveManagementName}</strong> informed for information only.
                      </p>
                    )}
                  </div>

                  {/* Sensitive Banner */}
                  {selectedRequest.hasSensitiveTab && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">
                        shield
                      </span>
                      <div>
                        <p className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                          Sensitive Access Grant
                        </p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                          This application involves high-sensitivity tabs. Every approval, view, and modification is locked in the institutional security audit log.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 block">Applicant</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedRequest.requesterName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Department</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedRequest.department}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Module</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedRequest.module}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Duration</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedRequest.durationType}{" "}
                        {selectedRequest.endDate ? `(Until ${selectedRequest.endDate})` : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Status</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {selectedRequest.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Date Submitted</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                        {new Date(selectedRequest.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Tabs & Rights breakdown */}
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white mb-2">
                      Requested &amp; Granted Rights per Tab
                    </h4>
                    <div className="space-y-1.5">
                      {selectedRequest.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {it.tab}
                            </span>
                            {it.sensitive && (
                              <span className="ml-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                (Sensitive)
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px]">
                              Requested: {it.rightsRequested.join(", ")}
                            </span>
                            {it.rightsGranted && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold block text-[11px]">
                                Granted: {it.rightsGranted.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Justification */}
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white mb-1">
                      Applicant Justification
                    </h4>
                    <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedRequest.justification}
                    </p>
                  </div>

                  {/* Reduced rights reason banner if applicable */}
                  {selectedRequest.reducedRightsReason && (
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                      <span className="font-bold text-blue-900 dark:text-blue-200 block">
                        Super Admin Rights Modification Note:
                      </span>
                      <p className="text-blue-800 dark:text-blue-300 mt-0.5">
                        {selectedRequest.reducedRightsReason}
                      </p>
                    </div>
                  )}

                  {/* Rejection / Cancellation / Revocation reason */}
                  {selectedRequest.rejectionReason && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                      <span className="font-bold text-red-900 dark:text-red-200 block">
                        Rejection Reason:
                      </span>
                      <p className="text-red-800 dark:text-red-300 mt-0.5">
                        {selectedRequest.rejectionReason}
                      </p>
                    </div>
                  )}

                  {/* STAFF CONFIRMATION SECTION (when status is Granted, awaiting confirmation) */}
                  {selectedRequest.status === "Granted (awaiting confirmation)" &&
                    selectedRequest.requesterEmail.toLowerCase() === user?.email.toLowerCase() && (
                      <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-600">verified</span>
                          <h4 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-200">
                            Action Required: Confirm &amp; Accept Granted Access
                          </h4>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          Super Admin has accepted your application and granted rights. Please review the acceptance statement below and confirm access to activate it.
                        </p>
                        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-[11px] italic text-slate-700 dark:text-slate-300">
                          &ldquo;{settings?.acceptanceStatement || "I will use this access only for my authorized work, keep my login private, and report any misuse."}&rdquo;
                        </div>
                        <label className="flex items-center gap-2.5 text-xs font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          I accept the terms and activate this access
                        </label>
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            disabled={!acceptedTerms || confirming}
                            onClick={handleConfirmAccess}
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50 cursor-pointer shadow-sm transition"
                          >
                            {confirming ? "Activating..." : "Accept Access"}
                          </button>
                          <button
                            onClick={() => setShowDeclineModal(true)}
                            className="px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 font-bold text-xs hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Timeline History */}
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white mb-2">
                      Approval &amp; Audit Trail Timeline
                    </h4>
                    <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 dark:border-slate-800">
                      {selectedRequest.steps.map((step) => (
                        <div key={step.id} className="relative">
                          <span
                            className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full ring-4 ring-white dark:ring-slate-900 ${
                              step.action === "Approved" || step.action === "Accepted"
                                ? "bg-emerald-500"
                                : step.action === "Rejected" || step.action === "Revoked"
                                ? "bg-red-500"
                                : step.action === "Granted"
                                ? "bg-blue-500"
                                : step.action === "Viewed"
                                ? "bg-slate-400"
                                : "bg-blue-400"
                            }`}
                          />
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {step.action}: {step.stageName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(step.actedAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              By {step.approverName} ({step.approverRole})
                            </p>
                            {step.comment && (
                              <p className="mt-1 text-slate-700 dark:text-slate-300 italic">
                                &ldquo;{step.comment}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Decline Reason Modal */}
          {showDeclineModal && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-md shadow-2xl">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Decline Granted Access
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Please provide a reason for declining this granted access request.
                </p>
                <textarea
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Reason for declining..."
                  className="w-full mt-3 p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowDeclineModal(false)}
                    className="px-3.5 py-1.5 rounded-xl border text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeclineAccess}
                    className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold"
                  >
                    Confirm Decline
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: NOTIFICATIONS
          ───────────────────────────────────────────────────────────── */}
      {currentTab === "notifications" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">notifications</span>
                Access Control Notifications
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Personal alerts for submitted requests, approvals, and activations.
              </p>
            </div>
            {unreadNotifsCount > 0 && (
              <button
                onClick={handleMarkAllNotifsRead}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) {
                    fetch("/api/access/notifications", {
                      method: "PATCH",
                      headers: getHeaders(),
                      body: JSON.stringify({ notificationId: notif.id }),
                    }).catch(() => {});
                  }
                  router.push(`/access/my-requests?req=${notif.requestNumber}`);
                }}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                  !notif.isRead
                    ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 shadow-xs"
                    : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                }`}
              >
                <span className="material-symbols-outlined text-blue-600 text-xl shrink-0 mt-0.5">
                  vpn_key
                </span>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {notif.title}
                    </p>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {notif.requestNumber}
                    </span>
                    {!notif.isRead && (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                        Unread
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs">
                No access notifications to display.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
