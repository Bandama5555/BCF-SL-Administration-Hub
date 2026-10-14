"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUser, type AuthUser } from "@/lib/auth";
import {
  AccessRequest,
  AccessGrant,
  AccessRight,
} from "@/lib/accessTypes";
import { normalizeRole, RoleCode } from "@/lib/permissions";

interface Props {
  currentTab: "access-approval" | "access-acceptance";
}

const ALL_RIGHTS: AccessRight[] = ["Read", "Write", "View", "Upload", "Download"];

export function AccessApprovalModuleView({ currentTab }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reqParam = searchParams.get("req");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab 1 filters: "awaiting" | "decided" | "all"
  const [queueFilter, setQueueFilter] = useState<"awaiting" | "decided" | "all">("awaiting");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Detail state
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [actionType, setActionType] = useState<"Approve" | "Reject" | "Grant" | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Grant customization state (Stage 3 Super Admin)
  const [customizedItems, setCustomizedItems] = useState<{
    tabId: string;
    tab: string;
    rightsGranted: AccessRight[];
  }[]>([]);
  const [reducedRightsReason, setReducedRightsReason] = useState("");
  const [grantEndDate, setGrantEndDate] = useState("");

  // Revoke modal state
  const [revokeGrantId, setRevokeGrantId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);

  // Load user
  useEffect(() => {
    setUser(getUser());
  }, []);

  const roleCode: RoleCode = normalizeRole(user?.role, user?.username, user?.email);
  const isHrDirector = roleCode === "HR";
  const isSuperAdmin = roleCode === "SA";

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

  const fetchRequests = () => {
    if (!user) return;
    setLoading(true);
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
              handleOpenDetail(matched.id);
            }
          }
        }
      })
      .catch((err) => console.error("Error loading requests:", err))
      .finally(() => setLoading(false));
  };

  const fetchGrants = () => {
    if (!user) return;
    fetch("/api/access/grants", { headers: getHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setGrants(data.grants || []);
        }
      })
      .catch((err) => console.error("Error loading grants:", err));
  };

  useEffect(() => {
    if (user) {
      fetchRequests();
      if (currentTab === "access-acceptance") {
        fetchGrants();
      }
    }
  }, [user, currentTab, reqParam]);

  // Open detail and record "Viewed" step on server
  const handleOpenDetail = async (requestId: string) => {
    try {
      const res = await fetch(`/api/access/requests/${requestId}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedRequest(data.request);
        // Pre-fill grant customization with requested rights
        setCustomizedItems(
          data.request.items.map((it: any) => ({
            tabId: it.tabId,
            tab: it.tab,
            rightsGranted: [...it.rightsRequested],
          }))
        );
        setGrantEndDate(data.request.endDate || "");
      } else {
        alert(data.error || "You do not have access to that page.");
      }
    } catch (e: any) {
      alert("Error opening request detail.");
    }
  };

  // Determine if this request is currently awaiting action by the current user
  const isAwaitingCurrentUserAction = (req: AccessRequest): boolean => {
    if (isHrDirector) return false; // HR is view-only
    const reqEmail = (req.requesterEmail || "").toLowerCase().trim();
    const myEmail = (user?.email || "").toLowerCase().trim();

    // Nobody can approve their own request!
    if (reqEmail === myEmail) return false;

    // Route A Stage 1: Pending Department Director
    if (req.status === "Pending Department Director") {
      if (roleCode === "CEO") return true;
      if (req.directorEmail && req.directorEmail.toLowerCase().trim() === myEmail) return true;
      const userDept = (user?.department || "").toLowerCase().replace(/department/g, "").trim();
      const reqDept = (req.department || "").toLowerCase().replace(/department/g, "").trim();
      return userDept.length > 0 && userDept === reqDept;
    }

    // Route A Stage 2 & Route B Stage 1: Pending IT Director
    if (req.status === "Pending IT Director") {
      return roleCode === "IT" || roleCode === "SA";
    }

    // Route A Stage 3, Route B Stage 2, Route C Stage 1: Pending Super Admin
    if (req.status === "Pending Super Admin") {
      return roleCode === "SA" || (reqEmail.includes("admin") && roleCode === "CEO");
    }

    return false;
  };

  // Filter requests for Tab 1 (Access Approval)
  const approvalFilteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesSearch =
        !searchQuery ||
        r.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.department.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (queueFilter === "awaiting") {
        return isAwaitingCurrentUserAction(r);
      }
      if (queueFilter === "decided") {
        return r.steps.some(
          (s) => s.approverEmail?.toLowerCase() === user?.email.toLowerCase() && s.action !== "Viewed"
        );
      }
      return true; // "all"
    });
  }, [requests, queueFilter, searchQuery, user, roleCode]);

  // Tab 2: Requests awaiting Super Admin Acceptance & Grant (Pending Super Admin across all routes)
  const awaitingAcceptanceRequests = useMemo(() => {
    return requests.filter(
      (r) => r.status === "Pending Super Admin"
    );
  }, [requests]);

  // Action submit (Approve / Reject / Grant)
  const handleExecuteAction = async () => {
    if (!selectedRequest || !actionType) return;
    if (actionType === "Reject" && !actionReason.trim()) {
      alert("A rejection reason is required.");
      return;
    }

    setActionSubmitting(true);
    try {
      const payload: any = {
        action: actionType,
        comment: actionComment,
        reason: actionReason,
      };

      if (actionType === "Grant") {
        payload.items = customizedItems;
        payload.reducedRightsReason = reducedRightsReason;
        payload.endDate = grantEndDate || undefined;
      }

      const res = await fetch(`/api/access/requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Action execution failed.");
      }

      alert(data.message || "Action executed successfully.");
      setSelectedRequest(null);
      setActionType(null);
      setActionComment("");
      setActionReason("");
      setReducedRightsReason("");
      fetchRequests();
      if (currentTab === "access-acceptance") fetchGrants();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Revoke active grant
  const handleRevokeGrant = async () => {
    if (!revokeGrantId || !revokeReason.trim()) {
      alert("A revocation reason is required.");
      return;
    }
    setRevoking(true);
    try {
      const res = await fetch("/api/access/grants", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ grantId: revokeGrantId, reason: revokeReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to revoke grant.");
      }
      alert(data.message || "Access revoked successfully.");
      setRevokeGrantId(null);
      setRevokeReason("");
      fetchGrants();
      fetchRequests();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          TAB 1: ACCESS APPROVAL QUEUE
          ───────────────────────────────────────────────────────────── */}
      {currentTab === "access-approval" && (
        <div className="space-y-6">
          {/* Header Controls Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setQueueFilter("awaiting")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  queueFilter === "awaiting"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <span className="material-symbols-outlined text-sm">pending_actions</span>
                Awaiting My Action
              </button>
              <button
                onClick={() => setQueueFilter("decided")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  queueFilter === "decided"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <span className="material-symbols-outlined text-sm">done_all</span>
                Decided by Me
              </button>
              <button
                onClick={() => setQueueFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  queueFilter === "all"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <span className="material-symbols-outlined text-sm">list</span>
                All Requests
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search applicant, module..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-extrabold uppercase border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Ref</th>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Tabs</th>
                    <th className="py-3 px-4">Rights</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {approvalFilteredRequests.map((req) => {
                    const isMyTurn = isAwaitingCurrentUserAction(req);
                    return (
                      <tr
                        key={req.id}
                        onClick={() => handleOpenDetail(req.id)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition ${
                          isMyTurn ? "bg-blue-50/40 dark:bg-blue-950/20 font-bold" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {req.requestNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-white font-bold">
                          {req.requesterName}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {req.department}
                        </td>
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                          {req.module}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {req.items.map((i) => i.tab).join(", ")}
                          {req.hasSensitiveTab && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                              Sensitive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {req.items[0]?.rightsRequested?.join(", ")}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-500">
                          Stage {req.currentStage}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === "Active"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                                : req.status.includes("Pending")
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                                : req.status === "Rejected"
                                ? "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenDetail(req.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              isMyTurn
                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                            }`}
                          >
                            {isMyTurn ? "Review & Decide" : "View"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {approvalFilteredRequests.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        {queueFilter === "awaiting"
                          ? "No access requests currently awaiting your approval."
                          : "No requests found matching your filter."}
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
          TAB 2: ACCESS ACCEPTANCE (Super Admin Full, HR View-Only)
          ───────────────────────────────────────────────────────────── */}
      {currentTab === "access-acceptance" && (
        <div className="space-y-8">
          {/* Section 1: Awaiting Final Acceptance */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600">verified_user</span>
                  Stage 3: Awaiting Final Super Admin Acceptance
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Applications that have successfully cleared Department Director and IT Director approvals.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                {awaitingAcceptanceRequests.length} Pending Acceptance
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-extrabold uppercase border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3">Ref</th>
                    <th className="py-2.5 px-3">Applicant</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Module</th>
                    <th className="py-2.5 px-3">Tabs</th>
                    <th className="py-2.5 px-3">Requested Rights</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {awaitingAcceptanceRequests.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => handleOpenDetail(req.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                        {req.requestNumber}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {req.requesterName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {req.department}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">{req.module}</td>
                      <td className="py-2.5 px-3">{req.items.map((i) => i.tab).join(", ")}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {req.items[0]?.rightsRequested?.join(", ")}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetail(req.id)}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs transition"
                        >
                          Accept &amp; Grant Access
                        </button>
                      </td>
                    </tr>
                  ))}
                  {awaitingAcceptanceRequests.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400">
                        No requests currently awaiting Stage 3 Super Admin acceptance.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Active Grants Register */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">security</span>
                  Active Access Grants Register
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official registry of active permissions granted through the Access Approval chain.
                </p>
              </div>
              <button
                onClick={fetchGrants}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Refresh Register
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-extrabold uppercase border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-3">User / Staff</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Module</th>
                    <th className="py-3 px-3">Tab Granted</th>
                    <th className="py-3 px-3">Rights</th>
                    <th className="py-3 px-3">Granted By</th>
                    <th className="py-3 px-3">Accepted On</th>
                    <th className="py-3 px-3">End Date</th>
                    <th className="py-3 px-3">Status</th>
                    {isSuperAdmin && <th className="py-3 px-3 text-right">Revocation</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {grants.map((grant) => (
                    <tr key={grant.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {grant.userName}
                        </span>
                        <span className="text-[10px] text-slate-400">{grant.userEmail}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {grant.department}
                      </td>
                      <td className="py-3 px-3 font-semibold">{grant.module}</td>
                      <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-bold">
                        {grant.tab}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {grant.rightsGranted.join(", ")}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{grant.grantedByName}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {new Date(grant.acceptedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {grant.endDate || "Permanent"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            grant.status === "Active"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                              : grant.status === "Revoked"
                              ? "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {grant.status}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="py-3 px-3 text-right">
                          {grant.status === "Active" && (
                            <button
                              onClick={() => {
                                setRevokeGrantId(grant.id);
                                setRevokeReason("");
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 dark:bg-red-950/40 text-red-600 hover:bg-red-100 transition cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {grants.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No active access grants found in the register.
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
          MODAL: REQUEST DETAIL & DECISION CONSOLE
          ───────────────────────────────────────────────────────────── */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600 block">
                  {selectedRequest.requestNumber}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  Access Approval &amp; Decision Console
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
              {/* Sensitive Banner */}
              {selectedRequest.hasSensitiveTab && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">
                    shield
                  </span>
                  <div>
                    <p className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                      Sensitive Tab Access
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                      This request requires heightened executive oversight. All views and decisions are tracked in the permanent security audit trail.
                    </p>
                  </div>
                </div>
              )}

              {/* Applicant & Request Profile */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block font-semibold">Applicant</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedRequest.requesterName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Staff ID</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedRequest.staffId}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Department</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedRequest.department}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Position</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedRequest.position}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Module</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedRequest.module}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Duration</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedRequest.durationType} {selectedRequest.endDate ? `(${selectedRequest.endDate})` : ""}
                  </span>
                </div>
              </div>

              {/* Justification */}
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white mb-1">
                  Applicant Business Justification
                </h4>
                <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedRequest.justification}
                </p>
              </div>

              {/* SUPER ADMIN GRANT CONFIGURATION (Setting Rights & End Date) */}
              {selectedRequest.status === "Pending Super Admin" && isSuperAdmin && (
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">tune</span>
                    <h4 className="font-extrabold text-sm text-blue-950 dark:text-blue-100">
                      Super Admin Rights Configuration ({selectedRequest.routeName || "Final Grant"})
                    </h4>
                  </div>
                  <p className="text-xs text-blue-900 dark:text-blue-200">
                    You may grant all or customize granted rights per tab. A reason is required if you reduce any requested rights.
                  </p>

                  <div className="space-y-2 mt-2">
                    {customizedItems.map((item, idx) => (
                      <div
                        key={item.tabId}
                        className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.tab}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {ALL_RIGHTS.map((r) => {
                            const isChecked = item.rightsGranted.includes(r);
                            return (
                              <label
                                key={r}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold border cursor-pointer ${
                                  isChecked
                                    ? "bg-blue-100 dark:bg-blue-900/60 border-blue-400 text-blue-800 dark:text-blue-200"
                                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={isChecked}
                                  onChange={() => {
                                    setCustomizedItems((prev) => {
                                      const next = [...prev];
                                      const cur = next[idx].rightsGranted;
                                      next[idx].rightsGranted = cur.includes(r)
                                        ? cur.filter((x) => x !== r)
                                        : [...cur, r];
                                      return next;
                                    });
                                  }}
                                />
                                {r}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                      Reduced Rights Justification (Required if reducing rights)
                    </label>
                    <input
                      type="text"
                      value={reducedRightsReason}
                      onChange={(e) => setReducedRightsReason(e.target.value)}
                      placeholder="State reason if reducing rights from original application..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
                    />
                  </div>
                </div>
              )}

              {/* DECISION ACTION BUTTONS FOR APPROVER */}
              {isAwaitingCurrentUserAction(selectedRequest) && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Record Your Decision ({selectedRequest.routeName ? `${selectedRequest.routeName} &bull; ` : ""}Stage {selectedRequest.currentStage})
                  </h4>

                  {actionType === "Reject" ? (
                    <div>
                      <label className="block text-xs font-bold text-red-600 mb-1">
                        Rejection Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        placeholder="State the specific reason for rejecting this application..."
                        className="w-full p-2.5 rounded-xl border border-red-300 dark:border-red-800 text-xs font-semibold"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Approval Comment (Optional)
                      </label>
                      <input
                        type="text"
                        value={actionComment}
                        onChange={(e) => setActionComment(e.target.value)}
                        placeholder="Optional approval remarks..."
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    {selectedRequest.status === "Pending Super Admin" && isSuperAdmin ? (
                      <button
                        disabled={actionSubmitting}
                        onClick={() => {
                          setActionType("Grant");
                          setTimeout(handleExecuteAction, 50);
                        }}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {actionSubmitting ? "Processing..." : "Accept & Grant Access"}
                      </button>
                    ) : (
                      <button
                        disabled={actionSubmitting}
                        onClick={() => {
                          setActionType("Approve");
                          setTimeout(handleExecuteAction, 50);
                        }}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {actionSubmitting ? "Approving..." : "Approve & Advance"}
                      </button>
                    )}

                    {actionType !== "Reject" ? (
                      <button
                        onClick={() => setActionType("Reject")}
                        className="px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 font-bold text-xs hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                      >
                        Reject...
                      </button>
                    ) : (
                      <button
                        disabled={actionSubmitting}
                        onClick={handleExecuteAction}
                        className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {actionSubmitting ? "Rejecting..." : "Confirm Rejection"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Read-Only Notice for HR Director */}
              {isHrDirector && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs italic">
                  Note: As HR Director, you have view-only access across all approval stages.
                </div>
              )}

              {/* Full Timeline */}
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white mb-2">
                  Approval Timeline &amp; View Audit
                </h4>
                <div className="relative pl-6 space-y-3.5 border-l-2 border-slate-200 dark:border-slate-800">
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
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
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

      {/* ─────────────────────────────────────────────────────────────
          MODAL: REVOKE ACTIVE GRANT
          ───────────────────────────────────────────────────────────── */}
      {revokeGrantId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-md shadow-2xl space-y-3">
            <h4 className="font-extrabold text-sm text-red-600 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">gavel</span>
              Revoke Active Access Grant
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Revoking access will immediately remove user permissions from this module and tab. The action is permanently recorded in the institutional audit log.
            </p>
            <textarea
              rows={3}
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="State official reason for revoking access..."
              className="w-full p-2.5 rounded-xl border border-red-300 dark:border-red-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRevokeGrantId(null)}
                className="px-3.5 py-1.5 rounded-xl border text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                disabled={revoking}
                onClick={handleRevokeGrant}
                className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {revoking ? "Revoking..." : "Confirm Immediate Revocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
