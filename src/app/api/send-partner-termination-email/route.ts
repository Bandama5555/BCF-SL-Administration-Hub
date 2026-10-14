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
      partner.terminationReason ||
      "Contractual agreement concluded or institutional mandate reviewed by BCF-SL"
    ).trim();
    const effectiveDate =
      body.effectiveDate ||
      partner.terminatedDate ||
      new Date().toISOString().split("T")[0];
    const terminatedBy =
      body.terminatedBy ||
      partner.terminatedBy ||
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
          error: "Valid partner official email address is required to dispatch termination notice",
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

    const subject = `OFFICIAL NOTICE: Termination of Institutional Partnership [${partnerId} / ${relId}] — Bandama Charity Foundation Sierra Leone`;

    const plainText = `================================================================================
BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL)
DIRECTORATE OF STRATEGIC PARTNERSHIPS & RESOURCE MOBILIZATION
Official Registration: SL-NNGO-2023-084
Headquarters: Freetown, Sierra Leone | Regional Hub: Bo, Sierra Leone
Official Email: ${EMAIL_CONFIG.user} | Phone: +232 78 242826
================================================================================

OFFICIAL NOTICE OF INSTITUTIONAL PARTNERSHIP TERMINATION

Dear ${primaryContact},
Attn: Executive Management & Governing Board of ${partnerName}
Partner Master ID: ${partnerId}
Master Relationship Key: ${relId}
Official Designated Email: ${to}

This formal communication serves as an official institutional notice from the Directorate of Strategic Partnerships & Resource Mobilization, Bandama Charity Foundation – Sierra Leone (BCF-SL), that the institutional partnership agreement with ${partnerName} has been TERMINATED, effective ${effectiveDate}.

--------------------------------------------------------------------------------
OFFICIAL JUSTIFICATION & REASON FOR TERMINATION:
--------------------------------------------------------------------------------
"${reason}"

--------------------------------------------------------------------------------
CONTRACTUAL STATUS & INSTITUTIONAL GOVERNANCE PROVISIONS:
--------------------------------------------------------------------------------
1. STATUS OF HISTORICAL COMMITMENTS & AUDIT TRAILS:
   In accordance with BCF-SL institutional standards and National Non-Governmental Organization (NNGO) governance codes, all historical collaborative deliverables, certified Goods Received Notes (GRNs), and audited distributions executed prior to ${effectiveDate} remain archived in our immutable master ledger.

2. CESSATION OF JOINT INITIATIVES & PROCUREMENT PRs:
   Effective immediately upon issuance of this notice, your organization is deregistered from active partnership rosters. No new Purchase Requisitions (BCF-PR), Partnership Proposals (BCF-PP), MoUs, or resource disbursements will be initiated under master key ${relId}.

3. REVOCATION OF SYSTEM CREDENTIALS & LINKAGES:
   Active system access associated with this partnership is revoked. Partner-specific project workflows will be transitioned to administrative closure.

4. ADMINISTRATIVE REVIEW & OFFICIAL CORRESPONDENCE:
   Any formal representation or administrative inquiry regarding this determination may be directed in writing to the Directorate of Strategic Partnerships within fourteen (14) calendar days of this notice.

Issued by:
${terminatedBy}
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
  <title>BCF-SL Partner Termination Notice</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(153, 27, 27, 0.08), 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #fecaca;">
          
          <!-- Header Bar with Deep Crimson / Rose Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #450a0a 100%); padding: 30px 32px; text-align: left;">
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
                    <span style="display: inline-block; font-size: 10px; font-weight: 800; color: #fca5a5; text-transform: uppercase; letter-spacing: 1.5px;">
                      BANDAMA CHARITY FOUNDATION &bull; SIERRA LEONE
                    </span>
                    <h1 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: -0.3px;">
                      Notice of Partnership Termination
                    </h1>
                    <span style="font-size: 11px; color: #fecaca; display: block; margin-top: 2px;">
                      Directorate of Strategic Partnerships &amp; Resource Mobilization
                    </span>
                  </td>
                  <td width="110" align="right" valign="middle">
                    <span style="display: inline-block; padding: 5px 12px; background-color: rgba(239, 68, 68, 0.25); border: 1px solid #ef4444; color: #fee2e2; font-size: 10px; font-weight: 800; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      TERMINATED
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Key Identifiers Callout Ribbon -->
          <tr>
            <td style="background-color: #fef2f2; padding: 14px 32px; border-bottom: 1px solid #fee2e2;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" align="left">
                    <span style="font-size: 10px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Partner Identifier:</span>
                    <strong style="display: block; font-size: 14px; font-family: monospace; color: #7f1d1d;">${partnerId}</strong>
                  </td>
                  <td width="50%" align="right">
                    <span style="font-size: 10px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Master Relationship Key:</span>
                    <strong style="display: block; font-size: 14px; font-family: monospace; color: #991b1b;">${relId}</strong>
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
                This formal communication serves as an institutional notice from <strong>Bandama Charity Foundation – Sierra Leone (BCF-SL)</strong> that the institutional partnership agreement with <strong>${partnerName}</strong> has been officially <strong>TERMINATED</strong>, effective <strong>${effectiveDate}</strong>.
              </p>

              <!-- Formal Justification Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; border: 1px solid #fecaca; background-color: #fef2f2; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #fee2e2; background-color: #fee2e2;">
                    <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #991b1b;">
                      Official Justification / Grounds for Termination
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 18px; font-size: 13.5px; color: #7f1d1d; font-style: italic; line-height: 1.6;">
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
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Effective Date:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #991b1b; border-bottom: 1px solid #f1f5f9; font-weight: 700;">${effectiveDate}</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; font-weight: 600;">Institutional Status:</td>
                  <td style="padding: 9px 14px; font-size: 12px; color: #991b1b; font-weight: 800;">Deregistered &amp; Terminated</td>
                </tr>
              </table>

              <!-- Governance Directives -->
              <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                Institutional Governance Directives:
              </h4>
              <ol style="margin: 0 0 24px 0; padding-left: 20px; font-size: 12.5px; color: #475569; line-height: 1.7;">
                <li><strong>Preservation of Historical Audit Records:</strong> All project deliverables, signed agreements, and logistics vouchers completed prior to ${effectiveDate} remain permanently archived in the BCF-SL master ledger.</li>
                <li><strong>Cessation of Solicitations &amp; Proposals:</strong> No further Purchase Requisitions (PR), Joint Proposals (BCF-PP), or MoU renewals will be accepted or funded under relationship key ${relId}.</li>
                <li><strong>Revocation of Active Module Linkages:</strong> System access and cross-module permissions for joint implementations are decommissioned.</li>
                <li><strong>Review Procedure:</strong> Formal inquiries regarding this decision may be addressed in writing to the Directorate of Strategic Partnerships within 14 calendar days.</li>
              </ol>

              <!-- Sign-off Block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <tr>
                  <td width="65%" align="left" valign="top">
                    <p style="margin: 0; font-size: 12.5px; font-weight: 800; color: #0f172a;">
                      ${terminatedBy}
                    </p>
                    <p style="margin: 2px 0 0 0; font-size: 11.5px; color: #64748b;">
                      Bandama Charity Foundation – Sierra Leone (BCF-SL)<br/>
                      Central Secretariat &bull; Freetown &amp; Bo, Sierra Leone
                    </p>
                  </td>
                  <td width="35%" align="right" valign="top">
                    <div style="display: inline-block; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: monospace; font-size: 10px; color: #64748b; background-color: #f8fafc; text-align: right;">
                      GOVERNANCE NOTICE<br/>
                      REF: BCF-TERM-${partnerId}
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
    console.error("send-partner-termination-email error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to transmit partner termination notice",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
