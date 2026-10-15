"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { MODULES } from "@/lib/modules";
import { motion, AnimatePresence } from "framer-motion";

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

  /* Mode: 'login' or 'reset' */
  const [viewMode, setViewMode] = useState<"login" | "reset">("login");
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);

  /* Form state */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/");
  const [suspendedNotice, setSuspendedNotice] = useState<string | null>(null);

  /* Reset Flow States */
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [requestId, setRequestId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", ""]);
  const [otpExpiresInSeconds, setOtpExpiresInSeconds] = useState(600); // 10 minutes
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(60);
  const [resetToken, setResetToken] = useState("");
  const [tokenExpiresInSeconds, setTokenExpiresInSeconds] = useState(900); // 15 minutes
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const otpInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

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

  /* Countdown timers for Step 2 & Step 3 */
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (viewMode === "reset" && resetStep === 2) {
      timer = setInterval(() => {
        setOtpExpiresInSeconds((prev) => Math.max(0, prev - 1));
        setResendCooldownSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (viewMode === "reset" && resetStep === 3) {
      timer = setInterval(() => {
        setTokenExpiresInSeconds((prev) => {
          if (prev <= 1) {
            setResetError("Reset session expired (15-minute limit). Please start over.");
            setResetStep(1);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [viewMode, resetStep]);

  /* Format seconds to MM:SS */
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  /* ─── Standard Sign In Submit ─── */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      setError(null);
      setSuccessNotice(null);
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

  /* ─── Step 1 Submit: Request 5-digit OTP ─── */
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetLoading) return;

    const trimmed = resetIdentifier.trim();
    if (!trimmed) {
      setResetError("Please enter your registered email address or username.");
      return;
    }

    setResetError(null);
    setResetLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: trimmed }),
      });

      const data = await res.json();
      setResetLoading(false);

      // Always advance to step 2 with uniform message
      setRequestId(data.requestId || "PENDING");
      setMaskedEmail(data.maskedEmail || "your registered email address");
      setOtpExpiresInSeconds(600); // 10 minutes
      setResendCooldownSeconds(data.resendCooldownSeconds || 60);
      setOtpDigits(["", "", "", "", ""]);
      setRemainingAttempts(null);
      setResetStep(2);

      setTimeout(() => {
        otpInputRefs[0].current?.focus();
      }, 100);
    } catch {
      setResetLoading(false);
      // Neutral fallback
      setRequestId("PENDING");
      setMaskedEmail("your registered email address");
      setOtpExpiresInSeconds(600);
      setResendCooldownSeconds(60);
      setResetStep(2);
    }
  };

  /* ─── Step 2: Handle OTP Digits auto-advance, backspace, and paste ─── */
  const handleOtpChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const updated = [...otpDigits];
    updated[index] = char;
    setOtpDigits(updated);
    setResetError(null);

    // Auto-advance
    if (char && index < 4) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 5);
    if (!pasteData) return;

    const updated = [...otpDigits];
    for (let i = 0; i < 5; i++) {
      updated[i] = pasteData[i] || "";
    }
    setOtpDigits(updated);
    setResetError(null);

    const nextIndex = Math.min(pasteData.length, 4);
    otpInputRefs[nextIndex].current?.focus();
  };

  /* ─── Step 2 Submit: Verify 5-Digit OTP ─── */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetLoading) return;

    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== 5) {
      setResetError("Please enter all 5 digits of your verification code.");
      return;
    }

    setResetError(null);
    setResetLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, otp: fullOtp }),
      });

      const data = await res.json();
      setResetLoading(false);

      if (data.success && data.resetToken) {
        setResetToken(data.resetToken);
        setTokenExpiresInSeconds(data.expiresInSeconds || 900);
        setNewPassword("");
        setConfirmPassword("");
        setResetStep(3);
      } else {
        setResetError(data.error || "Invalid verification code.");
        if (typeof data.remainingAttempts === "number") {
          setRemainingAttempts(data.remainingAttempts);
        }
      }
    } catch {
      setResetLoading(false);
      setResetError("Failed to verify code. Please check your network or try again.");
    }
  };

  /* ─── Step 2: Resend OTP Code ─── */
  const handleResendOtp = async () => {
    if (resendCooldownSeconds > 0 || resetLoading) return;

    setResetError(null);
    setResetLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      const data = await res.json();
      setResetLoading(false);

      if (data.success) {
        setResendCooldownSeconds(data.resendCooldownSeconds || 60);
        setOtpExpiresInSeconds(600);
        setOtpDigits(["", "", "", "", ""]);
        setResetError(null);
        otpInputRefs[0].current?.focus();
      } else {
        setResetError(data.error || "Failed to resend code.");
      }
    } catch {
      setResetLoading(false);
      setResetError("Unable to resend code. Please try again.");
    }
  };

  /* ─── Password Strength Evaluation ─── */
  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "Too weak", color: "bg-slate-300" };
    let score = 0;
    if (pass.length >= 10) score += 25;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass)) score += 25;
    if (/[^A-Za-z0-9]/.test(pass)) score += 25;

    if (score <= 25) return { score, label: "Weak", color: "bg-rose-500" };
    if (score <= 50) return { score, label: "Fair", color: "bg-amber-500" };
    if (score <= 75) return { score, label: "Good", color: "bg-blue-500" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  };

  const strength = calculatePasswordStrength(newPassword);

  /* Password rule check states */
  const ruleMinLength = newPassword.length >= 10;
  const ruleMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const ruleNumber = /[0-9]/.test(newPassword);
  const ruleSymbol = /[^A-Za-z0-9]/.test(newPassword);
  const ruleMatch = newPassword.length > 0 && newPassword === confirmPassword;

  /* ─── Step 3 Submit: Set New Password ─── */
  const handleExecutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetLoading) return;

    if (!ruleMinLength || !ruleMixedCase || !ruleNumber || !ruleSymbol) {
      setResetError("Please satisfy all password complexity requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setResetError(null);
    setResetLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetToken,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      setResetLoading(false);

      if (data.success) {
        // Return to sign in with success banner
        setViewMode("login");
        setResetStep(1);
        setEmail(resetIdentifier);
        setPassword("");
        setSuccessNotice("Password changed. Please sign in.");
      } else {
        setResetError(data.error || "Failed to update password.");
      }
    } catch {
      setResetLoading(false);
      setResetError("An unexpected error occurred while resetting password.");
    }
  };

  const handleBackToSignIn = () => {
    setViewMode("login");
    setResetStep(1);
    setResetError(null);
    setError(null);
  };

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
          RIGHT FORM PANEL (Login or 3-Step Reset Flow)
      ══════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-y-auto">

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

        {/* Main interactive container */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-[400px]"
        >
          {/* ==========================================================
              VIEW 1: SIGN IN VIEW
             ========================================================== */}
          {viewMode === "login" && (
            <div>
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

              {/* Password Changed Success Notice */}
              <AnimatePresence>
                {successNotice && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-emerald-900 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-emerald-600 text-[22px] shrink-0 mt-0.5">
                      check_circle
                    </span>
                    <div className="text-xs leading-relaxed">
                      <strong className="block text-sm font-extrabold text-emerald-800 mb-0.5">
                        Password Reset Successful
                      </strong>
                      <span>{successNotice}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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

              {/* The login form */}
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

                {/* Forgot Password Button directly below Sign In button, centered, accent colour */}
                <button
                  type="button"
                  id="forgot-password-btn"
                  onClick={() => {
                    setViewMode("reset");
                    setResetStep(1);
                    setResetIdentifier(email || "");
                    setResetError(null);
                  }}
                  className="w-full text-center py-2 text-[13px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline transition-colors mt-1 focus:outline-none"
                >
                  Forgot password?
                </button>
              </motion.form>
            </div>
          )}

          {/* ==========================================================
              VIEW 2: 3-STEP RESET PASSWORD FLOW (SAME SCREEN, NO RELOAD)
             ========================================================== */}
          {viewMode === "reset" && (
            <div>
              {/* Stepper Indicator */}
              <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      resetStep === 1
                        ? "bg-emerald-600 text-white shadow"
                        : resetStep > 1
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-500"
                    )}
                  >
                    1
                  </div>
                  <div className={cn("h-0.5 w-8 transition-colors", resetStep > 1 ? "bg-emerald-500" : "bg-slate-200")} />
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      resetStep === 2
                        ? "bg-emerald-600 text-white shadow"
                        : resetStep > 2
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-500"
                    )}
                  >
                    2
                  </div>
                  <div className={cn("h-0.5 w-8 transition-colors", resetStep > 2 ? "bg-emerald-500" : "bg-slate-200")} />
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      resetStep === 3
                        ? "bg-emerald-600 text-white shadow"
                        : "bg-slate-200 text-slate-500"
                    )}
                  >
                    3
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Step {resetStep} of 3
                </span>
              </div>

              {/* Error Alert inside reset flow */}
              <AnimatePresence mode="wait">
                {resetError && (
                  <motion.div
                    key="reset-error"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200"
                    role="alert"
                  >
                    <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">
                      error
                    </span>
                    <p className="text-[13px] font-medium text-rose-900">{resetError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ────────────────────────────────────────────────────────────
                  RESET STEP 1: IDENTIFY
                 ──────────────────────────────────────────────────────────── */}
              {resetStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-6 text-center sm:text-left">
                    <h2
                      className="text-[22px] sm:text-[26px] font-extrabold mb-1"
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        color: "var(--on-surface)",
                      }}
                    >
                      Reset Password
                    </h2>
                    <p className="text-[13px]" style={{ color: "var(--on-surface-variant)" }}>
                      Enter your email or username to receive a 5-digit verification code.
                    </p>
                  </div>

                  <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="reset-identifier"
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
                          person_search
                        </span>
                        <input
                          id="reset-identifier"
                          type="text"
                          required
                          value={resetIdentifier}
                          onChange={(e) => {
                            setResetIdentifier(e.target.value);
                            setResetError(null);
                          }}
                          placeholder="staff@bcf-sl.org or username"
                          className="w-full h-12 pl-11 pr-4 rounded-xl text-[14px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          style={{
                            background: "var(--surface-container-low)",
                            color: "var(--on-surface)",
                            border: "1px solid var(--outline-variant)",
                          }}
                        />
                      </div>
                    </div>

                    <button
                      id="send-code-btn"
                      type="submit"
                      disabled={resetLoading || !resetIdentifier.trim()}
                      className="mt-2 w-full h-12 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 shadow-md"
                      style={{
                        background: "linear-gradient(135deg, #15803d 0%, #0f766e 100%)",
                      }}
                    >
                      {resetLoading ? (
                        <>
                          <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>Sending code...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[19px]">send</span>
                          <span>Send Code</span>
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ────────────────────────────────────────────────────────────
                  RESET STEP 2: ENTER THE OTP
                 ──────────────────────────────────────────────────────────── */}
              {resetStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-4 text-center sm:text-left">
                    <h2
                      className="text-[22px] sm:text-[26px] font-extrabold mb-1"
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        color: "var(--on-surface)",
                      }}
                    >
                      Enter Security Code
                    </h2>
                    <p className="text-[13px]" style={{ color: "var(--on-surface-variant)" }}>
                      If an account matches, a 5-digit code has been sent to{" "}
                      <strong className="text-slate-900 dark:text-white font-mono">{maskedEmail}</strong>.
                    </p>
                  </div>

                  {/* Neutral reassurance banner */}
                  <div className="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    If an account matches, a 5-digit code has been sent to the registered email. Check your spam folder if not received.
                  </div>

                  <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                    {/* 5 Separate Digit Boxes */}
                    <div className="flex items-center justify-between gap-2.5 my-2" onPaste={handleOtpPaste}>
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={otpInputRefs[idx]}
                          id={`otp-digit-${idx}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          autoComplete="one-time-code"
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-black rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition"
                        />
                      ))}
                    </div>

                    {/* Expiry and Resend meters */}
                    <div className="flex items-center justify-between text-xs text-slate-500 py-1">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-amber-600">timer</span>
                        <span>
                          Expires in:{" "}
                          <strong className={otpExpiresInSeconds < 60 ? "text-rose-600" : "text-slate-700 dark:text-slate-300"}>
                            {formatTimer(otpExpiresInSeconds)}
                          </strong>
                        </span>
                      </div>
                      <div>
                        {resendCooldownSeconds > 0 ? (
                          <span className="text-slate-400">Resend in {resendCooldownSeconds}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline focus:outline-none"
                          >
                            Resend Code
                          </button>
                        )}
                      </div>
                    </div>

                    {remainingAttempts !== null && (
                      <div className="text-center text-xs font-semibold text-rose-600">
                        {remainingAttempts} attempt(s) remaining before account lockout.
                      </div>
                    )}

                    <button
                      id="verify-code-btn"
                      type="submit"
                      disabled={resetLoading || otpDigits.join("").length !== 5 || otpExpiresInSeconds === 0}
                      className="mt-2 w-full h-12 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 shadow-md"
                      style={{
                        background: "linear-gradient(135deg, #15803d 0%, #0f766e 100%)",
                      }}
                    >
                      {resetLoading ? (
                        <>
                          <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>Verifying code...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[19px]">verified</span>
                          <span>Verify Code</span>
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ────────────────────────────────────────────────────────────
                  RESET STEP 3: NEW PASSWORD
                 ──────────────────────────────────────────────────────────── */}
              {resetStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-4 text-center sm:text-left">
                    <h2
                      className="text-[22px] sm:text-[26px] font-extrabold mb-1"
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        color: "var(--on-surface)",
                      }}
                    >
                      New Password
                    </h2>
                    <p className="text-[13px]" style={{ color: "var(--on-surface-variant)" }}>
                      Create a strong password (session expires in {formatTimer(tokenExpiresInSeconds)}).
                    </p>
                  </div>

                  <form onSubmit={handleExecutePasswordReset} className="flex flex-col gap-3.5">
                    {/* New Password */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="reset-new-password"
                        className="text-[12px] font-semibold"
                        style={{ color: "var(--on-surface-variant)" }}
                      >
                        New Password
                      </label>
                      <div className="relative">
                        <span
                          className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] pointer-events-none"
                          style={{ color: "var(--outline)" }}
                        >
                          lock
                        </span>
                        <input
                          id="reset-new-password"
                          type={showNewPass ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            setResetError(null);
                          }}
                          placeholder="At least 10 characters"
                          className="w-full h-11 pl-11 pr-11 rounded-xl text-[14px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          style={{
                            background: "var(--surface-container-low)",
                            color: "var(--on-surface)",
                            border: "1px solid var(--outline-variant)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <span className="material-symbols-outlined text-[19px]">
                            {showNewPass ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Password Strength Meter */}
                    {newPassword.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Strength:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{strength.label}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full transition-all duration-300", strength.color)}
                            style={{ width: `${strength.score}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Confirm Password */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="reset-confirm-password"
                        className="text-[12px] font-semibold"
                        style={{ color: "var(--on-surface-variant)" }}
                      >
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <span
                          className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] pointer-events-none"
                          style={{ color: "var(--outline)" }}
                        >
                          lock_reset
                        </span>
                        <input
                          id="reset-confirm-password"
                          type={showConfirmPass ? "text" : "password"}
                          required
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setResetError(null);
                          }}
                          placeholder="Re-enter password"
                          className="w-full h-11 pl-11 pr-11 rounded-xl text-[14px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          style={{
                            background: "var(--surface-container-low)",
                            color: "var(--on-surface)",
                            border: "1px solid var(--outline-variant)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPass((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <span className="material-symbols-outlined text-[19px]">
                            {showConfirmPass ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Policy Rules Checklist */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 text-[11px] space-y-1">
                      <div className={cn("flex items-center gap-1.5", ruleMinLength ? "text-emerald-700 font-semibold" : "text-slate-500")}>
                        <span className="material-symbols-outlined text-[14px]">{ruleMinLength ? "check_circle" : "radio_button_unchecked"}</span>
                        <span>At least 10 characters</span>
                      </div>
                      <div className={cn("flex items-center gap-1.5", ruleMixedCase ? "text-emerald-700 font-semibold" : "text-slate-500")}>
                        <span className="material-symbols-outlined text-[14px]">{ruleMixedCase ? "check_circle" : "radio_button_unchecked"}</span>
                        <span>Uppercase & lowercase letters</span>
                      </div>
                      <div className={cn("flex items-center gap-1.5", ruleNumber ? "text-emerald-700 font-semibold" : "text-slate-500")}>
                        <span className="material-symbols-outlined text-[14px]">{ruleNumber ? "check_circle" : "radio_button_unchecked"}</span>
                        <span>At least one number (0-9)</span>
                      </div>
                      <div className={cn("flex items-center gap-1.5", ruleSymbol ? "text-emerald-700 font-semibold" : "text-slate-500")}>
                        <span className="material-symbols-outlined text-[14px]">{ruleSymbol ? "check_circle" : "radio_button_unchecked"}</span>
                        <span>Special character symbol (!@#$%^&*)</span>
                      </div>
                      <div className={cn("flex items-center gap-1.5", ruleMatch ? "text-emerald-700 font-semibold" : "text-slate-500")}>
                        <span className="material-symbols-outlined text-[14px]">{ruleMatch ? "check_circle" : "radio_button_unchecked"}</span>
                        <span>Passwords match</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-0.5">
                        &bull; Cannot be the same as recent 5 passwords or personal name/ID.
                      </div>
                    </div>

                    <button
                      id="reset-password-btn"
                      type="submit"
                      disabled={resetLoading || !ruleMinLength || !ruleMixedCase || !ruleNumber || !ruleSymbol || !ruleMatch}
                      className="mt-1 w-full h-12 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 shadow-md"
                      style={{
                        background: "linear-gradient(135deg, #15803d 0%, #0f766e 100%)",
                      }}
                    >
                      {resetLoading ? (
                        <>
                          <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>Updating password...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[19px]">lock_reset</span>
                          <span>Reset Password</span>
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ────────────────────────────────────────────────────────────
                  BACK TO SIGN IN LINK (Present on every step)
                 ──────────────────────────────────────────────────────────── */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  id={`back-to-signin-step${resetStep}`}
                  onClick={handleBackToSignIn}
                  className="inline-flex items-center gap-1 text-[13px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors py-2 focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>Back to Sign In</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <p
          className="absolute bottom-6 text-[11px] text-center"
          style={{ color: "var(--outline)" }}
        >
          © {new Date().getFullYear()} Bandama Charity Foundation Sierra Leone
        </p>
      </div>
    </div>
  );
}
