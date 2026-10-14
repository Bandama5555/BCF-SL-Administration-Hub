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
    const proposal = body.proposal || body;
    const partner = body.partner || {};

    const rawTo =
      partner.email ||
      partner.officialEmail ||
      partner.official_email ||
      proposal.partnerEmail ||
      proposal.officialEmail ||
      proposal.official_email ||
      proposal.email ||
      body.officialEmail ||
      body.email ||
      body.to ||
      "";
    const to = typeof rawTo === "string" ? rawTo.trim() : "";
    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid partner official email address is required to transmit proposal" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const proposalId = proposal.id || "BCF-PP-2026-0001";
    const relId = proposal.relId || partner.relId || "BCF-REL-2026-000101";
    const partnerName = partner.name || proposal.partnerName || "Partner Institution";
    const contactPerson = partner.primaryContact || partner.contactPerson || "Executive Representative";
    const programme = proposal.programme || "Humanitarian Development Programme";
    const project = proposal.project || "Strategic Collaboration Initiative";
    const objective = proposal.objective || "Joint community development and aid delivery across Sierra Leone.";
    const beneficiaries = Number(proposal.beneficiariesCount || 0).toLocaleString();
    const estimatedValue = Number(proposal.estimatedValue || 0);
    const partnerContrib = proposal.partnerContribution || "Joint programmatic support and technical resources";
    const bcfContrib = proposal.bcfContribution || "Operational implementation, field staff, and logistics management";
    const status = proposal.approvalStatus || "Under Management Review";
    const timestamp = new Date().toUTCString();

    const formattedValue = `NLe ${Number(estimatedValue || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    // Resolve Logo
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

    const subject = `STRATEGIC PARTNERSHIP PROPOSAL (BCF-PP): ${project} [${proposalId}] — Bandama Charity Foundation Sierra Leone`;

    const plainText = `================================================================================
BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL)
DIRECTORATE OF STRATEGIC PARTNERSHIPS & PROGRAMME COLLABORATION
Proposal Transmission Notice: ${proposalId} | Relationship Key: ${relId}
Official Email: ${EMAIL_CONFIG.user} | Phone: +232 78 242826
================================================================================

TRANSMISSION OF FORMAL PARTNERSHIP PROPOSAL (BCF-PP)

Dear ${contactPerson},
Attn: Management & Project Review Directorate of ${partnerName},

We are pleased to submit the official Bandama Charity Foundation – Sierra Leone (BCF-SL) Joint Partnership Proposal for your formal review and collaborative endorsement.

This proposal has been registered in the BCF-SL central lifecycle tracking system under Master Relationship Key: ${relId}.

--------------------------------------------------------------------------------
PROPOSAL METADATA & JOINT COMMITMENTS:
--------------------------------------------------------------------------------
• Proposal Identifier:         ${proposalId}
• Master Relationship Key:     ${relId}
• Designated Partner:          ${partnerName}
• Recipient Official Email:    ${to}
• Strategic Programme:         ${programme}
• Proposed Project Title:      ${project}
• Target Beneficiaries:        ${beneficiaries} Citizens in Sierra Leone
• Total Estimated Investment:  ${formattedValue}
• Review & Clearance Status:   ${status}

--------------------------------------------------------------------------------
STRATEGIC PARTNERSHIP OBJECTIVE:
--------------------------------------------------------------------------------
${objective}

--------------------------------------------------------------------------------
AGREED JOINT CONTRIBUTIONS:
--------------------------------------------------------------------------------
1. PARTNER CONTRIBUTION (${partnerName}):
   ${partnerContrib}

2. BCF-SL CONTRIBUTION:
   ${bcfContrib}

--------------------------------------------------------------------------------
NEXT STEPS & GOVERNANCE WORKFLOW:
--------------------------------------------------------------------------------
1. Technical and Programmatic Review by your authorized delegates.
2. Formulation of official Memorandum of Understanding (MoU) / Sub-Grant Agreement (BCF-AGR).
3. Joint operational planning and milestone deliverable baseline scheduling.

Thank you for your dedicated collaboration to improve the lives of vulnerable communities in Sierra Leone.

Sincerely,

