import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — BCF-SL Administration Hub",
  description: "Official Privacy and Data Protection Policy for Bandama Charity Foundation Sierra Leone.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12">
        <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/bcf-logo.jpg" alt="BCF-SL Logo" className="h-10 w-auto rounded" />
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Bandama Charity Foundation</h1>
              <p className="text-xs text-slate-500 font-medium">Sierra Leone • Institutional Data Privacy Policy</p>
            </div>
          </div>
          <Link
            href="/login"
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Hub
          </Link>
        </div>

        <div className="mt-8 space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">1. Overview and Purpose</h2>
            <p>
              Bandama Charity Foundation Sierra Leone (BCF-SL) is committed to protecting the privacy, security, and integrity of all visitors to our public website and users of the BCF-SL Administration Hub. This policy details the technical particulars collected, how they are processed, and our strict retention and security safeguards.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">2. What Information We Collect</h2>
            <p className="mb-2">We record technical details necessary for operational security, service delivery, and fraud prevention:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>IP Address &amp; Approximate Location:</strong> Derived country, region, city, and network provider (ISP). Precise GPS coordinates are never requested or stored.</li>
              <li><strong>Device Identifier:</strong> A stable, pseudonymous identifier derived from secure browser storage and device signals, stored strictly in one-way cryptographic hash format (replacing hardware serial numbers or IMEI).</li>
              <li><strong>Operating System &amp; Browser:</strong> OS version, browser name and version, screen resolution, language, and system time zone.</li>
              <li><strong>Personal Particulars (Sign-in &amp; Forms Only):</strong> Your verified name and email address are recorded only when signing in to the Hub or submitting official public forms (contact, newsletter, donations). Unauthenticated visitors are designated as &ldquo;Anonymous&rdquo; and are never guessed.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">3. Prohibited Data Collection</h2>
            <p>
              We do <strong>not</strong> collect passwords, message content, biometric data, precise GPS coordinates, personal contacts, or any data outside of the BCF-SL website and Administration Hub.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">4. Data Retention and Deletion Rights</h2>
            <p>
              Visitor records are retained for a configurable institutional period (default 12 months), after which records are automatically deleted or fully anonymized. Any visitor or employee may request the lookup and deletion of their personal visitor history by contacting the BCF-SL Super Administrator with a valid compliance reason.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">5. Security, Access Restrictions &amp; Audit Logs</h2>
            <p>
              Access to visitor intelligence is strictly restricted to Super Administrators. Every review of records, export, and administrative action is permanently recorded in our tamper-proof institutional audit trail. Devices or accounts engaging in automated credential stuffing or unauthorized intrusions are subject to immediate security restriction.
            </p>
          </section>

          <section className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              For privacy inquiries, rights enforcement, or verification, contact: <strong>privacy@bcf-sl.org</strong> or the BCF-SL Legal &amp; Compliance Directorate, Freetown, Sierra Leone.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
