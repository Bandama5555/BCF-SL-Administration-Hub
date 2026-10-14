/**
 * fix-nav-links.mjs
 * Patches all Stitch HTML apps so their bottom nav links use window.top.location.href
 * to navigate the parent Next.js frame instead of doing href="#" (no-op).
 *
 * Route map: data-path value → Next.js route
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Recursive file finder
function findFiles(dir, pattern, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    try {
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'public') continue;
        findFiles(full, pattern, results);
      } else if (entry === pattern) {
        results.push(full);
      }
    } catch {}
  }
  return results;
}

// Map every data-path value to its Next.js route
const ROUTE_MAP = {
  // Employees module
  'directory':          '/employees/staff-directory',
  'staff-directory':    '/employees/staff-directory',
  'register-staff':     '/employees/register-staff',
  'staff-analytics':    '/employees/staff-analytics',
  'employee-profile':   '/employees/employee-profile',
  'organogram':         '/employees/organogram',
  'settings':           '/employees/organogram',  // No settings page → organogram

  // Donors module
  'donors-directory':   '/donors/donors-directory-log',
  'donors_directory':   '/donors/donors-directory-log',
  'log-donation':       '/donors/log-new-donation',
  'log_donation':       '/donors/log-new-donation',
  'giving-analytics':   '/donors/giving-analytics-reports',
  'giving_analytics':   '/donors/giving-analytics-reports',
  'donor-dossier':      '/donors/donor-dossier-history',
  'donor_dossier':      '/donors/donor-dossier-history',

  // Finance module
  'treasury':           '/finance/executive-treasury-bank-balance',
  'payroll':            '/finance/staff-payroll-statutory-schedule',
  'payslip':            '/finance/staff-monthly-payslip-self-service',
  'donor-funds':        '/finance/donor-funds-inflow-ledger',
  'donor_funds':        '/finance/donor-funds-inflow-ledger',
  'expenditure':        '/finance/program-expenditure-budgets',
  'loans-register':     '/finance/staff-loan-register-disbursements',
  'eosb':               '/finance/end-of-service',
  'end-of-service':     '/finance/end-of-service',

  // Loans module
  'loan-application':   '/loans/staff-eligibility-loan-application',
  'loan-tracking':      '/loans/loan-tracking-repayment-dashboard',
  'hr-approval':        '/loans/hr-finance-approval-console',
  'ceo-review':         '/loans/ceo-executive-review-authorization',
  'disbursement':       '/loans/hr-to-finance-disbursement-voucher',

  // Programs module
  'programs-database':  '/programs/programs-database',
  'programs_database':  '/programs/programs-database',
  'financial-ledger':   '/programs/financial-ledger',
  'financial_ledger':   '/programs/financial-ledger',
  'performance':        '/programs/performance-evaluation',
  'donors-partners':    '/programs/donors-partners',
  'donors_partners':    '/programs/donors-partners',

  // Leave & Allowance module
  'leave-dashboard':    '/leave/bcf-sl-leave-allowance-dashboard',
  'leave_dashboard':    '/leave/bcf-sl-leave-allowance-dashboard',
  'leave-application':  '/leave/bcf-sl-leave-application-form',
  'leave_application':  '/leave/bcf-sl-leave-application-form',
  'hr-review':          '/leave/bcf-sl-hr-review-approval',
  'hr_review':          '/leave/bcf-sl-hr-review-approval',
  'audit-trail':        '/leave/bcf-sl-audit-trail-foms-payment',
  'audit_trail':        '/leave/bcf-sl-audit-trail-foms-payment',

  // Beneficiaries module
  'beneficiaries':      '/beneficiaries/beneficiaries-database-log',

  // Procurement module
  'procurement':             '/procurement',
  'procurement-data':        '/procurement/procurement-data',
  'purchase-requisition':    '/procurement/purchase-requisition',
  'supplier-management':     '/procurement/supplier-management',
  'rfq-management':          '/procurement/rfq-management',
  'purchase-order':          '/procurement/purchase-order',
  'goods-received-note':     '/procurement/goods-received-note',
  'invoice-matching':        '/procurement/invoice-matching',
  'transaction-audit-trail': '/procurement/transaction-audit-trail',
  'procurement-dashboard':   '/procurement/procurement-dashboard',
  'data-hub':                '/procurement/procurement-data',
  'catalogs-and-pos':        '/procurement/purchase-order',
  'suppliers':               '/procurement/supplier-management',
  'audit-and-compliance':    '/procurement/transaction-audit-trail',

  // Partnerships module
  'partners':           '/partnerships/partners-directory',
  'deal-pipeline':      '/partnerships/deal-pipeline',
  'deal_pipeline':      '/partnerships/deal-pipeline',
  'partnership-analytics': '/partnerships/partnership-analytics',
  'partner-profile':    '/partnerships/partner-profile',
  'partnership-management': '/procurement/partnership-management',

  // Learning module
  'catalog':            '/learning/catalog-course-allocation',
  'my-learning':        '/learning/my-learning-grades',
  'my_learning':        '/learning/my-learning-grades',
  'assessment':         '/learning/assessment-certificate',
  'admin-provisioning': '/learning/admin-staff-provisioning',
};

const files = findFiles(ROOT, 'code.html');

let patchedCount = 0;

for (const filePath of files) {
  const original = readFileSync(filePath, 'utf-8');

  // Match: href="#" ... data-path="VALUE" OR data-path="VALUE" ... href="#"
  // Replace each anchor's href="#" with onclick based on data-path
  let patched = original.replace(
    /<a([^>]*?)href="#"([^>]*?)>/g,
    (match, before, after) => {
      // Find data-path in the full match attributes
      const fullAttrs = before + after;
      const dpMatch = fullAttrs.match(/data-path="([^"]+)"/);
      if (!dpMatch) return match; // No data-path → leave alone

      const dataPath = dpMatch[1];
      const route = ROUTE_MAP[dataPath];

      if (!route) {
        // Unknown path — disable gracefully
        return `<a${before}href="#" onclick="return false;"${after}>`;
      }

      // Remove href="#", add onclick
      const cleanBefore = before.replace(/\s*href="#"\s*/g, ' ');
      const cleanAfter = after.replace(/\s*href="#"\s*/g, ' ');
      return `<a${cleanBefore}${cleanAfter} onclick="window.top.location.href='${route}'; return false;" style="cursor:pointer">`;
    }
  );

  if (patched !== original) {
    writeFileSync(filePath, patched, 'utf-8');
    console.log(`  ✓  Patched: ${path.relative(ROOT, filePath)}`);
    patchedCount++;
  }
}

console.log(`\n✅  Patched ${patchedCount} file(s).`);
