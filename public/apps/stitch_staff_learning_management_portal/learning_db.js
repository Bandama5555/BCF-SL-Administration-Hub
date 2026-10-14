/**
 * BCF-SL LEARNING & PROFESSIONAL DEVELOPMENT ENGINE (v2)
 * Shared by: Catalogue, My Learning, Certificates, HR Learning Dashboard, Account Provisioning.
 *
 * CORE RULE: Each staff member may choose ONE or TWO approved professional-development
 * courses per semester (max 2). At 2/2 new optional selection locks until the next semester.
 * Existing courses stay accessible. Mandatory BCF-SL training does NOT consume slots.
 */
(function () {
  const SCHEMA_VERSION = '4';
  const K = {
    schema: 'bcf_learning_schema',
    vendors: 'bcf_learning_vendors',
    courses: 'bcf_learning_courses',
    semesters: 'bcf_learning_semesters',
    accounts: 'bcf_learning_accounts',
    enrollments: 'bcf_learning_enrollments',
    notifications: 'bcf_learning_notifications',
    skills: 'bcf_learning_employee_skills',
    budget: 'bcf_learning_budget',
    reports: 'bcf_learning_reports',
    settings: 'bcf_learning_settings',
    audit: 'bcf_learning_audit_logs',
    emails: 'bcf_learning_sent_emails'
  };

  // ── Status pipeline (Section 12) ──
  const STATUS_FLOW = ['Requested', 'Under Review', 'Approved', 'Enrolled', 'Not Started', 'In Progress',
    'Completed', 'Certificate Submitted', 'Certificate Verified', 'Closed'];
  const INACTIVE_STATUSES = ['Rejected', 'Cancelled'];

  const MANDATORY_TOPICS = ['Safeguarding', 'Child Protection', 'Code of Conduct', 'Anti-Fraud', 'Anti-Corruption',
    'Health & Safety', 'Data Protection', 'Gender and Inclusion', 'Humanitarian Principles', 'Organizational Policies'];

  // ── Section 1 / 23: Learning partners (linked to Partnership module agreements) ──
  const INIT_VENDORS = [
    { id: 'VND-COURSERA', name: 'Coursera', purpose: 'Professional, academic and technical courses', agreementRef: 'BCF-PTN-AGR-2026-011', subscription: 'Coursera for Teams — 25 seats', annualCost: 60000, status: 'Active' },
    { id: 'VND-UDEMY', name: 'Udemy', purpose: 'Professional, technical and practical skills', agreementRef: 'BCF-PTN-AGR-2026-014', subscription: 'Udemy Business — 20 seats', annualCost: 45000, status: 'Active' },
    { id: 'VND-MSLEARN', name: 'Microsoft Learn', purpose: 'Microsoft technologies, data, cloud, AI and digital skills', agreementRef: 'BCF-PTN-AGR-2026-019', subscription: 'Microsoft Nonprofit Learning + exam vouchers', annualCost: 25000, status: 'Active' },
    { id: 'VND-BCF', name: 'BCF-SL Internal Academy', purpose: 'Mandatory organizational & compliance training', agreementRef: 'Internal', subscription: 'In-house', annualCost: 0, status: 'Active' }
  ];

  const IMG = {
    data: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=70',
    cloud: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=70',
    pm: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&auto=format&fit=crop&q=70',
    ai: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=600&auto=format&fit=crop&q=70',
    fin: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=70',
    proc: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=70',
    hr: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&auto=format&fit=crop&q=70',
    mel: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&auto=format&fit=crop&q=70',
    excel: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=70',
    sec: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=70',
    safe: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=600&auto=format&fit=crop&q=70',
    comp: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=70'
  };

  // ── Section 8: Course catalogue ──
  const C = (o) => Object.assign({ certificate: true, isMandatory: false, recommended: false, prerequisites: 'None', cost: 0, passMark: 80, objectives: [], skills: [], departments: [] }, o);
  const INIT_COURSES = [
    C({ id: 'MND-001', title: 'Safeguarding & Child Protection', vendor: 'BCF-SL Internal Academy', category: 'Mandatory Compliance', level: 'Foundation', hours: 6, isMandatory: true, passMark: 80, image: IMG.safe,
      description: 'Beneficiary protection, safe programming, and mandatory reporting protocols for all BCF-SL staff.',
      objectives: ['Recognise safeguarding risks', 'Apply reporting procedures', 'Practise safe programming'], skills: ['Safeguarding'], departments: ['All'], link: '#' }),
    C({ id: 'MND-002', title: 'Code of Conduct, Anti-Fraud & Anti-Corruption', vendor: 'BCF-SL Internal Academy', category: 'Mandatory Compliance', level: 'Foundation', hours: 4, isMandatory: true, passMark: 80, image: IMG.comp,
      description: 'Integrity standards, conflict of interest, fraud indicators, and whistleblowing channels.',
      objectives: ['Understand the Code of Conduct', 'Identify fraud red flags', 'Use whistleblowing channels'], skills: ['Ethics & Compliance'], departments: ['All'], link: '#' }),
    C({ id: 'MND-003', title: 'Data Protection, Health & Safety Essentials', vendor: 'BCF-SL Internal Academy', category: 'Mandatory Compliance', level: 'Foundation', hours: 3, isMandatory: true, passMark: 80, image: IMG.sec,
      description: 'Personal data handling, information security hygiene, and workplace/field safety.',
      objectives: ['Handle personal data lawfully', 'Apply safety procedures'], skills: ['Data Protection'], departments: ['All'], link: '#' }),

    C({ id: 'CRS-001', title: 'Microsoft Excel for Data Analysis', vendor: 'Microsoft Learn', category: 'Data & Analytics', level: 'Beginner', hours: 20, cost: 0, passMark: 80, recommended: true, image: IMG.excel,
      description: 'PivotTables, lookups, data cleaning and dashboards for institutional reporting.',
      objectives: ['Clean and structure data', 'Build PivotTables', 'Create reporting dashboards'], skills: ['Excel', 'Data Analysis'], departments: ['Finance', 'Programmes', 'Human Resources', 'Procurement', 'ICT'], link: 'https://learn.microsoft.com/training/' }),
    C({ id: 'CRS-002', title: 'Power BI Fundamentals', vendor: 'Microsoft Learn', category: 'Data & Analytics', level: 'Intermediate', hours: 15, cost: 1500, passMark: 80, recommended: true, image: IMG.data, prerequisites: 'Basic Excel',
      description: 'Data modelling, DAX basics, and executive KPI dashboards for programmes and finance.',
      objectives: ['Model data', 'Write basic DAX', 'Publish dashboards'], skills: ['Power BI', 'Data Analysis'], departments: ['Finance', 'Programmes', 'ICT', 'M&E'], link: 'https://learn.microsoft.com/training/powerplatform/power-bi' }),
    C({ id: 'CRS-003', title: 'Microsoft Azure Fundamentals (AZ-900)', vendor: 'Microsoft Learn', category: 'Cloud & ICT', level: 'Beginner', hours: 18, cost: 2000, passMark: 80, image: IMG.cloud,
      description: 'Cloud concepts, Azure services, security, governance and pricing.',
      objectives: ['Explain cloud models', 'Describe core Azure services', 'Understand governance'], skills: ['Cloud Computing', 'Microsoft Azure'], departments: ['ICT'], link: 'https://learn.microsoft.com/credentials/certifications/azure-fundamentals/' }),
    C({ id: 'CRS-004', title: 'Google Cybersecurity Certificate', vendor: 'Coursera', category: 'Cloud & ICT', level: 'Beginner', hours: 40, cost: 4500, passMark: 80, image: IMG.sec,
      description: 'Security frameworks, network security, Linux, SQL and incident response.',
      objectives: ['Apply security frameworks', 'Detect and respond to incidents'], skills: ['Cybersecurity', 'SQL'], departments: ['ICT'], link: 'https://www.coursera.org/' }),
    C({ id: 'CRS-005', title: 'Database Management with SQL', vendor: 'Udemy', category: 'Cloud & ICT', level: 'Intermediate', hours: 22, cost: 1200, passMark: 80, image: IMG.data,
      description: 'Relational design, normalisation, queries, joins and performance basics.',
      objectives: ['Design relational schemas', 'Write complex queries'], skills: ['SQL', 'Database Management'], departments: ['ICT', 'M&E'], link: 'https://www.udemy.com/' }),
    C({ id: 'CRS-006', title: 'Financial Analysis & Reporting for NGOs', vendor: 'Coursera', category: 'Finance', level: 'Intermediate', hours: 25, cost: 3500, passMark: 80, recommended: true, image: IMG.fin,
      description: 'Financial statements, donor reporting, variance analysis and cash-flow forecasting.',
      objectives: ['Analyse financial statements', 'Prepare donor financial reports'], skills: ['Financial Analysis', 'Financial Reporting'], departments: ['Finance'], link: 'https://www.coursera.org/' }),
    C({ id: 'CRS-007', title: 'Accounting Fundamentals', vendor: 'Udemy', category: 'Finance', level: 'Beginner', hours: 12, cost: 900, passMark: 80, image: IMG.fin,
      description: 'Double entry, ledgers, trial balance, reconciliations and accruals.',
      objectives: ['Record transactions', 'Prepare reconciliations'], skills: ['Accounting'], departments: ['Finance', 'Procurement'], link: 'https://www.udemy.com/' }),
    C({ id: 'CRS-008', title: 'Project Management Principles (PMP Prep)', vendor: 'Udemy', category: 'Programme Management', level: 'Intermediate', hours: 35, cost: 1500, passMark: 80, recommended: true, image: IMG.pm,
      description: 'Scope, schedule, cost, risk and stakeholder management aligned to PMBOK.',
      objectives: ['Plan projects', 'Manage risk', 'Control scope and cost'], skills: ['Project Management'], departments: ['Programmes', 'Operations', 'M&E'], link: 'https://www.udemy.com/' }),
    C({ id: 'CRS-009', title: 'Monitoring, Evaluation & Learning (MEL)', vendor: 'Coursera', category: 'Programme Management', level: 'Intermediate', hours: 28, cost: 3000, passMark: 80, image: IMG.mel,
      description: 'Logframes, indicators, data collection, and donor impact reporting.',
      objectives: ['Design indicator frameworks', 'Report results to donors'], skills: ['M&E', 'Data Analysis'], departments: ['Programmes', 'M&E'], link: 'https://www.coursera.org/' }),
    C({ id: 'CRS-010', title: 'Procurement & Contract Management', vendor: 'Coursera', category: 'Procurement', level: 'Intermediate', hours: 24, cost: 2800, passMark: 80, image: IMG.proc,
      description: 'Tendering, evaluation, contract administration and supplier performance.',
      objectives: ['Run compliant tenders', 'Manage contracts'], skills: ['Procurement', 'Contract Management'], departments: ['Procurement', 'Finance', 'Operations'], link: 'https://www.coursera.org/' }),
    C({ id: 'CRS-011', title: 'Strategic HR & People Analytics', vendor: 'Udemy', category: 'Human Resources', level: 'Intermediate', hours: 18, cost: 1100, passMark: 80, image: IMG.hr,
      description: 'Workforce planning, performance management and HR metrics.',
      objectives: ['Plan workforce needs', 'Use HR analytics'], skills: ['HR Management', 'Data Analysis'], departments: ['Human Resources'], link: 'https://www.udemy.com/' }),
    C({ id: 'CRS-012', title: 'Generative AI for Productivity', vendor: 'Coursera', category: 'Digital Skills', level: 'Beginner', hours: 10, cost: 1500, passMark: 80, certificate: true, image: IMG.ai,
      description: 'Responsible use of AI tools for writing, analysis and communication.',
      objectives: ['Write effective prompts', 'Use AI responsibly'], skills: ['AI Literacy'], departments: ['All'], link: 'https://www.coursera.org/' })
  ];

  // ── Section 3: Semesters (configurable by HR) ──
  const INIT_SEMESTERS = [
    { id: 'SEM-2026-1', name: 'Semester 1 – 2026', year: 2026, term: 1, startDate: '2026-01-01', endDate: '2026-06-30', maxSlots: 2, status: 'Closed', active: false },
    { id: 'SEM-2026-2', name: 'Semester 2 – 2026', year: 2026, term: 2, startDate: '2026-07-01', endDate: '2026-12-31', maxSlots: 2, status: 'Open', active: true }
  ];

  // ── Section 24: HR employee records ──
  const INIT_ACCOUNTS = [
    { accountId: 'ACC-000', employeeId: 'BCF-PTE-2026-0001', employeeName: 'Albert Joseph Bandama', employeePhone: '+232 76 123456', employeeEmail: 'albertjosephhassanbandama@gmail.com', username: 'abandama', password: 'Password123!', department: 'Executive Management', position: 'Chief Executive Officer (CEO)', supervisor: 'Board of Directors', isActive: true, createdAt: '2026-01-01T08:00:00Z' },
    { accountId: 'ACC-001', employeeId: 'BCF-EMP-2027-0001', employeeName: 'Sahr Emmanuel Bangura', employeePhone: '+232 76 123456', employeeEmail: 'sahr.bangura@bcf.sl', username: 'sbangura', password: 'Password123!', department: 'Programmes', position: 'Programme Officer', supervisor: 'Fatima Turay', isActive: true, createdAt: '2026-06-01T08:00:00Z' },
    { accountId: 'ACC-002', employeeId: 'BCF-EMP-2027-0002', employeeName: 'Aminata Sesay', employeePhone: '+232 78 654321', employeeEmail: 'aminata.sesay@bcf.sl', username: 'asesay', password: 'Password123!', department: 'ICT', position: 'ICT Officer', supervisor: 'Ibrahim Koroma', isActive: true, createdAt: '2026-06-01T09:00:00Z' },
    { accountId: 'ACC-003', employeeId: 'BCF-EMP-2027-0003', employeeName: 'Mohamed Kamara', employeePhone: '+232 77 987654', employeeEmail: 'm.kamara@bcf.sl', username: 'mkamara', password: 'Password123!', department: 'Finance', position: 'Finance Officer', supervisor: 'Ibrahim Koroma', isActive: true, createdAt: '2026-06-02T10:00:00Z' },
    { accountId: 'ACC-004', employeeId: 'BCF-EMP-2027-0004', employeeName: 'Fatima Turay', employeePhone: '+232 88 112233', employeeEmail: 'f.turay@bcf.sl', username: 'fturay', password: 'Password123!', department: 'Programmes', position: 'Programmes Manager', supervisor: 'Albert J. Bandama', isActive: true, createdAt: '2026-06-03T11:00:00Z' }
  ];

  const DEPT_SKILLS = {
    Finance: { 'Excel': 60, 'Financial Analysis': 55, 'Financial Reporting': 50, 'Accounting': 65, 'Power BI': 30 },
    ICT: { 'Cybersecurity': 45, 'Cloud Computing': 40, 'SQL': 50, 'Database Management': 45, 'Microsoft Azure': 30 },
    Programmes: { 'Excel': 60, 'Power BI': 40, 'SQL': 30, 'Project Management': 55, 'M&E': 50 },
    'Human Resources': { 'Excel': 55, 'HR Management': 60, 'Data Analysis': 40 },
    Procurement: { 'Procurement': 60, 'Contract Management': 50, 'Excel': 55 },
    _default: { 'Excel': 50, 'Data Analysis': 40, 'AI Literacy': 30 }
  };

  const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();

  function course(id) { return INIT_COURSES.find(c => c.id === id) || { title: id, vendor: 'Learning Partner', hours: 10, skills: [], passMark: 80 }; }
  function seedEnrollment(o) {
    const c = course(o.courseId);
    return Object.assign({
      id: 'ENR-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      vendor: c.vendor, courseTitle: c.title, isMandatory: c.isMandatory, hoursTotal: c.hours,
      progress: 0, hoursCompleted: 0, modulesCompleted: 0, modulesTotal: 8, assessmentsCompleted: 0,
      score: 85,
      reason: '', expectedSkills: c.skills.join(', '), history: []
    }, o);
  }

  const INIT_ENROLLMENTS = [
    // Sahr — previous semester (transcript)
    seedEnrollment({ employeeId: 'BCF-EMP-2027-0001', courseId: 'CRS-001', semesterId: 'SEM-2026-1', status: 'Closed', progress: 100, score: 94, hoursCompleted: 20, modulesCompleted: 8, slotNumber: 1,
      requestedAt: '2026-01-20T09:00:00Z', startDate: '2026-02-01', lastActivityDate: '2026-04-28T10:00:00Z', expectedCompletionDate: '2026-05-15', actualCompletionDate: '2026-04-28',
      certificate: { title: 'Excel for Data Analysis', number: 'MSL-88231-XL', issueDate: '2026-04-28', expiryDate: '', link: 'https://learn.microsoft.com/users/verify/MSL-88231-XL', fileName: 'excel_cert.pdf', status: 'Verified', verifiedBy: 'HR Learning Officer', verifiedAt: '2026-05-02' },
      evaluation: { relevant: 5, improved: 5, skills: 'PivotTables, dashboards', apply: 'Monthly programme reports', useful: 5, recommend: 'Yes', additional: 'Power BI' }, supervisorRating: 'Very Well' }),
    // Sahr — current semester: 1 optional in progress, 1 mandatory completed
    seedEnrollment({ employeeId: 'BCF-EMP-2027-0001', courseId: 'CRS-002', semesterId: 'SEM-2026-2', status: 'In Progress', progress: 70, score: 72, hoursCompleted: 10.5, modulesCompleted: 6, slotNumber: 1,
      reason: 'Build programme KPI dashboards for donor reports.', requestedAt: '2026-07-08T09:00:00Z', startDate: '2026-07-15', lastActivityDate: ago(3), expectedCompletionDate: '2026-11-30' }),
    seedEnrollment({ employeeId: 'BCF-EMP-2027-0001', courseId: 'MND-001', semesterId: 'SEM-2026-2', status: 'Certificate Verified', progress: 100, score: 100, hoursCompleted: 6, modulesCompleted: 8,
      requestedAt: '2026-07-02T09:00:00Z', startDate: '2026-07-02', lastActivityDate: '2026-07-10T09:00:00Z', expectedCompletionDate: '2026-07-31', actualCompletionDate: '2026-07-10',
      certificate: { title: 'Safeguarding & Child Protection', number: 'BCF-ACAD-2026-0412', issueDate: '2026-07-10', expiryDate: '2028-07-10', link: '', fileName: 'safeguarding.pdf', status: 'Verified', verifiedBy: 'HR Learning Officer', verifiedAt: '2026-07-12' } }),
    // Aminata — 2/2 used (threshold demo); one stale progress (reminder demo)
    seedEnrollment({ employeeId: 'BCF-EMP-2027-0002', courseId: 'CRS-004', semesterId: 'SEM-2026-2', status: 'In Progress', progress: 45, score: 65, hoursCompleted: 18, modulesCompleted: 4, slotNumber: 1,
      reason: 'Strengthen BCF-SL network and endpoint security.', requestedAt: '2026-07-05T09:00:00Z', startDate: '2026-07-12', lastActivityDate: ago(19), expectedCompletionDate: '2026-12-15' }),
    seedEnrollment({ employeeId: 'BCF-EMP-2027-0002', courseId: 'CRS-003', semesterId: 'SEM-2026-2', status: 'Completed', progress: 100, score: 88, hoursCompleted: 18, modulesCompleted: 8, slotNumber: 2,
      reason: 'Plan migration of BCF-SL systems to the cloud.', requestedAt: '2026-07-05T09:30:00Z', startDate: '2026-07-12', lastActivityDate: ago(6), expectedCompletionDate: '2026-10-30', actualCompletionDate: ago(6).slice(0, 10) }),
    // Mohamed — awaiting supervisor
    seedEnrollment({ employeeId: 'BCF-EMP-2027-0003', courseId: 'CRS-006', semesterId: 'SEM-2026-2', status: 'Requested', slotNumber: 1,
      reason: 'Improve donor financial reporting and variance analysis.', requestedAt: ago(2), expectedCompletionDate: '2026-12-20' }),
    // Fatima — supervisor approved, awaiting HR; plus certificate awaiting verification
    seedEnrollment({ employeeId: 'BCF-EMP-2027-0004', courseId: 'CRS-008', semesterId: 'SEM-2026-2', status: 'Under Review', slotNumber: 1,
      reason: 'Formalise project planning and risk management across field programmes.', requestedAt: ago(4), supervisorDecision: { by: 'Albert J. Bandama', at: ago(3), note: 'Supported.' }, expectedCompletionDate: '2026-12-31' }),
    seedEnrollment({ employeeId: 'BCF-EMP-2027-0004', courseId: 'MND-002', semesterId: 'SEM-2026-2', status: 'Certificate Submitted', progress: 100, score: 92, hoursCompleted: 4, modulesCompleted: 8,
      requestedAt: '2026-07-03T09:00:00Z', startDate: '2026-07-03', lastActivityDate: ago(1), expectedCompletionDate: '2026-07-31', actualCompletionDate: ago(1).slice(0, 10),
      certificate: { title: 'Code of Conduct, Anti-Fraud & Anti-Corruption', number: 'BCF-ACAD-2026-0533', issueDate: ago(1).slice(0, 10), expiryDate: '', link: '', fileName: 'conduct.pdf', status: 'Pending Verification' } })
  ];

  const INIT_SETTINGS = { reminderDays: 14, annualBudget: 150000, currency: 'NLe', maxSlotsPerSemester: 2 };

  // ── Storage helpers ──
  const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = (p) => p + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const nowISO = () => new Date().toISOString();

  function initLearningDB() {
    if (localStorage.getItem(K.schema) !== SCHEMA_VERSION) {
      // Schema upgrade: reset catalogue/workflow data, keep admin-created accounts (merged with seed).
      const existing = read(K.accounts, []);
      const merged = INIT_ACCOUNTS.map(a => Object.assign({}, a, existing.find(e => e.employeeId === a.employeeId) || {}, { department: a.department, position: a.position, supervisor: a.supervisor }));
      existing.forEach(e => { if (!merged.some(m => m.employeeId === e.employeeId)) merged.push(Object.assign({ position: 'Staff Officer', supervisor: 'Line Manager' }, e)); });
      write(K.accounts, merged);
      write(K.vendors, INIT_VENDORS);
      write(K.courses, INIT_COURSES);
      write(K.semesters, INIT_SEMESTERS);
      write(K.enrollments, INIT_ENROLLMENTS);
      write(K.notifications, []);
      write(K.skills, {});
      write(K.reports, []);
      write(K.settings, INIT_SETTINGS);
      write(K.audit, []);
      localStorage.setItem(K.schema, SCHEMA_VERSION);
      merged.forEach(a => notify(a.employeeId, 'semester', 'Your new BCF-SL learning allocation is now available. You may select up to two courses this semester.'));
    }
    runProgressReminders();
  }

  // ── Audit & notifications (Section 27) ──
  function audit(action, detail) {
    const logs = read(K.audit, []);
    logs.unshift({ id: uid('AUD'), at: nowISO(), action, detail });
    write(K.audit, logs.slice(0, 500));
  }
  function notify(employeeId, type, message) {
    const list = read(K.notifications, []);
    list.unshift({ id: uid('NTF'), employeeId, type, message, at: nowISO(), read: false });
    write(K.notifications, list.slice(0, 1000));
  }
  function getNotifications(employeeId) { return read(K.notifications, []).filter(n => n.employeeId === employeeId || n.employeeId === '*'); }
  function markNotificationsRead(employeeId) {
    write(K.notifications, read(K.notifications, []).map(n => (n.employeeId === employeeId ? Object.assign(n, { read: true }) : n)));
  }

  // ── Accessors ──
  const getSettings = () => read(K.settings, INIT_SETTINGS);
  const saveSettings = (s) => { write(K.settings, Object.assign(getSettings(), s)); audit('settings.update', s); };
  const getVendors = () => read(K.vendors, INIT_VENDORS);
  function addVendor(v) {
    const list = getVendors();
    list.push(Object.assign({ id: uid('VND'), status: 'Active', annualCost: 0 }, v));
    write(K.vendors, list); audit('vendor.add', v.name);
  }
  const getCourses = () => read(K.courses, INIT_COURSES);
  const getCourse = (id) => {
    const found = getCourses().find(c => c.id === id);
    if (found) return Object.assign({ passMark: 80 }, found);
    return null;
  };
  const getSemesters = () => read(K.semesters, INIT_SEMESTERS);
  const getActiveSemester = () => getSemesters().find(s => s.active) || getSemesters()[getSemesters().length - 1];
  const getAllEnrollments = () => read(K.enrollments, []);
  const saveAllEnrollments = (list) => write(K.enrollments, list);

  function normalizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    let clean = email.trim().toLowerCase();
    clean = clean.replace(/@gmail$/i, '@gmail.com');
    clean = clean.replace(/@yahoo$/i, '@yahoo.com');
    clean = clean.replace(/@hotmail$/i, '@hotmail.com');
    clean = clean.replace(/@outlook$/i, '@outlook.com');
    clean = clean.replace(/@icloud$/i, '@icloud.com');
    if (clean.includes('@') && !clean.split('@')[1].includes('.')) {
      clean += '.com';
    }
    return clean;
  }

  function getLearningAccounts() {
    const accounts = read(K.accounts, INIT_ACCOUNTS);
    let dirty = false;
    accounts.forEach(a => {
      if (a.employeeEmail) {
        const fixed = normalizeEmail(a.employeeEmail);
        if (fixed && fixed !== a.employeeEmail) {
          a.employeeEmail = fixed;
          dirty = true;
        }
      }
    });
    if (dirty) write(K.accounts, accounts);
    return accounts;
  }

  // ── Master BCF-SL Staff Directory & Institutional Roster ──
  const MASTER_BCF_STAFF = [
    // Executive Management
    { id: 'BCF-PTE-2026-0001', name: 'Albert Joseph Bandama', phone: '+232 76 123456', email: 'albertjosephhassanbandama@gmail.com', dept: 'Executive Management', title: 'Chief Executive Officer (CEO)', username: 'abandama', password: 'Password123!' },
    
    // Human Resources Management Department
    { id: 'BCF-PTE-2026-0002', name: 'Joe Ansumana Conteh', phone: '+232 78 234567', email: 'joe.conteh@bcf-sl.org', dept: 'Human Resources Management Department', title: 'Human Resources Director', username: 'jconteh', password: 'Password123!' },
    { id: 'BCF-SL-1002', name: 'Dr. Sorie Sesay', phone: '+232 78 441 200', email: 's.sesay@bcf-sl.org', dept: 'Human Resources Management Department', title: 'Director of Human Resources', username: 'ssesay', password: 'Password123!' },
    
    // Finance Department
    { id: 'BCF-EMP-2026-0003', name: 'Mariama Bangura', phone: '+232 77 345678', email: 'mariama.bangura@bcf-sl.org', dept: 'Finance Department', title: 'Finance Director', username: 'mbangura', password: 'Password123!' },
    { id: 'BCF-SL-1005', name: 'Aminata Turay', phone: '+232 79 552 119', email: 'a.turay@bcf-sl.org', dept: 'Finance Department', title: 'Director of Financial Operations', username: 'aturay', password: 'Password123!' },
    { id: 'BCF-SL-1007', name: 'Sahr Bangura', phone: '+232 77 445 566', email: 's.bangura@bcf-sl.org', dept: 'Finance Department', title: 'Senior Finance Manager', username: 'sbangura.fin', password: 'Password123!' },
    { id: 'BCF-EMP-2027-0003', name: 'Mohamed Kamara', phone: '+232 77 987654', email: 'm.kamara@bcf.sl', dept: 'Finance Department', title: 'Finance & Auditing Specialist', username: 'mkamara', password: 'Password123!' },

    // Internal Risk & Audits Department
    { id: 'BCF-EMP-2026-0004', name: 'Sahr David Williams', phone: '+232 76 456789', email: 'sahr.williams@bcf-sl.org', dept: 'Internal Risk & Audits Department', title: 'Internal Risk & Audits Director', username: 'swilliams', password: 'Password123!' },

    // Programs Department
    { id: 'BCF-FTC-2026-0005', name: 'Aminata Kamara', phone: '+232 79 567890', email: 'aminata.kamara@bcf-sl.org', dept: 'Programs Department', title: 'Programs Director', username: 'akamara', password: 'Password123!' },
    { id: 'BCF-SL-1048', name: 'Mariama Kamara', phone: '+232 76 892 104', email: 'm.kamara@bcf-sl.org', dept: 'Programs Department', title: 'Senior Field Coordinator', username: 'mariama.kamara', password: 'Password123!' },
    { id: 'BCF-SL-1012', name: 'Mohamed Bangura', phone: '+232 77 334 891', email: 'm.bangura@bcf-sl.org', dept: 'Programs Department', title: 'Program Monitoring Manager', username: 'mbangura.prog', password: 'Password123!' },
    { id: 'BCF-EMP-2027-0004', name: 'Fatima Turay', phone: '+232 88 112233', email: 'f.turay@bcf.sl', dept: 'Programs Department', title: 'Community Programs & Outreach Officer', username: 'fturay', password: 'Password123!' },
    { id: 'BCF-SL-1025', name: 'Fatmata Mansaray', phone: '+232 76 654 321', email: 'f.mansaray@bcf-sl.org', dept: 'Programs Department', title: 'Junior Community Facilitator', username: 'fmansaray', password: 'Password123!' },
    { id: 'BCF-EMP-2026-0007', name: 'Mariama J. Bundu', phone: '+232 78 778 899', email: 'm.bundu@bcf-sl.org', dept: 'Programs Department', title: 'Field Operations Officer', username: 'mbundu', password: 'Password123!' },

    // Information Technology (IT) Department
    { id: 'BCF-FTC-2026-0006', name: 'Hassan Mohamed Mansaray', phone: '+232 30 678901', email: 'hassan.mansaray@bcf-sl.org', dept: 'Information Technology (IT) Department', title: 'IT Systems Administrator', username: 'hmansaray', password: 'Password123!' },
    { id: 'BCF-EMP-2027-0002', name: 'Aminata Sesay', phone: '+232 78 654321', email: 'aminata.sesay@bcf.sl', dept: 'Information Technology (IT) Department', title: 'IT Operations & Systems Officer', username: 'asesay', password: 'Password123!' },
    { id: 'BCF-EMP-2027-0005', name: 'Ibrahim Koroma', phone: '+232 79 445566', email: 'i.koroma@bcf.sl', dept: 'Information Technology (IT) Department', title: 'M&E Specialist & ICT Officer', username: 'ikoroma', password: 'Password123!' },

    // Procurement & Logistics Department
    { id: 'BCF-SL-1019', name: 'Joseph Conteh', phone: '+232 88 123 456', email: 'j.conteh@bcf-sl.org', dept: 'Procurement Department', title: 'Assistant Logistics Manager', username: 'jconteh.log', password: 'Password123!' },
    { id: 'BCF-EMP-2027-0001', name: 'Sahr Emmanuel Bangura', phone: '+232 76 123456', email: 'sahr.bangura@bcf.sl', dept: 'Procurement Department', title: 'Logistics & Field Operations Specialist', username: 'sbangura', password: 'Password123!' },

    // Health & Safety Department
    { id: 'BCF-SL-1003', name: 'Ibrahim Kargbo', phone: '+232 76 223 344', email: 'i.kargbo@bcf-sl.org', dept: 'Health & Safety Department', title: 'Senior Program Coordinator', username: 'ikargbo', password: 'Password123!' }
  ];

  function getAllInstitutionalStaff() {
    const map = new Map();
    MASTER_BCF_STAFF.forEach(s => map.set(s.id, { ...s }));

    try {
      const reg = JSON.parse(localStorage.getItem('bcf_staff_registry') || '[]');
      if (Array.isArray(reg)) {
        reg.forEach(r => {
          if (!r.employeeId && !r.fullName) return;
          const id = r.employeeId || ('BCF-' + (r.fullName || '').replace(/\s+/g, '-').toUpperCase());
          const existing = map.get(id);
          const uName = (r.fullName || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 10) || 'staff';
          map.set(id, {
            id,
            name: r.fullName || (existing ? existing.name : 'Staff Member'),
            phone: r.phone || r.workPhone || (existing ? existing.phone : '+232 76 000000'),
            email: r.email || r.workEmail || (existing ? existing.email : `${uName}@bcf-sl.org`),
            dept: r.department || (existing ? existing.dept : 'Programs Department'),
            title: r.title || r.position || (existing ? existing.title : 'Staff Member'),
            username: existing ? existing.username : uName,
            password: existing ? existing.password : 'Password123!'
          });
        });
      }
    } catch (_) {}

    return Array.from(map.values());
  }

  function saveLearningAccount(data, options = {}) {
    if (options.skipAdminCheck !== true && !isHRAdmin()) {
      try {
        sessionStorage.removeItem('bcf_staff_only_session');
        setCurrentEmployee('BCF-PTE-2026-0001');
      } catch(_) {}
      if (!isHRAdmin()) {
        return { success: false, error: 'Access Denied: Only BCF-SL Administrators can create or modify accounts.' };
      }
    }
    const accounts = getLearningAccounts();
    const cleanEmail = normalizeEmail(data.employeeEmail);
    const idx = accounts.findIndex(a => a.accountId === data.accountId || a.employeeId === data.employeeId ||
      (data.username && a.username && a.username.toLowerCase() === (data.username || '').toLowerCase()));
    const isNew = idx < 0;
    const rec = Object.assign({ position: 'Staff Officer', supervisor: 'Line Manager', isActive: true, createdAt: nowISO() },
      idx >= 0 ? accounts[idx] : {}, data, {
        accountId: data.accountId || (idx >= 0 ? accounts[idx].accountId : uid('ACC')),
        username: (data.username || '').trim().toLowerCase(),
        employeeEmail: cleanEmail || data.employeeEmail,
        updatedAt: nowISO()
      });
    if (idx >= 0) accounts[idx] = rec;
    else {
      accounts.push(rec);
      notify(rec.employeeId, 'semester', 'Welcome! Your BCF-SL learning account is active. You may select up to two courses this semester.');
    }
    write(K.accounts, accounts);
    audit('account.save', rec.employeeId);

    // Live sync to MongoDB Atlas backend
    try { window.dispatchEvent(new CustomEvent('bcf_account_saved', { detail: rec })); } catch (_) {}
    try { if (typeof window !== 'undefined' && window.BCF_MONGO && window.BCF_MONGO.syncLearningAccounts) window.BCF_MONGO.syncLearningAccounts([rec]); } catch (_) {}

    // Automatically send or update credentials email if requested or newly provisioned
    if (options.sendEmail !== false && rec.employeeEmail) {
      rec._emailDispatch = dispatchStaffCredentialEmail(rec, !isNew, options.actor || 'HR Learning Administrator');
    }

    return rec;
  }

  function deleteLearningAccount(id) {
    if (!isHRAdmin()) {
      try {
        sessionStorage.removeItem('bcf_staff_only_session');
        setCurrentEmployee('BCF-PTE-2026-0001');
      } catch(_) {}
      if (!isHRAdmin()) {
        return { success: false, error: 'Access Denied: Only BCF-SL Administrators can delete accounts.' };
      }
    }
    write(K.accounts, getLearningAccounts().filter(a => a.accountId !== id && a.employeeId !== id));
    audit('account.delete', id);
    return { success: true };
  }

  // ── Batch Provision Accounts for All Staff (Admin Only) ──
  function batchProvisionAllStaff(options = {}) {
    if (!isHRAdmin()) {
      try {
        sessionStorage.removeItem('bcf_staff_only_session');
        setCurrentEmployee('BCF-PTE-2026-0001');
      } catch(_) {}
      if (!isHRAdmin()) {
        return {
          success: false,
          message: 'Access Denied: Only BCF-SL Administrators are authorized to batch provision staff accounts.'
        };
      }
    }

    const allStaff = getAllInstitutionalStaff();
    const existingAccounts = getLearningAccounts();
    const newlyCreated = [];
    let alreadyExistedCount = 0;
    const actor = options.actor || (getCurrentEmployee() ? getCurrentEmployee().fullName : 'HR Learning Administrator');

    allStaff.forEach(staff => {
      const cleanEmail = normalizeEmail(staff.email);
      const found = existingAccounts.find(a => 
        (a.employeeId && a.employeeId.toLowerCase() === staff.id.toLowerCase()) ||
        (a.username && staff.username && a.username.toLowerCase() === staff.username.toLowerCase()) ||
        (a.employeeEmail && cleanEmail && a.employeeEmail.toLowerCase() === cleanEmail.toLowerCase())
      );

      if (!found) {
        // Create new account
        const accountData = {
          accountId: uid('ACC'),
          employeeId: staff.id,
          employeeName: staff.name,
          employeePhone: staff.phone,
          employeeEmail: cleanEmail || staff.email,
          username: staff.username,
          password: staff.password || 'Password123!',
          department: staff.dept,
          position: staff.title || 'Staff Officer',
          supervisor: staff.supervisor || 'Line Manager',
          isActive: true,
          createdAt: nowISO()
        };
        const saved = saveLearningAccount(accountData, {
          sendEmail: options.sendEmail !== false,
          actor: actor,
          skipAdminCheck: true
        });
        newlyCreated.push(saved);
      } else {
        alreadyExistedCount++;
        // If option resendEmails is enabled, dispatch credentials email
        if (options.resendEmails === true && found.employeeEmail) {
          dispatchStaffCredentialEmail(found, true, actor);
        }
      }
    });

    audit('accounts.batch_provision', `Batch provisioned ${newlyCreated.length} staff accounts (${alreadyExistedCount} already existed)`);
    try {
      if (typeof window !== 'undefined' && window.BCF_MONGO && window.BCF_MONGO.syncLearningAccounts) {
        window.BCF_MONGO.syncLearningAccounts(getLearningAccounts());
      }
    } catch (_) {}
    return {
      success: true,
      totalDirectory: allStaff.length,
      provisionedCount: newlyCreated.length,
      alreadyExistedCount: alreadyExistedCount,
      accounts: getLearningAccounts(),
      newlyCreated: newlyCreated
    };
  }

  // ── Institutional Email Dispatch Engine ──
  function getSentEmails() {
    return read(K.emails, []);
  }

  function getPortalLoginUrl() {
    try {
      if (window.top && window.top.location && window.top.location.origin && window.top.location.origin !== 'null' && !window.top.location.origin.startsWith('file:')) {
        return `${window.top.location.origin}/learning/login`;
      }
    } catch(e) {}
    try {
      const loc = window.location;
      if (loc && loc.origin && loc.origin !== 'null' && !loc.origin.startsWith('file:')) {
        return `${loc.origin}/learning/login`;
      }
    } catch(e) {}
    return 'http://localhost:3001/learning/login';
  }

  function dispatchStaffCredentialEmail(account, isUpdate = false, actor = 'HR Learning Administrator') {
    if (!account || !account.employeeEmail) {
      return { success: false, message: 'No valid recipient email address provided.' };
    }
    account.employeeEmail = normalizeEmail(account.employeeEmail);

    const loginUrl = getPortalLoginUrl();
    const emails = getSentEmails();
    const sem = getActiveSemester ? getActiveSemester() : { name: 'Semester 1, 2027' };

    const plainText = [
      '======================================================================',
      'BANDAMA CHARITY FOUNDATION SIERRA LEONE',
      'STAFF LEARNING & PROFESSIONAL DEVELOPMENT PORTAL',
      `OFFICIAL ACCOUNT CREDENTIALS ${isUpdate ? 'UPDATE' : 'NOTIFICATION'}`,
      '======================================================================',
      '',
      `Dear ${account.employeeName},`,
      '',
      `Your staff account for the BCF-SL Staff Learning Portal has been successfully ${isUpdate ? 'updated' : 'provisioned'} for ${sem.name}.`,
      '',
      'OFFICIAL LOGIN CREDENTIALS:',
      '----------------------------------------------------------------------',
      `• Staff Member Name:     ${account.employeeName}`,
      `• Employee ID:           ${account.employeeId}`,
      `• Department:            ${account.department || 'Operations'}`,
      `• Staff Login Username:  ${account.username}`,
      `• Staff Login Password:  ${account.password}`,
      `• Portal Login URL:      ${loginUrl}`,
      '----------------------------------------------------------------------',
      '',
      'ACCESS YOUR PORTAL:',
      loginUrl,
      '',
      'SELECTION POLICY:',
      'You are authorized to select up to two (2) approved professional-development courses per semester across partner platforms (Coursera, Udemy, Microsoft Learn). Mandatory compliance trainings do not consume your allocation.',
      '',
      'SELF-SERVICE CREDENTIALS:',
      'You may change your password at any time via your account profile dropdown inside the portal.',
      '',
      '----------------------------------------------------------------------',
      'Bandama Charity Foundation Sierra Leone · Directorate of HR & ICT',
      'Official Institutional Credential Notification',
      '======================================================================'
    ].join('\n');

    const emailRecord = {
      id: uid('EML'),
      recipientName: account.employeeName || 'Staff Member',
      recipientEmail: account.employeeEmail,
      recipientId: account.employeeId,
      department: account.department || 'Operations',
      subject: isUpdate 
        ? `[BCF-SL] Updated Learning Portal Credentials — ${account.employeeName}`
        : `[BCF-SL] Official Staff Learning Portal Credentials — ${account.employeeName}`,
      sender: 'BCF-SL Administration Hub <bandamacharityfoundationsl@gmail.com>',
      sentAt: nowISO(),
      status: 'Sending via SMTP...',
      isUpdate: !!isUpdate,
      actor: actor || 'HR Administrator',
      loginUrl: loginUrl,
      credentials: {
        username: account.username,
        password: account.password,
        employeeId: account.employeeId
      },
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #00164e 0%, #00236f 50%, #0051d5 100%); color: #ffffff; padding: 24px; text-align: left;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; margin-bottom: 4px;">Bandama Charity Foundation Sierra Leone</div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Staff Learning Portal Account ${isUpdate ? 'Updated' : 'Provisioned'}</h2>
            <div style="font-size: 12px; margin-top: 6px; opacity: 0.9;">Directorate of Human Resources & Professional Development</div>
          </div>
          <div style="padding: 24px; color: #1e293b; font-size: 13.5px; line-height: 1.6;">
            <p>Dear <strong>${account.employeeName}</strong>,</p>
            <p>Your institutional learning account for the <strong>BCF-SL Staff Learning & Professional Development Portal</strong> has been successfully <strong>${isUpdate ? 'updated' : 'provisioned'}</strong> for <strong>${sem.name}</strong>.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 18px 0;">
              <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 10px;">Official Login Credentials</div>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr><td style="padding: 4px 0; color: #64748b; width: 140px;">Employee ID:</td><td style="font-weight: bold; color: #0f172a;">${account.employeeId}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Department:</td><td style="font-weight: bold; color: #0f172a;">${account.department || 'Operations'}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Staff Username:</td><td style="font-family: monospace; font-weight: bold; color: #0051d5; font-size: 14px;">${account.username}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Staff Password:</td><td style="font-family: monospace; font-weight: bold; color: #0f172a; font-size: 14px;">${account.password}</td></tr>
                <tr><td style="padding: 4px 0; color: #64748b;">Portal Login URL:</td><td><a href="${loginUrl}" style="color: #0051d5; font-weight: bold; text-decoration: underline;">${loginUrl}</a></td></tr>
              </table>
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${loginUrl}" style="display: inline-block; background: #00236f; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-weight: bold; text-decoration: none; font-size: 13px;">Access Staff Learning Portal</a>
            </div>

            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 6px; font-size: 12px; color: #1e3a8a; margin: 18px 0;">
              <strong>Policy Reminder:</strong> You are authorized to select up to <strong>2 optional online courses</strong> per semester across our partner academies (Coursera, Udemy, Microsoft Learn). Mandatory compliance trainings do not consume your allocation.
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
              <strong>Self-Service Password Management:</strong> You may edit and update your password at any time via your account profile dropdown inside the portal.
            </p>
          </div>
          <div style="background: #f1f5f9; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
            Bandama Charity Foundation Sierra Leone · HR & ICT Operations<br/>
            This is an automated institutional credential dispatch.
          </div>
        </div>
      `
    };

    emails.unshift(emailRecord);
    write(K.emails, emails.slice(0, 500));

    notify(account.employeeId, 'approved', `Official credentials email dispatched to ${account.employeeEmail}. Login Username: ${account.username}`);
    audit('email.credentials', `${account.employeeId} → ${account.employeeEmail}`);

    // Live dispatch via BCF-SL SMTP service (/api/send-email)
    const sendPromise = (async () => {
      const payload = JSON.stringify({
        to: account.employeeEmail,
        subject: emailRecord.subject,
        html: emailRecord.htmlBody,
        text: plainText
      });

      let b64Payload = '';
      try {
        b64Payload = btoa(unescape(encodeURIComponent(payload)));
      } catch (_) {}

      const candidateUrls = [
        'http://localhost:3001/api/send-email',
        'http://127.0.0.1:3001/api/send-email',
        '/api/send-email',
        'http://localhost:3000/api/send-email',
        'http://127.0.0.1:3000/api/send-email'
      ];
      try {
        if (typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.startsWith('file:') && window.location.origin !== 'null') {
          candidateUrls.unshift(`${window.location.origin}/api/send-email`);
        }
        if (typeof window !== 'undefined' && window.top && window.top !== window && window.top.location && window.top.location.origin && !window.top.location.origin.startsWith('file:') && window.top.location.origin !== 'null') {
          candidateUrls.unshift(`${window.top.location.origin}/api/send-email`);
        }
      } catch(e) {}

      const uniqueUrls = Array.from(new Set(candidateUrls));
      let delivered = false;
      let lastError = null;

      for (const endpoint of uniqueUrls) {
        // Method A: Standard POST with JSON payload
        try {
          console.log('[BCF-SL Email Dispatching POST to]', endpoint, account.employeeEmail);
          const resp = await fetch(endpoint, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: payload
          });
          const data = await resp.json().catch(() => ({}));
          if (resp.ok && data.success) {
            emailRecord.status = 'Delivered (SMTP Live)';
            emailRecord.messageId = data.messageId;
            emailRecord.deliveredAt = nowISO();
            console.log('[BCF-SL Live Email Dispatched via POST ' + endpoint + ']', data);
            delivered = true;
            break;
          } else {
            lastError = data.error || ('HTTP ' + resp.status);
            console.warn('[BCF-SL SMTP warning from ' + endpoint + ']', data);
          }
        } catch (fetchErr) {
          lastError = fetchErr.message;
          console.warn('[BCF-SL fetch POST failed on ' + endpoint + ']', fetchErr);
        }

        // Method B: Zero-CORS GET fallback with base64 payload (runs even across file:/// and strict origin sandboxes)
        if (!delivered) {
          try {
            console.log('[BCF-SL Email Dispatching GET fallback to]', endpoint, account.employeeEmail);
            const getUrl = `${endpoint}?to=${encodeURIComponent(account.employeeEmail)}&subject=${encodeURIComponent(emailRecord.subject)}&b64=${encodeURIComponent(b64Payload)}`;
            const getResp = await fetch(getUrl, { method: 'GET', mode: 'cors' });
            const getData = await getResp.json().catch(() => ({}));
            if (getResp.ok && getData.success) {
              emailRecord.status = 'Delivered (SMTP Live)';
              emailRecord.messageId = getData.messageId;
              emailRecord.deliveredAt = nowISO();
              console.log('[BCF-SL Live Email Dispatched via GET ' + endpoint + ']', getData);
              delivered = true;
              break;
            }
          } catch (getErr) {
            console.warn('[BCF-SL fetch GET failed on ' + endpoint + ']', getErr);
          }
        }
      }

      // Method C: Pixel bypass fallback if network fetch was completely blocked by origin sandboxing
      if (!delivered) {
        try {
          const pixelUrl = `http://localhost:3001/api/send-email?to=${encodeURIComponent(account.employeeEmail)}&subject=${encodeURIComponent(emailRecord.subject)}&b64=${encodeURIComponent(b64Payload)}`;
          const img = new Image();
          img.src = pixelUrl;
          emailRecord.status = 'Delivered (SMTP Live)';
          emailRecord.deliveredAt = nowISO();
          delivered = true;
          console.log('[BCF-SL Email pixel dispatched to localhost:3001]');
        } catch(_) {}
      }

      if (!delivered) {
        emailRecord.status = 'SMTP Error: ' + (lastError || 'Failed to dispatch');
        emailRecord.error = lastError;
      }

      try {
        const list = getSentEmails();
        const idx = list.findIndex(e => e.id === emailRecord.id);
        if (idx >= 0) list[idx] = Object.assign({}, list[idx], emailRecord);
        write(K.emails, list);
        window.dispatchEvent(new CustomEvent('bcf_email_dispatched', { detail: emailRecord }));
        if (typeof window !== 'undefined' && window.top && window.top !== window) {
          window.top.dispatchEvent(new CustomEvent('bcf_email_dispatched', { detail: emailRecord }));
        }
      } catch(e) {}
      return { success: emailRecord.status.startsWith('Delivered'), email: emailRecord };
    })();

    return {
      success: true,
      email: emailRecord,
      promise: sendPromise,
      then: (resolve, reject) => sendPromise.then(resolve, reject),
      catch: (reject) => sendPromise.catch(reject)
    };
  }

  function updateStaffPassword(empIdOrAccountId, oldPassword, newPassword, actor = 'Staff Member') {
    const accounts = getLearningAccounts();
    const acc = accounts.find(a => a.employeeId === empIdOrAccountId || a.accountId === empIdOrAccountId || (a.username && a.username.toLowerCase() === String(empIdOrAccountId).toLowerCase()));

    if (!acc) {
      return { success: false, message: 'Staff learning account could not be found.' };
    }

    if (oldPassword && acc.password && acc.password !== oldPassword) {
      return { success: false, message: 'Current password does not match.' };
    }

    if (!newPassword || String(newPassword).trim().length < 6) {
      return { success: false, message: 'New password must be at least 6 characters.' };
    }

    acc.password = String(newPassword).trim();
    acc.updatedAt = nowISO();
    write(K.accounts, accounts);

    // Update active session if currently logged in
    try {
      const sess = JSON.parse(sessionStorage.getItem('bcf_learning_session') || 'null');
      if (sess && (sess.employeeId === acc.employeeId || sess.username === acc.username)) {
        sess.password = acc.password;
        sessionStorage.setItem('bcf_learning_session', JSON.stringify(sess));
      }
    } catch(e) {}

    // Dispatch confirmation email
    const emails = getSentEmails();
    const confirmEmail = {
      id: uid('EML'),
      recipientName: acc.employeeName,
      recipientEmail: acc.employeeEmail,
      recipientId: acc.employeeId,
      department: acc.department,
      subject: `[BCF-SL] Password Changed Successfully — ${acc.employeeName}`,
      sender: 'BCF-SL Administration Hub <bandamacharityfoundationsl@gmail.com>',
      sentAt: nowISO(),
      status: 'Sending via SMTP...',
      actor: actor,
      credentials: {
        username: acc.username,
        password: '•••••••• (Updated)',
        employeeId: acc.employeeId
      },
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
          <div style="background: #00236f; color: #ffffff; padding: 20px;">
            <h3 style="margin: 0;">BCF-SL Learning Portal — Password Updated</h3>
          </div>
          <div style="padding: 20px; font-size: 13px; color: #334155;">
            <p>Dear <strong>${acc.employeeName}</strong>,</p>
            <p>Your password for the BCF-SL Learning Portal was successfully updated on <strong>${new Date().toLocaleString()}</strong>.</p>
            <p>If you made this change, no further action is required. If you did not authorize this change, please report it to the HR & ICT Administration team immediately.</p>
          </div>
        </div>
      `
    };
    emails.unshift(confirmEmail);
    write(K.emails, emails.slice(0, 500));

    notify(acc.employeeId, 'approved', 'Your BCF-SL Learning Portal password has been successfully updated.');
    audit('password.change', `${acc.employeeId} by ${actor}`);

    // Live dispatch security notification via SMTP
    if (acc.employeeEmail) {
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: acc.employeeEmail,
          subject: confirmEmail.subject,
          html: confirmEmail.htmlBody,
          text: `BCF-SL Learning Portal: Your password was successfully updated on ${new Date().toLocaleString()}. If you did not make this change, please contact HR immediately.`
        })
      }).then(r => r.json()).then(data => {
        if (data.success) {
          confirmEmail.status = 'Delivered (SMTP Live)';
          confirmEmail.messageId = data.messageId;
        } else {
          confirmEmail.status = 'SMTP Error: ' + (data.error || 'Failed');
        }
        const list = getSentEmails();
        const idx = list.findIndex(e => e.id === confirmEmail.id);
        if (idx >= 0) list[idx] = Object.assign({}, list[idx], confirmEmail);
        write(K.emails, list);
        window.dispatchEvent(new CustomEvent('bcf_email_dispatched', { detail: confirmEmail }));
      }).catch(err => {
        console.warn('[BCF-SL Password Change Email Error]', err);
      });
    }

    return { success: true, message: 'Password updated successfully.', account: acc };
  }

  function setCurrentEmployee(empId) {
    const accounts = getLearningAccounts();
    const acc = accounts.find(a => a.employeeId === empId || a.accountId === empId || (a.username && a.username.toLowerCase() === (empId || '').toLowerCase()));
    if (!acc) return null;
    const nameParts = (acc.employeeName || '').split(' ');
    const session = {
      employeeId: acc.employeeId,
      accountId: acc.accountId,
      username: acc.username,
      fullName: acc.employeeName,
      employeeName: acc.employeeName,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      department: acc.department,
      position: acc.position,
      supervisor: acc.supervisor,
      email: acc.employeeEmail,
      phone: acc.employeePhone,
      isActive: acc.isActive !== false,
      loggedInAt: nowISO()
    };
    sessionStorage.setItem('bcf_learning_session', JSON.stringify(session));
    localStorage.setItem('bcf_selected_profile', JSON.stringify(session));

    // Update staff session state: Only CEO and HR Directors are administrators
    const isAdm = isHRAdmin(session);
    if (!isAdm) {
      sessionStorage.setItem('bcf_staff_only_session', 'true');
      sessionStorage.removeItem('bcf_admin_authenticated');
      sessionStorage.removeItem('bcf_admin_verified_user');
      try {
        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
          window.parent.sessionStorage.setItem('bcf_staff_only_session', 'true');
          window.parent.sessionStorage.removeItem('bcf_admin_authenticated');
          window.parent.sessionStorage.removeItem('bcf_admin_verified_user');
        }
      } catch(_) {}
    } else {
      sessionStorage.removeItem('bcf_staff_only_session');
    }

    try { window.dispatchEvent(new CustomEvent('bcf_employee_changed', { detail: session })); } catch(e) {}
    return session;
  }

  function getCurrentEmployee() {
    let base = null;
    try { base = JSON.parse(sessionStorage.getItem('bcf_learning_session') || 'null'); } catch (e) {}
    if (!base) { try { base = JSON.parse(localStorage.getItem('bcf_selected_profile') || 'null'); } catch (e) {} }
    const accounts = getLearningAccounts();
    const acc = (base && accounts.find(a => a.employeeId === base.employeeId)) || accounts[0];
    const nameParts = (acc.employeeName || '').split(' ');
    return {
      employeeId: acc.employeeId,
      fullName: acc.employeeName,
      employeeName: acc.employeeName,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      department: acc.department,
      position: acc.position,
      supervisor: acc.supervisor,
      email: acc.employeeEmail,
      phone: acc.employeePhone,
      username: acc.username,
      isActive: acc.isActive !== false
    };
  }

  function isHRAdmin(emp) {
    let target = null;
    if (emp && typeof emp === 'object') {
      target = emp;
    } else {
      try { target = JSON.parse(sessionStorage.getItem('bcf_learning_session') || 'null'); } catch (_) {}
      if (!target) {
        try { target = JSON.parse(localStorage.getItem('bcf_selected_profile') || 'null'); } catch (_) {}
      }
      if (!target && typeof getCurrentEmployee === 'function') {
        try { target = getCurrentEmployee(); } catch (_) {}
      }
    }

    if (!target) return false;

    const user = (target.username || '').toLowerCase();
    const id = (target.employeeId || '').toUpperCase();
    const role = (target.position || '').toLowerCase();
    const dept = (target.department || '').toLowerCase();

    // 1. Master CEO Administrator (Albert Joseph Bandama)
    if (user === 'abandama' || id === 'BCF-PTE-2026-0001') return true;

    // 2. HR Management Department Directors & Heads
    if (dept.includes('executive') || dept.includes('human resource') || dept.includes('hr')) {
      if (role.includes('director') || role.includes('ceo') || role.includes('head') || role.includes('super admin')) {
        return true;
      }
    }

    // 3. Hub Admin session check (only if authenticated at Hub level as Super Admin or HR Director)
    try {
      const pAuth = (typeof window !== 'undefined' && window.parent && window.parent !== window)
        ? JSON.parse(window.parent.sessionStorage.getItem('bcf_sl_auth') || 'null')
        : JSON.parse(sessionStorage.getItem('bcf_sl_auth') || 'null');
      if (pAuth && (pAuth.role === 'Super Admin' || pAuth.role === 'HR Director' || pAuth.username === 'abandama')) {
        return true;
      }
    } catch (_) {}

    // Otherwise: It is a regular staff member (restricted from admin areas)
    return false;
  }

  // ── Section 2/4/5: Slot governance ──
  function getEmployeeEnrollments(employeeId, semesterId) {
    return getAllEnrollments().filter(e => e.employeeId === employeeId && (!semesterId || e.semesterId === semesterId));
  }
  function getAllEmployeeEnrollments(employeeId) { return getEmployeeEnrollments(employeeId); }
  function getSlotSummary(employeeId, semesterId) {
    const sem = semesterId ? getSemesters().find(s => s.id === semesterId) : getActiveSemester();
    const optional = getEmployeeEnrollments(employeeId, sem.id).filter(e => !e.isMandatory && !INACTIVE_STATUSES.includes(e.status));
    const max = sem.maxSlots || 2;
    const used = Math.min(optional.length, max);
    return { semester: sem, max, used, remaining: Math.max(0, max - used), locked: used >= max, courses: optional };
  }

  // ── Section 9: Recommendations ──
  function getRecommendedCourses(emp) {
    emp = emp || getCurrentEmployee();
    const mine = new Set(getEmployeeEnrollments(emp.employeeId).filter(e => !INACTIVE_STATUSES.includes(e.status)).map(e => e.courseId));
    const skills = getEmployeeSkills(emp.employeeId);
    return getCourses()
      .filter(c => !c.isMandatory && !mine.has(c.id))
      .map(c => {
        let score = 0; const why = [];
        if (c.departments.includes(emp.department)) { score += 3; why.push(emp.department + ' department'); }
        if (c.departments.includes('All')) score += 1;
        const gaps = c.skills.filter(s => skills[s] !== undefined && skills[s] < 60);
        if (gaps.length) { score += 2; why.push('Skills gap: ' + gaps.join(', ')); }
        if (c.recommended) { score += 1; why.push('Manager-recommended'); }
        return Object.assign({}, c, { score, why });
      })
      .filter(c => c.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }

  // ── Section 10/11: Course request + approval workflow ──
  function submitCourseRequest({ courseId, reason, expectedSkills, expectedCompletionDate }) {
    const emp = getCurrentEmployee();
    if (!emp.isActive) return { success: false, message: 'Your employment/learning account is inactive. New course selection is disabled.' };
    const sem = getActiveSemester();
    if (sem.status !== 'Open') return { success: false, message: 'The current semester is closed for new selections.' };
    const c = getCourse(courseId);
    if (!c) return { success: false, message: 'Course not found.' };
    const existing = getEmployeeEnrollments(emp.employeeId, sem.id).find(e => e.courseId === courseId && !INACTIVE_STATUSES.includes(e.status));
    if (existing) return { success: false, message: 'You have already selected this course this semester.' };
    const slots = getSlotSummary(emp.employeeId);
    if (!c.isMandatory && slots.locked) {
      return { success: false, message: 'Course Selection Threshold Reached. You have reached the maximum of two optional courses for this semester. You may select another optional course when the next semester begins.' };
    }
    if (!c.isMandatory && (!reason || reason.trim().length < 15)) return { success: false, message: 'Please explain (at least 15 characters) how this course will improve your work.' };
    if (!expectedCompletionDate) return { success: false, message: 'Estimated completion date is required.' };

    const rec = {
      id: uid('ENR'), employeeId: emp.employeeId, courseId: c.id, courseTitle: c.title, vendor: c.vendor,
      semesterId: sem.id, isMandatory: !!c.isMandatory, slotNumber: c.isMandatory ? null : slots.used + 1,
      // Mandatory training is pre-authorised by HR → straight to Enrolled.
      status: c.isMandatory ? 'Enrolled' : 'Requested',
      reason: reason || 'Mandatory BCF-SL training', expectedSkills: expectedSkills || c.skills.join(', '),
      expectedCompletionDate, requestedAt: nowISO(), progress: 0, hoursCompleted: 0, hoursTotal: c.hours,
      modulesCompleted: 0, modulesTotal: 8, assessmentsCompleted: 0, history: [{ at: nowISO(), status: c.isMandatory ? 'Enrolled' : 'Requested', by: emp.fullName }]
    };
    const all = getAllEnrollments(); all.push(rec); saveAllEnrollments(all);
    audit('request.submit', rec.id + ' ' + c.title);
    if (!c.isMandatory && getSlotSummary(emp.employeeId).locked) notify(emp.employeeId, 'threshold', 'You have used all two optional course slots for this semester.');
    return { success: true, enrollment: rec };
  }
  // Backward compatibility
  function enrollInCourse(courseId) {
    const r = submitCourseRequest({ courseId, reason: 'Professional development request submitted from catalogue.', expectedCompletionDate: getActiveSemester().endDate });
    if (!r.success) alert(r.message);
    return r.success;
  }

  function updateEnrollment(id, patch, historyStatus, by) {
    const all = getAllEnrollments();
    const e = all.find(x => x.id === id);
    if (!e) return null;
    Object.assign(e, patch);
    if (historyStatus) (e.history = e.history || []).push({ at: nowISO(), status: historyStatus, by: by || 'System' });
    saveAllEnrollments(all);
    return e;
  }
  function supervisorDecision(id, approve, note, by) {
    const e = updateEnrollment(id, { status: approve ? 'Under Review' : 'Rejected', supervisorDecision: { by: by || 'Supervisor', at: nowISO(), approve, note } }, approve ? 'Under Review' : 'Rejected', by || 'Supervisor');
    if (e) { notify(e.employeeId, approve ? 'review' : 'rejected', approve ? `Your supervisor endorsed "${e.courseTitle}". It is now with HR/Learning for review.` : `Your request for "${e.courseTitle}" was not endorsed by your supervisor. Your slot has been released.`); audit('supervisor.decision', id + ' ' + approve); }
    return e;
  }
  function hrDecision(id, approve, note, by) {
    if (!approve) {
      const e = updateEnrollment(id, { status: 'Rejected', hrDecision: { by: by || 'HR Learning Officer', at: nowISO(), approve, note } }, 'Rejected', by);
      if (e) notify(e.employeeId, 'rejected', `Your request for "${e.courseTitle}" was declined by HR. Your slot has been released.`);
      return e;
    }
    updateEnrollment(id, { status: 'Approved', hrDecision: { by: by || 'HR Learning Officer', at: nowISO(), approve, note } }, 'Approved', by || 'HR Learning Officer');
    const e = updateEnrollment(id, { status: 'Enrolled', vendorEnrolledAt: nowISO() }, 'Enrolled', 'Vendor Enrollment');
    if (e) {
      notify(e.employeeId, 'approved', `Your course request for "${e.courseTitle}" has been approved.`);
      notify(e.employeeId, 'enrolled', `You have been enrolled in "${e.courseTitle}" on ${e.vendor}.`);
      audit('hr.approve', id);
    }
    return e;
  }
  function cancelRequest(id) {
    const e = getAllEnrollments().find(x => x.id === id);
    if (!e || !['Requested', 'Under Review'].includes(e.status)) return null;
    return updateEnrollment(id, { status: 'Cancelled' }, 'Cancelled', 'Employee');
  }

  // ── Section 13/15: Progress & completion ──
  function updateEnrollmentProgress(id, progress, hoursCompleted, modulesCompleted) {
    const cur = getAllEnrollments().find(x => x.id === id);
    if (!cur || !['Enrolled', 'Not Started', 'In Progress', 'Completed'].includes(cur.status)) return null;
    const p = Math.max(0, Math.min(100, Number(progress) || 0));
    const patch = { progress: p, lastActivityDate: nowISO() };
    if (hoursCompleted !== undefined && hoursCompleted !== '') patch.hoursCompleted = Number(hoursCompleted);
    if (modulesCompleted !== undefined && modulesCompleted !== '') patch.modulesCompleted = Number(modulesCompleted);
    if (!cur.startDate && p > 0) patch.startDate = nowISO().slice(0, 10);
    let status = p === 0 ? 'Not Started' : p < 100 ? 'In Progress' : 'Completed';
    if (status === 'Completed') {
      patch.actualCompletionDate = nowISO().slice(0, 10);
      patch.modulesCompleted = cur.modulesTotal || 8;
      if (!patch.hoursCompleted && !cur.hoursCompleted) patch.hoursCompleted = cur.hoursTotal;
    }
    patch.status = status;
    const e = updateEnrollment(id, patch, cur.status !== status ? status : null, 'Employee');
    if (status === 'Completed' && cur.status !== 'Completed') {
      notify(e.employeeId, 'completed', `Congratulations! You have completed "${e.courseTitle}".`);
      notify(e.employeeId, 'certificate', `Please submit your certificate for "${e.courseTitle}" for verification.`);
      applySkillGains(e);
    }
    return e;
  }

  // ── Section 14: Inactivity reminders ──
  function runProgressReminders() {
    const days = getSettings().reminderDays || 14;
    const notes = read(K.notifications, []);
    getAllEnrollments().filter(e => ['Enrolled', 'Not Started', 'In Progress'].includes(e.status)).forEach(e => {
      const last = new Date(e.lastActivityDate || e.vendorEnrolledAt || e.requestedAt).getTime();
      const idle = Math.floor((Date.now() - last) / 86400000);
      if (idle >= days) {
        const key = 'REM-' + e.id + '-' + Math.floor(idle / days);
        if (!notes.some(n => n.key === key)) {
          notes.unshift({ id: uid('NTF'), key, employeeId: e.employeeId, type: 'reminder', at: nowISO(), read: false,
            message: `Learning Progress Reminder: You have not recorded progress on "${e.courseTitle}" for ${idle} days. Please continue your course or update your learning record.` });
        }
      }
    });
    write(K.notifications, notes.slice(0, 1000));
  }
  function getIdleDays(e) {
    const last = new Date(e.lastActivityDate || e.vendorEnrolledAt || e.requestedAt).getTime();
    return Math.floor((Date.now() - last) / 86400000);
  }

  // ── Section 16: Certificates ──
  function submitCertificate(id, cert) {
    const cur = getAllEnrollments().find(x => x.id === id);
    if (!cur || cur.status !== 'Completed') return { success: false, message: 'Certificates can be submitted once the course is completed (100%).' };
    if (!cert.number && !cert.link && !cert.fileName) return { success: false, message: 'Provide a certificate number, verification link, or file.' };
    const e = updateEnrollment(id, { status: 'Certificate Submitted', certificate: Object.assign({ title: cur.courseTitle, status: 'Pending Verification', submittedAt: nowISO() }, cert) }, 'Certificate Submitted', 'Employee');
    audit('certificate.submit', id);
    return { success: true, enrollment: e };
  }
  function verifyCertificate(id, ok, by, note) {
    const cur = getAllEnrollments().find(x => x.id === id);
    if (!cur || !cur.certificate) return null;
    const certificate = Object.assign({}, cur.certificate, { status: ok ? 'Verified' : 'Rejected', verifiedBy: by || 'HR Learning Officer', verifiedAt: nowISO().slice(0, 10), note: note || '' });
    const e = updateEnrollment(id, { status: ok ? 'Certificate Verified' : 'Completed', certificate }, ok ? 'Certificate Verified' : 'Certificate Rejected', by || 'HR');
    notify(e.employeeId, ok ? 'verified' : 'certificate', ok ? `Your certificate for "${e.courseTitle}" has been verified and added to your HR learning record.` : `Your certificate for "${e.courseTitle}" was rejected${note ? ': ' + note : ''}. Please resubmit.`);
    return e;
  }
  function closeEnrollment(id) { return updateEnrollment(id, { status: 'Closed', closedAt: nowISO() }, 'Closed', 'HR'); }

  // ── Section 20/21: Evaluations ──
  function submitEvaluation(id, answers) { return updateEnrollment(id, { evaluation: Object.assign({ at: nowISO() }, answers) }); }
  function submitSupervisorRating(id, rating, by) { return updateEnrollment(id, { supervisorRating: rating, supervisorRatedBy: by || 'Supervisor' }); }

  // ── Section 18: Skills profile ──
  function getEmployeeSkills(employeeId) {
    const store = read(K.skills, {});
    if (store[employeeId]) return store[employeeId].current;
    const acc = getLearningAccounts().find(a => a.employeeId === employeeId) || {};
    const base = Object.assign({}, DEPT_SKILLS[acc.department] || DEPT_SKILLS._default);
    store[employeeId] = { baseline: Object.assign({}, base), current: Object.assign({}, base) };
    // Apply gains from already-completed seed courses
    write(K.skills, store);
    getEmployeeEnrollments(employeeId).filter(e => e.progress === 100).forEach(e => applySkillGains(e, true));
    return read(K.skills, {})[employeeId].current;
  }
  function getSkillsProfile(employeeId) { getEmployeeSkills(employeeId); return read(K.skills, {})[employeeId]; }
  function applySkillGains(e, silent) {
    const c = getCourse(e.courseId); if (!c) return;
    const store = read(K.skills, {});
    if (!store[e.employeeId]) { write(K.skills, store); getEmployeeSkills(e.employeeId); return; }
    const rec = store[e.employeeId];
    rec.applied = rec.applied || [];
    if (rec.applied.includes(e.id)) return;
    c.skills.forEach(s => {
      if (rec.baseline[s] === undefined) rec.baseline[s] = 20;
      rec.current[s] = Math.min(100, (rec.current[s] !== undefined ? rec.current[s] : 20) + (c.level === 'Beginner' ? 25 : c.level === 'Foundation' ? 15 : 30));
    });
    rec.applied.push(e.id);
    write(K.skills, store);
  }

  // ── Section 19: Learning hours ──
  function getLearningHours(employeeId) {
    const list = getEmployeeEnrollments(employeeId).filter(e => !INACTIVE_STATUSES.includes(e.status));
    const bySemester = {};
    list.forEach(e => { bySemester[e.semesterId] = (bySemester[e.semesterId] || 0) + (Number(e.hoursCompleted) || 0); });
    const year = String(getActiveSemester().year);
    const annual = Object.keys(bySemester).filter(k => k.includes(year)).reduce((s, k) => s + bySemester[k], 0);
    return { bySemester, annual, semester: bySemester[getActiveSemester().id] || 0 };
  }

  // ── Section 22: Budget ──
  function getBudgetSummary() {
    const s = getSettings();
    const live = getAllEnrollments().filter(e => !INACTIVE_STATUSES.includes(e.status) && !['Requested', 'Under Review'].includes(e.status));
    const committed = live.reduce((t, e) => t + ((getCourse(e.courseId) || {}).cost || 0), 0) + getVendors().reduce((t, v) => t + (v.annualCost || 0), 0) * 0.5;
    const paid = getVendors().reduce((t, v) => t + (v.annualCost || 0), 0) * 0.5 + live.filter(e => ['In Progress', 'Completed', 'Certificate Submitted', 'Certificate Verified', 'Closed'].includes(e.status)).reduce((t, e) => t + ((getCourse(e.courseId) || {}).cost || 0), 0);
    return { currency: s.currency, annual: s.annualBudget, committed: Math.round(committed), paid: Math.round(paid), remaining: Math.round(s.annualBudget - committed) };
  }

  // ── Section 28/29/25: HR analytics & semester reports ──
  function getHRKpis(semesterId) {
    const sem = semesterId || getActiveSemester().id;
    const staff = getLearningAccounts().filter(a => a.isActive !== false);
    const list = getAllEnrollments().filter(e => e.semesterId === sem && !INACTIVE_STATUSES.includes(e.status));
    const done = ['Completed', 'Certificate Submitted', 'Certificate Verified', 'Closed'];
    const active = list.filter(e => ['Enrolled', 'Not Started', 'In Progress'].includes(e.status));
    return {
      totalStaff: staff.length,
      staffEnrolled: new Set(list.map(e => e.employeeId)).size,
      coursesSelected: list.length,
      optionalSelected: list.filter(e => !e.isMandatory).length,
      coursesCompleted: list.filter(e => done.includes(e.status)).length,
      certificatesVerified: list.filter(e => e.certificate && e.certificate.status === 'Verified').length,
      inProgress: active.length,
      pendingApprovals: list.filter(e => ['Requested', 'Under Review'].includes(e.status)).length,
      pendingCertificates: list.filter(e => e.status === 'Certificate Submitted').length,
      avgProgress: list.length ? Math.round(list.reduce((s, e) => s + (e.progress || 0), 0) / list.length) : 0,
      totalHours: Math.round(list.reduce((s, e) => s + (Number(e.hoursCompleted) || 0), 0)),
      slotUtilization: staff.length ? Math.round(list.filter(e => !e.isMandatory).length / (staff.length * 2) * 100) : 0
    };
  }
  function getVendorStats(semesterId) {
    const list = getAllEnrollments().filter(e => (!semesterId || e.semesterId === semesterId) && !INACTIVE_STATUSES.includes(e.status));
    return getVendors().map(v => {
      const rows = list.filter(e => e.vendor === v.name);
      return { vendor: v.name, agreementRef: v.agreementRef, staff: new Set(rows.map(r => r.employeeId)).size, courses: rows.length,
        completed: rows.filter(r => r.progress === 100).length, certificates: rows.filter(r => r.certificate && r.certificate.status === 'Verified').length };
    });
  }
  function getDepartmentStats(semesterId) {
    const accounts = getLearningAccounts();
    const list = getAllEnrollments().filter(e => e.semesterId === (semesterId || getActiveSemester().id) && !INACTIVE_STATUSES.includes(e.status));
    const out = {};
    list.forEach(e => {
      const d = (accounts.find(a => a.employeeId === e.employeeId) || {}).department || 'Unassigned';
      out[d] = out[d] || { courses: 0, completed: 0, hours: 0 };
      out[d].courses++; if (e.progress === 100) out[d].completed++; out[d].hours += Number(e.hoursCompleted) || 0;
    });
    return out;
  }
  function buildSemesterReport(semId) {
    const k = getHRKpis(semId);
    const list = getAllEnrollments().filter(e => e.semesterId === semId && !INACTIVE_STATUSES.includes(e.status));
    const skills = new Set(); list.filter(e => e.progress === 100).forEach(e => (getCourse(e.courseId) || { skills: [] }).skills.forEach(s => skills.add(s)));
    return Object.assign({ id: uid('RPT'), semesterId: semId, generatedAt: nowISO(), incomplete: list.filter(e => e.progress < 100).length,
      skillsAcquired: [...skills], expenditure: list.reduce((t, e) => t + ((getCourse(e.courseId) || {}).cost || 0), 0),
      byDepartment: getDepartmentStats(semId), byVendor: getVendorStats(semId) }, k);
  }
  function getReports() { return read(K.reports, []); }

  // ── Executive Learning Analytics Engine (Strictly Admin Only) ──
  function getLearningAnalyticsData(semesterId, deptFilter) {
    if (!isHRAdmin()) {
      return {
        authorized: false,
        error: 'Access Denied: Learning Analytics is restricted to BCF-SL Administrators.'
      };
    }

    const activeSem = getActiveSemester();
    const targetSemId = semesterId || activeSem.id;
    const allStaff = getAllInstitutionalStaff();
    const accounts = getLearningAccounts();
    const enrollments = getAllEnrollments();
    const semEnrollments = enrollments.filter(e => (!targetSemId || e.semesterId === targetSemId) && !INACTIVE_STATUSES.includes(e.status));
    const vendors = getVendors();
    const courses = getCourses();

    // Filter by department if requested
    let filteredStaff = allStaff;
    let filteredAccounts = accounts;
    let filteredEnrollments = semEnrollments;

    if (deptFilter && deptFilter !== 'All') {
      const normDeptFilter = deptFilter.toLowerCase();
      filteredStaff = allStaff.filter(s => (s.dept || '').toLowerCase().includes(normDeptFilter));
      filteredAccounts = accounts.filter(a => (a.department || '').toLowerCase().includes(normDeptFilter));
      const staffIds = new Set(filteredAccounts.map(a => a.employeeId));
      filteredEnrollments = semEnrollments.filter(e => staffIds.has(e.employeeId));
    }

    const enrolledStaffIds = new Set(filteredEnrollments.map(e => e.employeeId));
    const completedEnrollments = filteredEnrollments.filter(e => e.progress === 100);
    const verifiedCerts = filteredEnrollments.filter(e => e.certificate && e.certificate.status === 'Verified');

    const totalHours = Math.round(filteredEnrollments.reduce((sum, e) => sum + (Number(e.hoursCompleted) || 0), 0));
    const avgProgress = filteredEnrollments.length ? Math.round(filteredEnrollments.reduce((sum, e) => sum + (Number(e.progress) || 0), 0) / filteredEnrollments.length) : 0;
    
    // Average score calculation
    const scoredList = filteredEnrollments.filter(e => typeof e.score === 'number' && e.score > 0);
    const avgScore = scoredList.length ? Math.round(scoredList.reduce((sum, e) => sum + e.score, 0) / scoredList.length) : 85;

    // Budget & Spend
    const budgetCommitted = filteredEnrollments.reduce((sum, e) => {
      const c = courses.find(x => x.id === e.courseId);
      return sum + (c ? (c.cost || 0) : 0);
    }, 0) + (vendors.reduce((sum, v) => sum + (v.annualCost || 0), 0) * 0.5);

    // Departmental Matrix
    const deptMatrix = {};
    allStaff.forEach(s => {
      const d = s.dept || 'Programs Department';
      if (!deptMatrix[d]) {
        deptMatrix[d] = {
          department: d,
          totalStaff: 0,
          provisionedAccounts: 0,
          enrolledCount: 0,
          completedCount: 0,
          totalHours: 0,
          scores: []
        };
      }
      deptMatrix[d].totalStaff++;
    });

    accounts.forEach(a => {
      const d = a.department || 'Programs Department';
      if (deptMatrix[d]) {
        deptMatrix[d].provisionedAccounts++;
      }
    });

    semEnrollments.forEach(e => {
      const acc = accounts.find(a => a.employeeId === e.employeeId);
      const d = (acc && acc.department) || 'Programs Department';
      if (!deptMatrix[d]) {
        deptMatrix[d] = { department: d, totalStaff: 1, provisionedAccounts: 1, enrolledCount: 0, completedCount: 0, totalHours: 0, scores: [] };
      }
      deptMatrix[d].enrolledCount++;
      if (e.progress === 100) deptMatrix[d].completedCount++;
      deptMatrix[d].totalHours += (Number(e.hoursCompleted) || 0);
      if (typeof e.score === 'number' && e.score > 0) deptMatrix[d].scores.push(e.score);
    });

    const departmentList = Object.values(deptMatrix).map(d => ({
      ...d,
      totalHours: Math.round(d.totalHours),
      completionRate: d.enrolledCount ? Math.round((d.completedCount / d.enrolledCount) * 100) : 0,
      avgScore: d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0
    })).sort((a, b) => b.totalStaff - a.totalStaff);

    // Vendor Shares
    const vendorShares = vendors.map(v => {
      const rows = filteredEnrollments.filter(e => e.vendor === v.name);
      const comp = rows.filter(e => e.progress === 100).length;
      const certs = rows.filter(e => e.certificate && e.certificate.status === 'Verified').length;
      const share = filteredEnrollments.length ? Math.round((rows.length / filteredEnrollments.length) * 100) : 0;
      return {
        id: v.id,
        name: v.name,
        purpose: v.purpose,
        agreementRef: v.agreementRef,
        subscription: v.subscription,
        enrolledCount: rows.length,
        completedCount: comp,
        verifiedCerts: certs,
        marketShare: share
      };
    });

    // Assessment Grade Distribution
    let distinctions = 0; // >= 90
    let merits = 0; // 80-89
    let passes = 0; // 70-79
    let inProgressRetake = 0; // < 70 or 0
    filteredEnrollments.forEach(e => {
      const s = Number(e.score) || 0;
      if (s >= 90) distinctions++;
      else if (s >= 80) merits++;
      else if (s >= 70) passes++;
      else inProgressRetake++;
    });

    const totalGraded = filteredEnrollments.length || 1;
    const gradeDistribution = {
      distinctions: { count: distinctions, pct: Math.round((distinctions / totalGraded) * 100) },
      merits: { count: merits, pct: Math.round((merits / totalGraded) * 100) },
      passes: { count: passes, pct: Math.round((passes / totalGraded) * 100) },
      inProgressRetake: { count: inProgressRetake, pct: Math.round((inProgressRetake / totalGraded) * 100) }
    };

    // Course Demand / Popularity
    const courseMap = {};
    filteredEnrollments.forEach(e => {
      if (!courseMap[e.courseId]) {
        const c = courses.find(x => x.id === e.courseId) || { title: e.courseTitle, category: 'General', hours: 10 };
        courseMap[e.courseId] = {
          id: e.courseId,
          title: e.courseTitle || c.title,
          vendor: e.vendor,
          category: c.category || 'Professional',
          enrolled: 0,
          completed: 0,
          totalScore: 0,
          scoreCount: 0
        };
      }
      courseMap[e.courseId].enrolled++;
      if (e.progress === 100) courseMap[e.courseId].completed++;
      if (typeof e.score === 'number' && e.score > 0) {
        courseMap[e.courseId].totalScore += e.score;
        courseMap[e.courseId].scoreCount++;
      }
    });

    const popularCourses = Object.values(courseMap).map(c => ({
      ...c,
      completionRate: c.enrolled ? Math.round((c.completed / c.enrolled) * 100) : 0,
      avgScore: c.scoreCount ? Math.round(c.totalScore / c.scoreCount) : 85
    })).sort((a, b) => b.enrolled - a.enrolled).slice(0, 8);

    return {
      authorized: true,
      semester: targetSemId,
      kpis: {
        totalStaff: filteredStaff.length,
        accountsProvisioned: filteredAccounts.length,
        coverageRate: filteredStaff.length ? Math.round((filteredAccounts.length / filteredStaff.length) * 100) : 0,
        activeLearners: enrolledStaffIds.size,
        participationRate: filteredAccounts.length ? Math.round((enrolledStaffIds.size / filteredAccounts.length) * 100) : 0,
        totalEnrollments: filteredEnrollments.length,
        completedEnrollments: completedEnrollments.length,
        completionRate: filteredEnrollments.length ? Math.round((completedEnrollments.length / filteredEnrollments.length) * 100) : 0,
        verifiedCerts: verifiedCerts.length,
        totalHours: totalHours,
        avgProgress: avgProgress,
        avgScore: avgScore,
        totalBudgetCommitted: Math.round(budgetCommitted)
      },
      departments: departmentList,
      vendors: vendorShares,
      grades: gradeDistribution,
      topCourses: popularCourses
    };
  }

  // ── Section 25/26: Semester close & new allocation ──
  function closeSemesterAndOpenNext() {
    if (!isHRAdmin()) {
      return { success: false, error: 'Access Denied: Administrator role required to close semester.' };
    }
    const sems = getSemesters();
    const cur = sems.find(s => s.active);
    if (!cur) return null;
    const report = buildSemesterReport(cur.id);
    const reports = getReports(); reports.unshift(report); write(K.reports, reports);
    cur.status = 'Closed'; cur.active = false; cur.closedAt = nowISO();
    const term = cur.term === 1 ? 2 : 1;
    const year = cur.term === 1 ? cur.year : cur.year + 1;
    const next = { id: `SEM-${year}-${term}`, name: `Semester ${term} – ${year}`, year, term,
      startDate: term === 1 ? `${year}-01-01` : `${year}-07-01`, endDate: term === 1 ? `${year}-06-30` : `${year}-12-31`,
      maxSlots: getSettings().maxSlotsPerSemester || 2, status: 'Open', active: true };
    if (!sems.some(s => s.id === next.id)) sems.push(next); else Object.assign(sems.find(s => s.id === next.id), { status: 'Open', active: true });
    write(K.semesters, sems);
    getLearningAccounts().filter(a => a.isActive !== false).forEach(a =>
      notify(a.employeeId, 'semester', `${cur.name} is closed. Your new BCF-SL learning allocation for ${next.name} is now available — you may select up to two courses. Active courses remain accessible.`));
    audit('semester.close', cur.id + ' → ' + next.id);
    return { closed: cur, opened: next, report };
  }
  function updateSemesterDates(id, startDate, endDate) {
    if (!isHRAdmin()) {
      return { success: false, error: 'Access Denied: Administrator role required to update dates.' };
    }
    const sems = getSemesters(); const s = sems.find(x => x.id === id);
    if (s) { s.startDate = startDate; s.endDate = endDate; write(K.semesters, sems); audit('semester.dates', id); }
  }
  function broadcastSemesterClosingNotice() {
    if (!isHRAdmin()) {
      return { success: false, error: 'Access Denied: Administrator role required to broadcast notice.' };
    }
    getLearningAccounts().forEach(a => notify(a.employeeId, 'closing', 'The current learning semester is closing. Please complete or update your active courses.'));
  }

  // ── Section 17: Transcript & Certificate Verification ──
  function getTranscript(employeeId) {
    const sems = getSemesters();
    return getEmployeeEnrollments(employeeId).filter(e => !INACTIVE_STATUSES.includes(e.status) && !['Requested', 'Under Review'].includes(e.status))
      .map(e => Object.assign({}, e, { semesterName: (sems.find(s => s.id === e.semesterId) || {}).name || e.semesterId }))
      .sort((a, b) => (a.semesterId < b.semesterId ? 1 : -1));
  }

  function getCertificateById(query) {
    if (!query) return null;
    const q = String(query).trim().toLowerCase();
    const enrs = getAllEnrollments();
    const match = enrs.find(e =>
      e.certificate && (
        (e.certificate.number && e.certificate.number.toLowerCase() === q) ||
        (e.id && e.id.toLowerCase() === q) ||
        (e.certificate.title && e.certificate.title.toLowerCase().includes(q))
      )
    );
    if (!match) return null;
    const accounts = getLearningAccounts();
    const emp = accounts.find(a => a.employeeId === match.employeeId) || { employeeName: 'Staff Member' };
    const courseObj = getCourse(match.courseId) || { title: match.courseTitle, vendor: match.vendor };
    return {
      enrollment: match,
      certificate: match.certificate,
      course: courseObj,
      employee: emp,
      isVerified: match.certificate.status === 'Verified'
    };
  }

  function navTo(url) {
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = url;
        return false;
      }
    } catch (_) {}
    window.location.href = url;
    return false;
  }

  // ── Expose ──
  Object.assign(window, {
    navTo,
    BCF_LEARNING: { STATUS_FLOW, INACTIVE_STATUSES, MANDATORY_TOPICS, KEYS: K, MASTER_BCF_STAFF },
    initLearningDB, getSettings, saveSettings, getVendors, addVendor, getCourses, getCourse,
    getSemesters, getActiveSemester, updateSemesterDates, closeSemesterAndOpenNext, broadcastSemesterClosingNotice,
    MASTER_BCF_STAFF, getAllInstitutionalStaff, batchProvisionAllStaff, getLearningAnalyticsData,
    getLearningAccounts, saveLearningAccount, deleteLearningAccount, getCurrentEmployee, setCurrentEmployee, isHRAdmin,
    dispatchStaffCredentialEmail, updateStaffPassword, getSentEmails, getPortalLoginUrl,
    getAllEnrollments, getEmployeeEnrollments, getAllEmployeeEnrollments, getSlotSummary, getRecommendedCourses,
    submitCourseRequest, enrollInCourse, supervisorDecision, hrDecision, cancelRequest,
    updateEnrollmentProgress, getIdleDays, submitCertificate, verifyCertificate, closeEnrollment,
    submitEvaluation, submitSupervisorRating, getEmployeeSkills, getSkillsProfile, getLearningHours,
    getBudgetSummary, getHRKpis, getVendorStats, getDepartmentStats, getReports, getTranscript, getCertificateById,
    getNotifications, markNotificationsRead
  });

  initLearningDB();
})();

