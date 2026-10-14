// Automated RBAC and visibility verification script
import { MODULES } from '../src/lib/modules.ts';
import { ACCESS_MATRIX, hasModuleAccess, hasSubAppAccess, getRoleLandingPage, normalizeRole } from '../src/lib/permissions.ts';

const roles = ['ST', 'HR', 'SA', 'CEO', 'FIN', 'IAR', 'PRG', 'PRC', 'IT'];

console.log('=== ROLE-BASED ACCESS CONTROL (RBAC) VERIFICATION ===\n');

// 1. Verify landing pages
console.log('1. Landing Pages per Role:');
roles.forEach(role => {
  console.log(`  - Role ${role}: ${getRoleLandingPage(role)}`);
});

// 2. Visible modules per role
console.log('\n2. Visible Modules per Role:');
roles.forEach(role => {
  const visibleModules = MODULES.filter(m => hasModuleAccess(role, m.slug)).map(m => m.name);
  console.log(`  - Role ${role} (${visibleModules.length} modules): ${visibleModules.join(', ')}`);
});

// 3. Check Section 3 requirements:
console.log('\n3. Specific Boundary Checks:');
// Staff (ST): Staff Directory, BCF Organogram, My Payslip, Staff Loan Application, Leave & Allowance Application, Purchase Requisitions, Course Catalogue, My Learning & Grades, Documents & Policies (Docs & Policies only)
const stVisibleApps = [];
MODULES.forEach(m => {
  m.subApps.forEach(s => {
    if (hasSubAppAccess('ST', m.slug, s.id)) {
      stVisibleApps.push(`${m.slug}/${s.id}`);
    }
  });
});
console.log(`  - Staff (ST) total accessible sub-apps: ${stVisibleApps.length}`);
console.log(`    Sub-apps: ${stVisibleApps.join(', ')}`);

// Staff must NOT have access to Beneficiaries, Donors, Proposals, Projects, Deleted Items
const stBeneficiaries = hasModuleAccess('ST', 'beneficiaries');
const stDonors = hasModuleAccess('ST', 'donors');
const stProposals = hasSubAppAccess('ST', 'documents-policies', 'proposals');
const stProjects = hasSubAppAccess('ST', 'documents-policies', 'projects');
const stDeleted = hasSubAppAccess('ST', 'documents-policies', 'deleted-items');

console.log(`    Staff Beneficiaries access blocked: ${!stBeneficiaries}`);
console.log(`    Staff Donors access blocked: ${!stDonors}`);
console.log(`    Staff Proposals access blocked: ${!stProposals}`);
console.log(`    Staff Projects access blocked: ${!stProjects}`);
console.log(`    Staff Deleted Items access blocked: ${!stDeleted}`);

// IT Director: Only Learning module
const itVisibleModules = MODULES.filter(m => hasModuleAccess('IT', m.slug)).map(m => m.slug);
console.log(`  - IT Director visible modules: ${itVisibleModules.join(', ')} (Expected only ['learning'])`);

// Procurement Director: Procurement and Programs modules
const prcVisibleModules = MODULES.filter(m => hasModuleAccess('PRC', m.slug)).map(m => m.slug);
console.log(`  - Procurement Director visible modules: ${prcVisibleModules.join(', ')} (Expected ['procurement', 'programs', 'learning'])`);

// CEO: View on most, Full on CEO auth
console.log(`  - CEO executive loan auth: ${ACCESS_MATRIX['loans']['ceo-authorisation']['CEO']}`);

// 4. Test normalizeRole string variations:
console.log('\n4. normalizeRole Strict Verification:');
const testCases = [
  { role: "Staff Member", user: "staff_user", email: "staff@bcf-sl.org", expected: "ST" },
  { role: "Community Field Officer", user: "mabinty", email: "mabinty@bcf-sl.org", expected: "ST" },
  { role: "Administrative Assistant", user: "admin_asst", email: "asst@bcf-sl.org", expected: "ST" },
  { role: "Officer", user: "johndoe", email: "john@bcf-sl.org", expected: "ST" },
  { role: "", user: "", email: "", expected: "ST" },
  { role: "Super Admin", user: "admin", email: "admin@bcfsl.org", expected: "SA" },
  { role: "Chief Executive Officer", user: "ceo_user", email: "ceo@bcf-sl.org", expected: "CEO" },
  { role: "HR Director", user: "hr_director", email: "jconteh@bcf-sl.org", expected: "HR" },
  { role: "Finance Director", user: "fin_director", email: "mbangura@bcf-sl.org", expected: "FIN" },
  { role: "Procurement Director", user: "prc_director", email: "hkanu@bcf-sl.org", expected: "PRC" },
  { role: "IT Director", user: "it_director", email: "atoro@bcf-sl.org", expected: "IT" },
];

testCases.forEach(tc => {
  const resolved = normalizeRole(tc.role, tc.user, tc.email);
  const pass = resolved === tc.expected;
  console.log(`  - '${tc.role}' / '${tc.user}' -> ${resolved} (Expected: ${tc.expected}) [${pass ? 'PASS' : 'FAIL'}]`);
  if (!pass) throw new Error(`normalizeRole failed for ${tc.role}: got ${resolved}, expected ${tc.expected}`);
});

console.log('\n=== VERIFICATION COMPLETE ===');
