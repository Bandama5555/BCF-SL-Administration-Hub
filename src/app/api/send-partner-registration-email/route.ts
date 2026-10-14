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

    const rawTo = partner.email || partner.officialEmail || partner.official_email || partner.emailAddress || partner.partnerEmail || body.to;
    const to = typeof rawTo === "string" ? rawTo.trim() : "";
    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid partner official email address is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const partnerId = partner.id || "BCF-PAR-2026-0001";
    const relId = partner.relId || "BCF-REL-2026-000101";
    const partnerName = partner.name || "Partner Institution";
    const partnerType = partner.type || "Institutional Partner";
    const regNo = partner.registrationNumber || "SL-REG-COMPLIANT";
    const country = partner.country || "Sierra Leone";
    const district = partner.district || "Western Area Urban";
    const address = partner.address || "Freetown, Sierra Leone";
    const website = partner.website || "—";
    const telephone = partner.telephone || partner.phone || "—";
    const primaryContact = partner.primaryContact || partner.contactPerson || "Authorized Executive";
    const position = partner.position || "Head of Mission / Representative";
    const status = partner.partnershipStatus || "Active";
    const stage = partner.pipelineStage || "Identified";
    const officer = partner.partnershipOfficer || "Mohamed Bangura (Partnerships Manager)";
    const category = partner.category || "Programme Partnership";
    const thematic = partner.thematicArea || "Community Development & Humanitarian Aid";
    const finVal = Number(partner.financialValue || 0);
    const inKindVal = Number(partner.inKindValue || 0);
    const timestamp = new Date().toUTCString();

    const formattedFinVal = `NLe ${Number(finVal || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    const formattedInKindVal = `NLe ${Number(inKindVal || 0).toLocaleString("en-US", {
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

    const subject = `OFFICIAL NOTIFICATION: Institutional Partnership Registration & Master Key [${partnerId} / ${relId}] — Bandama Charity Foundation Sierra Leone`;

    const plainText = `================================================================================
BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL)
DIRECTORATE OF STRATEGIC PARTNERSHIPS & DONOR RELATIONS
Central Administration Secretariat | Freetown & Bo, Sierra Leone
Official Email: ${EMAIL_CONFIG.user} | Phone: +232 78 242826
================================================================================

OFFICIAL STATEMENT OF INSTITUTIONAL PARTNERSHIP ENROLLMENT

Dear ${primaryContact},
Attn: Executive Leadership & Governance Board of ${partnerName},

We are honored to officially confirm that ${partnerName} has been formally registered into the BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL) PARTNER MASTER REGISTRY.

Your organization has been provisioned with a permanent Master Relationship Identifier (BCF-REL), guaranteeing end-to-end integration across our Programme Management, Grants, Procurement, and Financial Ledgers across Sierra Leone.

--------------------------------------------------------------------------------
OFFICIAL PARTNERSHIP MASTER RECORD DETAILS:
--------------------------------------------------------------------------------
• Partner Identification:     ${partnerId}
• Master Relationship Key:    ${relId}
• Legal / Institutional Name: ${partnerName}
• Partner Classification:     ${partnerType}
• Statutory Registration No:  ${regNo}
• Jurisdiction / Country:     ${country}
• Operational District:       ${district}
• Physical Address:           ${address}
• Official Website:           ${website}
• Official Email:             ${to}
• Telephone Contact:          ${telephone}
• Primary Representative:     ${primaryContact} (${position})
• Partnership Status:         ${status}
• Current Pipeline Stage:     ${stage}
• Lead BCF-SL Officer:        ${officer}
• Strategic Category:         ${category}
• Thematic Focus Area:        ${thematic}
• Financial Commitment:       ${formattedFinVal}
• In-Kind Contribution:       ${formattedInKindVal}

--------------------------------------------------------------------------------
CROSS-MODULE INTEGRATION & STRATEGIC PRINCIPLE:
--------------------------------------------------------------------------------
BCF-SL operates under the core institutional principle:
"CREATE ONCE → VERIFY ONCE → APPROVE ONCE → USE EVERYWHERE → AUDIT EVERYTHING"

This formal registration enables:
1. JOINT PROGRAMME & PROPOSAL DESIGN (BCF-PP):
   Joint project concepts and Memoranda of Understanding (MoUs) will cite your master key (${relId}).
2. INTEGRATED PROCUREMENT & AID DELIVERY:
   Goods, logistics, and vendor distributions executed for this partnership will automatically reconcile through BCF-SL 3-Way Matching and Goods Received Notes.
3. DISTRICT-LEVEL MONITORING & REPORTING:
   All operations in ${district} will be tracked via our M&E database for verified community impact.

We look forward to an impactful, transparent, and transformative alliance.

Warm regards,

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
  <title>BCF-SL Partner Registration Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8faff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0b1c30; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8faff; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 55, 176, 0.08), 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #dce9ff;">
          
          <!-- Header Bar with Deep Royal Navy & Gold Accent -->
          <tr>
            <td style="background: linear-gradient(135deg, #00247d 0%, #0037b0 50%, #1e1b4b 100%); padding: 30px 32px; text-align: left;">
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
                      Institutional Partner Registration Certificate
                    </h1>
                    <span style="font-size: 11px; color: #cbd5e1; display: block; margin-top: 2px;">
                      Central Directorate of Strategic Partnerships &amp; Grants
                    </span>
                  </td>
                  <td width="90" align="right" valign="middle">
                    <span style="display: inline-block; padding: 5px 10px; background-color: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #a7f3d0; font-size: 10px; font-weight: 800; border-radius: 20px; text-transform: uppercase;">
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
                    <span style="font-size: 10px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Partner Identifier:</span>
                    <strong style="display: block; font-size: 14px; font-family: monospace; color: #1e3a8a;">${partnerId}</strong>
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
                Dear <strong>${primaryContact}</strong>,<br/>
                Attn: Executive Leadership &amp; Board of <strong>${partnerName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 13.5px; color: #334155; line-height: 1.6;">
                We are pleased to formally issue this notice confirming that <strong>${partnerName}</strong> has been officially registered and enrolled into the <strong>Bandama Charity Foundation – Sierra Leone (BCF-SL) Strategic Partner Master Registry</strong>.
              </p>

              <!-- Master Profile Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <tr style="background-color: #f1f5f9;">
                  <td colspan="2" style="padding: 10px 14px; font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                    Official Partner Master Record
                  </td>
                </tr>
                <tr>
                  <td width="35%" style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Legal Name:</td>
                  <td width="65%" style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-weight: 700;">${partnerName}</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Partner Type:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${partnerType}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Registration / Tax ID:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; font-family: monospace; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${regNo}</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Operational District:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9;"><strong>${district}</strong>, Sierra Leone</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Physical Headquarters:</td>
                  <td style="padding: 9px 14px; font-size: 12px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${address}</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Primary Representative:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${primaryContact} (${position})</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Strategic Classification:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${category}</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Thematic Focus Area:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${thematic}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Pipeline Stage:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; color: #0037b0; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${stage}</td>
                </tr>
                <tr style="background-color: #fafafa;">
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Committed Finance:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; font-family: monospace; color: #047857; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${formattedFinVal}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; font-size: 12px; color: #64748b; font-weight: 600;">In-Kind Contribution:</td>
                  <td style="padding: 9px 14px; font-size: 12.5px; font-family: monospace; color: #0369a1; font-weight: 700;">${formattedInKindVal}</td>
                </tr>
              </table>

              <!-- Institutional Scope Box -->
              <div style="background-color: #f8fafc; border-left: 4px solid #0037b0; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 24px;">
                <span style="display: block; font-size: 11px; font-weight: 800; color: #0037b0; text-transform: uppercase; margin-bottom: 4px;">
                  Unified Collaboration Architecture
                </span>
                <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
                  Your designated Master Key <strong>${relId}</strong> guarantees unified traceability across all BCF-SL modules: Joint Concept Proposals (BCF-PP), Memoranda of Understanding (BCF-AGR), Milestone Deliverables (BCF-DEL), and Linked Procurement Packages.
                </p>
              </div>

              <p style="margin: 0 0 24px 0; font-size: 12.5px; color: #475569; line-height: 1.5;">
                For direct coordination, questions, or to schedule joint planning sessions, please contact your designated relationship officer: <strong>${officer}</strong>.
              </p>

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
                      VERIFIED ON: ${new Date().toISOString().split("T")[0]}
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
        partnerId,
        relId,
        message: `Official partner registration certificate successfully dispatched to ${to} via Gmail SMTP`,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("send-partner-registration-email error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to transmit partner registration email" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
