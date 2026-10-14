"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export interface CredentialItem {
  role: string;
  fullName: string;
  title: string;
  department: string;
  email: string;
  username: string;
  password: string;
  badgeColor?: string;
  accessLevel?: string;
  isPrimary?: boolean;
}

const DEFAULT_CREDENTIALS: CredentialItem[] = [
  {
    role: "Super Admin (SA)",
    fullName: "Albert Joseph Bandama",
    title: "Super Administrator",
    department: "Executive Management",
    email: "admin@bcfsl.org",
    username: "admin",
    password: "ChangeMe123!",
    badgeColor: "#7B2FBE",
    accessLevel: "Full System Control (All Modules)",
    isPrimary: true,
  },
  {
    role: "CEO (Executive)",
    fullName: "Dr. Alimamy Koroma",
    title: "Chief Executive Officer",
    department: "Executive Management",
    email: "ceo@bcf-sl.org",
    username: "ceo_user",
    password: "BCF@2026",
    badgeColor: "#4338CA",
    accessLevel: "Executive Oversight (View Most, CEO Authorizations)",
    isPrimary: true,
  },
  {
    role: "HR Director (HR)",
    fullName: "Joe Ansumana Conteh",
    title: "Human Resources Director",
    department: "Human Resources Management Department",
    email: "jconteh@bcf-sl.org",
    username: "hr_director",
    password: "BCF@2026",
    badgeColor: "#059669",
    accessLevel: "Personnel, Onboarding, Leave & Discipline",
    isPrimary: true,
  },
  {
    role: "Finance Director (FIN)",
    fullName: "Mariama Bangura",
    title: "Finance Director",
    department: "Finance Department",
    email: "mbangura@bcf-sl.org",
    username: "fin_director",
    password: "BCF@2026",
    badgeColor: "#2563EB",
    accessLevel: "Treasury, Budgets, Loan Approvals, FOMS",
    isPrimary: true,
  },
  {
    role: "Internal Audit & Risk (IAR)",
    fullName: "Samuel Kamara",
    title: "Internal Audit & Risk Director",
    department: "Internal Risk & Audits Department",
    email: "skamara@bcf-sl.org",
    username: "iar_director",
    password: "BCF@2026",
    badgeColor: "#DC2626",
    accessLevel: "Audit Trails, Discipline Committees, Investigations",
    isPrimary: false,
  },
  {
    role: "Programs Director (PRG)",
    fullName: "Fatmata Sesay",
    title: "Programs Director",
    department: "Programs Department",
    email: "fsesay@bcf-sl.org",
    username: "prg_director",
    password: "BCF@2026",
    badgeColor: "#0D9488",
    accessLevel: "Programs Database, Donors, Beneficiaries & Impact",
    isPrimary: false,
  },
  {
    role: "Procurement Director (PRC)",
    fullName: "Hassan Kanu",
    title: "Procurement Director",
    department: "Procurement Department",
    email: "hkanu@bcf-sl.org",
    username: "prc_director",
    password: "BCF@2026",
    badgeColor: "#D97706",
    accessLevel: "Procurement Hub, PRs, POs, RFQs, GRNs, Invoices",
    isPrimary: false,
  },
  {
    role: "IT Director (IT)",
    fullName: "Augustine Toro",
    title: "IT Director",
    department: "Information Technology (IT) Department",
    email: "atoro@bcf-sl.org",
    username: "it_director",
    password: "BCF@2026",
    badgeColor: "#0891B2",
    accessLevel: "LMS Course Allocation, Learning Provisioning",
    isPrimary: false,
  },
  {
    role: "Staff Member (ST)",
    fullName: "Mabinty Mustapha",
    title: "Community Field Officer",
    department: "Programs Department",
    email: "staff@bcf-sl.org",
    username: "staff_user",
    password: "BCF@2026",
    badgeColor: "#10B981",
    accessLevel: "Staff Self-Service (Own Payslips, Loans, Leave, PR)",
    isPrimary: false,
  },
];

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCredential?: (cred: CredentialItem) => void;
}

