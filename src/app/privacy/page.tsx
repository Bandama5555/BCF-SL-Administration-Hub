import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy & Data Protection Policy — BCF-SL",
  description: "Official institutional privacy and data protection policy for Bandama Charity Foundation Sierra Leone.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Institutional Transparency & Security
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Privacy & Data Protection Policy
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Bandama Charity Foundation Sierra Leone (BCF-SL) &bull; Last Revised: October 2026
            </p>
          </div>
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            &larr; Return to Hub
          </Link>
        </div>

        {/* Section 1: Overview */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px]">
              policy
            </span>
            1. Purpose and Scope
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Bandama Charity Foundation Sierra Leone (BCF-SL) operates this public website and the
            Administration Hub to advance humanitarian, educational, and charitable initiatives across
            Sierra Leone. This policy explains what personal information we collect, how it is protected,
            and your statutory rights regarding your records.
          </p>
        </div>

        {/* Section 2: What We Collect */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px]">
              inventory_2
            </span>
            2. Personal Information Collected
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Bandama Charity Foundation Sierra Leone collects only personal information that you voluntarily
            provide when logging in as an authorized staff member or submitting an official form (such as
            public contact inquiries or donation pledges). We do not deploy passive visitor tracking,
            persistent device fingerprinting, or tracking cookies across our public website or Administration Hub.
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 dark:bg-slate-800/60 font-bold text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-3">Data Category</th>
                  <th className="p-3">Source & Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <td className="p-3 font-semibold">Staff Credentials & Profiles</td>
                  <td className="p-3">Stored strictly for authenticated personnel to access foundation management modules according to established role-based access control.</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Public Form Submissions</td>
                  <td className="p-3">Donor names, emails, and contact messages submitted explicitly by members of the public to process philanthropic pledges or direct inquiries.</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Security Audit Logs</td>
                  <td className="p-3">Administrative actions within the Hub are recorded in an immutable institutional audit log to maintain organizational accountability.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Data Rights */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px]">
              schedule
            </span>
            3. Data Protection & Individual Rights
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            All institutional records are maintained under strict data protection protocols.
            Any person whose details are held by the foundation may request inspection or correction
            of their records by contacting the BCF-SL Administration Directorate.
          </p>
        </div>

        {/* Section 4: Contact */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
          <p className="font-bold text-slate-900 dark:text-white">Bandama Charity Foundation Sierra Leone</p>
          <p className="text-slate-500 dark:text-slate-400">Official Administration & Governance Command Centre</p>
          <p className="text-slate-500 dark:text-slate-400">Freetown, Sierra Leone &bull; Email: admin@bcfsl.org / bandamacharityfoundationsl@gmail.com</p>
        </div>
      </div>
    </div>
  );
}
