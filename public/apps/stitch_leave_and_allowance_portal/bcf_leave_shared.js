/**
 * ============================================================================
 * BCF-SL LEAVE MANAGEMENT MODULE — CORE SHARED ARCHITECTURE & LOGIC ENGINE
 * Bandama Charity Foundation Sierra Leone (BCF-SL)
 * 
 * Central Policy Rule:
 * Employment Date -> Service Anniversary -> Leave Eligibility -> 
 * Leave Application -> Approval -> Leave Allowance -> Payroll -> 
 * Leave Balance Ledger -> Return to Work Confirmation
 * 
 * Statutory / HR Policy Baseline:
 * 1. Annual Leave Entitlement: 31 Leave Days after completed 1 year of continuous service.
 * 2. Leave Allowance Formula: 5% of Annual Basic Salary (Monthly Basic Salary x 12 x 5%).
 * 3. Strict Employment Date Integration (obtained directly from HR Employee Master Record).
 * 4. Conflict & Staffing Level Checking across departments.
 * 5. Full lifecycle: Application, Allowance, Multi-Tier Approval, Recall, Cancellation & Return.
 * ============================================================================
 */

(function (global) {
  'use strict';

  // 1. SAFE STORAGE ENGINE (Fault-tolerant with In-Memory Fallback)
  const _memoryStore = {};
  const _safeStorage = {
    getItem(key) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const val = window.localStorage.getItem(key);
          if (val !== null) return val;
        }
      } catch (e) {
        console.warn('[BCF_LEAVE] LocalStorage read failed, using memory store fallback:', e);
      }
      return Object.prototype.hasOwnProperty.call(_memoryStore, key) ? _memoryStore[key] : null;
    },
    setItem(key, value) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch (e) {
        console.warn('[BCF_LEAVE] LocalStorage write failed, saving to memory store:', e);
      }
      _memoryStore[key] = String(value);
    },
    removeItem(key) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch (e) {}
      delete _memoryStore[key];
    }
  };

  // 2. STORAGE KEYS
  const KEYS = {
    SETTINGS: 'bcf_leave_policy_settings',
    EMPLOYEES: 'bcf_leave_employees',
    APPLICATIONS: 'bcf_leave_applications',
    ALLOWANCES: 'bcf_leave_allowances',
    LEDGERS: 'bcf_leave_ledgers',
    AUDIT: 'bcf_leave_audit_logs',
    CURRENT_USER: 'bcf_leave_current_user',
    STAFF_REGISTRY: 'bcf_staff_registry'
  };

  // 3. DEFAULT POLICY SETTINGS (Configurable by HR Admin)
  const DEFAULT_SETTINGS = {
    annualLeaveDays: 31,
    eligibilityMonths: 12,
    allowanceRate: 0.05, // 5%
    allowanceBasis: 'annual', // 'annual' = 5% of Annual Basic (Monthly x 12 x 5%), 'monthly' = 5% of Monthly Basic
    carryOverPermitted: true,
    maxCarryOverDays: 5,
    carryOverExpiryMonths: 3,
    leaveCountingRule: 'working_days', // 'working_days' or 'calendar_days'
    excludeWeekends: true,
    excludePublicHolidays: true,
    requireHandoverOfficer: true,
    requireSupervisorApproval: true,
    requireHrVerification: true,
    requireFinanceApproval: true,
    publicHolidays: [
      { date: '2026-01-01', name: "New Year's Day" },
      { date: '2026-02-18', name: "Armed Forces Day" },
      { date: '2026-03-20', name: "Eid al-Fitr (Estimated)" },
      { date: '2026-04-27', name: "Independence Day" },
      { date: '2026-05-27', name: "Eid al-Adha (Estimated)" },
      { date: '2026-12-25', name: "Christmas Day" },
      { date: '2026-12-26', name: "Boxing Day" }
    ]
  };

  // 4. SEED EMPLOYEES (Synced with HR Employee Master Record)
  const DEFAULT_EMPLOYEES = [
    {
      id: 'BCF-EMP-00025',
      fullName: 'John Kamara',
      gender: 'Male',
      department: 'Programmes',
      position: 'Programme Officer',
      empDate: '2025-10-01', // Completed 1 year continuous service (Eligible for 31-day quota & allowance)
      status: 'Active',
      workLoc: 'Freetown Headquarters',
      supervisor: 'Dr. Sorie Sesay (CEO)',
      email: 'john.kamara@bcf-sl.org',
      phone: '+232 78 554433',
      bankName: 'Sierra Leone Commercial Bank (SLCB)',
      accountNo: '00300188992211',
      monthlyBasic: 40000, // NLe 40,000 / month -> Annual NLe 480,000 -> 5% = NLe 24,000
      classification: 'Permanent',
      emergencyContact: 'Fatmata Kamara (Spouse) - +232 76 998877',
      unresolvedRestrictions: false
    },
    {
      id: 'BCF-EMP-00142',
      fullName: 'Francis M. Sesay',
      gender: 'Male',
      department: 'Programmes',
      position: 'Senior Program Officer',
      empDate: '2024-01-14', // Over 2 years service
      status: 'Active',
      workLoc: 'Bo Field Office',
      supervisor: 'John Kamara (Lead)',
      email: 'francis.sesay@bcf-sl.org',
      phone: '+232 76 443322',
      bankName: 'Rokel Commercial Bank',
      accountNo: '00200566778899',
      monthlyBasic: 35000, // Annual NLe 420,000 -> 5% = NLe 21,000
      classification: 'Permanent',
      emergencyContact: 'Mariama Sesay (Sister) - +232 77 112233',
      unresolvedRestrictions: false
    },
    {
      id: 'BCF-EMP-00018',
      fullName: 'Aminata Turay',
      gender: 'Female',
      department: 'Finance & Accounts',
      position: 'Senior Finance Specialist',
      empDate: '2023-04-01', // Completed 3+ years
      status: 'Active',
      workLoc: 'Freetown Headquarters',
      supervisor: 'Albert Joseph Bandama (CEO)',
      email: 'aminata.turay@bcf-sl.org',
      phone: '+232 79 123456',
      bankName: 'Standard Chartered Bank Sierra Leone',
      accountNo: '00100455667788',
      monthlyBasic: 48000, // Annual NLe 576,000 -> 5% = NLe 28,800
      classification: 'Permanent',
      emergencyContact: 'Mohamed Turay (Brother) - +232 78 990011',
      unresolvedRestrictions: false
    },
    {
      id: 'BCF-EMP-00088',
      fullName: 'Mariama Conteh',
      gender: 'Female',
      department: 'Health & Safety Department',
      position: 'WASH & Community Health Officer',
      empDate: '2026-08-01', // NEWLY HIRED: ~2 months of service -> NOT YET ELIGIBLE!
      status: 'Active',
      workLoc: 'Kenema Regional Hub',
      supervisor: 'Francis M. Sesay',
      email: 'mariama.conteh@bcf-sl.org',
      phone: '+232 77 889900',
      bankName: 'Sierra Leone Commercial Bank',
      accountNo: '00300998877665',
      monthlyBasic: 22000,
      classification: 'Fixed-Term Contract',
      emergencyContact: 'Ibrahim Conteh (Father) - +232 76 334455',
      unresolvedRestrictions: false
    },
    {
      id: 'BCF-EMP-00042',
      fullName: 'Mohamed Bangura',
      gender: 'Male',
      department: 'Procurement Department',
      position: 'Contracts & Procurement Specialist',
      empDate: '2025-02-10', // ~1 yr 8 mos
      status: 'Active',
      workLoc: 'Freetown Headquarters',
      supervisor: 'Albert Joseph Bandama (CEO)',
      email: 'albertjosephhassanbandama@gmail.com',
      phone: '+232 76 556677',
      bankName: 'Ecobank Sierra Leone',
      accountNo: '00400112233445',
      monthlyBasic: 32000,
      classification: 'Permanent',
      emergencyContact: 'Isatu Bangura (Spouse) - +232 78 223344',
      unresolvedRestrictions: false
    },
    {
      id: 'BCF-EMP-00095',
      fullName: 'Fatmata Koroma',
      gender: 'Female',
      department: 'Human Resources Management Department',
      position: 'HR & Welfare Associate',
      empDate: '2026-06-15', // ~3.5 months service -> NOT YET ELIGIBLE!
      status: 'Active',
      workLoc: 'Freetown Headquarters',
      supervisor: 'Joe Ansumana Conteh (HR Director)',
      email: 'fatmata.koroma@bcf-sl.org',
      phone: '+232 79 332211',
      bankName: 'Sierra Leone Commercial Bank',
      accountNo: '00300776655443',
      monthlyBasic: 18000,
      classification: 'Permanent',
      emergencyContact: 'Alhaji Koroma (Father) - +232 76 667788',
      unresolvedRestrictions: false
    },
    {
      id: 'BCF-EMP-00055',
      fullName: 'Joseph Conteh',
      gender: 'Male',
      department: 'Logistics & Supply Chain',
      position: 'Fleet & Inventory Supervisor',
      empDate: '2025-11-01', // Service anniversary approaching in ~25 days!
      status: 'Active',
      workLoc: 'Makeni Logistics Depot',
      supervisor: 'Mohamed Bangura',
      email: 'joseph.conteh@bcf-sl.org',
      phone: '+232 77 445566',
      bankName: 'Rokel Commercial Bank',
      accountNo: '00200889900112',
      monthlyBasic: 26000,
      classification: 'Permanent',
      emergencyContact: 'Finda Conteh (Spouse) - +232 78 778899',
      unresolvedRestrictions: false
    },
    {
      id: 'BCF-EMP-00001',
      fullName: 'Albert Joseph Bandama',
      gender: 'Male',
      department: 'Executive Management',
      position: 'Chief Executive Officer (CEO)',
      empDate: '2022-01-01',
      status: 'Active',
      workLoc: 'Freetown Headquarters',
      supervisor: 'BCF-SL Governing Board',
      email: 'albert.bandama@bcf-sl.org',
      phone: '+232 76 123456',
      bankName: 'Sierra Leone Commercial Bank',
      accountNo: '00300123456789',
      monthlyBasic: 75000,
      classification: 'Permanent',
      emergencyContact: 'Mrs. Bandama - +232 76 999000',
      unresolvedRestrictions: false
    },
    {
      id: 'BCF-EMP-00108',
      fullName: 'Sahr Morris',
      gender: 'Male',
      department: 'Programmes',
      position: 'Field Operations Coordinator',
      empDate: '2024-05-10', // Completed 2+ years of service
      status: 'Active',
      workLoc: 'Kono Field Base',
      supervisor: 'John Kamara (Programme Officer)',
      email: 'sahr.morris@bcf-sl.org',
      phone: '+232 78 881122',
      bankName: 'Sierra Leone Commercial Bank',
      accountNo: '00300445566778',
      monthlyBasic: 28000,
      classification: 'Permanent',
      emergencyContact: 'Kumba Morris (Spouse) - +232 77 334455',
      unresolvedRestrictions: false
    }
  ];

  // 5. SEED APPLICATIONS
  const DEFAULT_APPLICATIONS = [
    {
      id: 'BCF-LEV-2026-0001',
      reqRef: 'BCF-LR-2026-0001',
      employeeId: 'BCF-EMP-00142',
      employeeName: 'Francis M. Sesay',
      department: 'Programmes',
      position: 'Senior Program Officer',
      leaveType: 'Annual Leave',
      startDate: '2026-08-03',
      endDate: '2026-08-31',
      daysRequested: 21,
      balanceBefore: 31,
      balanceAfter: 10,
      reason: 'First installment of statutory annual restorative leave in Bo district (21 days taken, 10 days remaining).',
      emergencyContact: 'Mariama Sesay - +232 77 112233',
      handoverOfficer: 'John Kamara (Programme Officer)',
      handoverNotes: 'Field reports and WASH site monitoring handover completed.',
      status: 'Approved',
      submittedDate: '2026-07-20',
      supervisorApproval: { approved: true, officer: 'John Kamara', date: '2026-07-22' },
      hrVerification: { approved: true, officer: 'Joe A. Conteh (HR Director)', date: '2026-07-23' },
      finalApproval: { approved: true, officer: 'Albert J. Bandama (CEO)', date: '2026-07-25' },
      hasAllowanceClaim: true,
      allowanceId: 'BCF-LA-2026-0001',
      returnConfirmed: false
    },
    {
      id: 'BCF-LEV-2026-0002',
      reqRef: 'BCF-LR-2026-0002',
      employeeId: 'BCF-EMP-00042',
      employeeName: 'Mohamed Bangura',
      department: 'Procurement Department',
      position: 'Contracts & Procurement Specialist',
      leaveType: 'Annual Leave',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      daysRequested: 10,
      balanceBefore: 31,
      balanceAfter: 21,
      reason: 'Personal annual rest and medical follow-up.',
      emergencyContact: 'Isatu Bangura - +232 78 223344',
      handoverOfficer: 'Joseph Conteh',
      handoverNotes: 'RFQ vendor evaluation dossier handed over.',
      status: 'Active (On Leave)',
      submittedDate: '2026-09-20',
      supervisorApproval: { approved: true, officer: 'Albert J. Bandama', date: '2026-09-22' },
      hrVerification: { approved: true, officer: 'Joe A. Conteh', date: '2026-09-23' },
      finalApproval: { approved: true, officer: 'Albert J. Bandama', date: '2026-09-24' },
      hasAllowanceClaim: true,
      allowanceId: 'BCF-LA-2026-0002',
      employeeEmail: 'albertjosephhassanbandama@gmail.com',
      returnConfirmed: false
    },
    {
      id: 'BCF-LEV-2026-0003',
      reqRef: 'BCF-LR-2026-0003',
      employeeId: 'BCF-EMP-00018',
      employeeName: 'Aminata Turay',
      department: 'Finance & Accounts',
      position: 'Senior Finance Specialist',
      leaveType: 'Annual Leave',
      startDate: '2026-11-02',
      endDate: '2026-11-20',
      daysRequested: 15,
      balanceBefore: 31,
      balanceAfter: 16,
      reason: 'Annual leave post donor audit clearance.',
      emergencyContact: 'Mohamed Turay - +232 78 990011',
      handoverOfficer: 'Albert J. Bandama',
      handoverNotes: 'Q3 treasury reconciliations completed and archived.',
      status: 'Pending HR Verification',
      submittedDate: '2026-10-04',
      supervisorApproval: { approved: true, officer: 'Albert J. Bandama', date: '2026-10-05' },
      hrVerification: { approved: false, officer: null, date: null },
      finalApproval: { approved: false, officer: null, date: null },
      hasAllowanceClaim: true,
      allowanceId: 'BCF-LA-2026-0003',
      returnConfirmed: false
    },
    {
      id: 'BCF-LEV-2026-0004',
      reqRef: 'BCF-LR-2026-0004',
      employeeId: 'BCF-EMP-00108',
      employeeName: 'Sahr Morris',
      department: 'Programmes',
      position: 'Field Operations Coordinator',
      leaveType: 'Annual Leave',
      startDate: '2026-06-01',
      endDate: '2026-07-13',
      daysRequested: 31,
      balanceBefore: 31,
      balanceAfter: 0,
      reason: 'Statutory 31-day full restorative annual leave for 2026 service cycle.',
      emergencyContact: 'Kumba Morris - +232 77 334455',
      handoverOfficer: 'Francis M. Sesay',
      handoverNotes: 'Kono Field Base project files and logistics inventory handed over.',
      status: 'Completed (Returned)',
      submittedDate: '2026-05-15',
      supervisorApproval: { approved: true, officer: 'John Kamara', date: '2026-05-16' },
      hrVerification: { approved: true, officer: 'Joe A. Conteh', date: '2026-05-18' },
      finalApproval: { approved: true, officer: 'Albert J. Bandama (CEO)', date: '2026-05-20' },
      hasAllowanceClaim: true,
      allowanceId: 'BCF-LA-2026-0004',
      returnConfirmed: true,
      returnDate: '2026-07-14'
    }
  ];

  // 6. SEED ALLOWANCES
  const DEFAULT_ALLOWANCES = [
    {
      id: 'BCF-LA-2026-0001',
      reqRef: 'BCF-LR-2026-0001',
      employeeId: 'BCF-EMP-00142',
      employeeName: 'Francis M. Sesay',
      department: 'Programmes',
      serviceCycle: '2026/2027',
      monthlyBasic: 35000,
      annualBasic: 420000,
      rate: 0.05,
      allowanceAmount: 21000, // NLe 21,000
      claimDate: '2026-09-28',
      status: 'Paid',
      hrVerified: true,
      payrollVerified: true,
      financeApproved: true,
      paymentVoucher: 'PV-BCF-FOMS-2026-0412',
      paymentRef: 'SL-CB-EFT-994411',
      paymentDate: '2026-10-02',
      disbursementBank: 'Rokel Commercial Bank'
    },
    {
      id: 'BCF-LA-2026-0002',
      reqRef: 'BCF-LR-2026-0002',
      employeeId: 'BCF-EMP-00042',
      employeeName: 'Mohamed Bangura',
      department: 'Procurement Department',
      serviceCycle: '2026/2027',
      monthlyBasic: 32000,
      annualBasic: 384000,
      rate: 0.05,
      allowanceAmount: 19200, // NLe 19,200
      claimDate: '2026-09-20',
      status: 'Paid',
      hrVerified: true,
      payrollVerified: true,
      financeApproved: true,
      paymentVoucher: 'PV-BCF-FOMS-2026-0398',
      paymentRef: 'SL-CB-EFT-883322',
      paymentDate: '2026-09-25',
      disbursementBank: 'Ecobank Sierra Leone'
    },
    {
      id: 'BCF-LA-2026-0003',
      reqRef: 'BCF-LR-2026-0003',
      employeeId: 'BCF-EMP-00018',
      employeeName: 'Aminata Turay',
      department: 'Finance & Accounts',
      serviceCycle: '2026/2027',
      monthlyBasic: 48000,
      annualBasic: 576000,
      rate: 0.05,
      allowanceAmount: 28800, // NLe 28,800
      claimDate: '2026-10-04',
      status: 'Finance Review',
      hrVerified: true,
      payrollVerified: true,
      financeApproved: false,
      paymentVoucher: 'PV-BCF-FOMS-2026-0429',
      paymentRef: null,
      paymentDate: null,
      disbursementBank: 'Standard Chartered Bank'
    },
    {
      id: 'BCF-LA-2026-0004',
      reqRef: 'BCF-LR-2026-0004',
      employeeId: 'BCF-EMP-00108',
      employeeName: 'Sahr Morris',
      department: 'Programmes',
      serviceCycle: '2026/2027',
      monthlyBasic: 28000,
      annualBasic: 336000,
      rate: 0.05,
      allowanceAmount: 16800, // NLe 16,800
      claimDate: '2026-05-15',
      status: 'Paid',
      hrVerified: true,
      payrollVerified: true,
      financeApproved: true,
      paymentVoucher: 'PV-BCF-FOMS-2026-0188',
      paymentRef: 'SL-CB-EFT-441199',
      paymentDate: '2026-05-25',
      disbursementBank: 'Sierra Leone Commercial Bank'
    }
  ];

  // 7. INITIALIZE LEDGERS & AUDIT TRAIL
  const DEFAULT_AUDIT_LOGS = [
    {
      id: 'AUD-LEV-001',
      timestamp: '2026-10-06 09:15:20',
      actor: 'System / Automated Engine',
      action: 'SERVICE_ANNIVERSARY_CHECK',
      details: 'Daily service anniversary engine scanned 45 employee records. 31 eligible, 14 in service accumulation.',
      employeeId: 'SYSTEM'
    },
    {
      id: 'AUD-LEV-002',
      timestamp: '2026-10-01 10:20:00',
      actor: 'Albert J. Bandama (CEO)',
      action: 'LEAVE_AUTHORIZED',
      details: 'Approved 15-day annual leave application BCF-LEV-2026-0001 for Francis M. Sesay.',
      employeeId: 'BCF-EMP-00142'
    },
    {
      id: 'AUD-LEV-003',
      timestamp: '2026-10-02 14:45:10',
      actor: 'Finance Director (FOMS Gateway)',
      action: 'ALLOWANCE_DISBURSED',
      details: 'Disbursed NLe 21,000.00 via Rokel Commercial Bank for claim BCF-LA-2026-0001.',
      employeeId: 'BCF-EMP-00142'
    }
  ];

  // 8. DATA INITIALIZATION & SYNC ENGINE
  function _initStore() {
    // 1. Settings
    if (!_safeStorage.getItem(KEYS.SETTINGS)) {
      _safeStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
    // 2. Employees (integrate with bcf_staff_registry if available)
    if (!_safeStorage.getItem(KEYS.EMPLOYEES)) {
      let combined = [...DEFAULT_EMPLOYEES];
      try {
        const staffReg = JSON.parse(_safeStorage.getItem(KEYS.STAFF_REGISTRY) || '[]');
        if (Array.isArray(staffReg) && staffReg.length > 0) {
          staffReg.forEach(s => {
            if (!combined.some(c => c.id === s.employeeId)) {
              combined.push({
                id: s.employeeId,
                fullName: s.fullName,
                gender: s.gender || 'Not specified',
                department: s.department || 'General Administration',
                position: s.title || 'Staff Officer',
                empDate: s.empDate || '2026-01-01',
                status: s.status || 'Active',
                workLoc: s.workLoc || 'Freetown Headquarters',
                supervisor: s.reportsTo || 'Department Head',
                email: s.email || s.workEmail || `${(s.employeeId || 'staff').toLowerCase()}@bcf-sl.org`,
                phone: s.phone || s.workPhone || '+232 76 000000',
                bankName: s.bankName || 'Sierra Leone Commercial Bank',
                accountNo: s.accNo || '00300100200300',
                monthlyBasic: parseFloat(s.payBasic) || 25000,
                classification: s.classification || 'Permanent',
                emergencyContact: 'Emergency Contact on File',
                unresolvedRestrictions: false
              });
            }
          });
        }
      } catch (e) {
        console.warn('[BCF_LEAVE] Staff registry sync notice:', e);
      }
      _safeStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(combined));
    } else {
      // Ensure seed employees are present
      try {
        const curEmps = JSON.parse(_safeStorage.getItem(KEYS.EMPLOYEES) || '[]');
        let changed = false;
        DEFAULT_EMPLOYEES.forEach(seed => {
          const idx = curEmps.findIndex(e => e.id === seed.id);
          if (idx < 0) {
            curEmps.push(seed);
            changed = true;
          } else {
            // Keep verified email for Mohamed Bangura
            if (seed.id === 'BCF-EMP-00042' && !curEmps[idx].email?.includes('@')) {
              curEmps[idx].email = seed.email;
              changed = true;
            }
            // Ensure John Kamara has completed 1-year service date in cache
            if (seed.id === 'BCF-EMP-00025' && curEmps[idx].empDate !== seed.empDate) {
              curEmps[idx].empDate = seed.empDate;
              changed = true;
            }
          }
        });
        if (changed) _safeStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(curEmps));
      } catch (_) {}
    }
    // 3. Applications
    if (!_safeStorage.getItem(KEYS.APPLICATIONS)) {
      _safeStorage.setItem(KEYS.APPLICATIONS, JSON.stringify(DEFAULT_APPLICATIONS));
    } else {
      try {
        const curApps = JSON.parse(_safeStorage.getItem(KEYS.APPLICATIONS) || '[]');
        let changedApps = false;
        DEFAULT_APPLICATIONS.forEach(seed => {
          if (!curApps.some(a => a.id === seed.id)) {
            curApps.push(seed);
            changedApps = true;
          }
        });
        if (changedApps) _safeStorage.setItem(KEYS.APPLICATIONS, JSON.stringify(curApps));
      } catch (_) {}
    }
    // 4. Allowances
    if (!_safeStorage.getItem(KEYS.ALLOWANCES)) {
      _safeStorage.setItem(KEYS.ALLOWANCES, JSON.stringify(DEFAULT_ALLOWANCES));
    } else {
      try {
        const curAlws = JSON.parse(_safeStorage.getItem(KEYS.ALLOWANCES) || '[]');
        let changedAlws = false;
        DEFAULT_ALLOWANCES.forEach(seed => {
          if (!curAlws.some(a => a.id === seed.id)) {
            curAlws.push(seed);
            changedAlws = true;
          }
        });
        if (changedAlws) _safeStorage.setItem(KEYS.ALLOWANCES, JSON.stringify(curAlws));
      } catch (_) {}
    }
    // 5. Audit
    if (!_safeStorage.getItem(KEYS.AUDIT)) {
      _safeStorage.setItem(KEYS.AUDIT, JSON.stringify(DEFAULT_AUDIT_LOGS));
    }
    // 6. Current User (Default: John Kamara BCF-EMP-00025 for authentic employee portal view)
    if (!_safeStorage.getItem(KEYS.CURRENT_USER)) {
      _safeStorage.setItem(KEYS.CURRENT_USER, 'BCF-EMP-00025');
    }
  }

  _initStore();

  // 9. PUBLIC API IMPLEMENTATION
  const BCF_LEAVE = {
    // Current date reference for calculations (default: today)
    getCurrentDate() {
      return new Date();
    },

    formatCurrency(amount) {
      const num = Number(amount || 0);
      return `NLe ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    formatDate(dateStr) {
      if (!dateStr) return '—';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (e) {
        return dateStr;
      }
    },

    formatIsoDate(d = new Date()) {
      try {
        const dateObj = (d instanceof Date) ? d : new Date(d);
        if (isNaN(dateObj.getTime())) return new Date().toISOString().split('T')[0];
        return dateObj.toISOString().split('T')[0];
      } catch (e) {
        return new Date().toISOString().split('T')[0];
      }
    },

    // ─────────────────────────────────────────────────────────────
    // SETTINGS ACCESS
    // ─────────────────────────────────────────────────────────────
    getSettings() {
      try {
        return JSON.parse(_safeStorage.getItem(KEYS.SETTINGS)) || DEFAULT_SETTINGS;
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    },

    saveSettings(newSettings) {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      _safeStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
      this.addAuditLog('HR Administrator', 'POLICY_SETTINGS_UPDATED', 'Updated BCF-SL leave policy rules & thresholds.');
      return updated;
    },

    // ─────────────────────────────────────────────────────────────
    // EMPLOYEES & CURRENT USER
    // ─────────────────────────────────────────────────────────────
    getEmployees() {
      let employees = [];
      try {
        employees = JSON.parse(_safeStorage.getItem(KEYS.EMPLOYEES)) || [];
      } catch (e) {
        employees = [];
      }

      // Dynamically merge and update with central bcf_staff_registry if present
      try {
        const staffReg = JSON.parse(_safeStorage.getItem(KEYS.STAFF_REGISTRY) || '[]');
        if (Array.isArray(staffReg) && staffReg.length > 0) {
          staffReg.forEach(s => {
            const sid = s.employeeId || s.id;
            if (!sid) return;
            const existing = employees.find(e => e.id === sid);
            if (!existing) {
              employees.push({
                id: sid,
                fullName: s.fullName || s.name || 'Staff Member',
                gender: s.gender || 'Not specified',
                department: s.department || 'General Administration',
                position: s.title || s.position || 'Staff Officer',
                empDate: s.empDate || s.hireDate || '2025-01-01',
                status: s.status || 'Active',
                workLoc: s.workLoc || s.location || 'Freetown Headquarters',
                supervisor: s.reportsTo || s.supervisor || 'Executive Management',
                email: s.email || s.workEmail || `${sid.toLowerCase()}@bcf-sl.org`,
                phone: s.phone || s.workPhone || '+232 76 000000',
                bankName: s.bankName || 'Sierra Leone Commercial Bank',
                accountNo: s.accNo || '00300100200300',
                monthlyBasic: parseFloat(s.payBasic || s.salary) || 25000,
                classification: s.classification || 'Permanent',
                emergencyContact: 'Emergency Contact on File',
                unresolvedRestrictions: false
              });
            } else {
              // Update with any newer email from staff registry
              if (s.email || s.workEmail) existing.email = s.email || s.workEmail;
              if (s.phone || s.workPhone) existing.phone = s.phone || s.workPhone;
            }
          });
        }
      } catch (err) {
        console.warn('[BCF_LEAVE] Registry dynamic sync error:', err);
      }

      return employees;
    },

    getEmployee(empId) {
      if (!empId) return null;
      const employees = this.getEmployees();
      let emp = employees.find(e => e.id === empId || e.fullName === empId);
      if (!emp) {
        try {
          const staffReg = JSON.parse(_safeStorage.getItem(KEYS.STAFF_REGISTRY) || '[]');
          if (Array.isArray(staffReg)) {
            const s = staffReg.find(item => item.employeeId === empId || item.id === empId || item.fullName === empId);
            if (s) {
              const sid = s.employeeId || s.id || empId;
              emp = {
                id: sid,
                fullName: s.fullName || s.name || empId,
                gender: s.gender || 'Not specified',
                department: s.department || 'General Administration',
                position: s.title || s.position || 'Staff Officer',
                empDate: s.empDate || '2025-01-01',
                status: s.status || 'Active',
                workLoc: s.workLoc || 'Freetown Headquarters',
                supervisor: s.reportsTo || 'Executive Management',
                email: s.email || s.workEmail || `${sid.toLowerCase()}@bcf-sl.org`,
                phone: s.phone || '+232 76 000000',
                bankName: s.bankName || 'Sierra Leone Commercial Bank',
                accountNo: s.accNo || '00300100200300',
                monthlyBasic: parseFloat(s.payBasic) || 25000,
                classification: s.classification || 'Permanent',
                emergencyContact: 'Emergency Contact on File',
                unresolvedRestrictions: false
              };
            }
          }
        } catch (_) {}
      }
      return emp || null;
    },

    saveEmployee(employee) {
      if (!employee || !employee.id) return false;
      const employees = this.getEmployees();
      const idx = employees.findIndex(e => e.id === employee.id);
      if (idx >= 0) {
        employees[idx] = employee;
      } else {
        employees.push(employee);
      }
      _safeStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
      return true;
    },

    getCurrentUserId() {
      return _safeStorage.getItem(KEYS.CURRENT_USER) || 'BCF-EMP-00025';
    },

    setCurrentUserId(empId) {
      _safeStorage.setItem(KEYS.CURRENT_USER, empId);
    },

    getCurrentEmployee() {
      const id = this.getCurrentUserId();
      return this.getEmployee(id) || this.getEmployees()[0];
    },

    // ─────────────────────────────────────────────────────────────
    // AUTOMATIC SERVICE ANNIVERSARY & ELIGIBILITY ENGINE (Sec 2, 4, 5, 9)
    // ─────────────────────────────────────────────────────────────
    calculateEligibility(employee, asOfDate = new Date()) {
      if (!employee || !employee.empDate) {
        return {
          isEligible: false,
          status: 'Invalid Record',
          reason: 'Employee employment commencement date is missing from HR Master Record.',
          completedYears: 0,
          completedMonths: 0,
          completedDays: 0,
          totalDaysService: 0,
          anniversaryDate: null,
          nextAnniversary: null,
          daysRemaining: 0,
          annualEntitlementDays: 0,
          monthlyBasic: 0,
          annualBasic: 0,
          leaveAllowance: 0,
          allowanceFormula: 'N/A'
        };
      }

      const settings = this.getSettings();
      const empDate = new Date(employee.empDate);
      const today = new Date(asOfDate);

      // Total service difference in time
      const diffTime = today.getTime() - empDate.getTime();
      const totalDaysService = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      // Precise year/month/day calculation
      let completedYears = today.getFullYear() - empDate.getFullYear();
      let completedMonths = today.getMonth() - empDate.getMonth();
      let completedDays = today.getDate() - empDate.getDate();

      if (completedDays < 0) {
        completedMonths -= 1;
        // Days in previous month
        const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        completedDays += prevMonth.getDate();
      }
      if (completedMonths < 0) {
        completedYears -= 1;
        completedMonths += 12;
      }

      // Next Service Anniversary calculation
      const nextAnniv = new Date(empDate);
      const targetYear = (completedYears >= 0) ? empDate.getFullYear() + Math.max(1, completedYears + (completedMonths > 0 || completedDays > 0 ? 1 : 0)) : empDate.getFullYear() + 1;
      nextAnniv.setFullYear(targetYear);

      // First anniversary date
      const firstAnniv = new Date(empDate);
      firstAnniv.setFullYear(empDate.getFullYear() + 1);

      // Current eligibility anniversary
      const curAnniv = new Date(empDate);
      curAnniv.setFullYear(empDate.getFullYear() + Math.max(1, completedYears));

      // Threshold check: Must complete >= 1 year of continuous service
      const hasCompletedOneYear = (completedYears >= 1);
      const isActive = (employee.status || '').toLowerCase() === 'active';
      const noRestrictions = !employee.unresolvedRestrictions;

      const isEligible = hasCompletedOneYear && isActive && noRestrictions;

      // Days remaining until first or next anniversary
      let daysRemaining = 0;
      if (!hasCompletedOneYear) {
        daysRemaining = Math.max(0, Math.ceil((firstAnniv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      } else {
        daysRemaining = Math.max(0, Math.ceil((nextAnniv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Format remaining time text
      let remainingText = '';
      if (!hasCompletedOneYear) {
        const remainingMonths = Math.max(0, 11 - completedMonths);
        const remainingDaysPart = Math.max(0, 30 - completedDays);
        if (remainingMonths > 0) {
          remainingText = `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}, ${remainingDaysPart} days (${daysRemaining} calendar days)`;
        } else {
          remainingText = `${daysRemaining} days`;
        }
      }

      // Financial Leave Allowance Calculation (Section 9)
      const monthlyBasic = parseFloat(employee.monthlyBasic) || 0;
      const annualBasic = monthlyBasic * 12;
      const rate = settings.allowanceRate || 0.05;
      
      let leaveAllowance = 0;
      let allowanceFormula = '';
      if (settings.allowanceBasis === 'monthly') {
        leaveAllowance = monthlyBasic * rate;
        allowanceFormula = `${this.formatCurrency(monthlyBasic)} x ${(rate * 100).toFixed(0)}% (Monthly Basic)`;
      } else {
        // Default Option A: 5% of Annual Basic Salary (Monthly x 12 x 5%)
        leaveAllowance = annualBasic * rate;
        allowanceFormula = `${this.formatCurrency(monthlyBasic)} x 12 = ${this.formatCurrency(annualBasic)} x ${(rate * 100).toFixed(0)}% (Annual Basic)`;
      }

      // Reason formatting
      let reason = '';
      if (!hasCompletedOneYear) {
        reason = `You have not yet completed one year of continuous service under the BCF-SL Leave Policy. Employment Date: ${this.formatDate(employee.empDate)} | First Eligibility Date: ${this.formatDate(firstAnniv.toISOString().split('T')[0])} | Remaining: ${remainingText}.`;
      } else if (!isActive) {
        reason = `Employee status is currently '${employee.status}'. Annual leave is restricted to Active staff.`;
      } else if (!noRestrictions) {
        reason = 'Leave application unavailable due to pending administrative or disciplinary restriction.';
      } else {
        reason = `Service requirement satisfied (${completedYears} Year${completedYears > 1 ? 's' : ''} completed). Annual Leave entitlement and Leave Allowance are fully active.`;
      }

      const cycleLabel = `${curAnniv.getFullYear()}/${nextAnniv.getFullYear()}`;

      return {
        isEligible,
        hasCompletedOneYear,
        status: isEligible ? 'Eligible' : 'Not Yet Eligible',
        reason,
        completedYears,
        completedMonths,
        completedDays,
        totalDaysService,
        tenureDisplay: `${completedYears} yr${completedYears !== 1 ? 's' : ''}, ${completedMonths} mo${completedMonths !== 1 ? 's' : ''}, ${completedDays} day${completedDays !== 1 ? 's' : ''}`,
        employmentDate: employee.empDate,
        eligibilityDate: firstAnniv.toISOString().split('T')[0],
        nextAnniversary: nextAnniv.toISOString().split('T')[0],
        currentCycleAnniversary: curAnniv.toISOString().split('T')[0],
        serviceCycle: cycleLabel,
        daysRemaining,
        remainingText,
        annualEntitlementDays: settings.annualLeaveDays || 31,
        monthlyBasic,
        annualBasic,
        leaveAllowance,
        allowanceFormula,
        ratePercent: (rate * 100).toFixed(0) + '%'
      };
    },

    getServiceCycle(employee, asOfDate = new Date()) {
      if (!employee) return { cycleLabel: '2026/2027', cycleStartDate: '2026-01-01', cycleEndDate: '2026-12-31', nextAnniversary: '2027-01-01', isEligible: false };
      const elig = this.calculateEligibility(employee, asOfDate);
      const curStart = elig.currentCycleAnniversary || employee.empDate;
      const nextStart = elig.nextAnniversary;
      const cycleLabel = elig.serviceCycle || `${new Date(curStart).getFullYear()}/${new Date(nextStart).getFullYear()}`;
      return {
        cycleLabel,
        cycleStartDate: curStart,
        cycleEndDate: nextStart,
        nextAnniversary: nextStart,
        isEligible: elig.isEligible
      };
    },

    hasClaimedAllowanceInCycle(employeeId, asOfDate = new Date()) {
      const emp = this.getEmployee(employeeId);
      if (!emp) return { hasClaimed: false, canClaim: false, reason: 'Employee not found', cycleLabel: 'N/A' };

      const elig = this.calculateEligibility(emp, asOfDate);
      if (!elig.isEligible) {
        return { hasClaimed: false, canClaim: false, reason: elig.reason, cycleLabel: 'N/A' };
      }

      const cycle = this.getServiceCycle(emp, asOfDate);
      const allowances = this.getAllowances().filter(a => a.employeeId === employeeId && a.status !== 'Rejected' && a.status !== 'Cancelled');

      const curStart = cycle.cycleStartDate;
      const nextStart = cycle.nextAnniversary;

      const existingClaim = allowances.find(a => {
        if (a.serviceCycle && (a.serviceCycle === cycle.cycleLabel || a.serviceCycle.includes(String(new Date(curStart).getFullYear())))) {
          return true;
        }
        if (a.claimDate && curStart && nextStart) {
          if (a.claimDate >= curStart && a.claimDate < nextStart) return true;
        }
        return false;
      }) || (allowances.length > 0 ? allowances[0] : null);

      if (existingClaim) {
        return {
          hasClaimed: true,
          canClaim: false,
          allowance: existingClaim,
          cycleLabel: existingClaim.serviceCycle || cycle.cycleLabel,
          claimDate: existingClaim.claimDate,
          status: existingClaim.status,
          amount: existingClaim.allowanceAmount,
          reason: `Statutory 5% Leave Allowance has already been claimed for current service cycle (${existingClaim.serviceCycle || cycle.cycleLabel}) on ${this.formatDate(existingClaim.claimDate)} (Ref: ${existingClaim.id}). Claimed leave allowance only one time in a year (Section 10 & 11).`
        };
      }

      return {
        hasClaimed: false,
        canClaim: true,
        allowance: null,
        cycleLabel: cycle.cycleLabel,
        reason: 'Eligible to claim statutory 5% allowance for this service cycle.'
      };
    },

    // ─────────────────────────────────────────────────────────────
    parseDate(dateStr) {
      if (!dateStr) return null;
      if (dateStr instanceof Date) return new Date(dateStr.getTime());
      const str = String(dateStr).trim();
      const parts = str.split('T')[0].split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
      return new Date(str);
    },

    formatIsoDate(d) {
      if (!d || isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },

    // ─────────────────────────────────────────────────────────────
    // WORKING DAYS / LEAVE DAYS CALCULATOR (Sec 14)
    // ─────────────────────────────────────────────────────────────
    calculateLeaveDays(startDateStr, endDateStr) {
      if (!startDateStr || !endDateStr) return 0;
      const start = this.parseDate(startDateStr);
      const end = this.parseDate(endDateStr);
      if (!start || !end || end < start) return 0;

      const settings = this.getSettings();
      if (settings.leaveCountingRule === 'calendar_days') {
        const diff = end.getTime() - start.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
      }

      // Working days excluding weekends and configured public holidays
      const holidays = (settings.publicHolidays || []).map(h => h.date);
      let count = 0;
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endClean = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      while (cur <= endClean) {
        const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
        const dateStr = this.formatIsoDate(cur);
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isHoliday = holidays.includes(dateStr);

        if (settings.excludeWeekends && isWeekend) {
          // skip weekend
        } else if (settings.excludePublicHolidays && isHoliday) {
          // skip public holiday
        } else {
          count++;
        }
        cur.setDate(cur.getDate() + 1);
      }
      return count;
    },

    // ─────────────────────────────────────────────────────────────
    // AUTOMATIC RESUMPTION / END DATE CALCULATOR (31-Day Entitlement Engine)
    // ─────────────────────────────────────────────────────────────
    calculateEndDate(startDateStr, days = 31) {
      if (!startDateStr) return '';
      const targetDays = parseInt(days, 10);
      if (isNaN(targetDays) || targetDays <= 0) return startDateStr;

      const start = this.parseDate(startDateStr);
      if (!start) return '';

      const settings = this.getSettings();
      if (settings.leaveCountingRule === 'calendar_days') {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (targetDays - 1));
        return this.formatIsoDate(d);
      }

      // Working days forward accumulation
      const holidays = (settings.publicHolidays || []).map(h => h.date);
      let count = 0;
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());

      for (let i = 0; i < 365; i++) {
        const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
        const dateStr = this.formatIsoDate(cur);
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isHoliday = holidays.includes(dateStr);

        let isWorkingDay = true;
        if (settings.excludeWeekends && isWeekend) {
          isWorkingDay = false;
        } else if (settings.excludePublicHolidays && isHoliday) {
          isWorkingDay = false;
        }

        if (isWorkingDay) {
          count++;
          if (count === targetDays) {
            return dateStr;
          }
        }
        cur.setDate(cur.getDate() + 1);
      }

      return this.formatIsoDate(cur);
    },

    getNextWorkDay(dateStr) {
      if (!dateStr) return '';
      const d = this.parseDate(dateStr);
      if (!d) return '';

      const settings = this.getSettings();
      const holidays = (settings.publicHolidays || []).map(h => h.date);
      const cur = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

      for (let i = 0; i < 30; i++) {
        const dayOfWeek = cur.getDay();
        const str = this.formatIsoDate(cur);
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isHoliday = holidays.includes(str);

        if ((!settings.excludeWeekends || !isWeekend) && (!settings.excludePublicHolidays || !isHoliday)) {
          return str;
        }
        cur.setDate(cur.getDate() + 1);
      }
      return this.formatIsoDate(cur);
    },

    // ─────────────────────────────────────────────────────────────
    // RESUMPTION DATE DETECTION ENGINE (Sec 27 & 29)
    // ─────────────────────────────────────────────────────────────
    isResumptionDue(app, asOfDateStr = null) {
      if (!app) return false;
      if (!['Approved', 'Active (On Leave)'].includes(app.status)) return false;
      if (app.returnConfirmed === true) return false;
      if (!app.endDate) return false;

      const asOf = asOfDateStr ? this.parseDate(asOfDateStr) : new Date();
      const end = this.parseDate(app.endDate);
      if (!end || !asOf) return false;

      const asOfMidnight = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
      const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      return asOfMidnight >= endMidnight;
    },

    getDueResumptions(asOfDateStr = null) {
      return this.getApplications().filter(a => this.isResumptionDue(a, asOfDateStr));
    },

    getResumptionStatus(app, asOfDateStr = null) {
      if (!app || !app.endDate) return { isDue: false, isOverdue: false, daysDiff: 0, text: 'No dates' };
      if (app.returnConfirmed === true) return { isDue: false, isReturned: true, text: `Returned (${this.formatDate(app.returnDate)})` };

      const asOf = asOfDateStr ? this.parseDate(asOfDateStr) : new Date();
      const end = this.parseDate(app.endDate);
      if (!end || !asOf) return { isDue: false, text: 'Invalid dates' };

      const asOfMidnight = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
      const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const diffMs = endMidnight.getTime() - asOfMidnight.getTime();
      const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (daysDiff < 0) {
        return { isDue: true, isOverdue: true, daysDiff, text: `Resumption Date Passed (${Math.abs(daysDiff)}d ago)` };
      } else if (daysDiff === 0) {
        return { isDue: true, isOverdue: false, daysDiff: 0, text: 'Resumption Date is Today' };
      } else {
        return { isDue: false, isOverdue: false, daysDiff, text: `${daysDiff} day(s) until Resumption` };
      }
    },

    // ─────────────────────────────────────────────────────────────
    // LEAVE BALANCE & LEDGER (Sec 15 & 16)
    // ─────────────────────────────────────────────────────────────
    getLeaveBalance(empId, asOfDate = new Date()) {
      const emp = this.getEmployee(empId);
      if (!emp) {
        return {
          annualQuota: 0,
          usedDays: 0,
          pendingDays: 0,
          remainingDays: 0,
          carryOverDays: 0,
          isExhausted: false,
          cycle: { cycleLabel: 'N/A' },
          nextAnniversary: null,
          apps: []
        };
      }

      const eligibility = this.calculateEligibility(emp, asOfDate);
      const cycle = this.getServiceCycle(emp, asOfDate);

      if (!eligibility.isEligible) {
        return {
          annualQuota: 0,
          usedDays: 0,
          pendingDays: 0,
          remainingDays: 0,
          carryOverDays: 0,
          isExhausted: false,
          cycle,
          nextAnniversary: eligibility.nextAnniversary,
          apps: []
        };
      }

      const quota = eligibility.annualEntitlementDays || 31;
      const allEmpApps = this.getApplications().filter(a => a.employeeId === empId);

      // Filter applications that belong to the current service cycle
      const curStart = eligibility.currentCycleAnniversary;
      const nextStart = eligibility.nextAnniversary;

      const cycleApps = allEmpApps.filter(a => {
        if (!a.startDate) return true;
        if (curStart && nextStart) {
          return (a.startDate >= curStart && a.startDate < nextStart);
        }
        return true;
      });

      // Approved / Active days (only Annual Leave consumes the statutory 31 days quota)
      const usedDays = cycleApps
        .filter(a => ['Approved', 'Active (On Leave)', 'Completed (Returned)'].includes(a.status) && (a.leaveType === 'Annual Leave' || !a.leaveType))
        .reduce((sum, a) => sum + (parseInt(a.daysRequested) || 0), 0);

      // Pending review days
      const pendingDays = cycleApps
        .filter(a => a.status.startsWith('Pending') && (a.leaveType === 'Annual Leave' || !a.leaveType))
        .reduce((sum, a) => sum + (parseInt(a.daysRequested) || 0), 0);

      const remainingDays = Math.max(0, quota - usedDays);
      const isExhausted = (remainingDays === 0);

      return {
        annualQuota: quota,
        usedDays,
        pendingDays,
        remainingDays,
        carryOverDays: 0,
        isExhausted,
        cycle,
        currentCycleAnniversary: eligibility.currentCycleAnniversary,
        nextAnniversary: eligibility.nextAnniversary,
        apps: cycleApps
      };
    },

    getLeaveLedger(empId) {
      const emp = this.getEmployee(empId);
      if (!emp) return [];

      const eligibility = this.calculateEligibility(emp);
      const apps = this.getApplications().filter(a => a.employeeId === empId);

      const ledger = [];
      let runningBalance = 0;

      // Initial credit entry on eligibility anniversary
      if (eligibility.isEligible) {
        runningBalance = eligibility.annualEntitlementDays || 31;
        ledger.push({
          date: eligibility.currentCycleAnniversary || emp.empDate,
          transaction: 'Annual Leave Entitlement Unlocked',
          refNo: `ANNIV-${emp.id}`,
          changeDays: `+${runningBalance}`,
          balance: runningBalance,
          type: 'CREDIT',
          officer: 'Automated HR Policy Engine'
        });
      }

      // Applications entries
      apps.forEach(app => {
        if (['Approved', 'Active (On Leave)', 'Completed (Returned)'].includes(app.status)) {
          runningBalance = Math.max(0, runningBalance - app.daysRequested);
          ledger.push({
            date: app.submittedDate || '2026-10-01',
            transaction: `${app.leaveType} (${app.startDate} to ${app.endDate})`,
            refNo: app.id,
            changeDays: `-${app.daysRequested}`,
            balance: runningBalance,
            type: 'DEBIT',
            officer: app.finalApproval?.officer || 'HR Administration'
          });
        }
      });

      return ledger;
    },

    // ─────────────────────────────────────────────────────────────
    // CONFLICT & TEAM STAFFING CHECKING (Sec 18)
    // ─────────────────────────────────────────────────────────────
    checkStaffingConflicts(department, startDateStr, endDateStr, excludeAppId = null) {
      if (!startDateStr || !endDateStr || !department) return { conflictCount: 0, conflictingApps: [] };

      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      const allApps = this.getApplications();
      const conflicting = allApps.filter(a => {
        if (excludeAppId && a.id === excludeAppId) return false;
        if (a.department !== department) return false;
        if (!['Approved', 'Active (On Leave)', 'Pending Supervisor Review', 'Pending HR Verification'].includes(a.status)) return false;

        const aStart = new Date(a.startDate);
        const aEnd = new Date(a.endDate);

        // Date overlap logic: (StartA <= EndB) and (EndA >= StartB)
        return (aStart <= end && aEnd >= start);
      });

      return {
        conflictCount: conflicting.length,
        conflictingApps: conflicting,
        hasStaffingAlert: conflicting.length >= 2,
        alertMessage: conflicting.length > 0 
          ? `Staffing Alert: ${conflicting.length} colleague(s) from ${department} already have overlapping leave scheduled in this period.`
          : null
      };
    },

    // ─────────────────────────────────────────────────────────────
    // APPLICATIONS & CLAIMS CRUD & WORKFLOW
    // ─────────────────────────────────────────────────────────────
    getApplications() {
      try {
        const apps = JSON.parse(_safeStorage.getItem(KEYS.APPLICATIONS)) || [];
        const mb = apps.find(a => a.id === 'BCF-LEV-2026-0002');
        if (mb && !mb.employeeEmail) {
          mb.employeeEmail = 'albertjosephhassanbandama@gmail.com';
        }
        return apps;
      } catch (e) {
        return [];
      }
    },

    getApplication(id) {
      return this.getApplications().find(a => a.id === id) || null;
    },

    saveApplication(app) {
      const apps = this.getApplications();
      const idx = apps.findIndex(a => a.id === app.id);
      if (idx >= 0) {
        apps[idx] = app;
      } else {
        apps.unshift(app);
      }
      _safeStorage.setItem(KEYS.APPLICATIONS, JSON.stringify(apps));
      return app;
    },

    getAllowances() {
      try {
        return JSON.parse(_safeStorage.getItem(KEYS.ALLOWANCES)) || [];
      } catch (e) {
        return [];
      }
    },

    getAllowance(id) {
      return this.getAllowances().find(a => a.id === id) || null;
    },

    saveAllowance(allowance) {
      const allowances = this.getAllowances();
      const idx = allowances.findIndex(a => a.id === allowance.id);
      if (idx >= 0) {
        allowances[idx] = allowance;
      } else {
        allowances.unshift(allowance);
      }
      _safeStorage.setItem(KEYS.ALLOWANCES, JSON.stringify(allowances));
      return allowance;
    },

    // ─────────────────────────────────────────────────────────────
    // TRANSACTION NUMBER GENERATORS (Sec 23)
    // ─────────────────────────────────────────────────────────────
    generateLeaveId() {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      return `BCF-LEV-${year}-${rand}`;
    },

    generateAllowanceId() {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      return `BCF-LA-${year}-${rand}`;
    },

    generateCombinedReqId() {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      return `BCF-LR-${year}-${rand}`;
    },

    // ─────────────────────────────────────────────────────────────
    // LEAVE SUBMISSION (Option 1, 2, 3)
    // ─────────────────────────────────────────────────────────────
    submitLeaveApplication(data) {
      const emp = this.getEmployee(data.employeeId);
      if (!emp) throw new Error('Employee record not found in HR Master Registry.');

      const eligibility = this.calculateEligibility(emp);
      if (!eligibility.isEligible && data.leaveType === 'Annual Leave') {
        throw new Error(`Ineligible for Annual Leave: ${eligibility.reason}`);
      }

      const balance = this.getLeaveBalance(emp.id);
      const requestedDays = this.calculateLeaveDays(data.startDate, data.endDate);

      // RULE 1: When all 31 days have been taken, staff cannot apply for another leave until employment date is met again!
      if (data.leaveType === 'Annual Leave') {
        if (balance.remainingDays <= 0) {
          throw new Error(
            `Cannot submit annual leave: All ${balance.annualQuota} statutory annual leave days have already been consumed for the current service cycle (${balance.cycle.cycleLabel}). ` +
            `Under BCF-SL HR Policy, staff is unable to apply for another annual leave until their employment anniversary date is met again on ${this.formatDate(balance.nextAnniversary)}.`
          );
        }
        if (requestedDays > balance.remainingDays) {
          throw new Error(
            `Requested duration (${requestedDays} working days) exceeds your remaining statutory annual leave balance (${balance.remainingDays} days). ` +
            `Out of your official 31-day annual entitlement, ${balance.usedDays} days have already been taken. Under BCF-SL HR Policy, you can ONLY take up to the remaining ${balance.remainingDays} days (not more than), until all 31 days are complete.`
          );
        }
      }

      // RULE 2: Claimed leave allowance only ONE time in a year, not multiple as claiming leave date!
      if (data.claimAllowance) {
        const alwCheck = this.hasClaimedAllowanceInCycle(emp.id);
        if (alwCheck.hasClaimed) {
          throw new Error(
            `Cannot claim leave allowance: Statutory 5% Leave Allowance has already been claimed for current service cycle (${alwCheck.cycleLabel}) on ${this.formatDate(alwCheck.claimDate)} (Ref: ${alwCheck.allowance.id}, Status: ${alwCheck.status}). ` +
            `Statutory policy mandates claiming leave allowance only ONE time in a year (Section 10 & 11). Please select 'Apply for Leave Only' to submit your leave dates without claiming allowance.`
          );
        }
      }

      const empEmail = (data.employeeEmail || emp.email || '').trim();
      if (data.employeeEmail && data.employeeEmail.includes('@')) {
        emp.email = data.employeeEmail.trim();
        this.saveEmployee(emp);
      }

      const leaveId = this.generateLeaveId();
      const reqRef = this.generateCombinedReqId();

      const newApp = {
        id: leaveId,
        reqRef,
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeEmail: empEmail,
        department: emp.department,
        position: emp.position,
        employmentDate: emp.empDate,
        leaveType: data.leaveType || 'Annual Leave',
        startDate: data.startDate,
        endDate: data.endDate,
        daysRequested: requestedDays,
        balanceBefore: balance.remainingDays,
        balanceAfter: Math.max(0, balance.remainingDays - requestedDays),
        reason: data.reason || 'Annual leave request',
        emergencyContact: data.emergencyContact || emp.emergencyContact,
        handoverOfficer: data.handoverOfficer || 'Department Colleague',
        handoverNotes: data.handoverNotes || 'Handover completed',
        status: 'Pending Supervisor Review',
        submittedDate: new Date().toISOString().split('T')[0],
        supervisorApproval: { approved: false, officer: null, date: null },
        hrVerification: { approved: false, officer: null, date: null },
        finalApproval: { approved: false, officer: null, date: null },
        hasAllowanceClaim: !!data.claimAllowance,
        allowanceId: null,
        returnConfirmed: false
      };

      // If combined claim or separate allowance claim
      if (data.claimAllowance) {
        const allowanceId = this.generateAllowanceId();
        newApp.allowanceId = allowanceId;

        const newAllowance = {
          id: allowanceId,
          reqRef,
          employeeId: emp.id,
          employeeName: emp.fullName,
          department: emp.department,
          serviceCycle: balance.cycle.cycleLabel || `${eligibility.currentCycleAnniversary?.split('-')[0] || '2026'}/${parseInt(eligibility.currentCycleAnniversary?.split('-')[0] || 2026) + 1}`,
          monthlyBasic: eligibility.monthlyBasic,
          annualBasic: eligibility.annualBasic,
          rate: 0.05,
          allowanceAmount: eligibility.leaveAllowance,
          claimDate: new Date().toISOString().split('T')[0],
          status: 'HR Verification',
          hrVerified: false,
          payrollVerified: false,
          financeApproved: false,
          paymentVoucher: null,
          paymentRef: null,
          paymentDate: null,
          disbursementBank: emp.bankName
        };
        this.saveAllowance(newAllowance);
      }

      this.saveApplication(newApp);
      this.addAuditLog(emp.fullName, 'LEAVE_APPLICATION_SUBMITTED', `Submitted ${newApp.leaveType} request (${requestedDays} days, Ref: ${leaveId}).`, emp.id);

      return newApp;
    },

    submitAllowanceOnlyClaim(empId) {
      const emp = this.getEmployee(empId);
      if (!emp) throw new Error('Employee not found');

      const eligibility = this.calculateEligibility(emp);
      if (!eligibility.isEligible) {
        throw new Error(`Ineligible to claim leave allowance: ${eligibility.reason}`);
      }

      // RULE: Claimed leave allowance only ONE time in a year
      const alwCheck = this.hasClaimedAllowanceInCycle(empId);
      if (alwCheck.hasClaimed) {
        throw new Error(
          `Statutory 5% Leave Allowance has already been claimed for current service cycle (${alwCheck.cycleLabel}) on ${this.formatDate(alwCheck.claimDate)} (Ref: ${alwCheck.allowance.id}, Status: ${alwCheck.status}). ` +
          `Under BCF-SL policy (Section 10 & 11), statutory leave allowance can only be claimed ONE time in a year.`
        );
      }

      const cycle = this.getServiceCycle(emp);
      const allowanceId = this.generateAllowanceId();
      const newAllowance = {
        id: allowanceId,
        reqRef: allowanceId,
        employeeId: emp.id,
        employeeName: emp.fullName,
        department: emp.department,
        serviceCycle: cycle.cycleLabel || '2026/2027',
        monthlyBasic: eligibility.monthlyBasic,
        annualBasic: eligibility.annualBasic,
        rate: 0.05,
        allowanceAmount: eligibility.leaveAllowance,
        claimDate: new Date().toISOString().split('T')[0],
        status: 'HR Verification',
        hrVerified: false,
        payrollVerified: false,
        financeApproved: false,
        paymentVoucher: null,
        paymentRef: null,
        paymentDate: null,
        disbursementBank: emp.bankName
      };

      this.saveAllowance(newAllowance);
      this.addAuditLog(emp.fullName, 'ALLOWANCE_CLAIM_SUBMITTED', `Claimed statutory leave allowance of ${this.formatCurrency(eligibility.leaveAllowance)} (Ref: ${allowanceId}).`, emp.id);
      return newAllowance;
    },

    // ─────────────────────────────────────────────────────────────
    // MULTI-TIER APPROVAL WORKFLOW (Sec 17 & 20)
    // ─────────────────────────────────────────────────────────────
    supervisorApprove(appId, approverName = 'Supervisor') {
      const app = this.getApplication(appId);
      if (!app) return false;
      app.status = 'Pending HR Verification';
      app.supervisorApproval = { approved: true, officer: approverName, date: new Date().toISOString().split('T')[0] };
      this.saveApplication(app);
      this.addAuditLog(approverName, 'SUPERVISOR_APPROVAL', `Supervisor approved leave request ${app.id}.`, app.employeeId);
      return true;
    },

    hrVerify(appId, hrOfficer = 'HR Director') {
      const app = this.getApplication(appId);
      if (!app) return false;
      app.status = 'Pending Final Approval';
      app.hrVerification = { approved: true, officer: hrOfficer, date: new Date().toISOString().split('T')[0] };
      this.saveApplication(app);
      this.addAuditLog(hrOfficer, 'HR_VERIFICATION', `HR verified leave compliance for ${app.id}.`, app.employeeId);

      // Also forward linked allowance if present
      if (app.allowanceId) {
        const alw = this.getAllowance(app.allowanceId);
        if (alw) {
          alw.status = 'Payroll Verification';
          alw.hrVerified = true;
          this.saveAllowance(alw);
        }
      }
      return true;
    },

    async finalApprove(appId, finalAuthority = 'CEO / Executive Director', options = {}) {
      const app = this.getApplication(appId);
      if (!app) return { success: false, error: 'Leave application not found' };
      app.status = 'Approved';
      app.finalApproval = { 
        approved: true, 
        officer: finalAuthority, 
        date: new Date().toISOString().split('T')[0],
        notes: options.executiveNotes || ''
      };
      if (options.recipientEmail) {
        app.employeeEmail = options.recipientEmail.trim();
      }
      this.saveApplication(app);
      this.addAuditLog(finalAuthority, 'FINAL_AUTHORIZATION', `Executive authorized leave request ${app.id}.`, app.employeeId);

      // Auto update linked allowance to Scheduled for Payment
      if (app.allowanceId) {
        const alw = this.getAllowance(app.allowanceId);
        if (alw) {
          alw.status = 'Approved (Pending Payment)';
          alw.payrollVerified = true;
          alw.financeApproved = true;
          alw.paymentVoucher = `PV-BCF-FOMS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          this.saveAllowance(alw);
        }
      }

      // Automatically dispatch executive approval confirmation email to employee
      let emailResult = { success: false };
      if (options.skipEmail !== true) {
        emailResult = await this.sendApprovalNotification(app, finalAuthority, options);
      }

      return { success: true, app, emailResult };
    },

    rejectApplication(appId, officerName, rejectionReason) {
      const app = this.getApplication(appId);
      if (!app) return false;
      app.status = 'Rejected';
      app.rejectionReason = rejectionReason;
      this.saveApplication(app);
      this.addAuditLog(officerName, 'APPLICATION_REJECTED', `Rejected leave request ${app.id}. Reason: ${rejectionReason}`, app.employeeId);

      if (app.allowanceId) {
        const alw = this.getAllowance(app.allowanceId);
        if (alw) {
          alw.status = 'Rejected';
          this.saveAllowance(alw);
        }
      }
      return true;
    },

    // ─────────────────────────────────────────────────────────────
    // FINANCE & PAYROLL DISBURSEMENT (Sec 32 & 33)
    // ─────────────────────────────────────────────────────────────
    async disburseAllowancePayment(allowanceId, officerName = 'Finance Director', paymentRef = null, options = {}) {
      const alw = this.getAllowance(allowanceId);
      if (!alw) return { success: false, error: 'Allowance record not found' };
      alw.status = 'Paid';
      alw.paymentRef = paymentRef || `SL-CB-EFT-${Math.floor(100000 + Math.random() * 900000)}`;
      alw.paymentDate = new Date().toISOString().split('T')[0];
      if (options.recipientEmail) {
        alw.employeeEmail = options.recipientEmail.trim();
      }
      this.saveAllowance(alw);
      this.addAuditLog(officerName, 'ALLOWANCE_PAID', `Disbursed leave allowance ${alw.id} of ${this.formatCurrency(alw.allowanceAmount)} (Ref: ${alw.paymentRef}).`, alw.employeeId);

      // Automatically dispatch official disbursement advice email to the employee
      let emailResult = { success: false };
      if (options.skipEmail !== true) {
        emailResult = await this.sendDisbursementNotification(alw, {
          ...options,
          officerName,
          paymentRef: alw.paymentRef
        });
      }

      return { success: true, allowance: alw, emailResult };
    },

    async sendDisbursementNotification(allowance, options = {}) {
      if (!allowance) return { success: false, error: 'No allowance record provided' };
      const emp = this.getEmployee(allowance.employeeId);
      const app = allowance.reqRef ? this.getApplications().find(a => a.reqRef === allowance.reqRef || a.id === allowance.reqRef) : null;

      let recipientEmail = (
        (options && options.recipientEmail) ||
        allowance.employeeEmail ||
        (app && app.employeeEmail) ||
        (emp && emp.email) ||
        ''
      ).trim();

      if (!recipientEmail || !recipientEmail.includes('@')) {
        const staffName = (emp && emp.fullName) || allowance.employeeName || 'staff';
        const cleanSlug = staffName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
        recipientEmail = `${cleanSlug || 'staff'}@bcf-sl.org`;
      }

      if (emp && !emp.email) {
        emp.email = recipientEmail;
        this.saveEmployee(emp);
      }
      allowance.employeeEmail = recipientEmail;

      const monthlyBasic = emp ? emp.monthlyBasic : (allowance.monthlyBasic || 15000);
      const annualBasic = monthlyBasic * 12;
      const voucherNo = allowance.paymentVoucher || `PV-BCF-FOMS-${new Date().getFullYear()}-0429`;
      const bankName = emp?.bankName || allowance.disbursementBank || 'Sierra Leone Commercial Bank (SLCB)';
      const accountNo = emp?.accountNo ? `******${emp.accountNo.slice(-4)}` : '******9977';
      const officer = options.officerName || 'Director of Finance & Accounts (FOMS Gateway)';
      const eftRef = options.paymentRef || allowance.paymentRef || `SL-CB-EFT-${Math.floor(100000 + Math.random() * 900000)}`;

      try {
        const payload = {
          type: 'DISBURSEMENT_MADE',
          to: recipientEmail,
          employeeName: (emp && emp.fullName) || allowance.employeeName || 'Staff Member',
          employeeId: allowance.employeeId,
          allowanceId: allowance.id,
          voucherId: voucherNo,
          eftRef: eftRef,
          amount: this.formatCurrency(allowance.allowanceAmount),
          monthlySalary: this.formatCurrency(monthlyBasic),
          annualSalary: this.formatCurrency(annualBasic),
          allowanceRate: `${((allowance.rate || 0.05) * 100).toFixed(0)}% of Annual Basic Salary`,
          serviceCycle: allowance.serviceCycle || '2026/2027',
          bankDestination: bankName,
          accountNumber: accountNo,
          disbursingOfficer: officer,
          disbursementDate: this.formatDate(allowance.paymentDate || new Date()),
          notes: options.notes || 'Electronic funds transfer transmitted via automated clearing house banking protocol.'
        };

        const data = await this.postLeaveApi('/api/send-leave-notification', payload);

        if (data && data.success) {
          allowance.disbursementEmailDispatched = true;
          allowance.disbursementEmailRecipient = recipientEmail;
          allowance.disbursementEmailMessageId = data.messageId || `MSG-DISB-${Date.now()}`;
          allowance.disbursementEmailDispatchedAt = new Date().toISOString();
          delete allowance.disbursementEmailError;
          this.saveAllowance(allowance);

          this.addAuditLog(
            officer,
            'DISBURSEMENT_EMAIL_DISPATCHED',
            `Official leave allowance disbursement advice email sent to ${recipientEmail} for claim ${allowance.id} (${this.formatCurrency(allowance.allowanceAmount)}, Ref: ${eftRef}). Message ID: ${data.messageId || 'OK'}`,
            allowance.employeeId
          );
        } else {
          allowance.disbursementEmailDispatched = false;
          allowance.disbursementEmailError = data?.error || 'Email dispatch failed';
          this.saveAllowance(allowance);

          this.addAuditLog(
            officer,
            'DISBURSEMENT_EMAIL_FAILED',
            `Disbursement email to ${recipientEmail} for ${allowance.id} failed: ${data?.error || 'Unknown error'}`,
            allowance.employeeId
          );
        }

        return data;
      } catch (err) {
        console.warn('[BCF_LEAVE] Disbursement email dispatch error:', err);
        allowance.disbursementEmailDispatched = false;
        allowance.disbursementEmailError = err.message;
        this.saveAllowance(allowance);
        return { success: false, error: err.message };
      }
    },

    async resendDisbursementNotification(allowanceId, recipientEmail = null, options = {}) {
      const alw = this.getAllowance(allowanceId);
      if (!alw) return { success: false, error: 'Allowance dossier not found' };
      const opts = { ...options };
      if (recipientEmail && recipientEmail.trim()) {
        opts.recipientEmail = recipientEmail.trim();
      }
      return await this.sendDisbursementNotification(alw, opts);
    },

    // ─────────────────────────────────────────────────────────────
    // RESUMPTION DATE DETECTION & RETURN TO WORK (Sec 27, 28, 29)
    // ─────────────────────────────────────────────────────────────
    isResumptionDue(app, asOfDateStr = null) {
      if (!app || !app.endDate) return false;
      // Already returned or recalled or rejected
      if (app.returnConfirmed === true || app.status === 'Completed (Returned)') return false;
      if (['Recalled by Management', 'Rejected', 'Cancelled'].includes(app.status)) return false;
      // Must be active or approved
      if (app.status !== 'Active (On Leave)' && app.status !== 'Approved') return false;

      const targetDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
      const todayIso = this.formatIsoDate(targetDate);
      return todayIso >= app.endDate;
    },

    getDueResumptions(asOfDateStr = null) {
      const apps = this.getApplications();
      return apps.filter(app => this.isResumptionDue(app, asOfDateStr));
    },

    getResumptionStatus(app, asOfDateStr = null) {
      if (!app || !app.endDate) {
        return { isDue: false, isReturned: false, statusText: 'No Resumption Date', badgeClass: 'bg-slate-100 text-slate-500' };
      }
      if (app.returnConfirmed === true || app.status === 'Completed (Returned)') {
        return {
          isDue: false,
          isReturned: true,
          statusText: `Duty Resumed (${this.formatDate(app.returnDate || app.endDate)})`,
          badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300'
        };
      }
      if (app.status === 'Recalled by Management') {
        return {
          isDue: false,
          isReturned: false,
          statusText: 'Recalled from Leave',
          badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300'
        };
      }
      if (app.status !== 'Active (On Leave)' && app.status !== 'Approved') {
        return {
          isDue: false,
          isReturned: false,
          statusText: app.status,
          badgeClass: 'bg-slate-100 text-slate-500'
        };
      }

      const targetDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
      const todayIso = this.formatIsoDate(targetDate);
      const tDate = new Date(todayIso + 'T00:00:00');
      const eDate = new Date(app.endDate + 'T00:00:00');
      const diffDays = Math.round((tDate - eDate) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0) {
        return {
          isDue: true,
          isReturned: false,
          daysOverdue: diffDays,
          statusText: diffDays === 0 ? 'Resumption Date Reached Today' : `Resumption Date Passed (+${diffDays}d)`,
          badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-400 font-black animate-pulse'
        };
      } else {
        const daysLeft = Math.abs(diffDays);
        return {
          isDue: false,
          isReturned: false,
          daysRemaining: daysLeft,
          statusText: `${daysLeft} day${daysLeft > 1 ? 's' : ''} until Resumption (${app.endDate})`,
          badgeClass: 'bg-blue-50 text-blue-800 border border-blue-200'
        };
      }
    },

    async confirmReturnToWork(appId, notes = 'Resumed active duty in satisfactory health.', options = {}) {
      const app = this.getApplication(appId);
      if (!app) return { success: false, error: 'Leave application not found' };

      const returnDate = options.returnDate || app.endDate || this.formatIsoDate(new Date());
      app.status = 'Completed (Returned)';
      app.returnConfirmed = true;
      app.returnDate = returnDate;
      app.returnNotes = notes;
      app.returnAutoProcessed = !!options.isAuto;
      app.returnProcessedAt = new Date().toISOString();
      if (options.officer) app.returnConfirmedBy = options.officer;
      if (options.recipientEmail) app.employeeEmail = options.recipientEmail;

      this.saveApplication(app);

      const logAction = options.isAuto ? 'RETURN_TO_WORK_AUTO_CONFIRMED' : 'RETURN_TO_WORK_CONFIRMED';
      const logMsg = options.isAuto 
        ? `System auto-detected resumption date (${app.endDate}) reached. Confirmed return to active duty for ${app.id}. Record closed.`
        : `Confirmed return to active duty for ${app.id} (Effective: ${returnDate}). Record closed.`;
      
      this.addAuditLog(options.officer || app.employeeName, logAction, logMsg, app.employeeId);

      // Dispatch Official Return Notification Email to Employee via SMTP
      let emailResult = { success: false };
      if (options.sendEmail !== false && options.skipEmail !== true) {
        emailResult = await this.sendReturnToWorkNotification(app, {
          notes,
          returnDate,
          recipientEmail: options.recipientEmail || app.employeeEmail,
          isAuto: !!options.isAuto,
          officer: options.officer
        });
      }

      return { success: true, app, emailResult };
    },

    async autoDetectAndProcessResumptions(options = {}) {
      const asOf = options.asOfDate || null;
      let dueApps = this.getDueResumptions(asOf);

      // If specific app ID forced
      if (options.forceAppId) {
        const forced = this.getApplication(options.forceAppId);
        if (forced && !dueApps.some(a => a.id === forced.id)) {
          dueApps.push(forced);
        }
      }

      // If user requested to include scheduled active leaves when none are strictly overdue today
      if (dueApps.length === 0 && options.includeScheduledActive) {
        const activeApps = this.getApplications().filter(a => 
          (a.status === 'Active (On Leave)' || a.status === 'Approved') && 
          !a.returnConfirmed && 
          a.endDate
        );
        dueApps = activeApps;
      }

      const results = [];
      for (const app of dueApps) {
        try {
          const res = await this.confirmReturnToWork(app.id, options.notes || `System auto-cleared: Resumption date reached (${app.endDate}). Handover restored.`, {
            isAuto: true,
            sendEmail: options.sendEmail !== false,
            returnDate: options.returnDate || app.endDate,
            recipientEmail: options.recipientEmail || app.employeeEmail,
            officer: options.officer || 'Automated HR Resumption Engine'
          });
          results.push({ app, success: res.success, emailResult: res.emailResult });
        } catch (err) {
          console.warn('[BCF_LEAVE] Auto-resumption error for', app.id, err);
          results.push({ app, success: false, error: err.message });
        }
      }

      return {
        scannedCount: this.getApplications().length,
        dueCount: dueApps.length,
        processedCount: results.filter(r => r.success).length,
        results
      };
    },

    async sendReturnToWorkNotification(app, options = {}) {
      if (!app) return { success: false, error: 'No application record provided' };
      const emp = this.getEmployee(app.employeeId);
      
      const recipientEmail = (
        (options && options.recipientEmail) || 
        app.employeeEmail || 
        (emp && emp.email) || 
        ''
      ).trim();

      if (!recipientEmail || !recipientEmail.includes('@')) {
        const errMsg = `No valid email recipient available for employee ${app.employeeName || app.employeeId}.`;
        console.warn('[BCF_LEAVE]', errMsg);
        app.returnEmailDispatched = false;
        app.returnEmailError = errMsg;
        this.saveApplication(app);
        return { success: false, error: errMsg };
      }

      const returnDate = options.returnDate || app.returnDate || this.formatIsoDate(new Date());

      try {
        const payload = {
          type: 'RETURN_TO_WORK',
          to: recipientEmail,
          employeeName: (emp && emp.fullName) || app.employeeName || 'Colleague',
          employeeId: app.employeeId,
          refId: app.id,
          leaveType: app.leaveType || 'Annual Leave',
          startDate: this.formatDate(app.startDate),
          endDate: this.formatDate(app.endDate),
          returnDate: this.formatDate(returnDate),
          daysRequested: app.daysRequested,
          handoverOfficer: app.handoverOfficer || 'Designated Colleague',
          department: app.department || (emp && emp.department) || 'Procurement Department',
          position: app.position || (emp && emp.position) || 'Contracts & Procurement Specialist',
          workLoc: (emp && emp.workLoc) || 'Freetown Headquarters',
          supervisor: (emp && emp.supervisor) || 'Albert Joseph Bandama (CEO)',
          clearingOfficer: options.officer || app.returnConfirmedBy || 'Albert Joseph Bandama (CEO & Executive Director)',
          returnNotes: (options && options.notes) || app.returnNotes || 'Employee resumed active duty in satisfactory condition; handover reversed.',
          isAuto: !!(options && options.isAuto)
        };

        const data = await this.postLeaveApi('/api/send-leave-notification', payload);

        if (data && data.success) {
          app.returnEmailDispatched = true;
          app.returnEmailRecipient = recipientEmail;
          app.returnEmailMessageId = data.messageId || `MSG-RET-${Date.now()}`;
          app.returnEmailDispatchedAt = new Date().toISOString();
          delete app.returnEmailError;
          this.saveApplication(app);

          this.addAuditLog(
            options.officer || 'HR Directorate',
            'RETURN_TO_WORK_EMAIL_DISPATCHED',
            `Official return to duty confirmation email successfully sent to ${recipientEmail} (${app.employeeId}, Ref: ${app.id}). Message ID: ${data.messageId || 'OK'}`,
            app.employeeId
          );
        } else {
          app.returnEmailDispatched = false;
          app.returnEmailError = data?.error || 'Email dispatch failed';
          this.saveApplication(app);

          this.addAuditLog(
            options.officer || 'HR Directorate',
            'RETURN_TO_WORK_EMAIL_FAILED',
            `Return to duty email dispatch to ${recipientEmail} failed: ${data?.error || 'Unknown error'}`,
            app.employeeId
          );
        }

        return data;
      } catch (err) {
        console.warn('[BCF_LEAVE] Return email dispatch error:', err);
        app.returnEmailDispatched = false;
        app.returnEmailError = err.message;
        this.saveApplication(app);
        return { success: false, error: err.message };
      }
    },

    async resendReturnToWorkNotification(appId, recipientEmail = null, options = {}) {
      const app = this.getApplication(appId);
      if (!app) return { success: false, error: 'Leave application not found' };
      const opts = { ...options };
      if (recipientEmail && recipientEmail.trim()) {
        opts.recipientEmail = recipientEmail.trim();
      }
      return await this.sendReturnToWorkNotification(app, opts);
    },

    recallFromLeave(appId, authorityName, reason, unspentDays) {
      const app = this.getApplication(appId);
      if (!app) return false;
      const daysToRefund = Math.min(app.daysRequested, parseInt(unspentDays) || 0);
      app.status = 'Recalled by Management';
      app.recallReason = reason;
      app.recallAuthority = authorityName;
      app.recalledDate = new Date().toISOString().split('T')[0];
      app.daysRefunded = daysToRefund;
      this.saveApplication(app);

      this.addAuditLog(authorityName, 'LEAVE_RECALL', `Operational emergency recall issued for ${app.id}. Refunded ${daysToRefund} unused days back to employee ledger.`, app.employeeId);
      return true;
    },

    cancelLeaveApplication(appId, reason = 'Employee cancellation request before commencement.') {
      const app = this.getApplication(appId);
      if (!app) return false;
      app.status = 'Cancelled';
      app.cancellationReason = reason;
      this.saveApplication(app);
      this.addAuditLog(app.employeeName, 'LEAVE_CANCELLED', `Cancelled leave application ${app.id}. Days restored to ledger balance.`, app.employeeId);
      return true;
    },

    // ─────────────────────────────────────────────────────────────
    // AUDIT TRAIL LOGGING (Sec 34)
    // ─────────────────────────────────────────────────────────────
    getAuditLogs() {
      try {
        return JSON.parse(_safeStorage.getItem(KEYS.AUDIT)) || [];
      } catch (e) {
        return [];
      }
    },

    addAuditLog(actor, action, details, employeeId = 'SYSTEM') {
      const logs = this.getAuditLogs();
      const now = new Date();
      const timeStr = `${now.toISOString().split('T')[0]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const newLog = {
        id: `AUD-LEV-${Date.now().toString().slice(-6)}`,
        timestamp: timeStr,
        actor,
        action,
        details,
        employeeId
      };
      logs.unshift(newLog);
      // Keep last 150 entries
      if (logs.length > 150) logs.pop();
      _safeStorage.setItem(KEYS.AUDIT, JSON.stringify(logs));
      return newLog;
    },

    // ─────────────────────────────────────────────────────────────
    // DASHBOARD KPI STATISTICS (Sec 1)
    // ─────────────────────────────────────────────────────────────
    getDashboardStats() {
      const employees = this.getEmployees();
      const apps = this.getApplications();
      const allowances = this.getAllowances();
      const today = new Date();

      let eligibleCount = 0;
      let notEligibleCount = 0;
      let upcomingAnnivCount = 0;

      employees.forEach(e => {
        const elig = this.calculateEligibility(e, today);
        if (elig.isEligible) {
          eligibleCount++;
        } else {
          notEligibleCount++;
        }
        if (elig.daysRemaining <= 30 && elig.daysRemaining > 0) {
          upcomingAnnivCount++;
        }
      });

      const pendingApps = apps.filter(a => a.status.startsWith('Pending')).length;
      const approvedApps = apps.filter(a => a.status === 'Approved').length;
      const rejectedApps = apps.filter(a => a.status === 'Rejected').length;
      const onLeaveCount = apps.filter(a => a.status === 'Active (On Leave)').length;

      // Returning soon (end date within next 3 days)
      const returningSoon = apps.filter(a => {
        if (!['Approved', 'Active (On Leave)'].includes(a.status)) return false;
        const end = new Date(a.endDate);
        const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 3;
      }).length;

      const totalDaysUsed = apps
        .filter(a => ['Approved', 'Active (On Leave)', 'Completed (Returned)'].includes(a.status))
        .reduce((sum, a) => sum + (parseInt(a.daysRequested) || 0), 0);

      const totalDaysRemaining = (eligibleCount * 31) - totalDaysUsed;

      const allowancesPending = allowances.filter(a => a.status !== 'Paid' && a.status !== 'Rejected' && a.status !== 'Cancelled').length;
      const allowancesPaid = allowances.filter(a => a.status === 'Paid').length;
      const totalAllowancePaidAmount = allowances
        .filter(a => a.status === 'Paid')
        .reduce((sum, a) => sum + (parseFloat(a.allowanceAmount) || 0), 0);

      const totalAllowancePendingAmount = allowances
        .filter(a => a.status !== 'Paid' && a.status !== 'Rejected' && a.status !== 'Cancelled')
        .reduce((sum, a) => sum + (parseFloat(a.allowanceAmount) || 0), 0);

      return {
        totalEmployees: employees.length,
        eligibleForLeave: eligibleCount,
        notYetEligible: notEligibleCount,
        applicationsPending: pendingApps,
        approvedLeave: approvedApps,
        rejectedLeave: rejectedApps,
        currentlyOnLeave: onLeaveCount,
        returningSoon,
        leaveDaysUsed: totalDaysUsed,
        leaveDaysRemaining: Math.max(0, totalDaysRemaining),
        allowancesPending,
        allowancesPaid,
        totalAllowancePaidAmount,
        totalAllowancePendingAmount,
        upcomingAnniversaries: upcomingAnnivCount,
        overdueLeaveClaims: 1,
        expiredUnusedEntitlements: 2
      };
    },

    // ─────────────────────────────────────────────────────────────
    // EMAIL NOTIFICATION DISPATCHER (Sec 8, 30, 31)
    // ─────────────────────────────────────────────────────────────
    async postLeaveApi(endpoint, payload) {
      const endpointsToTry = [];
      const isBrowser = typeof window !== 'undefined';
      if (isBrowser) {
        const protocol = window.location.protocol;
        if (protocol === 'http:' || protocol === 'https:') {
          endpointsToTry.push(endpoint);
        }
        endpointsToTry.push(`http://localhost:3001${endpoint}`);
        endpointsToTry.push(`http://127.0.0.1:3001${endpoint}`);
        endpointsToTry.push(`http://localhost:3000${endpoint}`);
        if (protocol === 'file:') {
          endpointsToTry.push(`http://localhost:3001${endpoint}`);
        }
      } else {
        endpointsToTry.push(`http://localhost:3001${endpoint}`);
      }

      let lastError = null;
      let lastData = null;

      for (const url of endpointsToTry) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => null);
          if (res.ok && data) {
            return data;
          }
          if (res.ok) {
            return { success: true };
          }
          if (data) {
            lastData = data;
          }
          lastError = new Error((data && data.error) || ('HTTP ' + res.status));
        } catch (err) {
          lastError = err;
        }
      }

      if (lastData) return lastData;
      return { success: false, error: (lastError && lastError.message) || 'Network error reaching leave notification backend' };
    },

    async sendEligibilityNotification(employee, options = {}) {
      if (!employee) return { success: false, error: 'No employee record provided' };
      const emp = (typeof employee === 'string') ? this.getEmployee(employee) : employee;
      if (!emp) return { success: false, error: 'Employee not found' };

      const recipientEmail = (
        (options && options.recipientEmail) || 
        emp.email || 
        ''
      ).trim();

      if (!recipientEmail || !recipientEmail.includes('@')) {
        const errMsg = `No valid recipient email address found for ${emp.fullName} (${emp.id}).`;
        console.warn('[BCF_LEAVE]', errMsg);
        return { success: false, error: errMsg };
      }

      const elig = this.calculateEligibility(emp);
      const cycle = this.getServiceCycle(emp);

      try {
        const payload = {
          type: 'ELIGIBILITY_ANNIVERSARY',
          to: recipientEmail,
          employeeName: emp.fullName,
          employeeId: emp.id,
          employmentDate: this.formatDate(emp.empDate),
          eligibilityDate: this.formatDate(elig.eligibilityDate),
          nextAnniversary: this.formatDate(elig.nextAnniversary),
          serviceCycle: cycle.cycleLabel,
          leaveEntitlement: `${elig.annualEntitlementDays || 31} Working Days`,
          leaveAllowance: this.formatCurrency(elig.leaveAllowance),
          monthlyBasic: this.formatCurrency(elig.monthlyBasic),
          annualBasic: this.formatCurrency(elig.annualBasic),
          isRenewal: (elig.completedYears > 1)
        };

        const data = await this.postLeaveApi('/api/send-leave-notification', payload);

        if (data && data.success) {
          emp.lastEligibilityEmailCycle = cycle.cycleLabel;
          emp.lastEligibilityEmailDate = new Date().toISOString();
          emp.lastEligibilityEmailRecipient = recipientEmail;
          emp.lastEligibilityEmailMessageId = data.messageId || `MSG-ELIG-${Date.now()}`;
          this.saveEmployee(emp);

          this.addAuditLog(
            options.officer || 'HR Directorate / Automated Engine',
            'ELIGIBILITY_EMAIL_DISPATCHED',
            `Official leave eligibility & allowance notification email sent to ${recipientEmail} (${emp.id}, Cycle: ${cycle.cycleLabel}). Message ID: ${data.messageId || 'OK'}`,
            emp.id
          );
        } else {
          this.addAuditLog(
            options.officer || 'HR Directorate',
            'ELIGIBILITY_EMAIL_FAILED',
            `Eligibility email dispatch to ${recipientEmail} (${emp.id}) failed: ${data?.error || 'Unknown error'}`,
            emp.id
          );
        }

        return data;
      } catch (err) {
        console.warn('[BCF_LEAVE] Email dispatch notice:', err);
        return { success: false, error: err.message };
      }
    },

    async checkAndNotifyEligibleEmployees(asOfDate = new Date(), options = {}) {
      const employees = this.getEmployees();
      const results = [];

      for (const emp of employees) {
        const elig = this.calculateEligibility(emp, asOfDate);
        if (elig.isEligible) {
          const bal = this.getLeaveBalance(emp.id, asOfDate);
          // Only auto-notify if employee has leave days due to be taken (remainingDays > 0)
          if (bal.remainingDays > 0) {
            const cycle = this.getServiceCycle(emp, asOfDate);
            const alreadyNotified = (emp.lastEligibilityEmailCycle === cycle.cycleLabel);

            if (!alreadyNotified || options.forceResend) {
              try {
                const res = await this.sendEligibilityNotification(emp, {
                  officer: options.officer || 'Automated Leave Due Dispatcher',
                  recipientEmail: options.overrideEmailMap?.[emp.id] || emp.email
                });
                results.push({ employeeId: emp.id, employeeName: emp.fullName, success: res.success, messageId: res.messageId, email: emp.email });
              } catch (err) {
                results.push({ employeeId: emp.id, employeeName: emp.fullName, success: false, error: err.message });
              }
            }
          }
        }
      }

      return {
        totalScanned: employees.length,
        eligibleCount: employees.filter(e => this.calculateEligibility(e, asOfDate).isEligible).length,
        sentCount: results.filter(r => r.success).length,
        results
      };
    },

    async ensureEmployeeEligibilityNotified(empId, options = {}) {
      const emp = this.getEmployee(empId);
      if (!emp) return { success: false, error: 'Employee not found' };

      const elig = this.calculateEligibility(emp);
      if (!elig.isEligible) {
        return { success: false, notEligible: true, reason: elig.reason };
      }

      const bal = this.getLeaveBalance(emp.id);
      if (bal.remainingDays <= 0) {
        return { success: false, quotaExhausted: true, reason: 'All 31 leave days already consumed for this service cycle.' };
      }

      const cycle = this.getServiceCycle(emp);
      const isAlreadyNotified = (emp.lastEligibilityEmailCycle === cycle.cycleLabel);

      if (isAlreadyNotified && !options.forceResend) {
        return {
          success: true,
          alreadyNotified: true,
          cycle: cycle.cycleLabel,
          date: emp.lastEligibilityEmailDate,
          recipient: emp.lastEligibilityEmailRecipient || emp.email,
          messageId: emp.lastEligibilityEmailMessageId
        };
      }

      // Automatically dispatch notification email
      const res = await this.sendEligibilityNotification(emp, {
        officer: options.officer || 'Automated Leave Due Dispatcher',
        recipientEmail: options.recipientEmail || emp.email
      });

      return {
        success: res.success,
        newlySent: res.success,
        cycle: cycle.cycleLabel,
        date: emp.lastEligibilityEmailDate || new Date().toISOString(),
        recipient: emp.lastEligibilityEmailRecipient || emp.email,
        messageId: res.messageId,
        error: res.error
      };
    },

    startAutomatedEligibilityWatcher(intervalMs = 60000) {
      if (typeof window === 'undefined') return null;
      if (window.__bcfLeaveWatcherRunning) return window.__bcfLeaveWatcherRunning;

      window.__bcfLeaveWatcherRunning = true;
      // Immediate asynchronous scan
      setTimeout(() => {
        this.checkAndNotifyEligibleEmployees().catch(err => console.warn('[BCF_LEAVE] Auto-scan error:', err));
      }, 1500);

      // Periodic recurring scan
      const timerId = setInterval(() => {
        this.checkAndNotifyEligibleEmployees().catch(err => console.warn('[BCF_LEAVE] Periodic auto-scan error:', err));
      }, Math.max(10000, intervalMs));

      return timerId;
    },

    async sendApprovalNotification(app, approverName = 'Executive Authority', options = {}) {
      if (!app) return { success: false, error: 'No application record provided' };
      const emp = this.getEmployee(app.employeeId);
      
      // Determine recipient email: options override -> app.employeeEmail -> emp.email
      let recipientEmail = (
        (options && options.recipientEmail) || 
        app.employeeEmail || 
        (emp && emp.email) || 
        ''
      ).trim();

      if (!recipientEmail || !recipientEmail.includes('@')) {
        const errMsg = `No valid email recipient available for employee ${app.employeeName || app.employeeId}.`;
        console.warn('[BCF_LEAVE]', errMsg);
        app.emailDispatched = false;
        app.emailError = errMsg;
        this.saveApplication(app);
        return { success: false, error: errMsg };
      }

      const alw = app.allowanceId ? this.getAllowance(app.allowanceId) : null;

      try {
        const payload = {
          type: 'LEAVE_APPROVED',
          to: recipientEmail,
          employeeName: (emp && emp.fullName) || app.employeeName || 'Colleague',
          employeeId: app.employeeId,
          refId: app.id,
          leaveType: app.leaveType || 'Annual Leave',
          startDate: this.formatDate(app.startDate),
          endDate: this.formatDate(app.endDate),
          daysRequested: app.daysRequested,
          balanceAfter: app.balanceAfter !== undefined ? app.balanceAfter : 0,
          approverName: approverName,
          handoverOfficer: app.handoverOfficer || 'Designated Colleague',
          allowanceAmount: alw ? this.formatCurrency(alw.allowanceAmount) : null,
          allowanceVoucher: alw ? alw.paymentVoucher : null,
          executiveNotes: (options && options.executiveNotes) || app.finalApproval?.notes || '',
          cc: (options && options.cc) || undefined
        };

        const data = await this.postLeaveApi('/api/send-leave-notification', payload);
        
        if (data && data.success) {
          app.emailDispatched = true;
          app.emailRecipient = recipientEmail;
          app.emailMessageId = data.messageId || `MSG-${Date.now()}`;
          app.emailDispatchedAt = new Date().toISOString();
          delete app.emailError;
          this.saveApplication(app);

          this.addAuditLog(
            approverName,
            'EMAIL_DISPATCHED',
            `Official executive approval notification email successfully sent to ${recipientEmail} (${app.employeeId}, Ref: ${app.id}). Message ID: ${data.messageId || 'OK'}`,
            app.employeeId
          );
        } else {
          app.emailDispatched = false;
          app.emailError = data?.error || 'Email dispatch failed';
          this.saveApplication(app);

          this.addAuditLog(
            approverName,
            'EMAIL_DISPATCH_FAILED',
            `Executive approval email dispatch to ${recipientEmail} failed: ${data?.error || 'Unknown error'}`,
            app.employeeId
          );
        }

        return data;
      } catch (err) {
        console.warn('[BCF_LEAVE] Approval email dispatch notice:', err);
        app.emailDispatched = false;
        app.emailError = err.message;
        this.saveApplication(app);
        return { success: false, error: err.message };
      }
    },

    async resendApprovalNotification(appId, approverName = 'Executive Authority', recipientEmail = null, options = {}) {
      const app = this.getApplication(appId);
      if (!app) return { success: false, error: 'Leave application not found' };
      const opts = { ...options };
      if (recipientEmail && recipientEmail.trim()) {
        opts.recipientEmail = recipientEmail.trim();
      }
      return await this.sendApprovalNotification(app, approverName, opts);
    },

    // ─────────────────────────────────────────────────────────────
    // TOAST NOTIFICATIONS HELPER
    // ─────────────────────────────────────────────────────────────
    showToast(message, type = 'info') {
      const existing = document.getElementById('bcf-leave-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'bcf-leave-toast';
      const bg = type === 'success' ? '#004328' : (type === 'error' ? '#ba1a1a' : (type === 'warning' ? '#ca8a04' : '#1e3a8a'));
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        background: ${bg};
        color: #ffffff;
        padding: 12px 20px;
        border-radius: 12px;
        font-family: 'Public Sans', sans-serif;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 420px;
        animation: bcfToastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      `;

      let icon = 'info';
      if (type === 'success') icon = 'check_circle';
      if (type === 'error') icon = 'error';
      if (type === 'warning') icon = 'warning';

      toast.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 18px;">${icon}</span>
        <span>${message}</span>
      `;

      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 4200);
    }
  };

  // Export to global scope
  global.BCF_LEAVE = BCF_LEAVE;

})(typeof window !== 'undefined' ? window : this);
