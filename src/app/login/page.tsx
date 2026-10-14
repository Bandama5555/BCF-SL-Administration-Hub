"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { MODULES } from "@/lib/modules";
import { motion, AnimatePresence } from "framer-motion";
import { PrivacyNoticeBanner } from "@/components/PrivacyNoticeBanner";

/* ─── helpers ─── */
function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── animated module icon strip ─── */
function ModuleIconGrid() {
  return (
    <div className="grid grid-cols-5 gap-3">
      {MODULES.map((mod, i) => (
        <motion.div
          key={mod.id}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 + i * 0.08, duration: 0.4, ease: "backOut" }}
          className="flex flex-col items-center gap-1.5 group cursor-default"
          title={mod.label}
        >
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              "bg-white/10 backdrop-blur-sm border border-white/20",
              "group-hover:bg-white/20 transition-all duration-200 group-hover:scale-110"
            )}
          >
            <span className="material-symbols-outlined text-white text-[22px]">
              {mod.icon}
            </span>
          </div>
          <span className="text-white/60 text-[9px] font-semibold uppercase tracking-wide text-center leading-tight max-w-[52px] truncate">
            {mod.shortLabel}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── floating stat pill ─── */
function StatPill({
  icon,
  label,
  delay,
}: {
  icon: string;
  label: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15"
    >
      <span className="material-symbols-outlined text-white/70 text-[16px]">
        {icon}
      </span>
      <span className="text-white/80 text-[12px] font-medium">{label}</span>
    </motion.div>
  );
}

/* ─── main page ─── */
export default function LoginPage() {
  const router = useRouter();

  /* form state */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/");

  const [suspendedNotice, setSuspendedNotice] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redir = params.get("redirect");
      if (redir && redir !== "/login") {
        setRedirectPath(redir);
      }

      const reason = params.get("reason");
      const storedReason = sessionStorage.getItem("bcf_logout_reason");
      if (reason === "suspended" || storedReason) {
        setSuspendedNotice(
          storedReason ||
          "Your staff account has been suspended by the administrator. You have been automatically logged out."
        );
        sessionStorage.removeItem("bcf_logout_reason");
      }
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      setError(null);
      setLoading(true);

      try {
        const result = await login(email, password);

        if (result.success) {
          router.replace(redirectPath);
        } else {
          setLoading(false);
          setError(result.error || "Invalid username/email or password.");
          setShake(true);
          setTimeout(() => setShake(false), 600);
        }
      } catch (err: unknown) {
        setLoading(false);
        const msg = err instanceof Error ? err.message : "Authentication error.";
        setError(msg);
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
    },
    [email, password, loading, router, redirectPath]
  );

  /* ─── render ─── */
  return (
    <div className="min-h-screen flex" style={{ background: "var(--surface)" }}>

      {/* ══════════════════════════════════════════
          LEFT BRANDING PANEL (hidden on mobile)
      ══════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-[58%] relative flex-col justify-between p-10 overflow-hidden"
        style={{
          background:
            "linear-gradient(140deg, #7B2FBE 0%, #1A56DB 35%, #22A849 70%, #145C2B 100%)",
        }}
      >
        {/* Animated background orbs — BCF brand colors */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
          className="absolute top-[-100px] right-[-80px] w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, #22A849, transparent 70%)",
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.18, 0.1] }}
          transition={{
            repeat: Infinity,
            duration: 9,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute bottom-[-120px] left-[-60px] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, #60A5FA, transparent 70%)",
          }}
        />

        {/* Top: BCF Logo image + org name */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 flex items-center gap-4"
        >
          {/* Actual BCF Logo on white pill background */}
          <div className="px-3 py-2 rounded-2xl bg-white/95 shadow-xl backdrop-blur-sm">
            <img
              src="/bcf-logo.jpg"
              alt="Bandama Charity Foundation Logo"
              className="h-12 w-auto object-contain"
            />
          </div>
        </motion.div>

        {/* Middle: tagline + stats */}
        <div className="relative z-10 flex flex-col gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          >
            <p
              className="text-white text-[32px] font-extrabold leading-[1.2] mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Your unified command
              <br />
              centre for BCF-SL.
            </p>
            <p className="text-white/60 text-[14px] leading-relaxed max-w-md">
              Manage people, donors, programmes, finances, procurement, and 
              partnerships — all from one secure portal.
            </p>
          </motion.div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-2">
            <StatPill icon="badge" label="142 Staff Members" delay={0.5} />
            <StatPill icon="volunteer_activism" label="1,420 Donors" delay={0.6} />
            <StatPill icon="groups" label="3,847 Beneficiaries" delay={0.7} />
            <StatPill icon="folder_special" label="12 Programmes" delay={0.8} />
          </div>

          {/* Module icon grid */}
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3"
            >
              10 Integrated Modules
            </motion.p>
            <ModuleIconGrid />
          </div>
        </div>

        {/* Bottom: footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="relative z-10 text-white/30 text-[11px]"
        >
          © {new Date().getFullYear()} Bandama Charity Foundation Sierra Leone · 
          Freetown
        </motion.p>
      </div>

      {/* ══════════════════════════════════════════
          RIGHT FORM PANEL
      ══════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">

        {/* Mobile-only: BCF logo + branding at top */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:hidden flex flex-col items-center justify-center mb-8 text-center"
        >
          <div className="px-3 py-1.5 rounded-2xl bg-white shadow-md mb-2">
            <img
              src="/bcf-logo.jpg"
              alt="Bandama Charity Foundation"
              className="h-10 w-auto object-contain"
            />
          </div>
          <span className="text-xs font-extrabold tracking-wide text-slate-800 dark:text-slate-200">
            Bandama Charity Foundation SL
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            Administration Hub Portal
          </span>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-[400px]"
        >
          {/* Heading */}
          <div className="mb-6 sm:mb-8 text-center sm:text-left">
            <h2
              className="text-[24px] sm:text-[28px] font-extrabold mb-1.5"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                color: "var(--on-surface)",
              }}
            >
              Welcome back
            </h2>
            <p className="text-[13px] sm:text-[14px]" style={{ color: "var(--on-surface-variant)" }}>
              Sign in to access the BCF-SL Administration Hub
            </p>
          </div>

          {/* Suspended Notice Banner */}
          <AnimatePresence>
            {suspendedNotice && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 shadow-sm"
              >
                <span className="material-symbols-outlined text-rose-600 text-[22px] shrink-0 mt-0.5">
                  block
                </span>
                <div className="text-xs leading-relaxed">
                  <strong className="block text-sm font-extrabold text-rose-800 mb-0.5">
                    Account Access Suspended
                  </strong>
                  <span>{suspendedNotice}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error message */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.25 }}
                className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl"
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                }}
                role="alert"
                aria-live="polite"
              >
                <span
                  className="material-symbols-outlined text-[18px] shrink-0 mt-0.5"
                  style={{ color: "var(--error)" }}
                >
                  error
                </span>
                <p className="text-[13px] font-medium" style={{ color: "#991b1b" }}>
                  {error}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* The form */}
          <motion.form
            onSubmit={handleSubmit}
            animate={shake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.5 }}
            noValidate
            className="flex flex-col gap-4"
          >
            {/* Email field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-email"
                className="text-[12px] font-semibold"
                style={{ color: "var(--on-surface-variant)" }}
              >
                Email address or Username
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] pointer-events-none"
                  style={{ color: "var(--outline)" }}
                >
                  alternate_email
                </span>
                <input
                  ref={emailRef}
                  id="login-email"
                  type="text"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="admin@bcfsl.org"
                  className="w-full h-12 pl-11 pr-4 rounded-xl text-[16px] sm:text-[14px] font-medium transition-all
                             focus:outline-none focus:ring-2"
                  style={{
                    background: "var(--surface-container-low)",
                    color: "var(--on-surface)",
                    border: "1px solid var(--outline-variant)",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--primary)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--outline-variant)")
                  }
                />
              </div>
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-password"
                className="text-[12px] font-semibold"
                style={{ color: "var(--on-surface-variant)" }}
              >
                Password
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] pointer-events-none"
                  style={{ color: "var(--outline)" }}
                >
                  lock
                </span>
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full h-12 pl-11 pr-12 rounded-xl text-[16px] sm:text-[14px] font-medium transition-all
                             focus:outline-none"
                  style={{
                    background: "var(--surface-container-low)",
                    color: "var(--on-surface)",
                    border: "1px solid var(--outline-variant)",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--primary)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--outline-variant)")
                  }
                />
                <button
                  type="button"
                  id="toggle-password-btn"
                  onClick={() => setShowPass((p) => !p)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center 
                             justify-center rounded-lg transition-colors hover:bg-[var(--surface-container)]"
                  style={{ color: "var(--outline)" }}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPass ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              id="sign-in-btn"
              type="submit"
              disabled={loading || !email || !password}
              className="mt-2 w-full h-12 rounded-xl font-bold text-[15px] text-white 
                         flex items-center justify-center gap-2.5 transition-all 
                         hover:opacity-90 active:scale-[0.98] disabled:opacity-50 
                         disabled:cursor-not-allowed shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, #7B2FBE 0%, #1A56DB 50%, #22A849 100%)",
                boxShadow: "0 4px 24px rgba(123,47,190,0.40)",
              }}
            >
              {loading ? (
                <>
                  <div
                    className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"
                  />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">
                    login
                  </span>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </motion.form>
        </motion.div>

        {/* Footer */}
        <p
          className="absolute bottom-6 text-[11px] text-center"
          style={{ color: "var(--outline)" }}
        >
          © {new Date().getFullYear()} Bandama Charity Foundation Sierra Leone
        </p>
      </div>

      {/* Mandatory Security & Privacy Notice Banner */}
      <PrivacyNoticeBanner isHubLogin={true} />
    </div>
  );
}

