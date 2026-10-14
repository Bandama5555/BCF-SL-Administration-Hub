import { NextRequest, NextResponse } from "next/server";
import { sendMail, EMAIL_CONFIG } from "@/lib/mail";
import path from "path";
import fs from "fs";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const partner = body.partner || body;
    const reason = (
      body.reason ||
      partner.reinstatementReason ||
      "Governance and compliance review successfully completed and cleared by Executive Board"
    ).trim();
    const effectiveDate =
      body.effectiveDate ||
      partner.reinstatedDate ||
      new Date().toISOString().split("T")[0];
    const reinstatedBy =
      body.reinstatedBy ||
      partner.reinstatedBy ||
      "Directorate of Strategic Partnerships & Resource Mobilization";

    const rawTo =
      partner.email ||
      partner.officialEmail ||
      partner.official_email ||
      partner.emailAddress ||
      body.to ||
      "";
    const to = typeof rawTo === "string" ? rawTo.trim() : "";
    if (!to || !to.includes("@")) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid partner official email address is required to dispatch reinstatement notice",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const partnerId = partner.id || "BCF-PAR-REGISTERED";
    const relId = partner.relId || "BCF-REL-2026-000100";
    const partnerName = partner.name || "Institutional Partner";
    const partnerType = partner.type || "Institutional Partner";
    const regNo = partner.registrationNumber || "SL-REG-COMPLIANT";
    const district = partner.district || "Western Area Urban";
    const country = partner.country || "Sierra Leone";
    const primaryContact = partner.primaryContact || "Authorized Representative";
    const position = partner.position || "Head of Mission / Representative";
    const timestamp = new Date().toUTCString();

    // Resolve official logo path
    const possibleLogoPaths = [
      path.join(process.cwd(), "public", "bcf_official_logo.png"),
      path.join(process.cwd(), "bcf_official_logo.png"),
      path.join(process.cwd(), "..", "bcf_official_logo.png"),
      path.join(process.cwd(), "public", "bcf-logo.jpg"),
      path.join(process.cwd(), "..", "bcf-logo.jpg"),
      "c:/Users/Albert J Bandama/Desktop/BCF-SL Administration System/bcf_official_logo.png",
      "c:/Users/Albert J Bandama/Desktop/BCF-SL Administration System/frontend/public/bcf_official_logo.png",
    ];
    const resolvedLogoPath = possibleLogoPaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

    const attachments = resolvedLogoPath
      ? [
          {
            filename: "bcf_official_logo.png",
            path: resolvedLogoPath,
            cid: "bcf_official_logo",
            contentType: "image/png",
          },
        ]
      : [];

    const subject = `OFFICIAL NOTICE: Reinstatement & Renewal of Institutional Partnership [${partnerId} / ${relId}] — Bandama Charity Foundation Sierra Leone`;

    const plainText = `================================================================================
BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL)
DIRECTORATE OF STRATEGIC PARTNERSHIPS & RESOURCE MOBILIZATION
Official Registration: SL-NNGO-2023-084
Headquarters: Freetown, Sierra Leone | Regional Hub: Bo, Sierra Leone
Official Email: ${EMAIL_CONFIG.user} | Phone: +232 78 242826
================================================================================

OFFICIAL NOTICE OF INSTITUTIONAL PARTNERSHIP REINSTATEMENT & RENEWAL

Dear ${primaryContact},
Attn: Executive Management & Governing Board of ${partnerName}
Partner Master ID: ${partnerId}
Master Relationship Key: ${relId}
Official Designated Email: ${to}

We are pleased to formally issue this official institutional notice from Bandama Charity Foundation – Sierra Leone (BCF-SL) that the institutional partnership standing of ${partnerName} has been fully REINSTATED and RESTORED to Active Status in the Partner Master Register, effective ${effectiveDate}.

--------------------------------------------------------------------------------
OFFICIAL GOVERNANCE JUSTIFICATION & BASIS FOR REINSTATEMENT:
--------------------------------------------------------------------------------
"${reason}"

--------------------------------------------------------------------------------
RESTORED PRIVILEGES & OPERATIONAL STATUS:
--------------------------------------------------------------------------------
1. ACTIVE PARTNER MASTER REGISTER STANDING:
   Your institution is restored to full active accreditation across all 16 districts of Sierra Leone.

2. CO-DEVELOPMENT OF PARTNERSHIP PROPOSALS (BCF-PP) & MoUs:
   Your organization is fully eligible to co-develop joint programmes, submit proposals under master key ${relId}, and renew Memoranda of Understanding (MoUs).

3. RE-ACTIVATION OF INTEGRATED PROCUREMENT & AID WORKFLOWS:
   Cross-module relationship linkages to Procurement Purchase Requisitions (BCF-PR), delivery certifications, and logistical distributions are re-enabled.

4. DEDICATED PARTNERSHIP OFFICER ASSIGNMENT:
   The Directorate of Strategic Partnerships has assigned a desk officer to oversee ongoing bilateral coordination and joint project monitoring.

Authorized by:
${reinstatedBy}
Central Administration Secretariat
Bandama Charity Foundation – Sierra Leone (BCF-SL)
Official Email: ${EMAIL_CONFIG.user}
Official Inquiries: +232 78 242826
Website: https://bcf-sl.org
Timestamp: ${timestamp}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BCF-SL Partner Reinstatement Notice</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(5, 150, 105, 0.08), 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #a7f3d0;">
          
          <!-- Header Bar with Deep Emerald Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #022c22 100%); padding: 30px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                <tr>
                  <td width="110" align="left" valign="middle">
                    ${
                      resolvedLogoPath
                        ? `<img src="cid:bcf_official_logo" alt="BCF-SL Logo" width="85" style="display: block; border-radius: 10px; border: 2px solid rgba(255,255,255,0.25); background-color: #ffffff; padding: 4px;" />`
                        : `<div style="font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -1px;">BCF-SL</div>`
                    }
                  </td>
                  <td align="left" valign="middle" style="padding-left: 14px;">
                    <span style="display: inline-block; font-size: 10px; font-weight: 800; color: #6ee7b7; text-transform: uppercase; letter-spacing: 1.5px;">
                      BANDAMA CHARITY FOUNDATION &bull; SIERRA LEONE
                    </span>
                    <h1 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: -0.3px;">
                      Notice of Partnership Reinstatement
                    </h1>
                    <span style="font-size: 11px; color: #a7f3d0; display: block; margin-top: 2px;">
                      Directorate of Strategic Partnerships &amp; Resource Mobilization
                    </span>
                  </td>
                  <td width="110" align="right" valign="middle">
                    <span style="display: inline-block; padding: 5px 12px; background-color: rgba(16, 185, 129, 0.25); border: 1px solid #10b981; color: #d1fae5; font-size: 10px; font-weight: 800; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      REINSTATED
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Key Identifiers Callout Ribbon -->
          <tr>
            <td style="background-color: #ecfdf5; padding: 14px 32px; border-bottom: 1px solid #d1fae5;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" align="left">
                    <span style="font-size: 10px; font-weight: 700; color: #065f46; text-transform: uppercase;">Partner Identifier:</span>
                    <strong style="display: block; font-size: 14px; font-family: monospace; color: #064e3b;">${partnerId}</strong>
                  </td>
                  <td width="50%" align="right">
                    <span style="font-size: 10px; font-weight: 700; color: #065f46; text-transform: uppercase;">Master Relationship Key:</span>
                    <strong style="display: block; font-size: 14px; font-family: monospace; color: #047857;">${relId}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 30px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
                Dear <strong>${primaryContact}</strong> (${position}),<br/>
                Attn: Executive Management &amp; Governing Board of <strong>${partnerName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 13.5px; color: #334155; line-height: 1.6;">
                We are pleased to inform you that following governance review, the institutional partnership agreement with <strong>${partnerName}</strong> has been officially <strong>REINSTATED</strong> and returned to <strong>Active Status</strong>, effective <strong>${effectiveDate}</strong>.
              </p>

              <!-- Formal Justification Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; border: 1px solid #a7f3d0; background-color: #ecfdf5; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #d1fae5; background-color: #d1fae5;">
                    <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #065f46;">
                      Governance Justification &amp; Clearance Summary
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 18px; font-size: 13.5px; color: #064e3b; font-style: italic; line-height: 1.6;">
                    &ldquo;${reason}&rdquo;
                  </td>
                </tr>
              </table>

              <!-- Master Profile Summary -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <tr style="background-color: #f8fafc;">
                  <td colspan="2" style="padding: 10px 14px; font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                    Partner Registry Record
                  </td>
                </tr>
                <tr>
                  <td width="35%" style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Organization Name:</td>
                  <td width="65%" style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-weight: 700;">${partnerName}</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Partner Classification:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${partnerType}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Official Email Address:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-family: monospace;">${to}</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">District / Location:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${district}, ${country}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Reinstatement Date:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #047857; border-bottom: 1px solid #f1f5f9; font-weight: 700;">${effectiveDate}</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; font-weight: 600;">Institutional Status:</td>
                  <td style="padding: 9px 14px; font-size: 12px; color: #047857; font-weight: 800;">Active &amp; In Good Standing</td>
                </tr>
              </table>

              <!-- Restored Privileges -->
              <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                Restored Institutional Privileges:
              </h4>
              <ol style="margin: 0 0 24px 0; padding-left: 20px; font-size: 12.5px; color: #475569; line-height: 1.7;">
                <li><strong>Full Partner Master Register Standing:</strong> Your organization has been re-activated in the master registry with verified partner clearance.</li>
                <li><strong>Joint Proposals &amp; MoUs:</strong> You may submit and collaborate on Partnership Proposals (BCF-PP) and negotiate new Memoranda of Understanding.</li>
                <li><strong>Re-enabled Cross-Module Linkages:</strong> The BCF-REL master key is reconnected to procurement, logistics, and field operations.</li>
                <li><strong>Ongoing Governance Coordination:</strong> Regular bilateral communication and joint monitoring checkpoints will resume as scheduled.</li>
              </ol>

              <!-- Sign-off Block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <tr>
                  <td width="65%" align="left" valign="top">
                    <p style="margin: 0; font-size: 12.5px; font-weight: 800; color: #0f172a;">
                      ${reinstatedBy}
                    </p>
                    <p style="margin: 2px 0 0 0; font-size: 11.5px; color: #64748b;">
                      Bandama Charity Foundation – Sierra Leone (BCF-SL)<br/>
                      Central Secretariat &bull; Freetown &amp; Bo, Sierra Leone
                    </p>
                  </td>
                  <td width="35%" align="right" valign="top">
                    <div style="display: inline-block; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: monospace; font-size: 10px; color: #047857; background-color: #ecfdf5; text-align: right;">
                      REINSTATEMENT NOTICE<br/>
                      REF: BCF-REIN-${partnerId}
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #94a3b8;">
                This is an official administrative notice issued under the authority of BCF-SL Central Administration.
              </p>
              <p style="margin: 0; font-size: 10.5px; color: #cbd5e1;">
                Bandama Charity Foundation – Sierra Leone &bull; SL-NNGO-2023-084 &bull; ${timestamp}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const result = await sendMail({
      to,
      subject,
      text: plainText,
      html,
      attachments,
    });

    return NextResponse.json(
      {
        success: true,
        messageId: result.messageId,
        to,
        partnerId,
        relId,
        reason,
        effectiveDate,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("send-partner-reinstatement-email error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to transmit partner reinstatement notice",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
