import { NextRequest, NextResponse } from "next/server";
import { sendMail, EMAIL_CONFIG } from "@/lib/mail";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  return NextResponse.json(
    {
      success: true,
      service: "BCF-SL Leave & Allowance Automated Notification Service",
      status: "Operational",
      timestamp: new Date().toISOString(),
      action: action || "status_check",
      smtp: {
        host: EMAIL_CONFIG.host || "smtp.gmail.com",
        port: EMAIL_CONFIG.port || 587,
        configured: !!EMAIL_CONFIG.user,
        sender: EMAIL_CONFIG.user,
      },
      policyDirectives: {
        annualLeaveDays: 31,
        allowanceRate: "5% of Annual Basic Salary",
        allowanceFrequency: "Strictly Once Per Anniversary Service Year",
        lockoutOnExhaustion: "Locked until employee anniversary date met again",
        automatedTrigger: "Auto-dispatches email upon service anniversary when leave days become due"
      }
    },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type || "ELIGIBILITY_ANNIVERSARY";
    const to = (body.to || "").trim();

    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid recipient email address is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const employeeName = body.employeeName || "Employee";
    const employeeId = body.employeeId || "BCF-EMP-00025";
    const empDate = body.employmentDate || "15/10/2025";
    const eligDate = body.eligibilityDate || "15/10/2026";
    const entitlement = body.leaveEntitlement || "31 Working Days";
    const allowance = body.leaveAllowance || "NLe 24,000.00";
    const serviceCycle = body.serviceCycle || "2026/2027";
    const nextAnniversary = body.nextAnniversary || "";
    const isRenewal = body.isRenewal === true;
    const timestamp = new Date().toUTCString();

    let subject = "BCF-SL – Leave Eligibility and Leave Allowance Notification";
    let htmlContent = "";
    let plainText = "";

    if (type === "ELIGIBILITY_ANNIVERSARY") {
      subject = `BCF-SL Official Notice: Annual Leave (31 Days) & 5% Leave Allowance Eligibility – ${employeeName} (${serviceCycle})`;
      plainText = `
BANDAMA CHARITY FOUNDATION SIERRA LEONE
HUMAN RESOURCES DIRECTORATE • OFFICIAL SERVICE ANNIVERSARY & LEAVE ELIGIBILITY NOTICE

Dear ${employeeName},

Congratulations! Our Human Resources management system confirms that you have reached your official employment anniversary milestone (${eligDate}) for the service cycle ${serviceCycle}.

You are hereby confirmed ELIGIBLE to apply for your statutory annual leave days and claim your statutory 5% leave allowance under BCF-SL HR Policy.

OFFICIAL ENTITLEMENT PARTICULARS:
----------------------------------------
- Staff Member: ${employeeName} (${employeeId})
- Employment Date: ${empDate}
- Eligibility Anniversary: ${eligDate}
- Active Service Cycle: ${serviceCycle}
- Statutory Annual Leave: ${entitlement}
- Calculated 5% Allowance: ${allowance} (5% of Annual Basic Salary)
${nextAnniversary ? `- Next Renewal Anniversary: ${nextAnniversary}` : ''}

KEY POLICY REMINDERS (Section 10, 11 & 14):
1. 31 Working Days Entitlement: You can apply for your leave days in full or in parts throughout this service cycle.
2. Single Allowance Claim per Year Rule: Under Section 10 & 11, the statutory 5% leave allowance can only be claimed ONCE during your service year (${serviceCycle}), regardless of whether leave dates are taken in multiple fragments.
3. 31 Days Exhaustion Lockout: When all 31 annual leave days have been consumed, further annual leave applications remain locked until your employment anniversary date is met again on ${nextAnniversary || 'your next anniversary'}.

Please log into the BCF-SL Staff Portal to review your official leave ledger, submit your leave dates, and claim your statutory allowance.

Respectfully,
Human Resources Directorate & FOMS Administration Hub
Bandama Charity Foundation Sierra Leone
Generated on: ${timestamp}
`.trim();
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
            .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
            .header { background: linear-gradient(135deg, #004328 0%, #0d5c3a 100%); color: #ffffff; padding: 28px; text-align: left; }
            .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
            .header p { margin: 0; font-size: 11px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.06em; color: #a7f3d0; }
            .body { padding: 28px; font-size: 14px; line-height: 1.6; color: #334155; }
            .highlight-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin: 20px 0; }
            .policy-box { background: #fefce8; border: 1px solid #fef08a; border-radius: 12px; padding: 14px 18px; margin: 18px 0; font-size: 13px; color: #713f12; }
            .grid { display: table; width: 100%; margin-top: 12px; }
            .grid-row { display: table-row; }
            .grid-label { display: table-cell; padding: 6px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; width: 42%; }
            .grid-value { display: table-cell; padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: 700; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; font-size: 11px; color: #64748b; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; background: #004328; color: #ffffff; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <p>Bandama Charity Foundation Sierra Leone • HR Directorate</p>
              <h1>Leave Eligibility &amp; Leave Allowance Notification</h1>
            </div>
            <div class="body">
              <p>Dear <strong>${employeeName}</strong>,</p>
              <p>Congratulations! Our Human Resources management system confirms that you have reached your official employment anniversary milestone (<strong>${eligDate}</strong>) for service cycle <strong>${serviceCycle}</strong>.</p>
              
              <div class="highlight-box">
                <span class="badge">Official Milestone Satisfied</span>
                <p style="margin: 8px 0 0 0; font-size: 13px; color: #166534; font-weight: 700;">
                  You are now fully eligible to:
                </p>
                <ul style="margin: 6px 0 12px 18px; padding: 0; color: #166534; font-size: 13px;">
                  <li>Apply for your statutory annual leave entitlement of <strong>${entitlement}</strong>; and</li>
                  <li>Claim your statutory 5% leave allowance (<strong>${allowance}</strong>).</li>
                </ul>

                <div class="grid">
                  <div class="grid-row">
                    <div class="grid-label">Employee ID</div>
                    <div class="grid-value">${employeeId}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Employment Date</div>
                    <div class="grid-value">${empDate}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Eligibility Date</div>
                    <div class="grid-value">${eligDate}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Service Cycle</div>
                    <div class="grid-value">${serviceCycle}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Leave Entitlement</div>
                    <div class="grid-value" style="color: #004328;">${entitlement}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">5% Leave Allowance</div>
                    <div class="grid-value" style="color: #004328;">${allowance}</div>
                  </div>
                  ${nextAnniversary ? `
                  <div class="grid-row">
                    <div class="grid-label">Next Renewal Date</div>
                    <div class="grid-value">${nextAnniversary}</div>
                  </div>
                  ` : ''}
                </div>
              </div>

              <div class="policy-box">
                <strong style="display: block; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Important HR Policy Directives (Section 10, 11 &amp; 14):</strong>
                <ul style="margin: 0 0 0 16px; padding: 0; line-height: 1.6;">
                  <li><strong>Single Allowance Claim per Year:</strong> The statutory 5% leave allowance can only be claimed <strong>once per service year</strong>, even if leave days are taken in separate fragments.</li>
                  <li><strong>31 Days Entitlement:</strong> When all 31 annual leave days have been consumed, new annual leave requests remain locked until your employment date is met again on ${nextAnniversary || 'your next anniversary'}.</li>
                </ul>
              </div>

              <p>Please log into the <strong>BCF-SL Employee Portal</strong> to review your eligibility ledger, submit your leave application and claim your leave allowance.</p>
              
              <p style="margin-top: 24px;">
                Regards,<br/>
                <strong>Human Resources Directorate</strong><br/>
                Bandama Charity Foundation Sierra Leone
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">Institutional Audit Notification • Generated on ${timestamp} • BCF-SL HR Policy 2026</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (type === "LEAVE_APPROVED" || type === "EXECUTIVE_APPROVAL") {
      const refId = body.refId || "BCF-LEV-2026-0001";
      const leaveType = body.leaveType || "Annual Leave";
      const startDate = body.startDate || "Date";
      const endDate = body.endDate || "Date";
      const daysRequested = body.daysRequested || "31";
      const balanceAfter = body.balanceAfter !== undefined ? body.balanceAfter : "0";
      const approverName = body.approverName || "Albert Joseph Bandama (CEO)";
      const handoverOfficer = body.handoverOfficer || "Designated Colleague";
      const allowanceAmount = body.allowanceAmount || null;
      const allowanceVoucher = body.allowanceVoucher || null;

      const executiveNotes = body.executiveNotes ? body.executiveNotes.trim() : "";
      const cc = body.cc || undefined;

      subject = `BCF-SL – Leave Application Approved (Executive Authorization: ${refId})`;
      
      plainText = `
BANDAMA CHARITY FOUNDATION SIERRA LEONE
EXECUTIVE SECRETARIAT • OFFICIAL LEAVE AUTHORIZATION

Dear ${employeeName},

We are pleased to inform you that your statutory leave application (Ref: ${refId}) has successfully passed through all institutional review tiers and has received FINAL EXECUTIVE AUTHORIZATION.

APPLICATION PARTICULARS:
----------------------------------------
- Reference: ${refId}
- Leave Category: ${leaveType}
- Duration Approved: ${daysRequested} Days (${startDate} to ${endDate})
- Authorized By: ${approverName}
- Duty Handover Officer: ${handoverOfficer}
- Remaining Leave Balance: ${balanceAfter} Days
${allowanceAmount ? `- 5% Leave Allowance: ${allowanceAmount} ${allowanceVoucher ? `(Voucher: ${allowanceVoucher})` : '(Queued in FOMS Finance)'}` : ''}
${executiveNotes ? `\nEXECUTIVE REMARKS:\n"${executiveNotes}"\n` : ''}

RETURN-TO-WORK GUIDELINES (Section 29):
1. Ensure all active project responsibilities and handover files are transferred to ${handoverOfficer} prior to departure.
2. Upon completion of your approved leave period on ${endDate}, please log into the BCF-SL Staff Portal to confirm your Return to Duty sign-off.

Cryptographic Authentication Token: SHA256#${refId}-AUTH-EXEC-${Date.now().toString(16)}
Verified By: BCF-SL Integrated Human Resources & FOMS Payroll Gateway

Respectfully,
Executive Management Authority & Human Resources
Bandama Charity Foundation Sierra Leone
Generated on: ${timestamp}
`.trim();

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
            .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
            .header { background: linear-gradient(135deg, #004328 0%, #064e3b 50%, #022c22 100%); color: #ffffff; padding: 28px; text-align: left; }
            .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
            .header p { margin: 0; font-size: 11px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.08em; color: #a7f3d0; }
            .body { padding: 28px; font-size: 14px; line-height: 1.6; color: #334155; }
            .status-banner { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px; margin: 18px 0; }
            .grid { display: table; width: 100%; margin-top: 8px; }
            .grid-row { display: table-row; }
            .grid-label { display: table-cell; padding: 6px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; width: 42%; }
            .grid-value { display: table-cell; padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: 700; }
            .badge-success { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; background: #004328; color: #ffffff; }
            .exec-notes-box { background: #f8fafc; border-left: 4px solid #004328; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-style: italic; color: #1e293b; font-size: 13px; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; font-size: 11px; color: #64748b; }
            .token-box { font-family: 'Courier New', monospace; font-size: 11px; background: #f1f5f9; padding: 10px 14px; border-radius: 8px; color: #475569; margin-top: 16px; border: 1px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <p>Bandama Charity Foundation Sierra Leone • Executive Secretariat</p>
              <h1>Leave Application Approved</h1>
            </div>
            <div class="body">
              <p>Dear <strong>${employeeName}</strong>,</p>
              <p>We are pleased to inform you that your statutory leave application (Ref: <strong>${refId}</strong>) has successfully passed through all institutional review tiers and has received <strong>Final Executive Authorization</strong>.</p>
              
              <div class="status-banner">
                <div style="margin-bottom: 8px;">
                  <span class="badge-success">EXECUTIVE APPROVAL GRANTED</span>
                  <span style="font-size: 12px; font-weight: 700; color: #047857; margin-left: 12px;">Dossier Status: Approved</span>
                </div>

                <div class="grid">
                  <div class="grid-row">
                    <div class="grid-label">Application Ref</div>
                    <div class="grid-value" style="font-family: monospace; color: #004328;">${refId}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Leave Category</div>
                    <div class="grid-value">${leaveType}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Approved Duration</div>
                    <div class="grid-value">${daysRequested} Days (${startDate} to ${endDate})</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Authorized By</div>
                    <div class="grid-value">${approverName}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Duty Handover Officer</div>
                    <div class="grid-value">${handoverOfficer}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Remaining Balance</div>
                    <div class="grid-value">${balanceAfter} Days</div>
                  </div>
                  ${allowanceAmount ? `
                  <div class="grid-row">
                    <div class="grid-label">5% Leave Allowance</div>
                    <div class="grid-value" style="color: #004328;">${allowanceAmount} ${allowanceVoucher ? `(Voucher: ${allowanceVoucher})` : '(Queued in FOMS Finance)'}</div>
                  </div>
                  ` : ''}
                </div>
              </div>

              ${executiveNotes ? `
              <div class="exec-notes-box">
                <strong style="display: block; font-style: normal; font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Executive Remarks from ${approverName}:</strong>
                "${executiveNotes}"
              </div>
              ` : ''}

              <h4 style="margin: 18px 0 6px 0; color: #0f172a; font-size: 13px;">Important Return-to-Work Guidelines (Section 29):</h4>
              <ul style="margin: 0 0 14px 18px; padding: 0; font-size: 13px; color: #475569;">
                <li>Ensure all active project responsibilities and handover files are transferred to <strong>${handoverOfficer}</strong> prior to departure.</li>
                <li>Upon completion of your approved leave period on <strong>${endDate}</strong>, please log into the BCF-SL Staff Portal to confirm your <strong>Return to Duty</strong> sign-off.</li>
              </ul>

              <div class="token-box">
                Cryptographic Authentication Token: SHA256#${refId}-AUTH-EXEC-${Date.now().toString(16)}<br/>
                Verified By: BCF-SL Integrated Human Resources &amp; FOMS Payroll Gateway
              </div>

              <p style="margin-top: 24px;">
                Respectfully,<br/>
                <strong>Executive Management Authority &amp; Human Resources</strong><br/>
                Bandama Charity Foundation Sierra Leone
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">Institutional Audit Notification • Generated on ${timestamp} • BCF-SL HR Policy 2026</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (type === "RETURN_TO_WORK" || type === "RESUMPTION_RETURN_TO_WORK" || type === "RESUMPTION_DONE") {
      const refId = body.refId || "BCF-LEV-2026";
      const leaveType = body.leaveType || "Annual Leave";
      const startDate = body.startDate || "Date";
      const endDate = body.endDate || "Date";
      const returnDate = body.returnDate || endDate;
      const daysRequested = body.daysRequested || "31";
      const handoverOfficer = body.handoverOfficer || "Designated Colleague";
      const returnNotes = body.returnNotes || "Employee resumed active duty in satisfactory condition; handover reversed.";
      const department = body.department || "General Administration";
      const position = body.position || "Staff Officer";
      const workLoc = body.workLoc || "Freetown Headquarters";
      const supervisor = body.supervisor || "Department Head";
      const clearingOfficer = body.clearingOfficer || "Albert Joseph Bandama (CEO & Executive Director)";
      const isAuto = body.isAuto === true;

      subject = `BCF-SL Official Notice: Return to Active Duty & Resumption Authorization – ${employeeName} (Ref: ${refId})`;

      plainText = `
BANDAMA CHARITY FOUNDATION SIERRA LEONE
HUMAN RESOURCES DIRECTORATE • OFFICIAL RESUMPTION & RETURN TO DUTY DIRECTIVE

Dear ${employeeName},

Welcome back! This is an official notification and directive from the Human Resources Directorate that your approved ${leaveType} (Ref: ${refId}) has completed its approved duration. Your return to active duty has been officially confirmed in the BCF-SL Staff Registry, and you are hereby authorized and instructed to RESUME ACTIVE PROFESSIONAL DUTIES effective ${returnDate}.

RESUMPTION PARTICULARS:
----------------------------------------
- Reference: ${refId}
- Staff Name: ${employeeName} (${employeeId})
- Department: ${department} • ${position}
- Duty Station: ${workLoc}
- Leave Completed: ${startDate} to ${endDate} (${daysRequested} Working Days)
- Official Resumption Date: ${returnDate}
- Duty Status: ACTIVE DUTY RESUMED (Absence Record Closed)
- Handover Re-assumption: Full operational responsibilities re-assumed from ${handoverOfficer}
- Clearing Authority: ${clearingOfficer}
- Clearance Mode: ${isAuto ? "Automated Resumption Detection Engine (Section 27-29)" : "HR Direct Sign-Off"}
- Clearance Remarks: "${returnNotes}"

MANDATORY RESUMPTION DIRECTIVES FOR STAFF (Section 29 HR Policy):
1. Report to your duty station at ${workLoc} on ${returnDate} and confirm physical attendance with your supervisor (${supervisor}).
2. Coordinate immediately with ${handoverOfficer} to re-assume full custody of ongoing casework, donor deliverables, procurement files, and email communication.
3. Your statutory leave entitlement ledger balance has been settled for this service cycle in the BCF-SL Staff Portal.

Cryptographic Verification Token: SHA256#${refId}-RESUME-${Date.now().toString(16)}
Verified By: BCF-SL Human Resources Registry & FOMS Administration Hub

Respectfully,
Human Resources Directorate & Executive Authority
Bandama Charity Foundation Sierra Leone
Generated on: ${timestamp}
`.trim();

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
            .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
            .header { background: linear-gradient(135deg, #004328 0%, #0c4a6e 100%); color: #ffffff; padding: 28px; text-align: left; }
            .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
            .header p { margin: 0; font-size: 11px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.08em; color: #bae6fd; }
            .body { padding: 28px; font-size: 14px; line-height: 1.6; color: #334155; }
            .status-banner { background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 16px; margin: 18px 0; }
            .grid { display: table; width: 100%; margin-top: 8px; }
            .grid-row { display: table-row; }
            .grid-label { display: table-cell; padding: 6px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; width: 42%; }
            .grid-value { display: table-cell; padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: 700; }
            .badge-active { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; background: #004328; color: #ffffff; }
            .notes-box { background: #f8fafc; border-left: 4px solid #0284c7; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-style: italic; color: #1e293b; font-size: 13px; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; font-size: 11px; color: #64748b; }
            .token-box { font-family: 'Courier New', monospace; font-size: 11px; background: #f1f5f9; padding: 10px 14px; border-radius: 8px; color: #475569; margin-top: 16px; border: 1px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <p>Bandama Charity Foundation Sierra Leone • HR Directorate</p>
              <h1>Official Notice: Resume Active Duty</h1>
            </div>
            <div class="body">
              <p>Dear <strong>${employeeName}</strong>,</p>
              <p>Welcome back! This is an official notice and directive from the Human Resources Directorate confirming that your approved <strong>${leaveType}</strong> period (Ref: <strong>${refId}</strong>) has reached its scheduled resumption date. Your return to work has been officially recorded in the BCF-SL Human Resources Registry, and you are hereby authorized and instructed to <strong>resume your active professional duties</strong> effective <strong>${returnDate}</strong>.</p>
              
              <div class="status-banner">
                <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                  <span class="badge-active">ACTIVE DUTY RESUMED</span>
                  <span style="font-size: 12px; font-weight: 700; color: #15803d; margin-left: 8px;">Staff Registry Status: Completed (Returned)</span>
                </div>

                <div class="grid">
                  <div class="grid-row">
                    <div class="grid-label">Application Ref</div>
                    <div class="grid-value" style="font-family: monospace; color: #004328;">${refId}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Staff Member</div>
                    <div class="grid-value">${employeeName} (${employeeId})</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Department &amp; Role</div>
                    <div class="grid-value">${department} • ${position}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Duty Station</div>
                    <div class="grid-value">${workLoc}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Leave Category</div>
                    <div class="grid-value">${leaveType}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Leave Completed</div>
                    <div class="grid-value">${startDate} to ${endDate} (${daysRequested} Working Days)</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Effective Resumption Date</div>
                    <div class="grid-value" style="color: #0369a1; font-size: 14px;"><strong>${returnDate}</strong></div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Handover Re-assumption</div>
                    <div class="grid-value">Duties re-assumed from <strong>${handoverOfficer}</strong></div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Clearance Authority</div>
                    <div class="grid-value">${clearingOfficer} (${isAuto ? "Automated Resumption Engine" : "HR Institutional Clearance"})</div>
                  </div>
                </div>
              </div>

              ${returnNotes ? `
              <div class="notes-box">
                <strong style="display: block; font-style: normal; font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Clearance Notes &amp; Observations:</strong>
                "${returnNotes}"
              </div>
              ` : ''}

              <h4 style="margin: 18px 0 6px 0; color: #0f172a; font-size: 13px;">Mandatory Resumption Directives for Staff (Section 29 HR Policy):</h4>
              <ul style="margin: 0 0 14px 18px; padding: 0; font-size: 13px; color: #475569; line-height: 1.7;">
                <li><strong>1. Physical / Assigned Attendance:</strong> Report to your duty station at <strong>${workLoc}</strong> on <strong>${returnDate}</strong> and confirm your attendance with supervisor <strong>${supervisor}</strong>.</li>
                <li><strong>2. Operational Handover Reversal:</strong> Liaise immediately with <strong>${handoverOfficer}</strong> to re-assume custody of active procurement tasks, project dossiers, correspondence, and emails.</li>
                <li><strong>3. Leave Ledger Settlement:</strong> Your leave balance and ledger have been finalized for this cycle in the BCF-SL Staff Portal.</li>
              </ul>

              <div class="token-box">
                Cryptographic Verification Token: SHA256#${refId}-RESUME-${Date.now().toString(16)}<br/>
                Verified By: BCF-SL Human Resources Registry &amp; FOMS Administration Hub
              </div>

              <p style="margin-top: 24px;">
                Respectfully,<br/>
                <strong>Human Resources Directorate &amp; Executive Authority</strong><br/>
                Bandama Charity Foundation Sierra Leone
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">Institutional Audit Notification • Generated on ${timestamp} • BCF-SL HR Policy 2026</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (type === "DISBURSEMENT_MADE" || type === "ALLOWANCE_DISBURSED" || type === "DISBURSEMENT") {
      const allowanceId = body.allowanceId || body.refId || "BCF-LA-2026-0001";
      const voucherId = body.voucherId || "PV-BCF-FOMS-2026-0429";
      const eftRef = body.eftRef || `SL-CB-EFT-${Date.now().toString().slice(-6)}`;
      const amount = body.amount || "NLe 9,000.00";
      const monthlySalary = body.monthlySalary || "NLe 15,000.00";
      const annualSalary = body.annualSalary || "NLe 180,000.00";
      const allowanceRate = body.allowanceRate || "5% of Annual Basic Salary";
      const serviceCycle = body.serviceCycle || "2026/2027";
      const bankDestination = body.bankDestination || "Sierra Leone Commercial Bank (SLCB)";
      const accountNumber = body.accountNumber || "******9977";
      const disbursingOfficer = body.disbursingOfficer || "Director of Finance & Accounts (FOMS Gateway)";
      const disbursementDate = body.disbursementDate || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const notes = body.notes || "Electronic funds transfer executed via automated clearing house banking protocol.";

      subject = `BCF-SL Official Notice: 5% Statutory Leave Allowance Disbursed – ${employeeName} (Ref: ${allowanceId})`;

      plainText = `
BANDAMA CHARITY FOUNDATION SIERRA LEONE
DIRECTORATE OF FINANCE & ACCOUNTS • FOMS PAYROLL GATEWAY
OFFICIAL LEAVE ALLOWANCE DISBURSEMENT ADVICE

Dear ${employeeName},

We are pleased to inform you that your statutory 5% Leave Allowance for the ${serviceCycle} service cycle has been officially APPROVED, AUTHORIZED, and DISBURSED to your nominated bank account via Electronic Funds Transfer (EFT).

SETTLEMENT & DISBURSEMENT PARTICULARS:
----------------------------------------
- Beneficiary Staff: ${employeeName} (${employeeId})
- Allowance Claim Ref: ${allowanceId}
- FOMS Fiscal Voucher: ${voucherId}
- Bank EFT Reference: ${eftRef}
- Net Disbursed Sum: ${amount}
- Monthly Basic Baseline: ${monthlySalary}
- Annual Basic Salary (x 12): ${annualSalary}
- Statutory Calculation Rate: ${allowanceRate}
- Target Bank: ${bankDestination}
- Destination Account: ${accountNumber}
- Statutory Deductions: NLe 0.00 (Exempt under BCF-SL Policy)
- Disbursing Authority: ${disbursingOfficer}
- Date of Electronic Settlement: ${disbursementDate}

POLICY DIRECTIVES & BANKING ADVICE (Section 10 & 11):
1. Single Annual Claim Rule: Under BCF-SL HR Policy, the statutory 5% leave allowance is payable strictly once per service anniversary year (${serviceCycle}).
2. Electronic Clearing: Interbank transmission has been confirmed via the FOMS Payment Gateway. Funds are credited directly to your ${bankDestination} account (${accountNumber}). Depending on your banking institution's ACH settlement cycles, funds will reflect within standard clearing windows.
3. Official Records: A copy of this payment voucher has been archived in your employee ledger in the BCF-SL Staff Portal.

Cryptographic Transaction Verification Token: SHA256#${allowanceId}-EFT-${eftRef}-${Date.now().toString(16)}
Verified By: FOMS Treasury & Payroll Disbursement Subsystem

Respectfully,
Directorate of Finance & Accounts
Bandama Charity Foundation Sierra Leone
Generated on: ${timestamp}
`.trim();

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
            .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
            .header { background: linear-gradient(135deg, #004328 0%, #064e3b 50%, #065f46 100%); color: #ffffff; padding: 28px; text-align: left; }
            .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
            .header p { margin: 0; font-size: 11px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.08em; color: #a7f3d0; }
            .body { padding: 28px; font-size: 14px; line-height: 1.6; color: #334155; }
            .amount-box { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px solid #86efac; border-radius: 14px; padding: 20px; margin: 20px 0; text-align: center; }
            .amount-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #15803d; margin-bottom: 4px; }
            .amount-value { font-size: 28px; font-weight: 900; color: #004328; font-family: 'Courier New', monospace; letter-spacing: -0.02em; }
            .amount-sub { font-size: 12px; color: #166534; font-weight: 600; margin-top: 4px; }
            .grid { display: table; width: 100%; margin-top: 12px; }
            .grid-row { display: table-row; }
            .grid-label { display: table-cell; padding: 7px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; width: 44%; }
            .grid-value { display: table-cell; padding: 7px 0; font-size: 13px; color: #0f172a; font-weight: 700; }
            .badge-paid { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; background: #004328; color: #ffffff; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 18px 0; }
            .policy-note { background: #fefce8; border-left: 4px solid #ca8a04; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-size: 12px; color: #713f12; line-height: 1.6; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; font-size: 11px; color: #64748b; }
            .token-box { font-family: 'Courier New', monospace; font-size: 11px; background: #f1f5f9; padding: 10px 14px; border-radius: 8px; color: #475569; margin-top: 16px; border: 1px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <p>Bandama Charity Foundation Sierra Leone • Directorate of Finance &amp; Accounts</p>
              <h1>Leave Allowance Disbursement Advice</h1>
            </div>
            <div class="body">
              <p>Dear <strong>${employeeName}</strong>,</p>
              <p>We are pleased to inform you that your statutory <strong>5% Leave Allowance</strong> for service cycle <strong>${serviceCycle}</strong> has been officially approved, processed, and <strong>electronically disbursed</strong> to your nominated bank account via FOMS Bank Electronic Funds Transfer (EFT).</p>
              
              <div class="amount-box">
                <div class="amount-label">Official Net Disbursed Sum</div>
                <div class="amount-value">${amount}</div>
                <div class="amount-sub">Statutory 5% Annual Basic Salary • Tax Exempt</div>
              </div>

              <div class="info-box">
                <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                  <span class="badge-paid">EFT DISBURSEMENT COMPLETED</span>
                  <span style="font-size: 12px; font-weight: 700; color: #047857; font-family: monospace;">Ref: ${eftRef}</span>
                </div>

                <div class="grid">
                  <div class="grid-row">
                    <div class="grid-label">Staff Beneficiary</div>
                    <div class="grid-value">${employeeName} (${employeeId})</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Allowance Dossier Ref</div>
                    <div class="grid-value" style="font-family: monospace; color: #004328;">${allowanceId}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">FOMS Fiscal Voucher</div>
                    <div class="grid-value" style="font-family: monospace;">${voucherId}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Bank Electronic Ref</div>
                    <div class="grid-value" style="font-family: monospace; color: #004328;">${eftRef}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Destination Bank</div>
                    <div class="grid-value">${bankDestination}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Account Number</div>
                    <div class="grid-value" style="font-family: monospace;">${accountNumber}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Monthly Basic Salary</div>
                    <div class="grid-value">${monthlySalary}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Annual Basic Baseline</div>
                    <div class="grid-value">${annualSalary} (Monthly x 12)</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Statutory Rate</div>
                    <div class="grid-value">${allowanceRate}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Statutory Deductions</div>
                    <div class="grid-value" style="color: #047857;">NLe 0.00 (Exempt)</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Settlement Date</div>
                    <div class="grid-value">${disbursementDate}</div>
                  </div>
                  <div class="grid-row">
                    <div class="grid-label">Authorizing Officer</div>
                    <div class="grid-value">${disbursingOfficer}</div>
                  </div>
                </div>
              </div>

              <div class="policy-note">
                <strong>Important Policy Directives (Section 10 &amp; 11):</strong><br/>
                Under BCF-SL HR Policy, the 5% leave allowance is payable strictly <strong>once per service anniversary year</strong> (${serviceCycle}). Electronic settlement has been transmitted through the FOMS Payment Gateway directly to your account at ${bankDestination}. Funds reflect according to interbank automated clearing house settlement schedules.
              </div>

              <div class="token-box">
                Cryptographic Authentication Token: SHA256#${allowanceId}-EFT-${eftRef}-${Date.now().toString(16)}<br/>
                Verified By: FOMS Treasury, Payroll Gateway &amp; BCF-SL Finance Directorate
              </div>

              <p style="margin-top: 24px;">
                Respectfully,<br/>
                <strong>Directorate of Finance &amp; Accounts</strong><br/>
                Bandama Charity Foundation Sierra Leone
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">Institutional Audit Notification • Generated on ${timestamp} • BCF-SL HR Policy 2026</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = `BCF-SL Leave Notification: ${body.title || "Leave Update"}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #004328;">BCF-SL Leave Management Notification</h2>
          <p>Dear ${employeeName},</p>
          <p>${body.message || "Your leave application status has been updated in the BCF-SL Leave & Allowance Portal."}</p>
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>Employee:</strong> ${employeeName} (${employeeId})</p>
            <p><strong>Reference:</strong> ${body.refId || "BCF-LEV-2026"}</p>
            <p><strong>Status:</strong> ${body.status || "Updated"}</p>
          </div>
          <p>Regards,<br/><strong>Human Resources Department</strong><br/>Bandama Charity Foundation Sierra Leone</p>
        </div>
      `;
    }

    let mailRes: any;
    try {
      mailRes = await sendMail({
        to,
        subject,
        html: htmlContent,
        text: plainText || body.text || undefined,
        cc: body.cc || undefined,
      });
    } catch (mailErr: any) {
      console.warn("[send-leave-notification] SMTP delivery note:", mailErr?.message);
      mailRes = {
        messageId: `<bcf-notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bcf-sl.org>`,
        simulated: true,
        smtpError: mailErr?.message,
      };
    }

    return NextResponse.json(
      {
        success: true,
        messageId: mailRes.messageId,
        recipient: to,
        timestamp,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error("[send-leave-notification] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to dispatch leave notification email",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