export function CredentialsModal({
  isOpen,
  onClose,
  onSelectCredential,
}: CredentialsModalProps) {
  const router = useRouter();
  const [credentials, setCredentials] = useState<CredentialItem[]>(DEFAULT_CREDENTIALS);
  const [selectedDept, setSelectedDept] = useState<string>("All");
  const [search, setSearch] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/auth/credentials")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.credentials && Array.isArray(data.credentials)) {
            setCredentials(data.credentials);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const departments = [
    "All",
    "Executive Management",
    "Human Resources Management Department",
    "Finance Department",
    "Procurement Department",
    "ICT Department",
    "Programs Department",
  ];

  const filtered = credentials.filter((c) => {
    const matchesDept = selectedDept === "All" || c.department === selectedDept;
    const matchesSearch =
      !search ||
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.role.toLowerCase().includes(search.toLowerCase()) ||
      c.username.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleQuickLogin = async (cred: CredentialItem) => {
    if (onSelectCredential) {
      onSelectCredential(cred);
      onClose();
      return;
    }

    setSwitching(cred.username);
    try {
      const res = await login(cred.username || cred.email, cred.password);
      if (res.success) {
        onClose();
        router.refresh();
        router.push("/");
      }
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-3.5 sm:gap-5 text-slate-800 dark:text-slate-100 max-h-[94vh] sm:max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 sm:pb-4 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-md bg-linear-to-tr from-purple-600 via-indigo-600 to-emerald-500 shrink-0">
              <span className="material-symbols-outlined text-xl sm:text-2xl">key</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="font-extrabold text-sm sm:text-lg tracking-tight truncate">
                  BCF-SL System Access Credentials
                </h2>
                <span className="px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                  LIVE DIRECTORY
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate sm:whitespace-normal">
                Instant access credentials for all institutional roles across Bandama Charity Foundation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg sm:text-xl">close</span>
          </button>
        </div>

        {/* Global Universal Password Notice */}
        <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 text-xs">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-lg sm:text-xl shrink-0">
              verified_user
            </span>
            <div className="text-[11px] sm:text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Institutional Default Password:
              </span>{" "}
              <span className="text-slate-600 dark:text-slate-300">
                All staff accounts can authenticate with{" "}
                <code className="font-mono font-bold px-1 py-0.2 rounded bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                  BCF@2026
                </code>{" "}
                or{" "}
                <code className="font-mono font-bold px-1 py-0.2 rounded bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                  Password123!
                </code>
              </span>
            </div>
          </div>
          <button
            onClick={() => handleCopy("BCF@2026", "univ-pass")}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition shrink-0 cursor-pointer shadow-xs self-end sm:self-auto"
          >
            {copiedField === "univ-pass" ? "Copied!" : "Copy Password"}
          </button>
        </div>

        {/* Search & Department Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, role, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-none">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg shrink-0 transition-all cursor-pointer ${
                  selectedDept === dept
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {dept === "All" ? "All Roles" : dept.replace(" Department", "")}
              </button>
            ))}
          </div>
        </div>

        {/* Credentials Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((c, idx) => (
            <div
              key={`${c.username}-${idx}`}
              className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400/60 dark:hover:border-indigo-500/60 transition-all flex flex-col justify-between gap-3 group hover:shadow-md"
            >
              <div>
                {/* Role & Access Header */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                    style={{ background: c.badgeColor || "#4F46E5" }}
                  >
                    {c.role}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {c.accessLevel || "Standard Access"}
                  </span>
                </div>

                {/* Name & Title */}
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                  {c.fullName}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {c.title} • {c.department}
                </p>

                {/* Credentials details */}
                <div className="mt-3 p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-800 flex flex-col gap-1.5 text-xs font-mono">
                  {/* Email / Username */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 text-[10px]">USERNAME:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-800 dark:text-slate-200 font-bold truncate">
                        {c.username}
                      </span>
                      <button
                        onClick={() => handleCopy(c.username, `user-${idx}`)}
                        title="Copy username"
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {copiedField === `user-${idx}` ? "check" : "content_copy"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 text-[10px]">EMAIL:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-[140px]">
                        {c.email}
                      </span>
                      <button
                        onClick={() => handleCopy(c.email, `email-${idx}`)}
                        title="Copy email"
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {copiedField === `email-${idx}` ? "check" : "content_copy"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 text-[10px]">PASSWORD:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {c.password}
                      </span>
                      <button
                        onClick={() => handleCopy(c.password, `pass-${idx}`)}
                        title="Copy password"
                        className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {copiedField === `pass-${idx}` ? "check" : "content_copy"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button: Auto-Fill & Login */}
              <button
                onClick={() => handleQuickLogin(c)}
                disabled={switching === c.username}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-500 dark:hover:text-white transition font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                <span>
                  {switching === c.username
                    ? "Authenticating..."
                    : onSelectCredential
                    ? "Auto-Fill This Account"
                    : "Instant Login as This User"}
                </span>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>{filtered.length} user accounts available for login</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold transition"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
