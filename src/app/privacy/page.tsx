import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy & Data Protection Policy — BCF-SL",
  description: "Official privacy policy and technical telemetry disclosure for Bandama Charity Foundation Sierra Leone.",
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
            Sierra Leone. This policy explains what technical data and personal information we collect,
            how it is protected, and your statutory rights regarding your records.
          </p>
        </div>

        {/* Section 2: What We Collect */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px]">
              inventory_2
            </span>
            2. Technical & Personal Information Collected
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 dark:bg-slate-800/60 font-bold text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-3">Data Field</th>
                  <th className="p-3">Collection Source & Rules</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <td className="p-3 font-semibold">Name & Email</td>
                  <td className="p-3">From user account when signed in; or from public website forms (contact, donate, newsletter) only upon explicit submission. Otherwise &quot;Anonymous&quot;. Never guessed.</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">IP Address</td>
                  <td className="p-3">Obtained from inbound HTTP requests on the server (using client IP behind proxies) for cybersecurity, rate limiting, and network abuse prevention.</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Approximate Location</td>
                  <td className="p-3">Country, region, and city estimated from IP geolocation, plus network provider (ISP). No satellite GPS coordinates are ever requested or stored.</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Device Identifier</td>
                  <td className="p-3">A pseudonymized, cryptographic SHA-256 hash generated from browser/device signals to protect against repeat fraudulent activity without storing hardware serials or IMEIs.</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">System Details</td>
                  <td className="p-3">Operating System, Device Model / Category (Mobile/Tablet/Desktop), Browser version, screen dimensions, language, and visited pages.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Data Retention & Rights */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px]">
              schedule
            </span>
            3. Data Retention & Erasure (Right to be Forgotten)
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Visitor records are stored for a maximum period of <strong>12 months</strong>, after which
            they are automatically purged or anonymized by institutional automated maintenance jobs.
            Any visitor may request immediate inspection or permanent deletion of their recorded visitor
            data by contacting the BCF-SL Data Protection Officer. All deletions are immutably logged to
            the security audit trail.
          </p>
        </div>

        {/* Section 4: Contact */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
          <p className="font-bold text-slate-900 dark:text-white">Bandama Charity Foundation Sierra Leone</p>
          <p className="text-slate-500 dark:text-slate-400">Official Administration & Security Command Centre</p>
          <p className="text-slate-500 dark:text-slate-400">Freetown, Sierra Leone &bull; Email: admin@bcfsl.org / bandamacharityfoundationsl@gmail.com</p>
        </div>
      </div>
    </div>
  );
}
