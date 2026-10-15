"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function BcfPublicWebsitePage() {
  const [donateName, setDonateName] = useState("");
  const [donateEmail, setDonateEmail] = useState("");
  const [donateAmount, setDonateAmount] = useState("100");
  const [donateSubmitted, setDonateSubmitted] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donateEmail) return;
    setDonateSubmitted(true);
  };

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail) return;
    setContactSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-emerald-900/30">
              BCF
            </div>
            <div>
              <p className="font-extrabold text-sm sm:text-base leading-tight tracking-tight text-white">
                Bandama Charity Foundation
              </p>
              <p className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">
                Sierra Leone &bull; Official Public Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/80 text-xs font-semibold text-slate-200 transition"
            >
              Staff &amp; Admin Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-6 text-center border-b border-slate-800">
        <div className="max-w-4xl mx-auto space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Empowering Communities Across Sierra Leone
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Transforming Lives Through Education, Healthcare &amp; Community Relief
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Founded with a vision for sustainable community development, Bandama Charity Foundation
            delivers vital educational scholarships, child healthcare, and emergency assistance to
            underserved communities in Freetown and regional Sierra Leone.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#donate-section"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 transition cursor-pointer"
            >
              Support Our Mission
            </a>
            <a
              href="#contact-section"
              className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-semibold text-sm transition cursor-pointer"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* Impact Numbers */}
      <section className="py-12 px-4 sm:px-6 bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: "Children Supported", val: "1,250+" },
            { label: "Educational Grants", val: "480+" },
            { label: "Community Centers", val: "12" },
            { label: "Operational Districts", val: "5 Regions" },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
              <p className="text-2xl sm:text-3xl font-black text-emerald-400">{stat.val}</p>
              <p className="text-xs text-slate-400 font-medium mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Main Grid: Donation & Contact Forms */}
      <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Donation Form */}
        <div id="donate-section" className="p-6 sm:p-8 rounded-2xl bg-slate-800/50 border border-slate-700/80 shadow-xl space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-400 text-[24px]">volunteer_activism</span>
            <h2 className="text-xl font-bold text-white">Make a Charitable Donation</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your generous contribution directly funds educational materials and nutrition programs for children in Sierra Leone.
          </p>

          {donateSubmitted ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center space-y-1">
              <p className="font-bold text-sm">Thank you for your generous pledge!</p>
              <p>Our finance team will send your official charitable receipt.</p>
            </div>
          ) : (
            <form onSubmit={handleDonate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Donor Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Johnathan Koroma"
                  value={donateName}
                  onChange={(e) => setDonateName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="donor@example.com"
                  value={donateEmail}
                  onChange={(e) => setDonateEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Donation Amount (SLE / USD)</label>
                <div className="grid grid-cols-4 gap-2">
                  {["25", "50", "100", "250"].map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => setDonateAmount(amt)}
                      className={`py-1.5 rounded-lg border font-bold text-xs transition ${
                        donateAmount === amt
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                id="btn-submit-donation"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Submit Donation Pledge
              </button>
            </form>
          )}
        </div>

        {/* Contact Form */}
        <div id="contact-section" className="p-6 sm:p-8 rounded-2xl bg-slate-800/50 border border-slate-700/80 shadow-xl space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-400 text-[24px]">mail</span>
            <h2 className="text-xl font-bold text-white">Contact Our Freetown Office</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Have questions about partnerships, scholarship applications, or our community outreach initiatives? Reach out below.
          </p>

          {contactSubmitted ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center space-y-1">
              <p className="font-bold text-sm">Message Received!</p>
              <p>Our communications team will respond within 24 business hours.</p>
            </div>
          ) : (
            <form onSubmit={handleContact} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mariama Sesay"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="mariama@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Message</label>
                <textarea
                  rows={3}
                  placeholder="How can we assist you or collaborate?"
                  value={contactMsg}
                  onChange={(e) => setContactMsg(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
              <button
                type="submit"
                id="btn-submit-contact"
                className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Send Message
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-8 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} Bandama Charity Foundation Sierra Leone. All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/privacy" className="hover:text-emerald-400 transition">Privacy &amp; Security Policy</Link>
            <Link href="/login" className="hover:text-emerald-400 transition">Administration Hub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