DIRECTORATE OF STRATEGIC PARTNERSHIPS & GRANTS
Bandama Charity Foundation – Sierra Leone (BCF-SL)
Email: ${EMAIL_CONFIG.user} | Phone: +232 78 242826
Website: https://bcf-sl.org
Timestamp: ${timestamp}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BCF-SL Partnership Proposal Transmission</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8faff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0b1c30; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8faff; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 55, 176, 0.08), 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #dce9ff;">
          
          <!-- Header Bar with Deep Navy & Royal Blue Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #0037b0 60%, #1e3a8a 100%); padding: 30px 32px; text-align: left;">
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
                    <span style="display: inline-block; font-size: 10px; font-weight: 800; color: #93c5fd; text-transform: uppercase; letter-spacing: 1.5px;">
                      BANDAMA CHARITY FOUNDATION &bull; SIERRA LEONE
                    </span>
                    <h1 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: -0.3px;">
                      Partnership Proposal (BCF-PP)
                    </h1>
                    <span style="font-size: 11px; color: #cbd5e1; display: block; margin-top: 2px;">
                      Official Transmission &bull; Joint Programme Collaboration
                    </span>
                  </td>
                  <td width="110" align="right" valign="middle">
                    <span style="display: inline-block; padding: 5px 10px; background-color: rgba(59, 130, 246, 0.25); border: 1px solid #60a5fa; color: #bfdbfe; font-size: 10px; font-weight: 800; border-radius: 20px; text-transform: uppercase;">
                      ${status}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Key Identifiers Callout Ribbon -->
          <tr>
            <td style="background-color: #eff6ff; padding: 14px 32px; border-bottom: 1px solid #dbeafe;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" align="left">
                    <span style="font-size: 10px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Proposal Identifier:</span>
                    <strong style="display: block; font-size: 14px; font-family: monospace; color: #1e3a8a;">${proposalId}</strong>
                  </td>
                  <td width="50%" align="right">
                    <span style="font-size: 10px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Master Relationship Key:</span>
                    <strong style="display: block; font-size: 14px; font-family: monospace; color: #0037b0;">${relId}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 30px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
                Dear <strong>${contactPerson}</strong>,<br/>
                Attn: Executive Leadership &amp; Project Review Team of <strong>${partnerName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 13.5px; color: #334155; line-height: 1.6;">
                We are pleased to formally submit this <strong>Strategic Partnership Concept Proposal (${proposalId})</strong> for collaborative joint implementation between <strong>Bandama Charity Foundation – Sierra Leone</strong> and <strong>${partnerName}</strong>.
              </p>

              <!-- Proposal Specifications Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <tr style="background-color: #f1f5f9;">
                  <td colspan="2" style="padding: 10px 14px; font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                    Project Scope &amp; Specifications
                  </td>
                </tr>
                <tr>
                  <td width="35%" style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Project Title:</td>
                  <td width="65%" style="padding: 9px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-weight: 800;">${project}</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Programme Framework:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${programme}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Target Beneficiaries:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #047857; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${beneficiaries} Citizens in Sierra Leone</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Estimated Value:</td>
                  <td style="padding: 9px 14px; font-size: 14px; font-family: monospace; color: #0037b0; font-weight: 900; border-bottom: 1px solid #f1f5f9;">${formattedValue}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; font-weight: 600;">Review Status:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; font-weight: 700;">${status}</td>
                </tr>
              </table>

              <!-- Strategic Objectives Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <span style="display: block; font-size: 11px; font-weight: 800; color: #0037b0; text-transform: uppercase; margin-bottom: 6px;">
                  Partnership Strategic Objective
                </span>
                <p style="margin: 0; font-size: 12.5px; color: #334155; line-height: 1.6;">
                  ${objective}
                </p>
              </div>

              <!-- Respective Contributions Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td width="48%" valign="top" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px;">
                    <span style="display: block; font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; margin-bottom: 4px;">
                      Partner Contribution (${partnerName})
                    </span>
                    <p style="margin: 0; font-size: 12px; color: #14532d; line-height: 1.5;">
                      ${partnerContrib}
                    </p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" valign="top" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px;">
                    <span style="display: block; font-size: 11px; font-weight: 800; color: #1e40af; text-transform: uppercase; margin-bottom: 4px;">
                      BCF-SL Contribution
                    </span>
                    <p style="margin: 0; font-size: 12px; color: #1e3a8a; line-height: 1.5;">
                      ${bcfContrib}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Next Steps Notice -->
              <div style="background-color: #fdf4ff; border-left: 4px solid #a855f7; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 24px;">
                <span style="display: block; font-size: 11px; font-weight: 800; color: #7e22ce; text-transform: uppercase; margin-bottom: 4px;">
                  Action Required &amp; Governance Next Steps
                </span>
                <p style="margin: 0; font-size: 12px; color: #581c87; line-height: 1.5;">
                  Upon mutual review and alignment on this proposal, our legal and programmes team will issue the official bilateral <strong>Memorandum of Understanding (MoU) / Service Level Agreement (BCF-AGR)</strong>.
                </p>
              </div>

              <!-- Signature Block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <tr>
                  <td width="60%">
                    <strong style="font-size: 13px; color: #0f172a; display: block;">Directorate of Strategic Partnerships &amp; Grants</strong>
                    <span style="font-size: 11.5px; color: #64748b; display: block;">Bandama Charity Foundation – Sierra Leone (BCF-SL)</span>
                    <span style="font-size: 11px; color: #94a3b8; display: block; margin-top: 2px;">Email: ${EMAIL_CONFIG.user} | Phone: +232 78 242826</span>
                  </td>
                  <td width="40%" align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: #f1f5f9; border-radius: 6px; font-size: 10px; font-family: monospace; color: #64748b;">
                      TRANSMITTED: ${new Date().toISOString().split("T")[0]}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <span style="font-size: 11px; color: #94a3b8; display: block;">
                Bandama Charity Foundation Sierra Leone (BCF-SL) &bull; Registered Non-Profit Humanitarian Organization
              </span>
              <span style="font-size: 10px; color: #cbd5e1; display: block; margin-top: 3px;">
                CONFIDENTIALITY NOTICE: This transmission is intended solely for ${partnerName} (${to}).
              </span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const info = await sendMail({
      to,
      subject,
      text: plainText,
      html,
      attachments,
    });

    return NextResponse.json(
      {
        success: true,
        messageId: info.messageId,
        recipient: to,
        proposalId,
        relId,
        message: `Strategic partnership proposal successfully transmitted to ${to} via Gmail SMTP`,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("send-partner-proposal-email error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to transmit partner proposal email" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
