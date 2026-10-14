"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { type Module, type SubApp } from "@/lib/modules";

interface SubAppCardProps {
  module: Module;
  subApp: SubApp;
  index: number;
}

export function SubAppCard({ module, subApp, index }: SubAppCardProps) {
  const [isStaffSession, setIsStaffSession] = useState(false);

  useEffect(() => {
    try {
      const staffOnly = sessionStorage.getItem("bcf_staff_only_session") === "true";
      const learningSess = JSON.parse(sessionStorage.getItem("bcf_learning_session") || "null");
      const isExec = learningSess && (learningSess.username === "abandama" || learningSess.employeeId === "BCF-PTE-2026-0001");
      setIsStaffSession(staffOnly && !isExec);
    } catch (_) {}
  }, []);

  // Admin-only sub-apps display a clear 'Admin Only' badge

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: "easeOut" }}
    >
      <Link
        href={`/${module.slug}/${subApp.id}`}
        id={`subapp-card-${subApp.id}`}
        aria-label={`Open ${subApp.label}`}
        className="group flex items-start gap-4 p-4 rounded-xl transition-all duration-200 
                   hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
        style={{
          background: "var(--surface-container-lowest)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${module.color}`}
        >
          <span className="material-symbols-outlined text-white text-[20px]">
            {subApp.icon}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3
              className="text-[14px] font-semibold group-hover:text-[var(--primary)] transition-colors"
              style={{ color: "var(--on-surface)" }}
            >
              {subApp.label}
            </h3>
            {subApp.adminOnly && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                <span className="material-symbols-outlined text-[12px]">lock</span>
                Admin Only
              </span>
            )}
          </div>
          <p
            className="text-[12px] leading-relaxed line-clamp-2"
            style={{ color: "var(--on-surface-variant)" }}
          >
            {subApp.description}
          </p>
        </div>

        {/* Arrow */}
        <span
          className="material-symbols-outlined text-[20px] shrink-0 mt-0.5 opacity-0 
                     group-hover:opacity-100 transition-opacity"
          style={{ color: "var(--on-surface-variant)" }}
        >
          chevron_right
        </span>
      </Link>
    </motion.div>
  );
}

