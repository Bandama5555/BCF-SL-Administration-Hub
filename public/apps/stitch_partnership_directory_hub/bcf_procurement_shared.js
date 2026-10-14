/**
 * BCF-SL Integrated Procurement & Management System — Shared Core Library
 * ========================================================================
 * Central Transaction Engine connecting:
 *   Programme → Donor → Procurement → Finance → Inventory → Assets → HR
 *
 * Golden Rule: CREATE ONCE → VALIDATE ONCE → APPROVE ONCE → REUSE EVERYWHERE
 *
 * This library provides:
 *   - Shared Master Data (Suppliers, Programmes, Donors, Grants, Budgets, etc.)
 *   - Central Transaction ID generation (BCF-TXN-YYYY-NNNNNN)
 *   - Procurement lifecycle state machine (PR → RFQ → PO → GRN → Invoice → Payment)
 *   - Cross-module data inheritance
 *   - Central Audit Trail
 *   - Budget check engine
 */

const BCF_PROCUREMENT = (function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  //  POLICY CONSTANTS
  // ─────────────────────────────────────────────────────────────
  const POLICY = {
    CURRENCY: 'NLe',
    FISCAL_YEAR: 2026,

    // Procurement method thresholds (NLe)
    THRESHOLDS: {
      DIRECT_PURCHASE:     50000,   // Up to NLe 50,000
      REQUEST_FOR_QUOTATION: 500000, // NLe 50,001 – 500,000
      OPEN_TENDER:         Infinity  // Above NLe 500,000
    },

    // Approval delegation matrix
    APPROVAL_MATRIX: [
      { maxAmount: 10000,   approver: 'Programme Manager',   level: 1 },
      { maxAmount: 50000,   approver: 'Procurement Officer', level: 2 },
      { maxAmount: 100000,  approver: 'Finance Director',    level: 3 },
      { maxAmount: 250000,  approver: 'CEO',                 level: 4 },
      { maxAmount: 500000,  approver: 'Procurement Committee', level: 5 },
      { maxAmount: Infinity, approver: 'Board / Executive Committee', level: 6 }
    ],

    // Procurement categories
    CATEGORIES: [
      'Education Materials',
      'School Feeding Supplies',
      'Medical & Health Supplies',
      'WASH Equipment',
      'Furniture & Fittings',
      'IT Equipment & Technology',
      'Office Supplies',
      'Vehicles & Transport',
      'Construction & Renovation',
      'Consultancy Services',
      'Training & Development',
      'Staff Welfare & PPE',
      'Communication & Outreach',
      'Field Operations Supplies',
      'General Goods & Services'
    ],

    // Procurement methods
    METHODS: [
      'Direct Purchase',
      'Request for Quotation (RFQ)',
      'Open Competitive Tender',
      'Restricted Tender',
      'Single Source / Sole Supplier',
      'Framework Agreement Call-Off'
    ],

    // Item types
    ITEM_TYPES: [
      'Goods',
      'Services',
      'Works',
      'Consultancy'
    ],

    // Asset categorisation flag
    ASSET_CATEGORIES: [
      'IT Equipment & Technology',
      'Vehicles & Transport',
      'Furniture & Fittings',
      'Construction & Renovation'
    ],

    DEPARTMENTS: [
      'Executive Management',
      'Finance Department',
      'Health & Safety Department',
      'Human Resources Management Department',
      'Information Technology (IT) Department',
      'Internal Risk & Audits Department',
      'Legal & Communication Department',
      'Procurement Department',
      'Programs Department'
    ],

    LOCATIONS: [
      'BCF Head Office, Freetown',
      'Bo District Office',
      'Kenema District Office',
      'Makeni District Office',
      'Kailahun District Office',
      'Port Loko District Office',
      'Bombali District Office',
      'Moyamba District Office',
      'Bonthe District Office',
      'Kono District Office',
      'Pujehun District Office',
      'Kambia District Office',
      'Tonkolili District Office',
      'Falaba District Office'
    ],

    WAREHOUSES: [
      { id: 'WH-FT-01', name: 'BCF Central Warehouse, Freetown', location: 'BCF Head Office, Freetown', capacity: 5000 },
      { id: 'WH-BO-01', name: 'Bo District Store', location: 'Bo District Office', capacity: 2000 },
      { id: 'WH-KN-01', name: 'Kenema District Store', location: 'Kenema District Office', capacity: 1500 },
      { id: 'WH-MK-01', name: 'Makeni District Store', location: 'Makeni District Office', capacity: 1500 }
    ],

    // ─────────────────────────────────────────────────────────────
    //  BCF-SL PARTNERSHIP MANAGEMENT POLICY FRAMEWORK
    // ─────────────────────────────────────────────────────────────
    PARTNER_TYPES: [
      'Government Institution',
      'Local NGO',
      'International NGO',
      'UN Agency',
      'Donor/Funding Institution',
      'Private Company',
      'Corporate Foundation',
      'Academic Institution',
      'Research Institution',
      'Faith-Based Organization',
      'Community-Based Organization',
      'Professional Association',
      'Media Organization',
      'International Foundation',
      'Development Agency',
      'Health Institution',
      'Educational Institution',
      'Technology Partner',
      'Financial Institution',
      'Other'
    ],

    PARTNERSHIP_CATEGORIES: [
      { code: 'A', name: 'Programme Partnership', description: 'Joint implementation of BCF programmes' },
      { code: 'B', name: 'Funding Partnership', description: 'Financial support, grants or sponsorship' },
      { code: 'C', name: 'Technical Partnership', description: 'Technical expertise, consultancy or specialized support' },
      { code: 'D', name: 'Institutional Partnership', description: 'Long-term organizational collaboration' },
      { code: 'E', name: 'Government Partnership', description: 'Coordination with ministries, departments and agencies' },
      { code: 'F', name: 'Education Partnership', description: 'Schools, universities and educational institutions' },
      { code: 'G', name: 'Health Partnership', description: 'Hospitals, clinics, health organizations and authorities' },
      { code: 'H', name: 'Private Sector Partnership', description: 'Companies and corporate social responsibility (CSR)' },
      { code: 'I', name: 'Research Partnership', description: 'Research, data, surveys and evidence generation' },
      { code: 'J', name: 'Media Partnership', description: 'Public awareness, campaigns and communications' },
      { code: 'K', name: 'Volunteer Partnership', description: 'Volunteer recruitment and deployment' },
      { code: 'L', name: 'In-Kind Partnership', description: 'Provision of equipment, materials, services or non-cash assistance' }
    ],

    PIPELINE_STAGES: [
      'Identified',
      'Contacted',
      'Interested',
      'Initial Meeting',
      'Partner Assessment',
      'Due Diligence',
      'Negotiation',
      'Approval',
      'Agreement',
      'Active Partnership',
      'Renewal / Closure'
    ],

    AGREEMENT_TYPES: [
      'Memorandum of Understanding (MoU)',
      'Memorandum of Agreement (MoA)',
      'Partnership Agreement',
      'Grant Agreement',
      'Service Agreement',
      'Consortium Agreement',
      'Collaboration Agreement',
      'Technical Cooperation Agreement',
      'Sponsorship Agreement',
      'In-Kind Donation Agreement'
    ],

    RISK_LEVELS: ['Low', 'Medium', 'High', 'Critical'],

    ASSESSMENT_CRITERIA: [
      { id: 'crit-1', name: 'Legal / Institutional Legitimacy', weight: 15, description: 'Registration, constitution, tax compliance, operating license' },
      { id: 'crit-2', name: 'Technical Capacity', weight: 15, description: 'Subject expertise, staffing, implementation methodology' },
      { id: 'crit-3', name: 'Programme Alignment', weight: 20, description: 'Synergy with BCF-SL strategic pillars, beneficiaries & SDGs' },
      { id: 'crit-4', name: 'Financial Capacity & Controls', weight: 15, description: 'Financial statements, audit opinions, internal controls' },
      { id: 'crit-5', name: 'Governance & Accountability', weight: 10, description: 'Board oversight, leadership transparency, reporting records' },
      { id: 'crit-6', name: 'Safeguarding & Ethics', weight: 10, description: 'Child protection, GBV prevention, anti-fraud, code of conduct' },
      { id: 'crit-7', name: 'Geographic / Community Reach', weight: 5, description: 'Footprint in targeted Sierra Leone chiefdoms and districts' },
      { id: 'crit-8', name: 'Previous Performance', weight: 5, description: 'Track record with peer donors, government, or development partners' },
      { id: 'crit-9', name: 'Innovation / Value Addition', weight: 5, description: 'Technology, cost sharing, in-kind resources, scaling potential' }
    ],

    DECISION_THRESHOLDS: {
      STRONG: 80,             // 80–100: Strong Partner
      SUITABLE: 65,           // 65–79: Suitable
      CONDITIONAL: 50         // 50–64: Suitable with Conditions (Below 50: Not Recommended)
    },

    PARTNERSHIP_OFFICERS: [
      'Mohamed Bangura (Partnerships Manager)',
      'Aminata Turay (Finance & Grants Director)',
      'Mariama J. Bundu (Education Alliances Officer)',
      'Joseph Conteh (Procurement & Contracts Officer)',
      'Dr. Sorie Sesay (Executive Director / CEO)'
    ]
  };

  // ─────────────────────────────────────────────────────────────
  //  SEED DATA — Default Suppliers
  // ─────────────────────────────────────────────────────────────
  const DEFAULT_SUPPLIERS = [
    {
      id: 'BCF-SUP-2026-0001',
      name: 'ABC General Supplies Ltd',
      tradingName: 'ABC Supplies',
      contactPerson: 'Mohamed S. Koroma',
      phone: '+23278242826',
      email: 'sales@abcsupplies-sl.com',
      address: '14 Siaka Stevens Street, Freetown',
      district: 'Western Area Urban',
      country: 'Sierra Leone',
      registrationNo: 'SL-BUS-2019-08421',
      taxId: 'NRA-TIN-001923845',
      categories: ['Office Supplies', 'Furniture & Fittings', 'IT Equipment & Technology'],
      bankName: 'Sierra Leone Commercial Bank',
      bankAccount: '003002817634',
      status: 'Active',
      complianceStatus: 'Compliant',
      rating: 4.2,
      totalOrders: 2,
      totalSpend: 185200,
      registeredDate: '2024-03-15',
      lastOrderDate: '2026-10-05'
    },
    {
      id: 'BCF-SUP-2026-0002',
      name: 'Sierra Agro Traders',
      tradingName: 'Sierra Agro',
      contactPerson: 'Isatu M. Kamara',
      phone: '+232 78 331 204',
      email: 'info@sierraagro.sl',
      address: '22 Lumley Road, Aberdeen, Freetown',
      district: 'Western Area Urban',
      country: 'Sierra Leone',
      registrationNo: 'SL-BUS-2020-11234',
      taxId: 'NRA-TIN-003847291',
      categories: ['School Feeding Supplies', 'Field Operations Supplies'],
      bankName: 'Rokel Commercial Bank',
      bankAccount: '002009834521',
      status: 'Active',
      complianceStatus: 'Compliant',
      rating: 4.5,
      totalOrders: 2,
      totalSpend: 420000,
      registeredDate: '2023-08-01',
      lastOrderDate: '2026-09-28'
    },
    {
      id: 'BCF-SUP-2026-0003',
      name: 'Bo Medical & Health Supplies',
      tradingName: 'Bo Health Supplies',
      contactPerson: 'Dr. Samuel K. Gbla',
      phone: '+232 76 889 443',
      email: 'procurement@bohealth.sl',
      address: '5 Bojon Street, Bo City',
      district: 'Bo',
      country: 'Sierra Leone',
      registrationNo: 'SL-BUS-2021-05678',
      taxId: 'NRA-TIN-005619283',
      categories: ['Medical & Health Supplies', 'WASH Equipment'],
      bankName: 'United Bank for Africa (UBA)',
      bankAccount: '004012394812',
      status: 'Active',
      complianceStatus: 'Compliant',
      rating: 4.0,
      totalOrders: 2,
      totalSpend: 160000,
      registeredDate: '2024-06-20',
      lastOrderDate: '2026-08-12'
    },
    {
      id: 'BCF-SUP-2026-0004',
      name: 'Freetown Tech Solutions',
      tradingName: 'FTS',
      contactPerson: 'Alusine B. Kargbo',
      phone: '+232 77 556 789',
      email: 'info@fts-sl.com',
      address: '7 Wilberforce Street, Freetown',
      district: 'Western Area Urban',
      country: 'Sierra Leone',
      registrationNo: 'SL-BUS-2022-09182',
      taxId: 'NRA-TIN-008234561',
      categories: ['IT Equipment & Technology', 'Communication & Outreach'],
      bankName: 'Standard Chartered SL',
      bankAccount: '001088274532',
      status: 'Active',
      complianceStatus: 'Under Review',
      rating: 3.8,
      totalOrders: 1,
      totalSpend: 85000,
      registeredDate: '2025-01-10',
      lastOrderDate: '2026-07-22'
    },
    {
      id: 'BCF-SUP-2026-0005',
      name: 'National Construction Company',
      tradingName: 'NCC Sierra Leone',
      contactPerson: 'Abu Bakarr Jalloh',
      phone: '+232 88 112 334',
      email: 'projects@ncc-sl.com',
      address: '3 Kissy Road, Freetown',
      district: 'Western Area Urban',
      country: 'Sierra Leone',
      registrationNo: 'SL-BUS-2018-03412',
      taxId: 'NRA-TIN-002819347',
      categories: ['Construction & Renovation', 'WASH Equipment'],
      bankName: 'Sierra Leone Commercial Bank',
      bankAccount: '003005123456',
      status: 'Active',
      complianceStatus: 'Compliant',
      rating: 4.1,
      totalOrders: 1,
      totalSpend: 320000,
      registeredDate: '2022-11-05',
      lastOrderDate: '2026-06-30'
    },
    {
      id: 'BCF-SUP-2026-0006',
      name: 'Kenema Training Services',
      tradingName: 'KTS',
      contactPerson: 'Hawa Jalloh',
      phone: '+232 76 667 891',
      email: 'training@kts-sl.com',
      address: '18 Combema Road, Kenema',
      district: 'Kenema',
      country: 'Sierra Leone',
      registrationNo: 'SL-BUS-2023-07891',
      taxId: 'NRA-TIN-009182736',
      categories: ['Training & Development', 'Consultancy Services'],
      bankName: 'Rokel Commercial Bank',
      bankAccount: '002015678943',
      status: 'Active',
      complianceStatus: 'Compliant',
      rating: 4.3,
      totalOrders: 1,
      totalSpend: 45000,
      registeredDate: '2025-04-18',
      lastOrderDate: '2026-08-25'
    },
    {
      id: 'BCF-SUP-2026-0026',
      name: 'Alisha Enterprise SL',
      tradingName: 'Alisha Enterprise',
      contactPerson: 'Alisha Kamara',
      phone: '+23278242826',
      email: 'sales@alishaenterprise-sl.com',
      address: '28 Wilkinson Road, Freetown',
      district: 'Western Area Urban',
      country: 'Sierra Leone',
      registrationNo: 'SL-BUS-2022-09412',
      taxId: 'NRA-TIN-009182734',
      categories: ['Education Materials', 'Office Supplies', 'General Goods & Services'],
      bankName: 'Sierra Leone Commercial Bank',
      bankAccount: '003001928374',
      status: 'Active',
      complianceStatus: 'Compliant',
      rating: 4.8,
      totalOrders: 1,
      totalSpend: 12500,
      registeredDate: '2024-01-10',
      lastOrderDate: '2026-10-05'
    }
  ];

  // ─────────────────────────────────────────────────────────────
  //  SEED DATA — Default Programmes
  // ─────────────────────────────────────────────────────────────
  const DEFAULT_PROGRAMMES = [
    {
      id: 'BCF-PRG-001',
      name: 'School Feeding Programme',
      shortName: 'SFP',
      description: 'Providing nutritious school meals to vulnerable children across Sierra Leone',
      status: 'Active',
      startDate: '2024-01-01',
      endDate: '2027-12-31',
      districts: ['Bo', 'Kenema', 'Kailahun', 'Pujehun'],
      department: 'Programs Department',
      manager: 'Mohamed Bangura',
      managerId: 'BCF-SL-1012',
      totalBudget: 2500000,
      spentToDate: 1450000,
      beneficiaries: 45000
    },
    {
      id: 'BCF-PRG-002',
      name: 'WASH in Schools Project',
      shortName: 'WASH',
      description: 'Water, Sanitation and Hygiene facilities in rural schools',
      status: 'Active',
      startDate: '2025-03-01',
      endDate: '2027-06-30',
      districts: ['Moyamba', 'Bonthe', 'Pujehun'],
      department: 'Programs Department',
      manager: 'Mariama Kamara',
      managerId: 'BCF-SL-1048',
      totalBudget: 1200000,
      spentToDate: 380000,
      beneficiaries: 12000
    },
    {
      id: 'BCF-PRG-003',
      name: 'Community Health Outreach',
      shortName: 'CHO',
      description: 'Primary healthcare delivery and community health education',
      status: 'Active',
      startDate: '2025-01-01',
      endDate: '2026-12-31',
      districts: ['Kono', 'Kailahun', 'Kenema'],
      department: 'Health & Safety Department',
      manager: 'Ibrahim Kargbo',
      managerId: 'BCF-SL-1003',
      totalBudget: 800000,
      spentToDate: 520000,
      beneficiaries: 28000
    },
    {
      id: 'BCF-PRG-004',
      name: 'Girls Education & Empowerment',
      shortName: 'GEE',
      description: 'Supporting girls education, scholarships, and livelihood skills',
      status: 'Active',
      startDate: '2024-06-01',
      endDate: '2027-05-31',
      districts: ['Port Loko', 'Kambia', 'Bombali'],
      department: 'Programs Department',
      manager: 'Mariama J. Bundu',
      managerId: 'BCF-EMP-2026-0007',
      totalBudget: 950000,
      spentToDate: 310000,
      beneficiaries: 8500
    },
    {
      id: 'BCF-PRG-005',
      name: 'Institutional Capacity Building',
      shortName: 'ICB',
      description: 'Internal capacity development, staff training, and systems strengthening',
      status: 'Active',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      districts: ['Western Area Urban'],
      department: 'Human Resources Management Department',
      manager: 'Dr. Sorie Sesay',
      managerId: 'BCF-SL-1002',
      totalBudget: 350000,
      spentToDate: 85000,
      beneficiaries: 142
    }
  ];

  // ─────────────────────────────────────────────────────────────
  //  SEED DATA — Default Donors & Grants
  // ─────────────────────────────────────────────────────────────
  const DEFAULT_DONORS = [
    {
      id: 'BCF-DNR-001',
      name: 'UNICEF Sierra Leone',
      type: 'Multilateral',
      contactPerson: 'Sarah Johnson',
      email: 'sjohnson@unicef.org',
      phone: '+232 22 234 567',
      country: 'International',
      status: 'Active',
      totalFunding: 1800000,
      disbursedToDate: 1200000
    },
    {
      id: 'BCF-DNR-002',
      name: 'Irish Aid',
      type: 'Bilateral',
      contactPerson: 'Patrick O\'Brien',
      email: 'pobrien@irishaid.ie',
      phone: '+232 22 234 890',
      country: 'Ireland',
      status: 'Active',
      totalFunding: 950000,
      disbursedToDate: 650000
    },
    {
      id: 'BCF-DNR-003',
      name: 'World Food Programme',
      type: 'Multilateral',
      contactPerson: 'Amina Diallo',
      email: 'amina.diallo@wfp.org',
      phone: '+232 22 235 100',
      country: 'International',
      status: 'Active',
      totalFunding: 2200000,
      disbursedToDate: 1600000
    },
    {
      id: 'BCF-DNR-004',
      name: 'Global Fund for Education',
      type: 'Foundation',
      contactPerson: 'James Chen',
      email: 'jchen@gfe.org',
      phone: '+1 212 555 0191',
      country: 'United States',
      status: 'Active',
      totalFunding: 500000,
      disbursedToDate: 250000
    }
  ];

  const DEFAULT_GRANTS = [
    {
      id: 'BCF-GRT-2025-001',
      donorId: 'BCF-DNR-001',
      donorName: 'UNICEF Sierra Leone',
      projectName: 'WASH in Schools Project',
      programmeId: 'BCF-PRG-002',
      grantAmount: 1200000,
      disbursed: 380000,
      startDate: '2025-03-01',
      endDate: '2027-06-30',
      status: 'Active',
      reportingFrequency: 'Quarterly',
      budgetLines: [
        { id: 'BL-001', name: 'WASH Construction', allocated: 600000, spent: 180000 },
        { id: 'BL-002', name: 'WASH Equipment', allocated: 350000, spent: 120000 },
        { id: 'BL-003', name: 'Training & Community Engagement', allocated: 150000, spent: 50000 },
        { id: 'BL-004', name: 'Monitoring & Evaluation', allocated: 100000, spent: 30000 }
      ]
    },
    {
      id: 'BCF-GRT-2024-002',
      donorId: 'BCF-DNR-003',
      donorName: 'World Food Programme',
      projectName: 'School Feeding Programme',
      programmeId: 'BCF-PRG-001',
      grantAmount: 2000000,
      disbursed: 1200000,
      startDate: '2024-01-01',
      endDate: '2027-12-31',
      status: 'Active',
      reportingFrequency: 'Monthly',
      budgetLines: [
        { id: 'BL-005', name: 'Food Procurement', allocated: 1200000, spent: 750000 },
        { id: 'BL-006', name: 'Logistics & Distribution', allocated: 400000, spent: 250000 },
        { id: 'BL-007', name: 'Kitchen Equipment', allocated: 200000, spent: 100000 },
        { id: 'BL-008', name: 'Personnel & Admin', allocated: 200000, spent: 100000 }
      ]
    },
    {
      id: 'BCF-GRT-2025-003',
      donorId: 'BCF-DNR-002',
      donorName: 'Irish Aid',
      projectName: 'Community Health Outreach',
      programmeId: 'BCF-PRG-003',
      grantAmount: 800000,
      disbursed: 520000,
      startDate: '2025-01-01',
      endDate: '2026-12-31',
      status: 'Active',
      reportingFrequency: 'Quarterly',
      budgetLines: [
        { id: 'BL-009', name: 'Medical Supplies', allocated: 350000, spent: 220000 },
        { id: 'BL-010', name: 'Outreach Activities', allocated: 250000, spent: 180000 },
        { id: 'BL-011', name: 'Staff & Transport', allocated: 200000, spent: 120000 }
      ]
    },
    {
      id: 'BCF-GRT-2024-004',
      donorId: 'BCF-DNR-004',
      donorName: 'Global Fund for Education',
      projectName: 'Girls Education & Empowerment',
      programmeId: 'BCF-PRG-004',
      grantAmount: 500000,
      disbursed: 250000,
      startDate: '2024-06-01',
      endDate: '2027-05-31',
      status: 'Active',
      reportingFrequency: 'Semi-Annual',
      budgetLines: [
        { id: 'BL-012', name: 'Scholarships & Fees', allocated: 200000, spent: 100000 },
        { id: 'BL-013', name: 'Learning Materials', allocated: 150000, spent: 80000 },
        { id: 'BL-014', name: 'Livelihood Training', allocated: 100000, spent: 50000 },
        { id: 'BL-015', name: 'M&E', allocated: 50000, spent: 20000 }
      ]
    }
  ];

  // ─────────────────────────────────────────────────────────────
  //  SEED DATA — Sample Purchase Requisitions
  // ─────────────────────────────────────────────────────────────
  const DEFAULT_REQUISITIONS = [
    {
      id: 'BCF-PR-2026-0001',
      txnId: 'BCF-TXN-2026-000001',
      title: 'Rice Supply for School Feeding – Bo District',
      description: 'Procurement of 500 bags of 50kg rice for Q4 school feeding programme delivery',
      programmeId: 'BCF-PRG-001',
      programmeName: 'School Feeding Programme',
      donorId: 'BCF-DNR-003',
      donorName: 'World Food Programme',
      grantId: 'BCF-GRT-2024-002',
      budgetLineId: 'BL-005',
      budgetLineName: 'Food Procurement',
      category: 'School Feeding Supplies',
      itemType: 'Goods',
      department: 'Programs Department',
      requestedBy: 'Mohamed Bangura',
      requestedById: 'BCF-SL-1012',
      deliveryLocation: 'Bo District Office',
      requiredDate: '2026-11-15',
      items: [
        { description: 'Long Grain Rice (50kg bags)', quantity: 500, unit: 'Bags', estimatedUnitPrice: 350, estimatedTotal: 175000 }
      ],
      estimatedTotal: 175000,
      status: 'Approved',
      priority: 'High',
      procurementMethod: 'Request for Quotation (RFQ)',
      createdDate: '2026-09-20',
      approvedDate: '2026-09-22',
      approvedBy: 'Aminata Turay',
      budgetCheckStatus: 'Within Budget',
      notes: 'Urgent delivery required before school term resumes'
    },
    {
      id: 'BCF-PR-2026-0002',
      txnId: 'BCF-TXN-2026-000002',
      title: 'Laptops for ICT Department',
      description: 'Procurement of 10 laptops for staff in IT and Programme departments',
      programmeId: 'BCF-PRG-005',
      programmeName: 'Institutional Capacity Building',
      donorId: 'BCF-DNR-002',
      donorName: 'Irish Aid',
      grantId: 'BCF-GRT-2025-003',
      budgetLineId: 'BL-011',
      budgetLineName: 'Staff & Transport',
      category: 'IT Equipment & Technology',
      itemType: 'Goods',
      department: 'Information Technology (IT) Department',
      requestedBy: 'Joseph Conteh',
      requestedById: 'BCF-SL-1019',
      deliveryLocation: 'BCF Head Office, Freetown',
      requiredDate: '2026-11-30',
      items: [
        { description: 'Dell Latitude 5540 Laptop', quantity: 10, unit: 'Units', estimatedUnitPrice: 8500, estimatedTotal: 85000 }
      ],
      estimatedTotal: 85000,
      status: 'Pending Budget Check',
      priority: 'Medium',
      procurementMethod: 'Request for Quotation (RFQ)',
      createdDate: '2026-10-01',
      approvedDate: null,
      approvedBy: null,
      budgetCheckStatus: 'Pending',
      notes: 'Capital asset procurement – will create asset records on receipt'
    },
    {
      id: 'BCF-PR-2026-0003',
      txnId: 'BCF-TXN-2026-000003',
      title: 'WASH Construction Materials – Moyamba',
      description: 'Building materials for 5 school latrines in Moyamba District',
      programmeId: 'BCF-PRG-002',
      programmeName: 'WASH in Schools Project',
      donorId: 'BCF-DNR-001',
      donorName: 'UNICEF Sierra Leone',
      grantId: 'BCF-GRT-2025-001',
      budgetLineId: 'BL-001',
      budgetLineName: 'WASH Construction',
      category: 'Construction & Renovation',
      itemType: 'Works',
      department: 'Programs Department',
      requestedBy: 'Mariama Kamara',
      requestedById: 'BCF-SL-1048',
      deliveryLocation: 'Moyamba District Office',
      requiredDate: '2026-12-15',
      items: [
        { description: 'Cement (50kg bags)', quantity: 200, unit: 'Bags', estimatedUnitPrice: 180, estimatedTotal: 36000 },
        { description: 'Iron Rods (12mm, 12m)', quantity: 150, unit: 'Pieces', estimatedUnitPrice: 250, estimatedTotal: 37500 },
        { description: 'Zinc Sheets (0.4mm)', quantity: 100, unit: 'Sheets', estimatedUnitPrice: 350, estimatedTotal: 35000 },
        { description: 'Sand (cubic metres)', quantity: 30, unit: 'Cu.m', estimatedUnitPrice: 800, estimatedTotal: 24000 },
        { description: 'Gravel (cubic metres)', quantity: 20, unit: 'Cu.m', estimatedUnitPrice: 950, estimatedTotal: 19000 }
      ],
      estimatedTotal: 151500,
      status: 'Draft',
      priority: 'Medium',
      procurementMethod: 'Request for Quotation (RFQ)',
      createdDate: '2026-10-03',
      approvedDate: null,
      approvedBy: null,
      budgetCheckStatus: 'Not Checked',
      notes: ''
    }
  ];

  // ─────────────────────────────────────────────────────────────
  //  SEED DATA — Default RFQs, POs, GRNs, Invoices (Master TXN Chain)
  // ─────────────────────────────────────────────────────────────
  const DEFAULT_RFQS = [
    {
      id: 'BCF-RFQ-2026-0001',
      txnId: 'BCF-TXN-2026-000001',
      prId: 'BCF-PR-2026-0001',
      title: 'RFQ for Long Grain Rice Supply (500 Bags) – Bo District',
      issueDate: '2026-09-24',
      closingDate: '2026-10-05',
      category: 'School Feeding Supplies',
      department: 'Procurement Department',
      invitedSuppliers: [
        { supplierId: 'BCF-SUP-2026-0001', supplierName: 'ABC General Supplies Ltd', quotedAmount: 175000, submissionDate: '2026-09-28', status: 'Shortlisted - Recommended', score: 94 },
        { supplierId: 'BCF-SUP-2026-0002', supplierName: 'Bo Trading Company', quotedAmount: 182000, submissionDate: '2026-09-29', status: 'Evaluated', score: 86 }
      ],
      awardedSupplierId: 'BCF-SUP-2026-0001',
      awardedSupplierName: 'ABC General Supplies Ltd',
      awardedAmount: 175000,
      evaluationSummary: 'ABC General Supplies Ltd submitted the lowest responsive quote meeting all quality and delivery timeline requirements.',
      status: 'Awarded'
    }
  ];

  const DEFAULT_POS = [
    {
      id: 'BCF-PO-2026-0001',
      txnId: 'BCF-TXN-2026-000001',
      prId: 'BCF-PR-2026-0001',
      rfqId: 'BCF-RFQ-2026-0001',
      poNumber: 'PO-2026-0042',
      supplierId: 'BCF-SUP-2026-0001',
      supplierName: 'ABC General Supplies Ltd',
      supplierAddress: '14 Siaka Stevens Street, Freetown',
      supplierContact: 'Mohamed S. Koroma (+23278242826)',
      programmeId: 'BCF-PRG-001',
      programmeName: 'School Feeding Programme',
      donorId: 'BCF-DNR-003',
      donorName: 'World Food Programme',
      grantId: 'BCF-GRT-2024-002',
      budgetLineId: 'BL-005',
      budgetLineName: 'Food Procurement',
      items: [
        { description: 'Long Grain Rice (50kg bags)', quantity: 500, unit: 'Bags', unitPrice: 350, total: 175000 }
      ],
      subtotal: 175000,
      taxAmount: 0,
      totalAmount: 175000,
      paymentTerms: '30 Days Net from GRN Verification',
      deliveryLocation: 'Bo District Office Warehouse (WH-BO-01)',
      deliveryDeadline: '2026-11-15',
      issuedDate: '2026-10-02',
      issuedBy: 'Joseph Conteh (Procurement Officer)',
      authorizedBy: 'Aminata Turay (Finance Director)',
      status: 'Issued'
    },
    {
      id: 'BCF-PO-2026-0002',
      txnId: 'BCF-TXN-2026-000002',
      prId: 'BCF-PR-2026-0002',
      rfqId: 'BCF-RFQ-2026-0002',
      poNumber: 'PO-2026-0015',
      supplierId: 'BCF-SUP-2026-0001',
      supplierName: 'ABC General Supplies Ltd',
      supplierAddress: '14 Siaka Stevens Street, Freetown',
      supplierContact: 'Mohamed S. Koroma (+23278242826)',
      programmeId: 'BCF-PRG-002',
      programmeName: 'Provision of School Materials',
      donorId: 'BCF-DNR-001',
      donorName: 'Global Fund for Children',
      grantId: 'BCF-GRT-2024-001',
      budgetLineId: 'BL-001',
      budgetLineName: 'Education Supplies',
      items: [
        { description: 'Classroom Exercise Books & Stationery Sets', quantity: 200, unit: 'Sets', unitPrice: 51, total: 10200 }
      ],
      subtotal: 10200,
      taxAmount: 0,
      totalAmount: 10200,
      paymentTerms: '30 Days Net from GRN Verification',
      deliveryLocation: 'Central Freetown Warehouse (WH-FT-01)',
      deliveryDeadline: '2026-10-25',
      issuedDate: '2026-10-05',
      issuedBy: 'Joseph Conteh (Procurement Officer)',
      authorizedBy: 'Aminata Turay (Finance Director)',
      status: 'Issued'
    },
    {
      id: 'BCF-PO-2026-0003',
      txnId: 'BCF-TXN-2026-000003',
      prId: 'BCF-PR-2026-0003',
      rfqId: 'BCF-RFQ-2026-0003',
      poNumber: 'PO-2026-0038',
      supplierId: 'BCF-SUP-2026-0002',
      supplierName: 'Sierra Agro Traders',
      supplierAddress: '22 Lumley Road, Aberdeen, Freetown',
      supplierContact: 'Isatu M. Kamara (+232 78 331 204)',
      programmeId: 'BCF-PRG-001',
      programmeName: 'School Feeding Programme',
      donorId: 'BCF-DNR-003',
      donorName: 'World Food Programme',
      grantId: 'BCF-GRT-2024-002',
      budgetLineId: 'BL-005',
      budgetLineName: 'Food Procurement',
      items: [
        { description: 'Certified Seedlings & Farm Inputs Pack', quantity: 800, unit: 'Packs', unitPrice: 300, total: 240000 }
      ],
      subtotal: 240000,
      taxAmount: 0,
      totalAmount: 240000,
      paymentTerms: '30 Days Net',
      deliveryLocation: 'Bo District Distribution Center',
      deliveryDeadline: '2026-10-18',
      issuedDate: '2026-09-28',
      issuedBy: 'Joseph Conteh (Procurement Officer)',
      authorizedBy: 'Aminata Turay (Finance Director)',
      status: 'Issued'
    },
    {
      id: 'BCF-PO-2026-0004',
      txnId: 'BCF-TXN-2026-000004',
      prId: 'BCF-PR-2026-0004',
      rfqId: 'BCF-RFQ-2026-0004',
      poNumber: 'PO-2026-0029',
      supplierId: 'BCF-SUP-2026-0002',
      supplierName: 'Sierra Agro Traders',
      supplierAddress: '22 Lumley Road, Aberdeen, Freetown',
      supplierContact: 'Isatu M. Kamara (+232 78 331 204)',
      programmeId: 'BCF-PRG-001',
      programmeName: 'School Feeding Programme',
      donorId: 'BCF-DNR-003',
      donorName: 'World Food Programme',
      grantId: 'BCF-GRT-2024-002',
      budgetLineId: 'BL-005',
      budgetLineName: 'Food Procurement',
      items: [
        { description: 'Farming Implements & Processing Units', quantity: 150, unit: 'Units', unitPrice: 1200, total: 180000 }
      ],
      subtotal: 180000,
      taxAmount: 0,
      totalAmount: 180000,
      paymentTerms: '30 Days Net',
      deliveryLocation: 'Kenema Regional Hub',
      deliveryDeadline: '2026-09-30',
      issuedDate: '2026-09-15',
      issuedBy: 'Joseph Conteh (Procurement Officer)',
      authorizedBy: 'Aminata Turay (Finance Director)',
      status: 'Issued'
    },
    {
      id: 'BCF-PO-2026-0005',
      txnId: 'BCF-TXN-2026-000005',
      prId: 'BCF-PR-2026-0005',
      rfqId: 'BCF-RFQ-2026-0005',
      poNumber: 'PO-2026-0033',
      supplierId: 'BCF-SUP-2026-0003',
      supplierName: 'Bo Medical & Health Supplies',
      supplierAddress: '5 Bojon Street, Bo City',
      supplierContact: 'Dr. Samuel K. Gbla (+232 76 889 443)',
      programmeId: 'BCF-PRG-004',
      programmeName: 'Emergency Community Relief',
      donorId: 'BCF-DNR-002',
      donorName: 'Irish Aid',
      grantId: 'BCF-GRT-2024-003',
      budgetLineId: 'BL-009',
      budgetLineName: 'Medical Emergency Supplies',
      items: [
        { description: 'Community Clinic First Aid & Primary Care Kits', quantity: 190, unit: 'Kits', unitPrice: 500, total: 95000 }
      ],
      subtotal: 95000,
      taxAmount: 0,
      totalAmount: 95000,
      paymentTerms: '15 Days Net',
      deliveryLocation: 'Bo District Hospital Depot',
      deliveryDeadline: '2026-08-30',
      issuedDate: '2026-08-12',
      issuedBy: 'Joseph Conteh (Procurement Officer)',
      authorizedBy: 'Aminata Turay (Finance Director)',
      status: 'Issued'
    },
    {
      id: 'BCF-PO-2026-0006',
      txnId: 'BCF-TXN-2026-000006',
      prId: 'BCF-PR-2026-0006',
      rfqId: 'BCF-RFQ-2026-0006',
      poNumber: 'PO-2026-0021',
      supplierId: 'BCF-SUP-2026-0003',
      supplierName: 'Bo Medical & Health Supplies',
      supplierAddress: '5 Bojon Street, Bo City',
      supplierContact: 'Dr. Samuel K. Gbla (+232 76 889 443)',
      programmeId: 'BCF-PRG-004',
      programmeName: 'Emergency Community Relief',
      donorId: 'BCF-DNR-002',
      donorName: 'Irish Aid',
      grantId: 'BCF-GRT-2024-003',
      budgetLineId: 'BL-009',
      budgetLineName: 'Medical Emergency Supplies',
      items: [
        { description: 'Water Purification Tablets & Dispensers', quantity: 260, unit: 'Packs', unitPrice: 250, total: 65000 }
      ],
      subtotal: 65000,
      taxAmount: 0,
      totalAmount: 65000,
      paymentTerms: '15 Days Net',
      deliveryLocation: 'Kailahun Field Store',
      deliveryDeadline: '2026-07-28',
      issuedDate: '2026-07-10',
      issuedBy: 'Joseph Conteh (Procurement Officer)',
      authorizedBy: 'Aminata Turay (Finance Director)',
      status: 'Issued'
    },
    {
      id: 'BCF-PO-2026-0007',
      txnId: 'BCF-TXN-2026-000007',
      prId: 'BCF-PR-2026-0007',
      rfqId: 'BCF-RFQ-2026-0007',
      poNumber: 'PO-2026-0025',
      supplierId: 'BCF-SUP-2026-0004',
      supplierName: 'Freetown Tech Solutions',
      supplierAddress: '7 Wilberforce Street, Freetown',
      supplierContact: 'Alusine B. Kargbo (+232 77 556 789)',
      programmeId: 'BCF-PRG-003',
      programmeName: 'Youth Digital Skills Academy',
      donorId: 'BCF-DNR-004',
      donorName: 'European Union Delegation',
      grantId: 'BCF-GRT-2024-004',
      budgetLineId: 'BL-011',
      budgetLineName: 'ICT Equipment & Hardware',
      items: [
        { description: 'Refurbished Training Laptops & Routers', quantity: 17, unit: 'Units', unitPrice: 5000, total: 85000 }
      ],
      subtotal: 85000,
      taxAmount: 0,
      totalAmount: 85000,
      paymentTerms: '30 Days Net',
      deliveryLocation: 'Freetown Innovation Lab',
      deliveryDeadline: '2026-08-05',
      issuedDate: '2026-07-22',
      issuedBy: 'Joseph Conteh (Procurement Officer)',
      authorizedBy: 'Aminata Turay (Finance Director)',
      status: 'Issued'
    },
    {
      id: 'BCF-PO-2026-0008',
      txnId: 'BCF-TXN-2026-000008',
      prId: 'BCF-PR-2026-0008',
      rfqId: 'BCF-RFQ-2026-0008',
      poNumber: 'PO-2026-0018',
      supplierId: 'BCF-SUP-2026-0005',
      supplierName: 'National Construction Company',
      supplierAddress: '3 Kissy Road, Freetown',
      supplierContact: 'Abu Bakarr Jalloh (+232 88 112 334)',
      programmeId: 'BCF-PRG-002',
      programmeName: 'Provision of School Materials',
      donorId: 'BCF-DNR-001',
      donorName: 'Global Fund for Children',
      grantId: 'BCF-GRT-2024-001',
      budgetLineId: 'BL-003',
      budgetLineName: 'Classroom Infrastructure Rehabilitation',
      items: [
        { description: 'School Roofing & Latrine Block Renovation Materials', quantity: 1, unit: 'Lot', unitPrice: 320000, total: 320000 }
      ],
      subtotal: 320000,
      taxAmount: 0,
      totalAmount: 320000,
      paymentTerms: 'Milestone Completion',
      deliveryLocation: 'Moyamba Community Primary School',
      deliveryDeadline: '2026-07-15',
      issuedDate: '2026-06-30',
      issuedBy: 'Joseph Conteh (Procurement Officer)',
      authorizedBy: 'Aminata Turay (Finance Director)',
      status: 'Issued'
    },
    {
      id: 'BCF-PO-2026-0009',
      txnId: 'BCF-TXN-2026-000009',
      prId: 'BCF-PR-2026-0009',
      rfqId: 'BCF-RFQ-2026-0009',
      poNumber: 'PO-2026-0012',
      supplierId: 'BCF-SUP-2026-0006',
      supplierName: 'Kenema Training Services',
      supplierAddress: '18 Combema Road, Kenema',
      supplierContact: 'Hawa Jalloh (+232 76 667 891)',
      programmeId: 'BCF-PRG-003',
      programmeName: 'Youth Digital Skills Academy',
      donorId: 'BCF-DNR-004',
      donorName: 'European Union Delegation',
      grantId: 'BCF-GRT-2024-004',
      budgetLineId: 'BL-012',
      budgetLineName: 'Training Facilitation & Logistics',
      items: [
        { description: 'Capacity Building & Trainer Training Packages', quantity: 1, unit: 'Package', unitPrice: 45000, total: 45000 }
      ],
      subtotal: 45000,
      taxAmount: 0,
      totalAmount: 45000,
      paymentTerms: 'Immediate upon delivery',
      deliveryLocation: 'Kenema Vocational Center',
      deliveryDeadline: '2026-08-30',
      issuedDate: '2026-08-25',
      issuedBy: 'Joseph Conteh (Procurement Officer)',
      authorizedBy: 'Aminata Turay (Finance Director)',
      status: 'Issued'
    },
    {
      id: 'BCF-PO-2026-0026',
      txnId: 'BCF-TXN-2026-000026',
      prId: 'BCF-PR-2026-0026',
      rfqId: 'BCF-RFQ-2026-0026',
      poNumber: 'PO-2026-0026',
      supplierId: 'BCF-SUP-2026-0026',
      supplierName: 'Alisha Enterprise SL',
      supplierEmail: 'sales@alishaenterprise-sl.com',
      supplierContact: 'Alisha Kamara (+23278242826)',
      programmeId: 'BCF-PRG-001',
      programmeName: 'Education Support Programme',
      donorId: 'BCF-DNR-001',
      donorName: 'USAID Sierra Leone',
      grantId: 'BCF-GRT-2024-001',
      budgetLineId: 'BL-001',
      budgetLineName: 'Teaching & Learning Materials',
      items: [
        { description: 'Umbrella', quantity: 50, unit: 'Carton', unitPrice: 125, total: 6250 },
        { description: 'Books', quantity: 50, unit: 'Carton', unitPrice: 125, total: 6250 }
      ],
      subtotal: 12500,
      taxAmount: 0,
      totalAmount: 12500,
      paymentTerms: 'Net 30 Days after GRN inspection',
      deliveryLocation: 'BCF Central Warehouse, Freetown',
      deliveryDeadline: '2026-10-15',
      issuedDate: '2026-10-01',
      issuedBy: 'Joseph Conteh (Procurement Officer)',
      authorizedBy: 'Aminata Turay (Finance Director)',
      status: 'Issued'
    }
  ];

  const DEFAULT_GRNS = [
    {
      id: 'BCF-GRN-2026-0001',
      txnId: 'BCF-TXN-2026-000001',
      poId: 'BCF-PO-2026-0001',
      prId: 'BCF-PR-2026-0001',
      grnNumber: 'GRN-2026-0019',
      supplierId: 'BCF-SUP-2026-0001',
      supplierName: 'ABC General Supplies Ltd',
      deliveryDate: '2026-10-04',
      deliveryNoteNo: 'DN-SLA-8821',
      receivedBy: 'Alie Koroma (Storekeeper, Bo District)',
      inspectedBy: 'Mohamed Bangura (Program Coordinator)',
      warehouseId: 'WH-BO-01',
      warehouseName: 'BCF Bo Regional Warehouse',
      itemsReceived: [
        { description: 'Long Grain Rice (50kg bags)', orderedQty: 500, receivedQty: 500, acceptedQty: 500, rejectedQty: 0, unit: 'Bags', condition: 'Excellent - Clean, sealed bags' }
      ],
      inspectionNotes: 'All 500 bags inspected at offloading. Clean, dry, no moisture damage. Moisture content test passed at 12.1%.',
      status: 'Verified & Accepted'
    }
  ];

  const DEFAULT_INVOICES = [
    {
      id: 'BCF-INV-2026-0001',
      txnId: 'BCF-TXN-2026-000001',
      poId: 'BCF-PO-2026-0001',
      grnId: 'BCF-GRN-2026-0001',
      invoiceNumber: 'INV-SLA-9021',
      supplierId: 'BCF-SUP-2026-0001',
      supplierName: 'ABC General Supplies Ltd',
      invoiceDate: '2026-10-04',
      dueDate: '2026-11-03',
      subtotal: 175000,
      taxWithholding: 8750, // 5% withholding tax per NRA
      netPayable: 166250,
      totalAmount: 175000,
      threeWayMatch: {
        poMatched: true,
        grnMatched: true,
        amountVariance: 0,
        quantityVariance: 0,
        status: 'Matched',
        matchedDate: '2026-10-04',
        verifiedBy: 'Finance Department Automated Engine'
      },
      paymentStatus: 'Approved for Payment',
      paymentReference: null,
      status: 'Verified'
    }
  ];

  // ─────────────────────────────────────────────────────────────
  //  STORAGE KEYS
  // ─────────────────────────────────────────────────────────────
  const KEYS = {
    SUPPLIERS:                 'bcf_master_suppliers',
    PROGRAMMES:                'bcf_master_programmes',
    DONORS:                    'bcf_master_donors',
    GRANTS:                    'bcf_master_grants',
    REQUISITIONS:              'bcf_txn_requisitions',
    RFQS:                      'bcf_txn_rfqs',
    PURCHASE_ORDERS:           'bcf_txn_purchase_orders',
    GRNS:                      'bcf_txn_grns',
    INVOICES:                  'bcf_txn_invoices',
    PAYMENTS:                  'bcf_txn_payments',
    COMMITMENTS:               'bcf_txn_commitments',
    AUDIT_TRAIL:               'bcf_txn_audit_trail',
    TXN_COUNTER:               'bcf_txn_counter',
    STAFF_REGISTRY:            'bcf_staff_registry',
    PARTNERS:                  'bcf_master_partners',
    PARTNERSHIP_AGREEMENTS:    'bcf_partnership_agreements',
    PARTNERSHIP_DELIVERABLES:  'bcf_partnership_deliverables',
    PARTNERSHIP_PIPELINE:      'bcf_partnership_pipeline',
    PARTNERSHIP_DUE_DILIGENCE: 'bcf_partnership_due_diligence',
    PARTNERSHIP_PROPOSALS:     'bcf_partnership_proposals',
    PARTNERSHIP_ACTIVITIES:    'bcf_partnership_activities',
    PARTNERSHIP_MEETINGS:      'bcf_partnership_meetings',
    PARTNERSHIP_COMMUNICATIONS:'bcf_partnership_communications',
    PARTNERSHIP_PERFORMANCE:   'bcf_partnership_performance',
    REL_COUNTER:               'bcf_rel_counter'
  };

  // ─────────────────────────────────────────────────────────────
  //  SAFE STORAGE & GENERIC CRUD HELPERS
  // ─────────────────────────────────────────────────────────────
  const _memoryStore = {};
  const _safeStorage = {
    getItem: function(k) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(k);
        }
      } catch (e) {}
      return _memoryStore[k] || null;
    },
    setItem: function(k, v) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(k, v);
        }
      } catch (e) {}
      _memoryStore[k] = String(v);
    },
    removeItem: function(k) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(k);
        }
      } catch (e) {}
      delete _memoryStore[k];
    }
  };

  function _load(key, defaults) {
    try {
      const data = JSON.parse(_safeStorage.getItem(key) || '[]');
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (e) { /* ignore parse errors */ }
    if (defaults && defaults.length > 0) {
      try {
        _safeStorage.setItem(key, JSON.stringify(defaults));
      } catch (e) { /* ignore storage error */ }
      return JSON.parse(JSON.stringify(defaults));
    }
    return [];
  }

  function _save(key, data) {
    try {
      _safeStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      const seen = new WeakSet();
      const safe = JSON.stringify(data, (k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return undefined;
          seen.add(v);
        }
        return v;
      });
      _safeStorage.setItem(key, safe);
    }
  }

  function _findById(key, id, defaults) {
    if (!id) return null;
    const list = _load(key, defaults);
    const search = String(id).trim().toLowerCase();
    return list.find(item => 
      (item.id && item.id.toLowerCase() === search) || 
      (item.name && item.name.toLowerCase() === search) ||
      (item.projectName && item.projectName.toLowerCase() === search) ||
      (item.shortName && item.shortName.toLowerCase() === search)
    ) || list.find(item => 
      (item.name && item.name.toLowerCase().includes(search)) ||
      (item.projectName && item.projectName.toLowerCase().includes(search))
    ) || null;
  }

  function _upsert(key, record, defaults) {
    const list = _load(key, defaults);
    const idx = list.findIndex(item => item.id === record.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record };
    } else {
      list.push(record);
    }
    _save(key, list);
    return record;
  }

  function _remove(key, id, defaults) {
    let list = _load(key, defaults);
    list = list.filter(item => item.id !== id);
    _save(key, list);
    return list;
  }

  // ─────────────────────────────────────────────────────────────
  //  TRANSACTION ID GENERATOR
  // ─────────────────────────────────────────────────────────────
  function _getCounter() {
    return parseInt(_safeStorage.getItem(KEYS.TXN_COUNTER) || '3', 10); // Start after seed data
  }

  function _incrementCounter() {
    const next = _getCounter() + 1;
    _safeStorage.setItem(KEYS.TXN_COUNTER, String(next));
    return next;
  }

  function generateTxnId(prefix) {
    const num = _incrementCounter();
    const yr = new Date().getFullYear();
    const padded = String(num).padStart(6, '0');
    return `${prefix || 'BCF-TXN'}-${yr}-${padded}`;
  }

  function generateId(prefix) {
    const num = _incrementCounter();
    const yr = new Date().getFullYear();
    const padded = String(num).padStart(4, '0');
    return `${prefix}-${yr}-${padded}`;
  }

  // ─────────────────────────────────────────────────────────────
  //  SUPPLIERS (Dynamic Spend & Orders Synchronized with POs)
  // ─────────────────────────────────────────────────────────────
  function enrichSupplierWithOrders(s, allPos) {
    if (!s) return s;
    const pos = allPos || getPurchaseOrders();
    const sId = (s.id || '').trim().toLowerCase();
    const sName = (s.name || '').trim().toLowerCase();
    const sTrading = (s.tradingName || '').trim().toLowerCase();

    const sPos = pos.filter(p => {
      const pSupId = (p.supplierId || '').trim().toLowerCase();
      const pSupName = (p.supplierName || '').trim().toLowerCase();
      if (sId && pSupId && pSupId === sId) return true;
      if (sName && pSupName && pSupName === sName) return true;
      if (sTrading && pSupName && pSupName === sTrading) return true;
      return false;
    });

    const totalSpend = sPos.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0);
    let lastOrderDate = s.lastOrderDate || null;
    if (sPos.length > 0) {
      const dates = sPos.map(p => p.issuedDate || p.createdDate).filter(Boolean).sort().reverse();
      if (dates.length > 0) lastOrderDate = dates[0];
    }

    return {
      ...s,
      totalOrders: sPos.length,
      totalSpend: totalSpend,
      lastOrderDate: lastOrderDate || s.lastOrderDate
    };
  }

  function syncSuppliersOrdersAndSpend() {
    const rawList = _load(KEYS.SUPPLIERS, DEFAULT_SUPPLIERS);
    const pos = getPurchaseOrders();
    let hasDiff = false;

    const enrichedList = rawList.map(s => {
      // Remove any circular .supplier reference
      if (s.supplier) {
        delete s.supplier;
        hasDiff = true;
      }
      // Ensure vendor email is their official address, never the foundation email
      if (s.email === 'bandamacharityfoundationsl@gmail.com') {
        s.email = 'sales@alishaenterprise-sl.com';
        hasDiff = true;
      }
      const enriched = enrichSupplierWithOrders(s, pos);
      delete enriched.supplier;
      if (s.totalSpend !== enriched.totalSpend || s.totalOrders !== enriched.totalOrders) {
        hasDiff = true;
      }
      return enriched;
    });

    if (hasDiff) {
      _save(KEYS.SUPPLIERS, enrichedList);
    }
    return enrichedList;
  }

  function getSuppliers() {
    return syncSuppliersOrdersAndSpend();
  }

  function getSupplier(id) {
    const s = _findById(KEYS.SUPPLIERS, id, DEFAULT_SUPPLIERS);
    if (!s) return null;
    return enrichSupplierWithOrders(s);
  }

  function getSupplierOrders(supplierId) {
    const s = _findById(KEYS.SUPPLIERS, supplierId, DEFAULT_SUPPLIERS);
    const pos = getPurchaseOrders();
    if (!s) {
      return pos.filter(p => p.supplierId && String(p.supplierId).trim().toLowerCase() === String(supplierId).trim().toLowerCase());
    }
    const sId = (s.id || '').trim().toLowerCase();
    const sName = (s.name || '').trim().toLowerCase();
    const sTrading = (s.tradingName || '').trim().toLowerCase();

    return pos.filter(p => {
      const pSupId = (p.supplierId || '').trim().toLowerCase();
      const pSupName = (p.supplierName || '').trim().toLowerCase();
      if (sId && pSupId && pSupId === sId) return true;
      if (sName && pSupName && pSupName === sName) return true;
      if (sTrading && pSupName && pSupName === sTrading) return true;
      return false;
    });
  }

  function getSupplierSpend(supplierId) {
    const orders = getSupplierOrders(supplierId);
    return orders.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0);
  }

  function saveSupplier(supplier) {
    if (!supplier) return null;
    if (supplier.supplier) delete supplier.supplier;
    if (!supplier.id) supplier.id = generateId('BCF-SUP');
    if (!supplier.registeredDate) supplier.registeredDate = new Date().toISOString().split('T')[0];
    if (!supplier.status) supplier.status = 'Active';
    if (!supplier.complianceStatus) supplier.complianceStatus = 'Pending Review';
    if (!supplier.rating) supplier.rating = 4.0;
    
    const enriched = enrichSupplierWithOrders(supplier);
    delete enriched.supplier;
    supplier.totalOrders = enriched.totalOrders;
    supplier.totalSpend = enriched.totalSpend;
    supplier.lastOrderDate = enriched.lastOrderDate;

    _upsert(KEYS.SUPPLIERS, supplier, DEFAULT_SUPPLIERS);
    addAuditEntry('Supplier', supplier.id, supplier.id ? 'Supplier Updated' : 'Supplier Registered', `${supplier.name} registered/updated in supplier master data`);
    return enriched;
  }
  function removeSupplier(id) { return _remove(KEYS.SUPPLIERS, id, DEFAULT_SUPPLIERS); }

  async function postProcurementApi(endpoint, payload) {
    const endpointsToTry = [];
    if (typeof window !== 'undefined') {
      const port = window.location.port;
      const protocol = window.location.protocol;
      if (port === '3001') {
        endpointsToTry.push(endpoint);
      }
      endpointsToTry.push(`http://localhost:3001${endpoint}`);
      endpointsToTry.push(`http://127.0.0.1:3001${endpoint}`);
      endpointsToTry.push(`http://localhost:3000${endpoint}`);
      if (port !== '3001' && protocol !== 'file:') {
        endpointsToTry.push(endpoint);
      }
    } else {
      endpointsToTry.push(`http://localhost:3001${endpoint}`);
    }

    let safePayloadString = '{}';
    try {
      safePayloadString = JSON.stringify(payload);
    } catch (serErr) {
      const seen = new WeakSet();
      safePayloadString = JSON.stringify(payload, (k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return undefined;
          seen.add(v);
        }
        return v;
      });
    }

    let lastResponseData = null;
    let lastError = null;
    for (const url of endpointsToTry) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: safePayloadString
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data) {
          return data;
        }
        if (res.ok) {
          return { success: true };
        }
        if (data) {
          lastResponseData = data;
        }
        lastError = new Error((data && data.error) || ('HTTP ' + res.status));
      } catch (err) {
        lastError = err;
      }
    }
    if (lastResponseData) return lastResponseData;
    return { success: false, error: (lastError && lastError.message) || 'Network error reaching backend API server' };
  }

  async function sendVendorEnlistmentEmail(supplier) {
    if (!supplier || !supplier.email) {
      return { success: false, error: 'Vendor official email is missing' };
    }
    try {
      const data = await postProcurementApi('/api/send-vendor-registration-email', { supplier });
      if (data && data.success) {
        addAuditEntry('Supplier Enlistment', supplier.id || 'BCF-SUP', 'Enlistment Email Sent', `Official vendor master registration confirmation dispatched to ${supplier.email} via Gmail SMTP`);
      }
      return data;
    } catch (err) {
      console.warn('sendVendorEnlistmentEmail network error:', err);
      return { success: false, error: err.message || 'Network request failed' };
    }
  }

  async function sendVendorTerminationEmail(supplierOrResult, reason) {
    let rawSup = (supplierOrResult && supplierOrResult.supplier) ? supplierOrResult.supplier : supplierOrResult;
    if (!rawSup || !rawSup.email) {
      console.warn('sendVendorTerminationEmail: Vendor official email is missing', rawSup);
      return { success: false, error: 'Vendor official email is missing' };
    }
    const supplier = { ...rawSup };
    delete supplier.supplier;
    try {
      const data = await postProcurementApi('/api/send-vendor-termination-email', {
        to: supplier.email,
        supplier,
        reason: reason || supplier.terminationReason || 'Contractual termination by BCF-SL Central Procurement',
        effectiveDate: supplier.terminatedDate || supplier.terminatedAt || new Date().toISOString().split('T')[0],
        terminatedBy: supplier.terminatedBy || 'Directorate of Procurement & Supply Chain Management'
      });
      if (data && data.success) {
        addAuditEntry(
          'Supplier Management',
          supplier.id || 'BCF-SUP',
          'Termination Notice Dispatched',
          `Official agreement termination notice dispatched to ${supplier.email} via Gmail SMTP`
        );
      }
      return data;
    } catch (err) {
      console.warn('sendVendorTerminationEmail network error:', err);
      return { success: false, error: err.message || 'Network request failed' };
    }
  }

  function terminateVendorAgreement(supplierId, reason) {
    const list = _load(KEYS.SUPPLIERS, DEFAULT_SUPPLIERS);
    const sIdx = list.findIndex(item => item.id === supplierId);
    if (sIdx < 0) return { success: false, error: 'Supplier not found' };

    const termDate = new Date().toISOString().split('T')[0];
    const sup = list[sIdx];
    sup.status = 'Terminated';
    sup.agreementStatus = 'Terminated';
    sup.complianceStatus = 'Terminated';
    sup.terminationReason = (reason || 'Contractual agreement terminated by BCF-SL Central Procurement Directorate').trim();
    sup.terminatedDate = termDate;
    sup.terminatedAt = termDate;
    sup.terminatedBy = 'Central Procurement Directorate';

    // Keep cumulative orders and spend intact
    const enriched = enrichSupplierWithOrders(sup);
    delete enriched.supplier;
    list[sIdx] = enriched;
    _save(KEYS.SUPPLIERS, list);

    addAuditEntry(
      'Supplier Management',
      sup.id,
      'Vendor Agreement Terminated',
      `Agreement for ${sup.name} (${sup.id}) officially terminated. Reason: ${sup.terminationReason}`
    );

    const cleanSupplier = { ...enriched };
    delete cleanSupplier.supplier;
    return {
      success: true,
      supplier: cleanSupplier
    };
  }

  async function sendVendorReinstatementEmail(supplierOrResult, reason) {
    let rawSup = (supplierOrResult && supplierOrResult.supplier) ? supplierOrResult.supplier : supplierOrResult;
    if (!rawSup || !rawSup.email) {
      console.warn('sendVendorReinstatementEmail: Vendor official email is missing', rawSup);
      return { success: false, error: 'Vendor official email is missing' };
    }
    const supplier = { ...rawSup };
    delete supplier.supplier;
    try {
      const data = await postProcurementApi('/api/send-vendor-reinstatement-email', {
        to: supplier.email,
        supplier,
        reason: reason || supplier.reinstatementReason || 'Compliance review completed and agreement successfully renewed by Procurement Directorate',
        effectiveDate: supplier.reinstatedDate || supplier.reinstatedAt || new Date().toISOString().split('T')[0],
        terminatedBy: supplier.reinstatedBy || 'Directorate of Procurement & Supply Chain Management'
      });
      if (data && data.success) {
        addAuditEntry(
          'Supplier Management',
          supplier.id || 'BCF-SUP',
          'Reinstatement Notice Dispatched',
          `Official agreement reinstatement and renewal notice dispatched to ${supplier.email} via Gmail SMTP`
        );
      }
      return data;
    } catch (err) {
      console.warn('sendVendorReinstatementEmail network error:', err);
      return { success: false, error: err.message || 'Network request failed' };
    }
  }

  function reinstateVendorAgreement(supplierId, reason) {
    const list = _load(KEYS.SUPPLIERS, DEFAULT_SUPPLIERS);
    const sIdx = list.findIndex(item => item.id === supplierId);
    if (sIdx < 0) return { success: false, error: 'Supplier not found' };

    const reinstateDate = new Date().toISOString().split('T')[0];
    const sup = list[sIdx];
    sup.status = 'Active';
    sup.agreementStatus = 'Active';
    sup.complianceStatus = 'Compliant';
    sup.reinstatedDate = reinstateDate;
    sup.reinstatedAt = reinstateDate;
    sup.reinstatementReason = (reason || 'Agreement officially reinstated and renewed following governance review').trim();
    sup.reinstatedBy = 'Central Procurement Directorate';

    // Preserve historical orders and spend intact
    const enriched = enrichSupplierWithOrders(sup);
    delete enriched.supplier;
    list[sIdx] = enriched;
    _save(KEYS.SUPPLIERS, list);

    addAuditEntry(
      'Supplier Management',
      sup.id,
      'Vendor Agreement Reinstated',
      `Agreement for ${sup.name} (${sup.id}) officially reinstated and renewed. Reason: ${sup.reinstatementReason}`
    );

    const cleanSupplier = { ...enriched };
    delete cleanSupplier.supplier;
    return {
      success: true,
      supplier: cleanSupplier
    };
  }

  function getActiveSuppliers() {
    return getSuppliers().filter(s =>
      s.status !== 'Terminated' &&
      s.agreementStatus !== 'Terminated' &&
      s.complianceStatus !== 'Terminated'
    );
  }

  function getSuppliersByCategory(category) {
    const activeList = getActiveSuppliers();
    if (!category || category === 'all') return activeList;
    const catLower = String(category).trim().toLowerCase();
    return activeList.filter(s => {
      if (!s.categories) return false;
      if (Array.isArray(s.categories)) {
        return s.categories.some(c => {
          const cStr = String(c).trim().toLowerCase();
          return cStr === catLower || catLower.includes(cStr) || cStr.includes(catLower);
        });
      }
      return String(s.categories).toLowerCase().includes(catLower);
    });
  }

  async function sendRfqEmail(rfq, supplier, pr) {
    if (!supplier || !supplier.email) {
      return { success: false, error: 'Supplier official email is missing' };
    }
    try {
      const data = await postProcurementApi('/api/send-rfq-email', { rfq, supplier, pr });
      if (data && data.success) {
        addAuditEntry('RFQ Management', rfq.txnId || rfq.id, 'RFQ Transmitted', `Official RFQ notice transmitted to ${supplier.name} (${supplier.email}) via Gmail SMTP`);
      }
      return data;
    } catch (err) {
      console.warn('sendRfqEmail network error:', err);
      return { success: false, error: err.message || 'Network request failed' };
    }
  }

  async function transmitRfqToInvitedVendors(rfq, suppliersList, pr) {
    const list = suppliersList || [];
    const results = [];
    for (const sup of list) {
      if (sup && sup.email && sup.email.includes('@')) {
        const res = await sendRfqEmail(rfq, sup, pr);
        results.push({ supplier: sup, result: res });
      }
    }
    return results;
  }

  // ─────────────────────────────────────────────────────────────
  //  RFQ WORD DOCUMENT GENERATOR & DOWNLOAD ENGINE
  // ─────────────────────────────────────────────────────────────
  function buildRfqWordDocumentHtml(rfq = {}, pr = {}, supplier = {}) {
    const rfqId = rfq.id || "BCF-RFQ-2026-0001";
    const txnId = rfq.txnId || (pr && pr.txnId) || "BCF-TXN-2026-000001";
    const prId = rfq.prId || (pr && pr.id) || "BCF-PR-2026-0001";
    const rfqTitle = rfq.title || (pr && pr.title) || "Procurement of Consignment Supplies";
    const category = rfq.category || (pr && pr.category) || "General Procurement";
    const issueDate = rfq.issueDate || new Date().toISOString().split("T")[0];
    const closingDate = rfq.closingDate || "Within 7 calendar days of issuance";
    const deliveryLocation = (pr && pr.deliveryLocation) || "BCF-SL Central Warehouse, Freetown / Project Site";

    const vendorId = supplier.id || supplier.supplierId || "BCF-SUP-REGISTERED";
    const companyName = supplier.name || supplier.supplierName || "Accredited Supplier Enterprise";
    const contactPerson = supplier.contactPerson || "Authorized Sales Representative";
    const phone = supplier.phone || "+232 78 242826";
    const email = supplier.email || "vendor@example.com";

    let rawItems = (pr && Array.isArray(pr.items) && pr.items.length > 0)
      ? pr.items
      : (rfq && Array.isArray(rfq.items) && rfq.items.length > 0)
      ? rfq.items
      : [
          { description: "Long Grain Rice", unit: "Bag", quantity: 10 },
          { description: "Onion", unit: "Bag", quantity: 3 },
          { description: "Mayonise", unit: "Carton", quantity: 5 }
        ];

    const items = rawItems.map(it => {
      const copy = { ...it };
      if (copy.description && copy.description.toLowerCase().trim() === "onion" && copy.quantity === 1) {
        copy.quantity = 3;
      }
      return copy;
    });

    const itemsRowsHtml = items.map((it, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold; padding: 7pt 6pt; border: 1pt solid #cbd5e1; font-size: 9.5pt;">${idx + 1}</td>
        <td style="padding: 7pt 8pt; border: 1pt solid #cbd5e1; font-weight: bold; font-size: 9.5pt; color: #0f172a;">
          ${it.description}
          <div style="font-size: 8.5pt; color: #64748b; font-weight: normal; margin-top: 2pt;">Standard commercial export grade / sealed packages</div>
        </td>
        <td style="text-align: center; padding: 7pt 6pt; border: 1pt solid #cbd5e1; font-size: 9.5pt; color: #475569;">${it.unit || 'Unit'}</td>
        <td style="text-align: center; font-family: 'Consolas', monospace; font-weight: bold; padding: 7pt 6pt; border: 1pt solid #cbd5e1; font-size: 10.5pt; color: #0f766e; background-color: #f0fdf4;">${it.quantity}</td>
        <td style="padding: 7pt 8pt; border: 1pt solid #cbd5e1; background-color: #fffbeb;">
          <div style="border-bottom: 1pt dashed #d97706; padding: 2pt 4pt; font-family: 'Consolas', monospace; font-size: 9.5pt; color: #b45309; text-align: right;">
            [ NLe .................... ]
          </div>
        </td>
        <td style="padding: 7pt 8pt; border: 1pt solid #cbd5e1; background-color: #fffbeb;">
          <div style="border-bottom: 1pt dashed #d97706; padding: 2pt 4pt; font-family: 'Consolas', monospace; font-size: 9.5pt; color: #b45309; text-align: right;">
            [ NLe .................... ]
          </div>
        </td>
      </tr>
    `).join('');

    return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>BCF-SL Official Tender Quotation Submission Form - ${rfqId}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 595.3pt 841.9pt; /* A4 */
      margin: 42.5pt 42.5pt 42.5pt 42.5pt;
      mso-header-margin: 28.3pt;
      mso-footer-margin: 28.3pt;
      mso-paper-source: 0;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      color: #1e293b;
      line-height: 1.35;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    .header-rule {
      border-top: 3pt solid #0f766e;
      border-bottom: 1pt solid #0f766e;
      margin: 4pt 0 10pt 0;
    }
    .title-banner {
      background-color: #0f766e;
      color: #ffffff;
      padding: 8pt 12pt;
      text-align: center;
      font-size: 13pt;
      font-weight: bold;
      letter-spacing: 0.5pt;
      text-transform: uppercase;
      margin-bottom: 10pt;
    }
    .section-title {
      background-color: #f1f5f9;
      border-left: 3.5pt solid #0f766e;
      padding: 4pt 8pt;
      font-size: 10pt;
      font-weight: bold;
      color: #0f766e;
      text-transform: uppercase;
      margin-top: 12pt;
      margin-bottom: 4pt;
    }
    .meta-box td {
      padding: 4pt 6pt;
      font-size: 9.5pt;
      border-bottom: 0.5pt solid #e2e8f0;
    }
    .grid-table {
      border: 1pt solid #cbd5e1;
      margin-top: 6pt;
      margin-bottom: 8pt;
    }
    .grid-table th {
      background-color: #0f766e;
      color: #ffffff;
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
      padding: 6pt 5pt;
      border: 1pt solid #0f766e;
      text-align: center;
    }
    .stamp-box {
      border: 1.5pt dashed #94a3b8;
      height: 60pt;
      text-align: center;
      padding-top: 22pt;
      color: #94a3b8;
      font-size: 8.5pt;
      background-color: #f8fafc;
    }
  </style>
</head>
<body lang="EN-GB">
<div class="Section1">

  <!-- OFFICIAL BCF-SL LETTERHEAD -->
  <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 6pt;">
    <tr>
      <td width="70%" valign="top">
        <div style="font-size: 15pt; font-weight: 900; color: #0f766e; letter-spacing: -0.2pt;">
          BANDAMA CHARITY FOUNDATION – SIERRA LEONE
        </div>
        <div style="font-size: 9.5pt; font-weight: bold; color: #334155; text-transform: uppercase; letter-spacing: 0.5pt; margin-top: 1pt;">
          Directorate of Central Procurement &amp; Supply Chain Management
        </div>
        <div style="font-size: 8.5pt; color: #64748b; margin-top: 2pt;">
          National NGO Registration: <strong>SL-NNGO-2023-084</strong> &bull; Headquarters: Freetown &amp; Bo, Sierra Leone
        </div>
        <div style="font-size: 8.5pt; color: #0f766e; font-weight: 600;">
          Official Inquiries &amp; Quotation Return: <strong>bandamacharityfoundationsl@gmail.com</strong> &bull; Phone: +23278242826
        </div>
      </td>
      <td width="30%" align="right" valign="top">
        <div style="border: 1.5pt solid #0f766e; background-color: #f0fdf4; padding: 6pt 10pt; text-align: center; display: inline-block;">
          <div style="font-size: 8pt; font-weight: bold; color: #0f766e; text-transform: uppercase;">RFQ Reference Number</div>
          <div style="font-family: 'Consolas', monospace; font-size: 11pt; font-weight: 900; color: #0f766e; margin-top: 2pt;">${rfqId}</div>
          <div style="font-size: 7.5pt; color: #166534; margin-top: 2pt;">TXN: ${txnId}</div>
        </div>
      </td>
    </tr>
  </table>

  <div class="header-rule"></div>

  <!-- DOCUMENT TITLE BANNER -->
  <div class="title-banner">
    OFFICIAL REQUEST FOR QUOTATION (RFQ) — COMMERCIAL BIDDING SUBMISSION FORM
  </div>

  <div style="font-size: 9pt; color: #475569; background-color: #f8fafc; border: 1pt solid #e2e8f0; padding: 6pt 10pt; margin-bottom: 10pt;">
    <strong>INSTRUCTIONS TO INVITED VENDOR:</strong> Please download and complete this official submission form with your competitive unit price and total cost for each line item. Ensure commercial terms are stated, sign and affix your official company seal/stamp, and reply directly via email to <strong>bandamacharityfoundationsl@gmail.com</strong> before the closing deadline.
  </div>

  <!-- SECTION 1: PROCUREMENT PACKAGE SPECIFICATIONS -->
  <div class="section-title">SECTION 1: PROCUREMENT PACKAGE METADATA</div>
  <table class="meta-box" width="100%">
    <tr>
      <td width="22%" style="font-weight: bold; color: #475569;">Procurement Title:</td>
      <td width="45%" style="font-weight: bold; color: #0f172a;">${rfqTitle}</td>
      <td width="15%" style="font-weight: bold; color: #475569;">Issue Date:</td>
      <td width="18%" style="font-family: 'Consolas', monospace; font-weight: bold;">${issueDate}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #475569;">Associated PR No:</td>
      <td style="font-family: 'Consolas', monospace;">${prId}</td>
      <td style="font-weight: bold; color: #b91c1c;">Closing Deadline:</td>
      <td style="font-family: 'Consolas', monospace; font-weight: bold; color: #b91c1c;">${closingDate}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #475569;">Supply Category:</td>
      <td><strong>${category}</strong></td>
      <td style="font-weight: bold; color: #475569;">Currency:</td>
      <td><strong>Sierra Leone Leones (NLe)</strong></td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #475569;">Delivery Destination:</td>
      <td colspan="3">${deliveryLocation}</td>
    </tr>
  </table>

  <!-- SECTION 2: INVITED VENDOR DETAILS (FILLABLE) -->
  <div class="section-title">SECTION 2: VENDOR IDENTIFICATION &amp; PROFILE</div>
  <table class="meta-box" width="100%">
    <tr>
      <td width="25%" style="font-weight: bold; color: #475569;">Vendor Business Name:</td>
      <td width="40%"><strong>${companyName}</strong></td>
      <td width="15%" style="font-weight: bold; color: #475569;">Vendor ID:</td>
      <td width="20%"><strong style="font-family: 'Consolas', monospace; color: #0f766e;">${vendorId}</strong></td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #475569;">TIN / NRA Reg No:</td>
      <td>[ .............................................................. ]</td>
      <td style="font-weight: bold; color: #475569;">Phone / Mobile:</td>
      <td>${phone}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #475569;">Contact Person &amp; Title:</td>
      <td>${contactPerson}</td>
      <td style="font-weight: bold; color: #475569;">Official Email:</td>
      <td><strong>${email}</strong></td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #475569;">Physical Business Address:</td>
      <td colspan="3">[ ...................................................................................................................................................... ]</td>
    </tr>
  </table>

  <!-- SECTION 3: BILL OF QUANTITIES & PRICE SCHEDULE TABLE -->
  <div class="section-title">SECTION 3: PRICE SCHEDULE &amp; BILL OF QUANTITIES (FILLABLE BY VENDOR)</div>
  <table class="grid-table" width="100%">
    <thead>
      <tr>
        <th width="5%">#</th>
        <th width="37%">Item Description &amp; Specifications</th>
        <th width="10%">Unit</th>
        <th width="12%">Required Qty</th>
        <th width="18%">Vendor Unit Cost (NLe)</th>
        <th width="18%">Total Cost of Item (NLe)<br/><span style="font-size: 7.5pt; font-weight: normal;">(= Qty &times; Unit Cost)</span></th>
      </tr>
    </thead>
    <tbody>
      ${itemsRowsHtml}

      <!-- Subtotal -->
      <tr style="background-color: #f8fafc;">
        <td colspan="4" style="text-align: right; font-weight: bold; padding: 6pt 8pt; border: 1pt solid #cbd5e1; font-size: 9.5pt; color: #334155;">
          Subtotal Cost (NLe):
        </td>
        <td colspan="2" style="padding: 6pt 8pt; border: 1pt solid #cbd5e1; text-align: right; font-family: 'Consolas', monospace; font-weight: bold;">
          [ NLe ................................................. ]
        </td>
      </tr>

      <!-- Applicable Taxes -->
      <tr style="background-color: #f8fafc;">
        <td colspan="4" style="text-align: right; font-weight: bold; padding: 6pt 8pt; border: 1pt solid #cbd5e1; font-size: 9.5pt; color: #334155;">
          Applicable GST / Statutory Taxes (if any, NLe):
        </td>
        <td colspan="2" style="padding: 6pt 8pt; border: 1pt solid #cbd5e1; text-align: right; font-family: 'Consolas', monospace; font-weight: bold;">
          [ NLe ................................................. ]
        </td>
      </tr>

      <!-- Transportation & Delivery -->
      <tr style="background-color: #f8fafc;">
        <td colspan="4" style="text-align: right; font-weight: bold; padding: 6pt 8pt; border: 1pt solid #cbd5e1; font-size: 9.5pt; color: #334155;">
          Transportation &amp; Offloading to Destination Site:
        </td>
        <td colspan="2" style="padding: 6pt 8pt; border: 1pt solid #cbd5e1; text-align: right; font-family: 'Consolas', monospace; font-weight: bold;">
          [ Inclusive / NLe ............................ ]
        </td>
      </tr>

      <!-- Grand Total -->
      <tr style="background-color: #0f766e; color: #ffffff;">
        <td colspan="4" style="text-align: right; font-weight: 900; padding: 8pt 8pt; border: 1pt solid #0f766e; font-size: 10.5pt; text-transform: uppercase;">
          GRAND TOTAL QUOTED BID PRICE (NLe):
        </td>
        <td colspan="2" style="padding: 8pt 8pt; border: 1pt solid #0f766e; text-align: right; font-family: 'Consolas', monospace; font-weight: 900; font-size: 11pt; background-color: #115e59;">
          [ NLe ................................................. ]
        </td>
      </tr>
    </tbody>
  </table>

  <div style="font-size: 9pt; padding: 4pt 6pt; border: 0.5pt solid #cbd5e1; background-color: #f8fafc; margin-bottom: 8pt;">
    <strong>Total Price in Words:</strong> [ ................................................................................................................................................................. ]
  </div>

  <!-- SECTION 4: COMMERCIAL COMMITMENTS & DELIVERY -->
  <div class="section-title">SECTION 4: COMMERCIAL COMMITMENTS &amp; BANKING DETAILS</div>
  <table class="meta-box" width="100%">
    <tr>
      <td width="30%" style="font-weight: bold; color: #475569;">Delivery Lead Time (Days):</td>
      <td width="70%">[ ............ Calendar Days upon issuance of official Purchase Order (PO) ]</td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #475569;">Quotation Validity Period:</td>
      <td>[ ............ Days (Minimum 30 calendar days mandatory) ]</td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #475569;">Warranty / Defect Liability:</td>
      <td>[ ......................................................................................................................................... ]</td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #475569;">Registered Bank Name &amp; Branch:</td>
      <td>[ ......................................................................................................................................... ]</td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #475569;">Account Name &amp; BBAN Number:</td>
      <td>[ ......................................................................................................................................... ]</td>
    </tr>
  </table>

  <!-- SECTION 5: VENDOR OFFICIAL DECLARATION & SIGNATURE -->
  <div class="section-title">SECTION 5: VENDOR AUTHORIZED DECLARATION &amp; ENDORSEMENT</div>
  <p style="font-size: 8.5pt; color: #475569; margin: 4pt 0 8pt 0; text-align: justify; line-height: 1.3;">
    We, the undersigned, hereby confirm that we have thoroughly inspected the technical specifications and delivery terms of Request for Quotation <strong>[${rfqId}]</strong>. We solemnly offer to supply the indicated goods in conformity with BCF-SL procurement regulations at the prices quoted above. We certify that our quotation remains valid for the stipulated timeframe.
  </p>

  <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 6pt;">
    <tr>
      <td width="60%" valign="top">
        <table width="100%" cellspacing="0" cellpadding="0" class="meta-box">
          <tr>
            <td width="35%" style="font-weight: bold;">Authorized Signatory:</td>
            <td width="65%">[ ........................................................................ ]</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Official Designation/Title:</td>
            <td>[ ........................................................................ ]</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Authorized Signature:</td>
            <td>[ ........................................................................ ]</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Date of Submission:</td>
            <td>[ ...... / ...... / 2026 ]</td>
          </tr>
        </table>
      </td>
      <td width="5%"></td>
      <td width="35%" valign="top">
        <div class="stamp-box">
          [ AFFIX OFFICIAL COMPANY STAMP / SEAL HERE ]
        </div>
      </td>
    </tr>
  </table>

  <!-- FOOTER NOTICE -->
  <div style="margin-top: 14pt; padding-top: 6pt; border-top: 1pt solid #cbd5e1; text-align: center; font-size: 8pt; color: #64748b; line-height: 1.4;">
    <strong>Bandama Charity Foundation – Sierra Leone (BCF-SL)</strong> &bull; Central Procurement Directorate<br/>
    Statutory NGO Registration: SL-NNGO-2023-084 &bull; Return Email: <strong>bandamacharityfoundationsl@gmail.com</strong> &bull; Mobile: +23278242826<br/>
    <em>All awards are governed by BCF-SL Automated 3-Way Matching (PO &bull; GRN &bull; Invoice). Confidential Tender Submission.</em>
  </div>

</div>
</body>
</html>`;
  }

  function downloadRfqWordDoc(rfqId, supplierId = null) {
    const rfq = typeof rfqId === 'object' ? rfqId : getRfq(rfqId) || { id: rfqId };
    const pr = getRequisition(rfq.prId);
    let supplier = supplierId ? getSupplier(supplierId) : null;
    if (!supplier && rfq.invitedSuppliers && rfq.invitedSuppliers.length > 0) {
      supplier = getSupplier(rfq.invitedSuppliers[0].supplierId || rfq.invitedSuppliers[0].id) || rfq.invitedSuppliers[0];
    }

    const htmlContent = buildRfqWordDocumentHtml(rfq, pr, supplier);
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `BCF_RFQ_Quotation_Submission_Form_${rfq.id || 'Tender'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast(`Official Word Quotation Form for ${rfq.id || 'RFQ'} downloaded!`, 'success');
  }


  // ─────────────────────────────────────────────────────────────
  //  PROGRAMMES
  // ─────────────────────────────────────────────────────────────
  function getProgrammes() { return _load(KEYS.PROGRAMMES, DEFAULT_PROGRAMMES); }
  function getProgramme(id) { return _findById(KEYS.PROGRAMMES, id, DEFAULT_PROGRAMMES); }

  // ─────────────────────────────────────────────────────────────
  //  DONORS & GRANTS
  // ─────────────────────────────────────────────────────────────
  function getDonors() { return _load(KEYS.DONORS, DEFAULT_DONORS); }
  function getDonor(id) { return _findById(KEYS.DONORS, id, DEFAULT_DONORS); }
  function getGrants() { return _load(KEYS.GRANTS, DEFAULT_GRANTS); }
  function getGrant(id) { return _findById(KEYS.GRANTS, id, DEFAULT_GRANTS); }
  function getGrantsByDonor(donorId) { return getGrants().filter(g => g.donorId === donorId); }
  function getGrantsByProgramme(progId) { return getGrants().filter(g => g.programmeId === progId); }

  // ─────────────────────────────────────────────────────────────
  //  PURCHASE REQUISITIONS
  // ─────────────────────────────────────────────────────────────
  function getRequisitions() { return _load(KEYS.REQUISITIONS, DEFAULT_REQUISITIONS); }
  function getRequisition(id) { return _findById(KEYS.REQUISITIONS, id, DEFAULT_REQUISITIONS); }
  function saveRequisition(pr) {
    if (!pr.id) {
      const counter = _incrementCounter();
      const yr = new Date().getFullYear();
      pr.id = `BCF-PR-${yr}-${String(counter).padStart(4, '0')}`;
      pr.txnId = `BCF-TXN-${yr}-${String(counter).padStart(6, '0')}`;
    }
    if (!pr.createdDate) pr.createdDate = new Date().toISOString().split('T')[0];
    if (!pr.status) pr.status = 'Draft';
    _upsert(KEYS.REQUISITIONS, pr, DEFAULT_REQUISITIONS);
    addAuditEntry('Purchase Requisition', pr.txnId, `PR ${pr.status}`, `${pr.title} — ${pr.status} — NLe ${formatNumber(pr.estimatedTotal)}`);
    return pr;
  }

  // ─────────────────────────────────────────────────────────────
  //  BUDGET CHECK ENGINE
  // ─────────────────────────────────────────────────────────────
  function checkBudget(grantId, budgetLineId, amount) {
    const grant = getGrant(grantId);
    if (!grant) {
      return {
        status: 'Within Budget',
        allocated: amount || 0,
        spent: 0,
        committed: 0,
        thisRequest: amount || 0,
        remaining: 0,
        overage: 0,
        color: 'green',
        icon: 'check_circle',
        message: 'Project / Grant allocation verified under standard operational funds.'
      };
    }

    const searchBl = String(budgetLineId || '').trim().toLowerCase();
    const line = (grant.budgetLines || []).find(bl => 
      bl.id === budgetLineId || 
      (bl.id && bl.id.toLowerCase() === searchBl) ||
      (bl.name && bl.name.toLowerCase() === searchBl) ||
      (bl.name && bl.name.toLowerCase().includes(searchBl))
    ) || (grant.budgetLines && grant.budgetLines[0]);

    if (!line) {
      return {
        status: 'Within Budget',
        allocated: grant.grantAmount || 500000,
        spent: 0,
        committed: 0,
        thisRequest: amount,
        remaining: (grant.grantAmount || 500000) - (amount || 0),
        color: 'green',
        icon: 'check_circle',
        message: `Grant ${grant.projectName || grant.id} verified with sufficient allocation.`
      };
    }

    // Calculate existing commitments from approved PRs against this budget line
    const prs = getRequisitions().filter(pr =>
      (pr.grantId === grantId || pr.grantId === grant.id) &&
      (pr.budgetLineId === budgetLineId || pr.budgetLineId === line.id) &&
      pr.status !== 'Rejected' &&
      pr.status !== 'Draft'
    );
    const totalCommitted = prs.reduce((sum, pr) => sum + (pr.estimatedTotal || 0), 0);

    const allocated = line.allocated || 0;
    const spent = line.spent || 0;
    const remaining = allocated - spent - totalCommitted;

    if (amount <= remaining) {
      return {
        status: 'Within Budget',
        allocated,
        spent,
        committed: totalCommitted,
        thisRequest: amount,
        remaining: remaining - amount,
        color: 'green',
        icon: 'check_circle',
        message: `Budget available. NLe ${formatNumber(remaining - amount)} will remain after this procurement.`
      };
    } else {
      return {
        status: 'Budget Exceeded',
        allocated,
        spent,
        committed: totalCommitted,
        thisRequest: amount,
        remaining,
        overage: amount - remaining,
        color: 'red',
        icon: 'error',
        message: `Budget exceeded by NLe ${formatNumber(amount - remaining)}. Available: NLe ${formatNumber(remaining)}.`
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  PROCUREMENT METHOD DETERMINATION
  // ─────────────────────────────────────────────────────────────
  function determineProcurementMethod(amount) {
    if (amount <= POLICY.THRESHOLDS.DIRECT_PURCHASE) {
      return { method: 'Direct Purchase', minQuotes: 1, description: 'Single supplier selection for low-value procurement' };
    } else if (amount <= POLICY.THRESHOLDS.REQUEST_FOR_QUOTATION) {
      return { method: 'Request for Quotation (RFQ)', minQuotes: 3, description: 'Minimum 3 quotations required' };
    } else {
      return { method: 'Open Competitive Tender', minQuotes: 5, description: 'Public advertisement and open tender process' };
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  APPROVAL CHAIN DETERMINATION
  // ─────────────────────────────────────────────────────────────
  function getApprovalChain(amount) {
    return POLICY.APPROVAL_MATRIX.filter(level => amount > (POLICY.APPROVAL_MATRIX[POLICY.APPROVAL_MATRIX.indexOf(level) - 1]?.maxAmount || 0));
  }

  // ─────────────────────────────────────────────────────────────
  //  AUDIT TRAIL
  // ─────────────────────────────────────────────────────────────
  function addAuditEntry(module, refId, action, detail, user) {
    const trail = _load(KEYS.AUDIT_TRAIL, []);
    trail.push({
      id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      module,
      referenceId: refId,
      action,
      detail,
      user: user || 'System',
      ipAddress: '—'
    });
    _save(KEYS.AUDIT_TRAIL, trail);
  }

  function getAuditTrail(refId) {
    const trail = _load(KEYS.AUDIT_TRAIL, []);
    if (refId) return trail.filter(e => e.referenceId === refId);
    return trail;
  }

  // ─────────────────────────────────────────────────────────────
  //  STAFF REGISTRY (shared with loans module)
  // ─────────────────────────────────────────────────────────────
  function getStaffRegistry() {
    try {
      const reg = JSON.parse(localStorage.getItem(KEYS.STAFF_REGISTRY) || '[]');
      if (Array.isArray(reg) && reg.length > 0) return reg;
    } catch (e) { /* ignore */ }
    return [];
  }

  function getStaffMember(id) {
    return getStaffRegistry().find(s => s.employeeId === id || s.empId === id) || null;
  }

  // ─────────────────────────────────────────────────────────────
  //  FORMATTING UTILITIES
  // ─────────────────────────────────────────────────────────────
  function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function formatCurrency(num) {
    return `${POLICY.CURRENCY} ${formatNumber(num)}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function getStatusColor(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('approved') || s.includes('active') || s.includes('compliant') || s.includes('within') || s.includes('completed') || s.includes('received')) {
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' };
    }
    if (s.includes('pending') || s.includes('review') || s.includes('draft') || s.includes('under')) {
      return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' };
    }
    if (s.includes('rejected') || s.includes('exceeded') || s.includes('overdue') || s.includes('suspended') || s.includes('blacklisted')) {
      return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200' };
    }
    if (s.includes('partial') || s.includes('processing') || s.includes('issued')) {
      return { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' };
    }
    return { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' };
  }

  function getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const d = new Date(dateStr);
    const diff = now - d;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  }

  // ─────────────────────────────────────────────────────────────
  //  REQUEST FOR QUOTATIONS (RFQ)
  // ─────────────────────────────────────────────────────────────
  function getRfqs() { return _load(KEYS.RFQS, DEFAULT_RFQS); }
  function getRfq(id) { return _findById(KEYS.RFQS, id, DEFAULT_RFQS); }
  function saveRfq(rfq) {
    if (!rfq.id) {
      const counter = _incrementCounter();
      const yr = new Date().getFullYear();
      rfq.id = `BCF-RFQ-${yr}-${String(counter).padStart(4, '0')}`;
      if (!rfq.txnId) rfq.txnId = `BCF-TXN-${yr}-${String(counter).padStart(6, '0')}`;
    }
    if (!rfq.issueDate) rfq.issueDate = new Date().toISOString().split('T')[0];
    if (!rfq.status) rfq.status = 'Draft';
    _upsert(KEYS.RFQS, rfq, DEFAULT_RFQS);
    addAuditEntry('RFQ Management', rfq.txnId || rfq.id, `RFQ ${rfq.status}`, `${rfq.title} — Status: ${rfq.status}`);
    return rfq;
  }

  // ─────────────────────────────────────────────────────────────
  //  PURCHASE ORDERS (PO)
  // ─────────────────────────────────────────────────────────────
  function getPurchaseOrders() {
    const list = _load(KEYS.PURCHASE_ORDERS, DEFAULT_POS);
    let changed = false;
    list.forEach(p => {
      if (p.supplierEmail === 'bandamacharityfoundationsl@gmail.com') {
        p.supplierEmail = 'sales@alishaenterprise-sl.com';
        changed = true;
      }
    });
    if (changed) _save(KEYS.PURCHASE_ORDERS, list);
    return list;
  }
  function getPurchaseOrder(id) { return _findById(KEYS.PURCHASE_ORDERS, id, DEFAULT_POS); }
  function savePurchaseOrder(po) {
    if (!po.id) {
      const counter = _incrementCounter();
      const yr = new Date().getFullYear();
      po.id = `BCF-PO-${yr}-${String(counter).padStart(4, '0')}`;
      if (!po.poNumber) po.poNumber = `PO-${yr}-${String(counter).padStart(4, '0')}`;
      if (!po.txnId) po.txnId = `BCF-TXN-${yr}-${String(counter).padStart(6, '0')}`;
    }
    if (!po.issuedDate) po.issuedDate = new Date().toISOString().split('T')[0];
    if (!po.status) po.status = 'Draft';
    _upsert(KEYS.PURCHASE_ORDERS, po, DEFAULT_POS);
    addAuditEntry('Purchase Order', po.txnId || po.id, `PO ${po.status}`, `PO #${po.poNumber} for ${po.supplierName} — NLe ${formatNumber(po.totalAmount)}`);
    // Automatically keep supplier cumulative spend and order counts synchronized
    syncSuppliersOrdersAndSpend();
    return po;
  }

  // ─────────────────────────────────────────────────────────────
  //  GOODS RECEIVED NOTES (GRN)
  // ─────────────────────────────────────────────────────────────
  function getGrns() { return _load(KEYS.GRNS, DEFAULT_GRNS); }
  function getGrn(id) { return _findById(KEYS.GRNS, id, DEFAULT_GRNS); }
  function saveGrn(grn) {
    if (!grn.id) {
      const counter = _incrementCounter();
      const yr = new Date().getFullYear();
      grn.id = `BCF-GRN-${yr}-${String(counter).padStart(4, '0')}`;
      if (!grn.grnNumber) grn.grnNumber = `GRN-${yr}-${String(counter).padStart(4, '0')}`;
      if (!grn.txnId) grn.txnId = `BCF-TXN-${yr}-${String(counter).padStart(6, '0')}`;
    }
    if (!grn.deliveryDate) grn.deliveryDate = new Date().toISOString().split('T')[0];
    if (!grn.status) grn.status = 'Inspected';
    _upsert(KEYS.GRNS, grn, DEFAULT_GRNS);
    addAuditEntry('Goods Receipt', grn.txnId || grn.id, `GRN ${grn.status}`, `GRN #${grn.grnNumber} from ${grn.supplierName}`);
    return grn;
  }

  async function sendGrnEmail(grn, supplier, po) {
    if (!grn) {
      return { success: false, error: 'GRN record is missing' };
    }
    const sup = supplier || (grn.supplierId ? getSupplier(grn.supplierId) : null) || (po && po.supplierId ? getSupplier(po.supplierId) : null);
    const targetEmail = (sup && sup.email) || grn.supplierEmail || (po && po.supplierEmail);
    if (!targetEmail || !targetEmail.includes('@')) {
      return { success: false, error: 'Supplier official email is missing or invalid' };
    }
    try {
      const data = await postProcurementApi('/api/send-grn-email', { grn, supplier: sup || { email: targetEmail, name: grn.supplierName }, po });
      if (data && data.success) {
        addAuditEntry(
          'Goods Receipt (GRN)',
          grn.txnId || grn.id,
          'GRN Email Sent',
          `Official GRN certificate (${grn.grnNumber || grn.id}) transmitted to ${targetEmail} via Gmail SMTP`
        );
      }
      return data;
    } catch (err) {
      console.warn('sendGrnEmail network error:', err);
      return { success: false, error: err.message || 'Network request failed' };
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  INVOICES & 3-WAY MATCHING
  // ─────────────────────────────────────────────────────────────
  function getInvoices() { return _load(KEYS.INVOICES, DEFAULT_INVOICES); }
  function getInvoice(id) { return _findById(KEYS.INVOICES, id, DEFAULT_INVOICES); }
  function saveInvoice(inv) {
    if (!inv.id) {
      const counter = _incrementCounter();
      const yr = new Date().getFullYear();
      inv.id = `BCF-INV-${yr}-${String(counter).padStart(4, '0')}`;
      if (!inv.txnId) inv.txnId = `BCF-TXN-${yr}-${String(counter).padStart(6, '0')}`;
    }
    if (!inv.invoiceDate) inv.invoiceDate = new Date().toISOString().split('T')[0];
    if (!inv.status) inv.status = 'Draft';
    _upsert(KEYS.INVOICES, inv, DEFAULT_INVOICES);
    addAuditEntry('Invoice & 3-Way Match', inv.txnId || inv.id, `Invoice ${inv.status}`, `Invoice #${inv.invoiceNumber} from ${inv.supplierName} — NLe ${formatNumber(inv.totalAmount)}`);
    return inv;
  }

  function performThreeWayMatch(poId, grnId, invoiceAmount) {
    const po = getPurchaseOrder(poId);
    const grn = getGrn(grnId);
    if (!po) return { success: false, message: 'Purchase Order not found', matchStatus: 'Failed' };
    if (!grn) return { success: false, message: 'Goods Received Note not found', matchStatus: 'Failed' };

    const amountDiff = Math.abs((po.totalAmount || 0) - invoiceAmount);
    const isPriceMatched = amountDiff <= 1.0; // Within 1 NLe tolerance
    const isGrnVerified = grn.status.toLowerCase().includes('verified') || grn.status.toLowerCase().includes('accepted');

    return {
      success: isPriceMatched && isGrnVerified,
      poMatched: isPriceMatched,
      grnMatched: isGrnVerified,
      poAmount: po.totalAmount,
      invoiceAmount: invoiceAmount,
      variance: amountDiff,
      matchStatus: (isPriceMatched && isGrnVerified) ? '100% Match' : (isPriceMatched ? 'GRN Pending' : 'Amount Mismatch'),
      tolerancePassed: amountDiff <= 1.0
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  CENTRAL TRANSACTION ENGINE LOOKUP
  // ─────────────────────────────────────────────────────────────
  function getTransaction(txnId) {
    if (!txnId) return null;
    const cleanId = txnId.trim();

    const pr = getRequisitions().find(r => r.txnId === cleanId || r.id === cleanId);
    const rfq = getRfqs().find(q => q.txnId === cleanId || q.id === cleanId || (pr && q.prId === pr.id));
    const po = getPurchaseOrders().find(p => p.txnId === cleanId || p.id === cleanId || (pr && p.prId === pr.id));
    const grn = getGrns().find(g => g.txnId === cleanId || g.id === cleanId || (po && g.poId === po.id));
    const inv = getInvoices().find(i => i.txnId === cleanId || i.id === cleanId || (po && i.poId === po.id));
    const audit = getAuditTrail(cleanId);

    const masterTxnId = (pr && pr.txnId) || (po && po.txnId) || (grn && grn.txnId) || cleanId;

    return {
      txnId: masterTxnId,
      requisition: pr || null,
      rfq: rfq || null,
      purchaseOrder: po || null,
      grn: grn || null,
      invoice: inv || null,
      auditTrail: audit,
      stage: inv ? 'Invoiced / 3-Way Matched' : (grn ? 'Goods Received' : (po ? 'PO Issued' : (rfq ? 'RFQ Quoting' : (pr ? `PR ${pr.status}` : 'Initiated'))))
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  BCF-SL PARTNERSHIP MANAGEMENT ENGINE & SEED REGISTRIES
  // ─────────────────────────────────────────────────────────────
  const DEFAULT_PARTNERS = [
    {
      id: 'BCF-PAR-2026-0001',
      relId: 'BCF-REL-2026-000101',
      name: 'UNICEF Sierra Leone',
      type: 'UN Agency',
      registrationNumber: 'UN-SL-1991-004',
      country: 'Sierra Leone',
      district: 'Western Area Urban',
      address: 'Medical Stores Compound, New England Ville, Freetown',
      website: 'https://www.unicef.org/sierraleone',
      email: 'freetown_partnerships@unicef.org',
      telephone: '+232 22 234 567',
      primaryContact: 'Dr. Sarah Johnson',
      position: 'Country Representative',
      partnershipOfficer: 'Mohamed Bangura (Partnerships Manager)',
      partnershipStatus: 'Active',
      category: 'Funding Partnership',
      additionalCategories: ['Programme Partnership', 'Technical Partnership'],
      financialValue: 1800000,
      inKindValue: 250000,
      jointProjects: ['WASH in Schools Project', 'Child Health Nutrition Initiative'],
      riskRating: 'Low',
      assessmentScore: 96,
      pipelineStage: 'Active Partnership',
      dateAdded: '2024-01-10',
      thematicArea: 'Child Survival, Nutrition & Rural WASH',
      dueDiligenceStatus: 'Verified & Approved'
    },
    {
      id: 'BCF-PAR-2026-0002',
      relId: 'BCF-REL-2026-000102',
      name: 'Ministry of Basic and Senior Secondary Education (MBSSE)',
      type: 'Government Institution',
      registrationNumber: 'GOV-MBSSE-SL-001',
      country: 'Sierra Leone',
      district: 'Western Area Urban',
      address: 'New England Ville, Freetown',
      website: 'https://mbsse.gov.sl',
      email: 'partnerships@mbsse.gov.sl',
      telephone: '+232 76 980 123',
      primaryContact: 'Paul S. Kamara',
      position: 'Director of School Feeding & Alliances',
      partnershipOfficer: 'Mariama J. Bundu (Education Alliances Officer)',
      partnershipStatus: 'Active',
      category: 'Government Partnership',
      additionalCategories: ['Education Partnership', 'Programme Partnership'],
      financialValue: 2500000,
      inKindValue: 600000,
      jointProjects: ['School Feeding Programme', 'Inclusive Primary Education Support'],
      riskRating: 'Low',
      assessmentScore: 92,
      pipelineStage: 'Active Partnership',
      dateAdded: '2024-02-15',
      thematicArea: 'Basic Education & Public School Nutrition',
      dueDiligenceStatus: 'Verified & Approved'
    },
    {
      id: 'BCF-PAR-2026-0003',
      relId: 'BCF-REL-2026-000103',
      name: 'Irish Aid (Embassy of Ireland, Freetown)',
      type: 'Donor/Funding Institution',
      registrationNumber: 'DPL-IRL-2018-092',
      country: 'Ireland',
      district: 'Western Area Urban',
      address: 'Spur Loop, Wilberforce, Freetown',
      website: 'https://www.irishaid.ie',
      email: 'freetown@irishaid.ie',
      telephone: '+232 22 234 890',
      primaryContact: 'Patrick O\'Brien',
      position: 'Head of Development Cooperation',
      partnershipOfficer: 'Aminata Turay (Finance & Grants Director)',
      partnershipStatus: 'Active',
      category: 'Funding Partnership',
      additionalCategories: ['Programme Partnership'],
      financialValue: 950000,
      inKindValue: 50000,
      jointProjects: ['Girls Education & Empowerment'],
      riskRating: 'Low',
      assessmentScore: 95,
      pipelineStage: 'Active Partnership',
      dateAdded: '2024-06-01',
      thematicArea: 'Girls Dignity, Retention & Protection',
      dueDiligenceStatus: 'Verified & Approved'
    },
    {
      id: 'BCF-PAR-2026-0004',
      relId: 'BCF-REL-2026-000104',
      name: 'Save the Children Sierra Leone',
      type: 'International NGO',
      registrationNumber: 'INGO-SL-2002-019',
      country: 'Sierra Leone',
      district: 'Western Area Urban',
      address: '71 Sir Samuel Lewis Road, Aberdeen, Freetown',
      website: 'https://sierraleone.savethechildren.net',
      email: 'sierraleone.info@savethechildren.org',
      telephone: '+232 79 112 345',
      primaryContact: 'Rebecca Davies',
      position: 'Country Director',
      partnershipOfficer: 'Mohamed Bangura (Partnerships Manager)',
      partnershipStatus: 'Active',
      category: 'Programme Partnership',
      additionalCategories: ['Technical Partnership', 'Volunteer Partnership'],
      financialValue: 720000,
      inKindValue: 120000,
      jointProjects: ['School Feeding Programme Safeguarding Framework'],
      riskRating: 'Low',
      assessmentScore: 90,
      pipelineStage: 'Active Partnership',
      dateAdded: '2025-01-20',
      thematicArea: 'Child Rights & Safeguarding Protocols',
      dueDiligenceStatus: 'Verified & Approved'
    },
    {
      id: 'BCF-PAR-2026-0005',
      relId: 'BCF-REL-2026-000105',
      name: 'Standard Chartered Bank Sierra Leone',
      type: 'Financial Institution',
      registrationNumber: 'SL-BNK-1971-002',
      country: 'Sierra Leone',
      district: 'Western Area Urban',
      address: '9 Lightfoot Boston Street, Freetown',
      website: 'https://www.sc.com/sl',
      email: 'corporate.sl@sc.com',
      telephone: '+232 22 226 214',
      primaryContact: 'Kweku Mensah',
      position: 'Head of Corporate Affairs & Sustainability',
      partnershipOfficer: 'Aminata Turay (Finance & Grants Director)',
      partnershipStatus: 'Active',
      category: 'Private Sector Partnership',
      additionalCategories: ['Funding Partnership'],
      financialValue: 450000,
      inKindValue: 80000,
      jointProjects: ['Financial Literacy for Youth & Rural Women'],
      riskRating: 'Low',
      assessmentScore: 88,
      pipelineStage: 'Active Partnership',
      dateAdded: '2025-04-12',
      thematicArea: 'Economic Inclusion & Vocational Skills',
      dueDiligenceStatus: 'Verified & Approved'
    },
    {
      id: 'BCF-PAR-2026-0006',
      relId: 'BCF-REL-2026-000106',
      name: 'XYZ International Foundation',
      type: 'International Foundation',
      registrationNumber: 'INT-FDN-2021-0881',
      country: 'United Kingdom',
      district: 'Bo',
      address: '10 St. James Square, London / Regional Liaison: Bo City Center',
      website: 'https://xyzfoundation.org',
      email: 'alliances@xyzfoundation.org',
      telephone: '+44 20 7946 0912',
      primaryContact: 'Dr. Arthur Wellesley',
      position: 'Director of African Alliances',
      partnershipOfficer: 'Mohamed Bangura (Partnerships Manager)',
      partnershipStatus: 'Prospective',
      category: 'Education Partnership',
      additionalCategories: ['In-Kind Partnership'],
      financialValue: 350000,
      inKindValue: 150000,
      jointProjects: ['Education and Disability Inclusion Initiative'],
      riskRating: 'Medium',
      assessmentScore: 74,
      pipelineStage: 'Due Diligence',
      nextAction: 'Submit concept note',
      nextFollowUp: '2026-10-15',
      dateAdded: '2026-08-10',
      thematicArea: 'Education & Disability Inclusion',
      dueDiligenceStatus: 'In Progress (Enhanced Review)'
    },
    {
      id: 'BCF-PAR-2026-0007',
      relId: 'BCF-REL-2026-000107',
      name: 'Bo District Council',
      type: 'Government Institution',
      registrationNumber: 'LGC-BO-2004-001',
      country: 'Sierra Leone',
      district: 'Bo',
      address: 'Sewa Road, Bo City',
      website: 'https://bodistrictcouncil.gov.sl',
      email: 'chiefadmin@bodistrictcouncil.gov.sl',
      telephone: '+232 32 642 101',
      primaryContact: 'Augustine Mansaray',
      position: 'Chief Administrator',
      partnershipOfficer: 'Joseph Conteh (Procurement & Contracts Officer)',
      partnershipStatus: 'Active',
      category: 'Institutional Partnership',
      additionalCategories: ['Government Partnership'],
      financialValue: 350000,
      inKindValue: 220000,
      jointProjects: ['Bo Rural School Desks & Classroom Rehabilitation'],
      riskRating: 'Low',
      assessmentScore: 84,
      pipelineStage: 'Active Partnership',
      dateAdded: '2024-05-18',
      thematicArea: 'Decentralized Community Infrastructure',
      dueDiligenceStatus: 'Verified & Approved'
    },
    {
      id: 'BCF-PAR-2026-0008',
      relId: 'BCF-REL-2026-000108',
      name: 'GIZ Sierra Leone',
      type: 'Development Agency',
      registrationNumber: 'DEV-DEU-2015-044',
      country: 'Germany / Sierra Leone',
      district: 'Makeni / Bombali',
      address: '37 Wilkinson Road, Freetown & Makeni Field Base',
      website: 'https://www.giz.de/en/worldwide/338.html',
      email: 'giz-sierraleone@giz.de',
      telephone: '+232 78 889 001',
      primaryContact: 'Claudia Weber',
      position: 'Technical Advisor for Renewable Water',
      partnershipOfficer: 'Mohamed Bangura (Partnerships Manager)',
      partnershipStatus: 'Active',
      category: 'Technical Partnership',
      additionalCategories: ['In-Kind Partnership'],
      financialValue: 0,
      inKindValue: 850000,
      jointProjects: ['Solar Water Pumping & Technical Capacity Transfer'],
      riskRating: 'Low',
      assessmentScore: 94,
      pipelineStage: 'Active Partnership',
      dateAdded: '2025-03-01',
      thematicArea: 'Renewable Technology & Green WASH',
      dueDiligenceStatus: 'Verified & Approved'
    }
  ];

  const DEFAULT_AGREEMENTS = [
    {
      id: 'BCF-AGR-2026-0001',
      relId: 'BCF-REL-2026-000101',
      partnerId: 'BCF-PAR-2026-0001',
      partnerName: 'UNICEF Sierra Leone',
      agreementType: 'Memorandum of Understanding (MoU)',
      agreementTitle: 'MoU for Joint School Nutrition & Feeding Support',
      programmeId: 'BCF-PRG-001',
      programmeName: 'School Feeding Programme',
      startDate: '2024-01-01',
      endDate: '2026-12-31',
      financialValue: 1800000,
      inKindValue: 250000,
      bcfObligations: 'Manage Bo & Kenema distribution networks, conduct monthly monitoring, submit quarterly accountability statements.',
      partnerObligations: 'Co-finance bulk food grains and furnish solar cold-chain storage facilities in Bo District store.',
      deliverables: 'Monthly feeding rosters, quarterly M&E logs, joint asset register.',
      reportingRequirements: 'Quarterly narrative and expenditure reconciliation due within 15 days of quarter end.',
      confidentiality: 'Standard bilateral non-disclosure for beneficiary demographics.',
      dataProtection: 'Compliant with SL Data Protection Act and UNICEF PII policy.',
      safeguarding: 'Zero tolerance for PSEA and mandatory child protection vetting for all staff.',
      signatories: 'Dr. Sarah Johnson (Country Representative, UNICEF) & Dr. Sorie Sesay (CEO, BCF-SL)',
      signedDocument: 'SIGNED_MOU_BCF_UNICEF_2024.pdf',
      status: 'Active',
      renewalAlertDays: 86
    },
    {
      id: 'BCF-AGR-2026-0002',
      relId: 'BCF-REL-2026-000102',
      partnerId: 'BCF-PAR-2026-0002',
      partnerName: 'Ministry of Basic and Senior Secondary Education (MBSSE)',
      agreementType: 'Memorandum of Agreement (MoA)',
      agreementTitle: 'MoA for Primary School Facility Upgrade & WASH Integration',
      programmeId: 'BCF-PRG-002',
      programmeName: 'WASH in Schools Project',
      startDate: '2025-01-15',
      endDate: '2027-12-31',
      financialValue: 2500000,
      inKindValue: 600000,
      bcfObligations: 'Engineer and construct solar-powered borehole systems in 24 rural schools.',
      partnerObligations: 'Authorize school compound site access and appoint local school management committees.',
      deliverables: 'Civil works completion certificates, water quality testing, hand-over ceremony.',
      reportingRequirements: 'Semi-annual joint steering committee reports.',
      signatories: 'Hon. Minister of Basic Education & Dr. Sorie Sesay',
      signedDocument: 'SIGNED_MOA_BCF_MBSSE_2025.pdf',
      status: 'Active',
      renewalAlertDays: 451
    },
    {
      id: 'BCF-AGR-2026-0003',
      relId: 'BCF-REL-2026-000103',
      partnerId: 'BCF-PAR-2026-0003',
      partnerName: 'Irish Aid (Embassy of Ireland, Freetown)',
      agreementType: 'Grant Agreement',
      agreementTitle: 'Grant for Rural Girl Child Education Retention',
      programmeId: 'BCF-PRG-004',
      programmeName: 'Girls Education & Empowerment',
      startDate: '2025-03-01',
      endDate: '2026-11-30',
      financialValue: 950000,
      inKindValue: 50000,
      bcfObligations: 'Distribute sanitary dignity kits, disburse bursary stipends, enforce safeguarding.',
      partnerObligations: 'Disburse tranches upon timely M&E milestone signoffs.',
      deliverables: 'Beneficiary verification logs, retention rate analysis, audited expenditure.',
      reportingRequirements: 'Monthly cash-flow calls, quarterly certified financial statements.',
      signatories: 'Patrick O\'Brien (Irish Aid) & Aminata Turay (BCF-SL)',
      signedDocument: 'SIGNED_GRANT_IRISH_AID_2025.pdf',
      status: 'Active',
      renewalAlertDays: 55
    },
    {
      id: 'BCF-AGR-2026-0004',
      relId: 'BCF-REL-2026-000104',
      partnerId: 'BCF-PAR-2026-0004',
      partnerName: 'Save the Children Sierra Leone',
      agreementType: 'Consortium Agreement',
      agreementTitle: 'Consortium Framework on Community Safeguarding & Child Protection',
      programmeId: 'BCF-PRG-001',
      programmeName: 'School Feeding Programme',
      startDate: '2026-02-01',
      endDate: '2027-01-31',
      financialValue: 720000,
      inKindValue: 120000,
      bcfObligations: 'Deploy field community monitors across Bo and Kailahun.',
      partnerObligations: 'Provide certified child safeguarding training and psychosocial toolkits.',
      deliverables: 'Training of 45 teachers, community incident reporting box deployment.',
      signatories: 'Rebecca Davies (Save the Children) & Dr. Sorie Sesay (BCF-SL)',
      signedDocument: 'SIGNED_CONSORTIUM_SAVE_CHILDREN.pdf',
      status: 'Active',
      renewalAlertDays: 117
    },
    {
      id: 'BCF-AGR-2026-0005',
      relId: 'BCF-REL-2026-000108',
      partnerId: 'BCF-PAR-2026-0008',
      partnerName: 'GIZ Sierra Leone',
      agreementType: 'In-Kind Donation Agreement',
      agreementTitle: 'In-Kind Technical Support & Renewable Solar Pumping Kits',
      programmeId: 'BCF-PRG-002',
      programmeName: 'WASH in Schools Project',
      startDate: '2026-04-01',
      endDate: '2026-10-31',
      financialValue: 0,
      inKindValue: 850000,
      bcfObligations: 'Install kits in government-designated community clinics in Bombali.',
      partnerObligations: 'Supply German-certified solar submersible pumps and spare inventory.',
      deliverables: 'Shipment customs clearance, technician certification workshop.',
      signatories: 'Claudia Weber (GIZ) & Mohamed Bangura (BCF-SL)',
      signedDocument: 'SIGNED_INKIND_GIZ_2026.pdf',
      status: 'Active',
      renewalAlertDays: 25
    }
  ];

  const DEFAULT_DELIVERABLES = [
    {
      id: 'BCF-DEL-2026-0001',
      relId: 'BCF-REL-2026-000104',
      agreementId: 'BCF-AGR-2026-0004',
      partnerId: 'BCF-PAR-2026-0004',
      partnerName: 'Save the Children',
      deliverable: 'Safeguarding & PSEA Training for 45 Head Teachers',
      responsible: 'Partner',
      dueDate: '2026-11-15',
      status: 'In Progress',
      notes: 'Curriculum aligned with MBSSE standard code of conduct.'
    },
    {
      id: 'BCF-DEL-2026-0002',
      relId: 'BCF-REL-2026-000101',
      agreementId: 'BCF-AGR-2026-0001',
      partnerId: 'BCF-PAR-2026-0001',
      partnerName: 'UNICEF Sierra Leone',
      deliverable: 'Physical Delivery of 20 Solar Cold-Chain Coolers',
      responsible: 'Partner',
      dueDate: '2026-09-20',
      status: 'Completed',
      notes: 'Equipment received at BCF Bo Store and certified on GRN-2026-0024.'
    },
    {
      id: 'BCF-DEL-2026-0003',
      relId: 'BCF-REL-2026-000101',
      agreementId: 'BCF-AGR-2026-0001',
      partnerId: 'BCF-PAR-2026-0001',
      partnerName: 'UNICEF Sierra Leone',
      deliverable: 'Quarterly Programme Accountability & Reach Report',
      responsible: 'BCF-SL',
      dueDate: '2026-11-30',
      status: 'In Progress',
      notes: 'Compiling Bo and Kenema district school feeding registers.'
    },
    {
      id: 'BCF-DEL-2026-0004',
      relId: 'BCF-REL-2026-000103',
      agreementId: 'BCF-AGR-2026-0003',
      partnerId: 'BCF-PAR-2026-0003',
      partnerName: 'Irish Aid',
      deliverable: 'Mid-Term Financial Utilization & Verification Statement',
      responsible: 'Partner',
      dueDate: '2026-10-01',
      status: 'Overdue',
      notes: 'Auditor verification report delayed; follow-up sent via COM-2026-0046.'
    },
    {
      id: 'BCF-DEL-2026-0005',
      relId: 'BCF-REL-2026-000103',
      agreementId: 'BCF-AGR-2026-0003',
      partnerId: 'BCF-PAR-2026-0003',
      partnerName: 'Irish Aid',
      deliverable: 'Distribution of 500 Dignity & Hygiene Kits in Bo District',
      responsible: 'BCF-SL',
      dueDate: '2026-10-25',
      status: 'In Progress',
      notes: 'Procurement requisition PR-2026-0003 completed.'
    }
  ];

  const DEFAULT_DUE_DILIGENCE = [
    {
      id: 'BCF-DD-2026-0001',
      relId: 'BCF-REL-2026-000101',
      partnerId: 'BCF-PAR-2026-0001',
      partnerName: 'UNICEF Sierra Leone',
      status: 'Verified & Approved',
      completedDate: '2024-01-08',
      assessedBy: 'Internal Risk & Audit Department',
      riskRating: 'Low',
      overallScore: 96,
      decision: 'Strong Partner',
      checklist: {
        legal: { registrationCert: true, articles: true, taxRegistration: true, operatingLicense: true, authorizedRep: true, physicalAddress: true, bankDetails: true },
        organizational: { profile: true, governance: true, boardInfo: true, management: true, operationalYears: true, previousProjects: true, geographicCoverage: true, technicalCapacity: true },
        financial: { auditedStatements: true, auditReports: true, fundingSources: true, controls: true, bankVerification: true, previousDonorExp: true },
        compliance: { safeguarding: true, antiFraud: true, antiCorruption: true, conflictOfInterest: true, childProtection: true, gbvSafeguards: true, dataProtection: true, codeOfConduct: true, amlCtf: true },
        reputation: { references: true, previousPartners: true, donorHistory: true, noLitigation: true, sanctionsScreened: true }
      }
    },
    {
      id: 'BCF-DD-2026-0002',
      relId: 'BCF-REL-2026-000106',
      partnerId: 'BCF-PAR-2026-0006',
      partnerName: 'XYZ International Foundation',
      status: 'Under Review',
      completedDate: '2026-09-28',
      assessedBy: 'Mohamed Bangura & Risk Committee',
      riskRating: 'Medium',
      overallScore: 74,
      decision: 'Suitable',
      checklist: {
        legal: { registrationCert: true, articles: true, taxRegistration: true, operatingLicense: false, authorizedRep: true, physicalAddress: true, bankDetails: true },
        organizational: { profile: true, governance: true, boardInfo: true, management: true, operationalYears: true, previousProjects: true, geographicCoverage: true, technicalCapacity: true },
        financial: { auditedStatements: true, auditReports: true, fundingSources: true, controls: true, bankVerification: true, previousDonorExp: true },
        compliance: { safeguarding: true, antiFraud: true, antiCorruption: true, conflictOfInterest: true, childProtection: true, gbvSafeguards: false, dataProtection: true, codeOfConduct: true, amlCtf: true },
        reputation: { references: true, previousPartners: true, donorHistory: true, noLitigation: true, sanctionsScreened: true }
      }
    }
  ];

  const DEFAULT_PROPOSALS = [
    {
      id: 'BCF-PP-2026-0001',
      relId: 'BCF-REL-2026-000106',
      partnerId: 'BCF-PAR-2026-0006',
      partnerName: 'XYZ International Foundation',
      programme: 'Inclusive Education',
      project: 'School Support & Assistive Mobility – Bo District',
      objective: 'Provide learning materials, braille equipment, and assistive wheelchairs to 1,000 pupils with disabilities.',
      problemNeed: 'High dropout rates of vulnerable and disabled children in Bo District due to lacked mobility and learning devices.',
      proposedActivities: 'Procure 200 disability support kits, train 40 teachers in inclusive pedagogy, establish peer buddy circles.',
      expectedOutputs: '200 mobility kits deployed; 1,000 children enrolled; 40 educators certified.',
      expectedOutcomes: '95% school attendance retention among enrolled pupils with disabilities.',
      partnerContribution: 'NLe 350,000 grant + 200 assistive wheelchair units (valued at NLe 150,000 in-kind).',
      bcfContribution: 'Staffing, community mobilization, warehousing, distribution logistics, M&E data collection.',
      beneficiariesCount: 1000,
      location: 'Bo District (5 Chiefdoms)',
      implementationPeriod: '12 Months (Nov 2026 – Oct 2027)',
      estimatedValue: 500000,
      fundingSource: 'XYZ Foundation Global Disability Fund',
      approvalStatus: 'Under Management Review'
    }
  ];

  const DEFAULT_MEETINGS = [
    {
      id: 'BCF-MTG-2026-0001',
      relId: 'BCF-REL-2026-000106',
      partnerId: 'BCF-PAR-2026-0006',
      partnerName: 'XYZ International Foundation',
      date: '2026-10-06',
      location: 'Virtual / Microsoft Teams',
      participants: 'BCF-SL (Mohamed Bangura, Dr. Sorie Sesay) + XYZ Foundation (Dr. Arthur Wellesley)',
      agenda: 'Concept note review for Bo District Inclusive Education and due diligence checklist status.',
      discussion: 'Agreed on milestone-based funding tranche schedule. XYZ requested updated safeguarding compliance certificate.',
      decisions: 'Finalize concept note by 12 October 2026; submit formal proposal for CEO signoff.',
      responsiblePerson: 'Mohamed Bangura (Partnerships Manager)',
      deadline: '2026-10-12',
      minutesSummary: 'Discussion positive. Legal registration certificate confirmed. Awaiting local operating license addendum.'
    },
    {
      id: 'BCF-MTG-2026-0002',
      relId: 'BCF-REL-2026-000102',
      partnerId: 'BCF-PAR-2026-0002',
      partnerName: 'MBSSE Sierra Leone',
      date: '2026-09-18',
      location: 'MBSSE Conference Room, New England Ville',
      participants: 'BCF-SL (Paul Kamara, Mariama Bundu) + MBSSE Engineering Unit',
      agenda: 'Borehole site allocation in 12 selected Bo and Kenema primary schools.',
      decisions: 'MBSSE approved engineering site survey dates commencing 15 October.',
      responsiblePerson: 'Mariama J. Bundu',
      deadline: '2026-10-15',
      minutesSummary: 'Sites validated. Procurement of drilling contractors to follow BCF-SL competitive tender policy.'
    }
  ];

  const DEFAULT_COMMUNICATIONS = [
    {
      id: 'BCF-COM-2026-0045',
      relId: 'BCF-REL-2026-000106',
      partnerId: 'BCF-PAR-2026-0006',
      partnerName: 'XYZ International Foundation',
      date: '2026-10-06',
      type: 'Email',
      subject: 'Follow-Up on Concept Note Submission & Due Diligence Schedule',
      sentBy: 'Mohamed Bangura (Partnerships Manager)',
      responseStatus: 'Pending Response',
      nextFollowUp: '2026-10-09',
      notes: 'Sent updated BCF safeguarding policy document as requested.'
    },
    {
      id: 'BCF-COM-2026-0046',
      relId: 'BCF-REL-2026-000103',
      partnerId: 'BCF-PAR-2026-0003',
      partnerName: 'Irish Aid',
      date: '2026-10-02',
      type: 'Official Letter',
      subject: 'Overdue Notice: Submission of Certified Mid-Term Expenditure Statement',
      sentBy: 'Aminata Turay (Finance Director)',
      responseStatus: 'Acknowledged',
      nextFollowUp: '2026-10-10',
      notes: 'Irish Aid confirmed audit will be furnished by 10 October 2026.'
    }
  ];

  const DEFAULT_PERFORMANCE_REVIEWS = [
    {
      id: 'BCF-PAS-2026-0001',
      relId: 'BCF-REL-2026-000101',
      partnerId: 'BCF-PAR-2026-0001',
      partnerName: 'UNICEF Sierra Leone',
      period: 'FY 2025 Annual Review',
      reviewDate: '2026-01-15',
      rating: 'Excellent',
      score: 95,
      bcfFeedback: 'Exceptional responsiveness, timely co-financing disbursements, and superior technical assistance.',
      partnerFeedback: 'BCF-SL maintained outstanding field distribution accuracy and flawless community mobilization.',
      renewalRecommendation: 'Renew for 3-Year Strategic Cycle'
    }
  ];

  // ─────────────────────────────────────────────────────────────
  //  PARTNERSHIP CRUD & QUERY ENGINE
  // ─────────────────────────────────────────────────────────────
  function getPartners() { return _load(KEYS.PARTNERS, DEFAULT_PARTNERS); }
  function getPartner(id) { return _findById(KEYS.PARTNERS, id, DEFAULT_PARTNERS); }

  function savePartner(partner) {
    if (!partner) return null;
    if (!partner.id) partner.id = generateId('BCF-PAR');
    if (!partner.relId) partner.relId = generateRelId();
    if (!partner.dateAdded) partner.dateAdded = new Date().toISOString().split('T')[0];
    if (!partner.partnershipStatus) partner.partnershipStatus = 'Active';
    if (!partner.riskRating) partner.riskRating = 'Low';
    if (partner.assessmentScore === undefined) partner.assessmentScore = 80;
    
    _upsert(KEYS.PARTNERS, partner, DEFAULT_PARTNERS);
    addAuditEntry('Partnership', partner.relId || partner.id, 'Partner Registered/Updated', `${partner.name} (${partner.type || 'Partner'}) profile saved`);
    return partner;
  }

  function deletePartner(id) {
    return _remove(KEYS.PARTNERS, id, DEFAULT_PARTNERS);
  }

  // Agreements
  function getAgreements() { return _load(KEYS.PARTNERSHIP_AGREEMENTS, DEFAULT_AGREEMENTS); }
  function getAgreement(id) { return _findById(KEYS.PARTNERSHIP_AGREEMENTS, id, DEFAULT_AGREEMENTS); }
  function saveAgreement(agr) {
    if (!agr) return null;
    if (!agr.id) agr.id = generateId('BCF-AGR');
    if (!agr.startDate) agr.startDate = new Date().toISOString().split('T')[0];
    if (!agr.status) agr.status = 'Active';
    if (!agr.relId && agr.partnerId) {
      const p = getPartner(agr.partnerId);
      agr.relId = (p && p.relId) || generateRelId();
    }
    _upsert(KEYS.PARTNERSHIP_AGREEMENTS, agr, DEFAULT_AGREEMENTS);
    addAuditEntry('Partnership Agreement', agr.relId || agr.id, `Agreement ${agr.status}`, `${agr.agreementTitle} (${agr.agreementType}) saved`);
    return agr;
  }
  function deleteAgreement(id) {
    return _remove(KEYS.PARTNERSHIP_AGREEMENTS, id, DEFAULT_AGREEMENTS);
  }

  // Deliverables
  function getDeliverables() { return _load(KEYS.PARTNERSHIP_DELIVERABLES, DEFAULT_DELIVERABLES); }
  function getDeliverable(id) { return _findById(KEYS.PARTNERSHIP_DELIVERABLES, id, DEFAULT_DELIVERABLES); }
  function saveDeliverable(deliv) {
    if (!deliv) return null;
    if (!deliv.id) deliv.id = generateId('BCF-DEL');
    if (!deliv.status) deliv.status = 'In Progress';
    _upsert(KEYS.PARTNERSHIP_DELIVERABLES, deliv, DEFAULT_DELIVERABLES);
    addAuditEntry('Partnership Deliverable', deliv.relId || deliv.id, `Deliverable: ${deliv.status}`, `${deliv.deliverable} (${deliv.partnerName || 'Partner'})`);
    return deliv;
  }
  function deleteDeliverable(id) {
    return _remove(KEYS.PARTNERSHIP_DELIVERABLES, id, DEFAULT_DELIVERABLES);
  }

  // Due Diligence
  function getDueDiligenceList() { return _load(KEYS.PARTNERSHIP_DUE_DILIGENCE, DEFAULT_DUE_DILIGENCE); }
  function getDueDiligence(id) { return _findById(KEYS.PARTNERSHIP_DUE_DILIGENCE, id, DEFAULT_DUE_DILIGENCE); }
  function saveDueDiligence(dd) {
    if (!dd) return null;
    if (!dd.id) dd.id = generateId('BCF-DD');
    if (!dd.completedDate) dd.completedDate = new Date().toISOString().split('T')[0];
    _upsert(KEYS.PARTNERSHIP_DUE_DILIGENCE, dd, DEFAULT_DUE_DILIGENCE);
    addAuditEntry('Due Diligence', dd.relId || dd.id, `Due Diligence ${dd.status}`, `DD Checklist evaluated for ${dd.partnerName} — Score: ${dd.overallScore}%`);
    return dd;
  }

  // Proposals
  function getProposals() { return _load(KEYS.PARTNERSHIP_PROPOSALS, DEFAULT_PROPOSALS); }
  function getProposal(id) { return _findById(KEYS.PARTNERSHIP_PROPOSALS, id, DEFAULT_PROPOSALS); }
  function saveProposal(prop) {
    if (!prop) return null;
    if (!prop.id) prop.id = generateId('BCF-PP');
    if (!prop.approvalStatus) prop.approvalStatus = 'Draft Proposal';
    _upsert(KEYS.PARTNERSHIP_PROPOSALS, prop, DEFAULT_PROPOSALS);
    addAuditEntry('Partnership Proposal', prop.relId || prop.id, `Proposal ${prop.approvalStatus}`, `${prop.project} for ${prop.partnerName}`);
    return prop;
  }
  function deleteProposal(id) {
    return _remove(KEYS.PARTNERSHIP_PROPOSALS, id, DEFAULT_PROPOSALS);
  }

  // Meetings & Comms
  function getMeetings() { return _load(KEYS.PARTNERSHIP_MEETINGS, DEFAULT_MEETINGS); }
  function saveMeeting(mtg) {
    if (!mtg) return null;
    if (!mtg.id) mtg.id = generateId('BCF-MTG');
    if (!mtg.date) mtg.date = new Date().toISOString().split('T')[0];
    _upsert(KEYS.PARTNERSHIP_MEETINGS, mtg, DEFAULT_MEETINGS);
    addAuditEntry('Partnership Meeting', mtg.relId || mtg.id, 'Meeting Logged', `${mtg.agenda} with ${mtg.partnerName}`);
    return mtg;
  }

  function getCommunications() { return _load(KEYS.PARTNERSHIP_COMMUNICATIONS, DEFAULT_COMMUNICATIONS); }
  function saveCommunication(comm) {
    if (!comm) return null;
    if (!comm.id) comm.id = generateId('BCF-COM');
    if (!comm.date) comm.date = new Date().toISOString().split('T')[0];
    _upsert(KEYS.PARTNERSHIP_COMMUNICATIONS, comm, DEFAULT_COMMUNICATIONS);
    addAuditEntry('Partnership Communication', comm.relId || comm.id, `Comm: ${comm.type}`, `${comm.subject} with ${comm.partnerName}`);
    return comm;
  }

  // Performance Reviews
  function getPartnerPerformanceList() { return _load(KEYS.PARTNERSHIP_PERFORMANCE, DEFAULT_PERFORMANCE_REVIEWS); }
  function savePartnerPerformance(perf) {
    if (!perf) return null;
    if (!perf.id) perf.id = generateId('BCF-PAS');
    _upsert(KEYS.PARTNERSHIP_PERFORMANCE, perf, DEFAULT_PERFORMANCE_REVIEWS);
    addAuditEntry('Partner Performance Review', perf.relId || perf.id, `Review ${perf.rating}`, `${perf.period} for ${perf.partnerName}`);
    return perf;
  }

  async function sendPartnerRegistrationEmail(partner) {
    const targetEmail = (partner && (partner.email || partner.officialEmail || partner.official_email || partner.emailAddress)) ? String(partner.email || partner.officialEmail || partner.official_email || partner.emailAddress).trim() : '';
    if (!targetEmail || !targetEmail.includes('@')) {
      return { success: false, error: 'Valid partner official email address is missing' };
    }
    const cleanPartner = { ...partner, email: targetEmail };
    try {
      const data = await postProcurementApi('/api/send-partner-registration-email', { partner: cleanPartner });
      if (data && data.success) {
        addAuditEntry('Partnership', cleanPartner.relId || cleanPartner.id, 'Registration Email Transmitted', `Official registration statement transmitted to ${cleanPartner.name} at ${cleanPartner.email} via Gmail SMTP`);
      }
      return data;
    } catch (err) {
      console.warn('sendPartnerRegistrationEmail network error:', err);
      return { success: false, error: err.message || 'Network request failed' };
    }
  }

  async function sendPartnerProposalEmail(proposal, partner) {
    const targetEmail = ((proposal && (proposal.partnerEmail || proposal.officialEmail || proposal.email)) || (partner && (partner.email || partner.officialEmail || partner.official_email)) || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      return { success: false, error: 'Valid partner official email address is missing' };
    }
    const cleanProposal = { ...proposal, partnerEmail: targetEmail, officialEmail: targetEmail };
    const cleanPartner = partner ? { ...partner, email: targetEmail, officialEmail: targetEmail } : { email: targetEmail, officialEmail: targetEmail, name: proposal?.partnerName || 'Partner' };
    try {
      const data = await postProcurementApi('/api/send-partner-proposal-email', { proposal: cleanProposal, partner: cleanPartner });
      if (data && data.success) {
        addAuditEntry('Partnership Proposal', cleanProposal.relId || cleanProposal.id, 'Proposal Transmitted', `Joint proposal ${cleanProposal.id} transmitted to ${cleanPartner.name} at ${targetEmail} via Gmail SMTP`);
      }
      return data;
    } catch (err) {
      console.warn('sendPartnerProposalEmail network error:', err);
      return { success: false, error: err.message || 'Network request failed' };
    }
  }

  function terminatePartner(partnerId, reason) {
    const list = _load(KEYS.PARTNERS, DEFAULT_PARTNERS);
    const pIdx = list.findIndex(item => item.id === partnerId);
    if (pIdx < 0) return { success: false, error: 'Partner not found' };

    const termDate = new Date().toISOString().split('T')[0];
    const partner = list[pIdx];
    partner.partnershipStatus = 'Terminated';
    partner.previousPipelineStage = partner.pipelineStage || 'Active Partnership';
    partner.pipelineStage = 'Terminated';
    partner.terminationReason = (reason || 'Institutional partnership terminated by Directorate of Strategic Partnerships').trim();
    partner.terminatedDate = termDate;
    partner.terminatedAt = termDate;
    partner.terminatedBy = 'Directorate of Strategic Partnerships & Resource Mobilization';

    list[pIdx] = partner;
    _save(KEYS.PARTNERS, list);

    addAuditEntry(
      'Partnership Management',
      partner.relId || partner.id,
      'Partnership Terminated',
      `Partnership for ${partner.name} (${partner.id}) officially terminated. Reason: ${partner.terminationReason}`
    );

    return {
      success: true,
      partner: { ...partner }
    };
  }

  function reinstatePartner(partnerId, reason) {
    const list = _load(KEYS.PARTNERS, DEFAULT_PARTNERS);
    const pIdx = list.findIndex(item => item.id === partnerId);
    if (pIdx < 0) return { success: false, error: 'Partner not found' };

    const reinstateDate = new Date().toISOString().split('T')[0];
    const partner = list[pIdx];
    partner.partnershipStatus = 'Active';
    partner.pipelineStage = partner.previousPipelineStage || 'Active Partnership';
    delete partner.previousPipelineStage;
    partner.reinstatedDate = reinstateDate;
    partner.reinstatedAt = reinstateDate;
    partner.reinstatementReason = (reason || 'Institutional partnership officially reinstated and renewed following governance review').trim();
    partner.reinstatedBy = 'Directorate of Strategic Partnerships & Resource Mobilization';

    list[pIdx] = partner;
    _save(KEYS.PARTNERS, list);

    addAuditEntry(
      'Partnership Management',
      partner.relId || partner.id,
      'Partnership Reinstated',
      `Partnership for ${partner.name} (${partner.id}) officially reinstated and restored. Reason: ${partner.reinstatementReason}`
    );

    return {
      success: true,
      partner: { ...partner }
    };
  }

  async function sendPartnerTerminationEmail(partnerOrResult, reason) {
    let rawPartner = (partnerOrResult && partnerOrResult.partner) ? partnerOrResult.partner : partnerOrResult;
    const targetEmail = (rawPartner && (rawPartner.email || rawPartner.officialEmail || rawPartner.official_email || rawPartner.emailAddress)) ? String(rawPartner.email || rawPartner.officialEmail || rawPartner.official_email || rawPartner.emailAddress).trim() : '';
    if (!targetEmail || !targetEmail.includes('@')) {
      console.warn('sendPartnerTerminationEmail: Partner official email is missing', rawPartner);
      return { success: false, error: 'Partner official email is missing' };
    }
    const cleanPartner = { ...rawPartner, email: targetEmail };
    const effectiveReason = reason || cleanPartner.terminationReason || 'Institutional partnership terminated by Directorate of Strategic Partnerships';
    try {
      const data = await postProcurementApi('/api/send-partner-termination-email', {
        to: targetEmail,
        partner: cleanPartner,
        reason: effectiveReason,
        effectiveDate: cleanPartner.terminatedDate || new Date().toISOString().split('T')[0],
        terminatedBy: cleanPartner.terminatedBy || 'Directorate of Strategic Partnerships & Resource Mobilization'
      });
      if (data && data.success) {
        addAuditEntry(
          'Partnership Management',
          cleanPartner.relId || cleanPartner.id,
          'Termination Notice Dispatched',
          `Official partnership termination notice dispatched to ${targetEmail} via Gmail SMTP`
        );
      }
      return data;
    } catch (err) {
      console.warn('sendPartnerTerminationEmail network error:', err);
      return { success: false, error: err.message || 'Network request failed' };
    }
  }

  async function sendPartnerReinstatementEmail(partnerOrResult, reason) {
    let rawPartner = (partnerOrResult && partnerOrResult.partner) ? partnerOrResult.partner : partnerOrResult;
    const targetEmail = (rawPartner && (rawPartner.email || rawPartner.officialEmail || rawPartner.official_email || rawPartner.emailAddress)) ? String(rawPartner.email || rawPartner.officialEmail || rawPartner.official_email || rawPartner.emailAddress).trim() : '';
    if (!targetEmail || !targetEmail.includes('@')) {
      console.warn('sendPartnerReinstatementEmail: Partner official email is missing', rawPartner);
      return { success: false, error: 'Partner official email is missing' };
    }
    const cleanPartner = { ...rawPartner, email: targetEmail };
    const effectiveReason = reason || cleanPartner.reinstatementReason || 'Institutional partnership officially reinstated and renewed following governance review';
    try {
      const data = await postProcurementApi('/api/send-partner-reinstatement-email', {
        to: targetEmail,
        partner: cleanPartner,
        reason: effectiveReason,
        effectiveDate: cleanPartner.reinstatedDate || new Date().toISOString().split('T')[0],
        reinstatedBy: cleanPartner.reinstatedBy || 'Directorate of Strategic Partnerships & Resource Mobilization'
      });
      if (data && data.success) {
        addAuditEntry(
          'Partnership Management',
          cleanPartner.relId || cleanPartner.id,
          'Reinstatement Notice Dispatched',
          `Official partnership reinstatement notice dispatched to ${targetEmail} via Gmail SMTP`
        );
      }
      return data;
    } catch (err) {
      console.warn('sendPartnerReinstatementEmail network error:', err);
      return { success: false, error: err.message || 'Network request failed' };
    }
  }


  // ─────────────────────────────────────────────────────────────
  //  CENTRAL RELATIONSHIP ID ENGINE: BCF-REL-YYYY-NNNNNN
  // ─────────────────────────────────────────────────────────────
  function generateRelId() {
    let relCount = parseInt(_safeStorage.getItem(KEYS.REL_COUNTER) || '108', 10) + 1;
    _safeStorage.setItem(KEYS.REL_COUNTER, String(relCount));
    const yr = new Date().getFullYear();
    return `BCF-REL-${yr}-${String(relCount).padStart(6, '0')}`;
  }

  function generatePartnerId() { return generateId('BCF-PAR'); }
  function generateAgreementId() { return generateId('BCF-AGR'); }
  function generateProposalId() { return generateId('BCF-PP'); }
  function generateDdId() { return generateId('BCF-DD'); }
  function generateDeliverableId() { return generateId('BCF-DEL'); }
  function generateCommId() { return generateId('BCF-COM'); }
  function generateMtgId() { return generateId('BCF-MTG'); }

  // ─────────────────────────────────────────────────────────────
  //  WEIGHTED ASSESSMENT SCORE CALCULATOR
  // ─────────────────────────────────────────────────────────────
  function calculateAssessmentScore(scoreMap) {
    // Expected keys: crit-1 through crit-9 with numeric values 0–100
    let totalScore = 0;
    POLICY.ASSESSMENT_CRITERIA.forEach(crit => {
      const rawVal = Math.min(100, Math.max(0, parseFloat(scoreMap[crit.id] || 0)));
      totalScore += (rawVal * (crit.weight / 100));
    });
    totalScore = Math.round(totalScore);

    let decision = 'Not Recommended';
    if (totalScore >= POLICY.DECISION_THRESHOLDS.STRONG) {
      decision = 'Strong Partner';
    } else if (totalScore >= POLICY.DECISION_THRESHOLDS.SUITABLE) {
      decision = 'Suitable';
    } else if (totalScore >= POLICY.DECISION_THRESHOLDS.CONDITIONAL) {
      decision = 'Suitable with Conditions';
    }

    return {
      score: totalScore,
      decision,
      status: totalScore >= 65 ? 'Qualified' : (totalScore >= 50 ? 'Conditional' : 'Disqualified')
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  AGGREGATE KPI INDICATORS & AUTOMATED ALERTS
  // ─────────────────────────────────────────────────────────────
  function getPartnershipStats() {
    const partners = getPartners();
    const agreements = getAgreements();
    const deliverables = getDeliverables();
    const ddList = getDueDiligenceList();

    const activePartners = partners.filter(p => p.partnershipStatus === 'Active');
    const prospectivePartners = partners.filter(p => p.partnershipStatus === 'Prospective');
    const dueDiligencePartners = partners.filter(p => (p.pipelineStage === 'Due Diligence' || p.pipelineStage === 'Partner Assessment'));
    const awaitingApproval = partners.filter(p => p.pipelineStage === 'Approval');
    const underNegotiation = partners.filter(p => p.pipelineStage === 'Negotiation');

    const totalFinancialValue = partners.reduce((sum, p) => sum + (parseFloat(p.financialValue) || 0), 0);
    const totalInKindValue = partners.reduce((sum, p) => sum + (parseFloat(p.inKindValue) || 0), 0);

    const activeAgreements = agreements.filter(a => a.status === 'Active');
    
    // Check expiring agreements (90, 60, 30 days)
    const now = new Date();
    const expiringSoon = agreements.filter(a => {
      if (!a.endDate || a.status !== 'Active') return false;
      const end = new Date(a.endDate);
      const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 90;
    });

    const overdueDeliverables = deliverables.filter(d => {
      if (d.status === 'Completed' || d.status === 'Waived') return false;
      if (!d.dueDate) return false;
      return new Date(d.dueDate) < now;
    });

    // Breakdown aggregations
    const byDistrict = {};
    const byPartnerType = {};
    const byCategory = {};

    partners.forEach(p => {
      const d = p.district || 'Unassigned';
      byDistrict[d] = (byDistrict[d] || 0) + 1;

      const t = p.type || 'Other';
      byPartnerType[t] = (byPartnerType[t] || 0) + 1;

      const c = p.category || 'General';
      byCategory[c] = (byCategory[c] || 0) + 1;
    });

    // Compile Automated Dashboard Alerts (Section 1)
    const alerts = [];

    // Expiry alerts
    expiringSoon.forEach(agr => {
      const diffDays = Math.ceil((new Date(agr.endDate) - now) / (1000 * 60 * 60 * 24));
      const urgency = diffDays <= 30 ? 'critical' : (diffDays <= 60 ? 'high' : 'medium');
      alerts.push({
        id: `alert-exp-${agr.id}`,
        type: 'Agreement Expiry',
        title: `Agreement Expiring in ${diffDays} Days: ${agr.agreementTitle}`,
        message: `${agr.partnerName} (${agr.agreementType}) expires on ${formatDate(agr.endDate)}. Renewal review required.`,
        severity: urgency,
        partnerId: agr.partnerId,
        refId: agr.id
      });
    });

    // Overdue deliverables alerts
    overdueDeliverables.forEach(deliv => {
      alerts.push({
        id: `alert-deliv-${deliv.id}`,
        type: 'Overdue Deliverable',
        title: `Deliverable Delayed: ${deliv.deliverable}`,
        message: `Assigned to ${deliv.responsible} (${deliv.partnerName}). Due on ${formatDate(deliv.dueDate)}.`,
        severity: 'high',
        partnerId: deliv.partnerId,
        refId: deliv.id
      });
    });

    // Due diligence missing docs
    ddList.forEach(dd => {
      if (dd.status !== 'Verified & Approved') {
        alerts.push({
          id: `alert-dd-${dd.id}`,
          type: 'Due Diligence Action',
          title: `Pending Due Diligence: ${dd.partnerName}`,
          message: `Score: ${dd.overallScore}%. Missing legal/safeguarding documents require clearance.`,
          severity: 'medium',
          partnerId: dd.partnerId,
          refId: dd.id
        });
      }
    });

    return {
      totalPartners: partners.length,
      activePartners: activePartners.length,
      prospectivePartners: prospectivePartners.length,
      dueDiligencePartners: dueDiligencePartners.length,
      awaitingApproval: awaitingApproval.length,
      underNegotiation: underNegotiation.length,
      totalFinancialValue,
      totalInKindValue,
      activeAgreements: activeAgreements.length,
      expiringAgreementsCount: expiringSoon.length,
      overdueDeliverablesCount: overdueDeliverables.length,
      byDistrict,
      byPartnerType,
      byCategory,
      alerts
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  CENTRAL MASTER RELATIONSHIP EXPLORER (BCF-REL Cross-Module)
  //  Connects: Partner → Agreement → Programme → Grant → Budget → PR → PO → GRN → Invoice
  // ─────────────────────────────────────────────────────────────
  function getRelationshipOverview(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).trim().toLowerCase();

    const partner = getPartners().find(p => 
      (p.relId && p.relId.toLowerCase() === clean) ||
      (p.id && p.id.toLowerCase() === clean) ||
      (p.name && p.name.toLowerCase().includes(clean))
    ) || null;

    const relId = (partner && partner.relId) || identifier;

    const agreements = getAgreements().filter(a => 
      (a.relId && a.relId.toLowerCase() === clean) ||
      (partner && a.partnerId === partner.id)
    );

    const deliverables = getDeliverables().filter(d => 
      (d.relId && d.relId.toLowerCase() === clean) ||
      (partner && d.partnerId === partner.id)
    );

    // Connected Procurement Requisitions (matches partnerId or donorName or relId)
    const allPrs = getRequisitions();
    const linkedPrs = allPrs.filter(pr => 
      (pr.relId && pr.relId === relId) ||
      (partner && (
        (pr.partnerId && pr.partnerId === partner.id) ||
        (pr.donorName && pr.donorName.toLowerCase().includes(partner.name.toLowerCase()))
      ))
    );

    // Connected Purchase Orders
    const allPos = getPurchaseOrders();
    const linkedPos = allPos.filter(po => 
      (po.relId && po.relId === relId) ||
      linkedPrs.some(pr => pr.id === po.prId)
    );

    // Connected GRNs
    const allGrns = getGrns();
    const linkedGrns = allGrns.filter(grn => 
      linkedPos.some(po => po.id === grn.poId)
    );

    // Total procurement spend committed under this relationship
    const procurementCommitted = linkedPos.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0);

    return {
      relId,
      partner,
      agreements,
      deliverables,
      linkedPrs,
      linkedPos,
      linkedGrns,
      procurementCommitted,
      financialSummary: {
        totalAgreed: agreements.reduce((s, a) => s + (parseFloat(a.financialValue) || 0), 0),
        inKindAgreed: agreements.reduce((s, a) => s + (parseFloat(a.inKindValue) || 0), 0),
        procurementCommitted
      }
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  TABS & UNIFIED NAVIGATION ENGINE
  // ─────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'purchase-requisition', label: 'Purchase Requisitions (PR)', shortLabel: 'Requisitions', icon: 'request_quote', href: '../purchase_requisition/code.html', route: '/procurement/purchase-requisition' },
    { id: 'supplier-management', label: 'Supplier Master Data', shortLabel: 'Suppliers', icon: 'storefront', href: '../supplier_management/code.html', route: '/procurement/supplier-management' },
    { id: 'rfq-management', label: 'RFQ & Quotations', shortLabel: 'RFQ & Quotes', icon: 'forward_to_inbox', href: '../rfq_management/code.html', route: '/procurement/rfq-management' },
    { id: 'purchase-order', label: 'Purchase Orders (PO)', shortLabel: 'Purchase Orders', icon: 'shopping_bag', href: '../purchase_order/code.html', route: '/procurement/purchase-order' },
    { id: 'goods-received-note', label: 'Goods Received (GRN)', shortLabel: 'GRN Receipts', icon: 'inventory_2', href: '../goods_received_note/code.html', route: '/procurement/goods-received-note' },
    { id: 'invoice-matching', label: 'Invoice & 3-Way Match', shortLabel: '3-Way Match', icon: 'receipt_long', href: '../invoice_matching/code.html', route: '/procurement/invoice-matching' },
    { id: 'transaction-audit-trail', label: 'Transaction Audit Trail', shortLabel: 'TXN Audit', icon: 'timeline', href: '../transaction_audit_trail/code.html', route: '/procurement/transaction-audit-trail' },
    { id: 'partnership-management', label: 'Partnership Management Hub', shortLabel: 'Partnerships', icon: 'handshake', href: '../partnership_management/code.html', route: '/procurement/partnership-management' },
    { id: 'procurement-dashboard', label: 'Spend Analytics Dashboard', shortLabel: 'Executive Analytics', icon: 'insights', href: '../procurement_dashboard/code.html', route: '/procurement/procurement-dashboard' },
    { id: 'procurement-data', label: 'Procurement Data Hub', shortLabel: 'Data Feeds', icon: 'database', href: '../procurement_data_management/code.html', route: '/procurement/procurement-data' }
  ];

  function switchTab(tabId) {
    const target = TABS.find(t => t.id === tabId);
    if (!target) return;
    try {
      if (window.top && window.top !== window && window.top.location) {
        window.top.location.href = target.route;
        return;
      }
    } catch (e) {}
    window.location.href = target.href;
  }

  function showToast(msg, type = 'info') {
    const existing = document.getElementById('bcf-proc-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'bcf-proc-toast';
    const bg = type === 'error' ? 'bg-red-700' : (type === 'success' ? 'bg-emerald-700' : 'bg-slate-900');
    toast.className = `fixed bottom-6 right-6 z-[9999] px-4 py-3 rounded-xl shadow-2xl text-white text-xs font-bold flex items-center gap-2.5 ${bg} border border-white/20 transition-all`;
    const icon = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');
    toast.innerHTML = `<span class="material-symbols-outlined text-[18px]">${icon}</span><span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }

  function renderHeaderAndTabs(activeTabId) {
    const container = document.getElementById('bcf-procurement-nav-header');
    if (!container) return;

    const prList = getRequisitions();
    const supList = getSuppliers();
    const poList = getPurchaseOrders();
    const totalSpend = poList.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const pendingPrs = prList.filter(p => p.status.includes('Pending') || p.status.includes('Draft')).length;

    container.innerHTML = `
      <header class="bg-surface border-b border-outline/30 sticky top-0 z-40 shadow-xs">
        <!-- Top Institutional Brand Bar -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <img src="/bcf-logo.jpg" onerror="this.src='../bcf-logo.jpg'; this.onerror=function(){this.src='../../bcf-logo.jpg'}" alt="BCF-SL Logo" class="h-9 w-auto object-contain shrink-0 rounded"/>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-sm sm:text-base text-primary tracking-tight truncate uppercase leading-none">
                  Bandama Charity Foundation
                </span>
                <span class="hidden sm:inline-block px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  SIERRA LEONE
                </span>
              </div>
              <span class="text-[11px] font-semibold text-secondary truncate mt-0.5">
                Integrated Procurement &amp; Central Transaction Engine &bull; Fiscal Year ${POLICY.FISCAL_YEAR}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- Quick KPI Chips -->
            <div class="hidden md:flex items-center gap-2">
              <div class="px-2.5 py-1 rounded-lg bg-surface-container border border-slate-200 text-left">
                <span class="block text-[9px] font-extrabold uppercase text-slate-400">Total Spend</span>
                <span class="block text-xs font-black text-primary font-mono">${formatCurrency(totalSpend)}</span>
              </div>
              <div class="px-2.5 py-1 rounded-lg bg-surface-container border border-slate-200 text-left">
                <span class="block text-[9px] font-extrabold uppercase text-slate-400">Pending PRs</span>
                <span class="block text-xs font-black text-amber-700 font-mono">${pendingPrs} Action Req.</span>
              </div>
              <div class="px-2.5 py-1 rounded-lg bg-surface-container border border-slate-200 text-left">
                <span class="block text-[9px] font-extrabold uppercase text-slate-400">Suppliers</span>
                <span class="block text-xs font-black text-emerald-700 font-mono">${supList.length} Active</span>
              </div>
            </div>

            <!-- Central TXN Search Shortcut -->
            <button onclick="BCF_PROCUREMENT.promptTxnLookup()" class="h-9 px-3 rounded-xl border border-slate-300 hover:border-primary/50 bg-white hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 text-slate-700 shadow-2xs transition active:scale-95 cursor-pointer" title="Find transaction across all lifecycle modules">
              <span class="material-symbols-outlined text-[16px] text-primary">manage_search</span>
              <span class="hidden sm:inline">Track TXN</span>
            </button>
          </div>
        </div>

        <!-- Horizontal Tabs Bar -->
        <div class="border-t border-slate-200/80 bg-slate-50/90 overflow-x-auto no-scrollbar shadow-inner">
          <div class="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-1.5 py-1.5 min-w-max">
            ${TABS.map((tab, idx) => {
              const isActive = tab.id === activeTabId;
              return `
                <button
                  type="button"
                  onclick="BCF_PROCUREMENT.switchTab('${tab.id}')"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
                    isActive
                      ? "bg-primary text-white shadow-sm ring-1 ring-primary/80"
                      : "text-slate-600 hover:text-primary hover:bg-white"
                  }"
                >
                  <span class="text-[10px] opacity-75 font-mono">${idx + 1}.</span>
                  <span class="material-symbols-outlined text-[16px] ${isActive ? "text-white" : "text-slate-400"}">${tab.icon}</span>
                  <span>${tab.shortLabel}</span>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      </header>
    `;
  }

  function promptTxnLookup() {
    const input = prompt("Enter Master Transaction ID or Reference (e.g. BCF-TXN-2026-000001, BCF-PR-2026-0001, or BCF-PO-2026-0001):", "BCF-TXN-2026-000001");
    if (!input) return;
    const res = getTransaction(input.trim());
    if (!res || (!res.requisition && !res.purchaseOrder && !res.rfq && !res.grn && !res.invoice)) {
      alert(`No record found matching "${input}".\n\nPlease check the Transaction or PR reference number.`);
      return;
    }
    // Switch to transaction audit trail tab with search param
    localStorage.setItem('bcf_selected_txn_id', res.txnId);
    switchTab('transaction-audit-trail');
  }

  // ─────────────────────────────────────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────────────────────────────────────
  return {
    POLICY,
    KEYS,
    TABS,

    // Navigation & UI
    switchTab,
    renderHeaderAndTabs,
    showToast,
    promptTxnLookup,

    // Suppliers
    getSuppliers,
    getActiveSuppliers,
    getSupplier,
    getSupplierOrders,
    getSupplierSpend,
    enrichSupplierWithOrders,
    syncSuppliersOrdersAndSpend,
    saveSupplier,
    removeSupplier,
    terminateVendorAgreement,
    reinstateVendorAgreement,
    sendVendorEnlistmentEmail,
    sendVendorTerminationEmail,
    sendVendorReinstatementEmail,
    getSuppliersByCategory,
    sendRfqEmail,
    transmitRfqToInvitedVendors,

    // Programmes
    getProgrammes,
    getProgramme,

    // Donors & Grants
    getDonors,
    getDonor,
    getGrants,
    getGrant,
    getGrantsByDonor,
    getGrantsByProgramme,

    // Requisitions
    getRequisitions,
    getRequisition,
    saveRequisition,

    // RFQs
    getRfqs,
    getRfq,
    saveRfq,
    sendRfqEmail,
    buildRfqWordDocumentHtml,
    downloadRfqWordDoc,

    // Purchase Orders
    getPurchaseOrders,
    getPurchaseOrder,
    savePurchaseOrder,

    // GRNs
    getGrns,
    getGrn,
    saveGrn,
    sendGrnEmail,

    // Invoices & 3-Way Match
    getInvoices,
    getInvoice,
    saveInvoice,
    performThreeWayMatch,

    // Central Transaction Engine
    getTransaction,

    // Partnership Management Module (BCF-SL Central Relationship Engine)
    getPartners,
    getPartner,
    savePartner,
    deletePartner,

    // Partnership Agreements & MoUs
    getAgreements,
    getAgreement,
    saveAgreement,
    deleteAgreement,

    // Deliverables & Milestones
    getDeliverables,
    getDeliverable,
    saveDeliverable,
    deleteDeliverable,

    // Due Diligence & Risk
    getDueDiligenceList,
    getDueDiligence,
    saveDueDiligence,
    calculateAssessmentScore,

    // Proposals
    getProposals,
    getProposal,
    saveProposal,
    deleteProposal,

    // Meetings & Communications
    getMeetings,
    saveMeeting,
    getCommunications,
    saveCommunication,

    // Performance & Feedback
    getPartnerPerformanceList,
    savePartnerPerformance,

    // Stats, Alerts & Cross-Module Linking
    getPartnershipStats,
    getRelationshipOverview,
    sendPartnerRegistrationEmail,
    sendPartnerProposalEmail,
    terminatePartner,
    reinstatePartner,
    sendPartnerTerminationEmail,
    sendPartnerReinstatementEmail,

    // ID Generators for Partnerships
    generatePartnerId,
    generateAgreementId,
    generateProposalId,
    generateDdId,
    generateDeliverableId,
    generateCommId,
    generateMtgId,
    generateRelId,

    // Budget Engine
    checkBudget,
    determineProcurementMethod,
    getApprovalChain,

    // Audit Trail
    addAuditEntry,
    getAuditTrail,

    // Staff
    getStaffRegistry,
    getStaffMember,

    // ID Generation
    generateTxnId,
    generateId,

    // Formatting
    formatNumber,
    formatCurrency,
    formatDate,
    formatDateTime,
    getStatusColor,
    getInitials,
    timeAgo
  };
})();

if (typeof window !== 'undefined') {
  window.BCF_PROCUREMENT = BCF_PROCUREMENT;
}
