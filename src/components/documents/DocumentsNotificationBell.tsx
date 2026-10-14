"use client";

import React, { useState, useEffect, useRef } from "react";
import { type DocumentNotification } from "@/lib/documentTypes";

interface DocumentsNotificationBellProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  onSelectNotification?: (notif: DocumentNotification) => void;
}

export function DocumentsNotificationBell({
  userRole,
  userName,
  userEmail,
  onSelectNotification,
}: DocumentsNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<DocumentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (userRole) headers["x-bcf-user-role"] = userRole;
      if (userName) headers["x-bcf-username"] = userName;
      if (userEmail) headers["x-bcf-email"] = userEmail;

      const res = await fetch("/api/documents/notifications", { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.warn("Failed to load document notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, [userRole, userName]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userRole) headers["x-bcf-user-role"] = userRole;
      if (userName) headers["x-bcf-username"] = userName;
      if (userEmail) headers["x-bcf-email"] = userEmail;

      await fetch("/api/documents/notifications", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ markAllRead: true }),
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn("Failed to mark all as read:", err);
    }
  };

  const markSingleAsRead = async (notifId: string) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userRole) headers["x-bcf-user-role"] = userRole;
      if (userName) headers["x-bcf-username"] = userName;
      if (userEmail) headers["x-bcf-email"] = userEmail;

      await fetch("/api/documents/notifications", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ notificationId: notifId }),
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.warn("Failed to mark notification as read:", err);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        id="documents-notification-bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Documents and Policies alerts"
        title="Documents & Policies Alerts"
        className="relative h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-300">
          notifications
        </span>
        <span className="hidden sm:inline">Module Alerts</span>
        {unreadCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-600 text-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 flex flex-col gap-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                Documents &amp; Policies Alerts
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {loading && notifications.length === 0 ? (
              <div className="py-6 text-center text-slate-400">Loading alerts...</div>
            ) : notifications.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-3xl mb-1 block">
                  notifications_off
                </span>
                No alerts yet. You will be notified when documents or policies are added or deleted.
              </div>
            ) : (
              notifications.map((n) => {
                const isAdded = n.action === "Added";
                const isDeleted = n.action === "Deleted";

                return (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      n.read
                        ? "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                        : "bg-white dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white shadow-2xs font-medium"
                    }`}
                    onClick={() => {
                      if (!n.read) markSingleAsRead(n.id);
                      if (onSelectNotification) onSelectNotification(n);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            isAdded
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isDeleted
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {n.action}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 capitalize">
                          {n.tab}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {formatTime(n.timestamp)}
                      </span>
                    </div>

                    <p className="font-bold text-xs mt-1 leading-snug line-clamp-2">
                      {n.itemTitle}
                    </p>

                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <span>By: {n.actorName} ({n.actorRole})</span>
                      {!n.read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markSingleAsRead(n.id);
                          }}
                          className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">BCF-SL Audit Governance</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
