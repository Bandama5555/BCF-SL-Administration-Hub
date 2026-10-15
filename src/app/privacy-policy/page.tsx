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
              Bandama Charity Foundation Sierra Leone (BCF-SL) is committed to protecting the privacy, security, and integrity of all users of the BCF-SL Administration Hub and visitors to our public communications portal. This policy details our data protection standards and institutional safeguards.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">2. What Information We Collect</h2>
            <p className="mb-2">
              We collect only information necessary for organizational administration and charitable operations:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Staff Authentication Credentials:</strong> Username, email, employee ID, and encrypted passwords for verified institutional personnel to access administrative modules.</li>
              <li><strong>Public Communications &amp; Pledges:</strong> Contact inquiries and philanthropic pledges voluntarily submitted through official public forms.</li>
              <li><strong>Audit Trail:</strong> Institutional modifications, user role changes, and administrative actions are logged in our tamper-proof audit trail for governance and compliance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">3. Prohibited Data Collection</h2>
            <p>
              We do <strong>not</strong> track passive visitors, collect biometric data, deploy browser fingerprinting or tracking beacons, record satellite GPS locations, or access external data outside of the BCF-SL Administration Hub.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">4. Data Rights and Inquiries</h2>
            <p>
              Any employee or member of the public may request inspection or correction of their personal data by contacting the BCF-SL Legal &amp; Compliance Directorate.
            </p>
          </section>

          <section className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              For privacy inquiries, contact: <strong>privacy@bcf-sl.org</strong> or the BCF-SL Administration Directorate, Freetown, Sierra Leone.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
