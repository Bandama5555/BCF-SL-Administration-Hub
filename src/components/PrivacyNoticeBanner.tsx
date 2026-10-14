"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface PrivacyNoticeBannerProps {
  onAccept?: () => void;
  isHubLogin?: boolean;
}

export function PrivacyNoticeBanner({ onAccept, isHubLogin = false }: PrivacyNoticeBannerProps) {
  const [accepted, setAccepted] = useState(true); // default true to avoid flash

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bcf_privacy_accepted");
      if (!stored) {
        setAccepted(false);
      }
    }
  }, []);

  const handleAccept = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("bcf_privacy_accepted", "true");
      setAccepted(true);
      if (onAccept) onAccept();
    }
  };

  if (accepted) return null;

  return (
    <div
      id="bcf-privacy-notice-banner"
      role="region"
      aria-label="Privacy and Security Notice"
      className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 bg-slate-900/95 text-white backdrop-blur-md border-t border-slate-700 shadow-2xl transition-all"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-emerald-400 text-[20px] shrink-0">
            shield_person
          </span>
          <p className="text-slate-300 leading-relaxed">
            We record technical details such as IP address, device, browser and approximate location,
            and your name and email if you sign in or submit a form, for security and to improve our services.
            {" "}
            <Link
              href="/privacy"
              className="text-emerald-400 font-semibold hover:underline inline-flex items-center gap-0.5 ml-1"
            >
              Privacy Policy
              <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            id="btn-accept-privacy"
            onClick={handleAccept}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
