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
    const supplier = body.supplier || {};
    const reason = (body.reason || supplier.terminationReason || "Material breach of contractual terms or regulatory non-compliance").trim();
    const effectiveDate = body.effectiveDate || supplier.terminatedDate || new Date().toISOString().split("T")[0];
    const terminatedBy = body.terminatedBy || "Directorate of Procurement & Supply Chain Management";

    const to = supplier.email || body.to;
    if (!to || typeof to !== "string" || !to.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid supplier official email address is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const vendorId = supplier.id || "BCF-SUP-REGISTERED";
    const companyName = supplier.name || "Accredited Supplier";
    const tradingName = supplier.tradingName || companyName;
    const contactPerson = supplier.contactPerson || "Authorized Representative";
    const phone = supplier.phone || "—";
    const timestamp = new Date().toUTCString();

    // Resolve official logo path
    const possibleLogoPaths = [
      path.join(process.cwd(), "public", "bcf_official_logo.png"),
      path.join(process.cwd(), "bcf_official_logo.png"),
      path.join(process.cwd(), "..", "bcf_official_logo.png"),
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

    const subject = `OFFICIAL NOTICE: Termination of Vendor Accreditation Agreement [${vendorId}] — Bandama Charity Foundation`;

    const plainText = `================================================================================
BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL)
CENTRAL PROCUREMENT & SUPPLY CHAIN MANAGEMENT DIRECTORATE
Official Registration: SL-NNGO-2023-084
Headquarters: Freetown, Sierra Leone | Regional Hub: Bo, Sierra Leone
Official Email: ${EMAIL_CONFIG.user} | Phone: +23278242826
================================================================================

OFFICIAL NOTICE OF VENDOR AGREEMENT TERMINATION

Dear ${contactPerson},
Attn: Executive Management & Legal Directorate of ${companyName} (${tradingName})
Vendor Master ID: ${vendorId}
Official Designated Email: ${to}

This formal communication serves as official institutional notice from Bandama Charity Foundation – Sierra Leone (BCF-SL) that the Master Vendor Agreement and Institutional Accreditation for ${companyName} has been TERMINATED, effective ${effectiveDate}.

--------------------------------------------------------------------------------
OFFICIAL JUSTIFICATION & REASON FOR TERMINATION:
--------------------------------------------------------------------------------
"${reason}"

--------------------------------------------------------------------------------
CONTRACTUAL STATUS & GOVERNANCE PROVISIONS:
--------------------------------------------------------------------------------
1. STATUS OF EXISTING FULFILLED COMMITMENTS:
   In accordance with BCF-SL procurement standards, historical orders and accepted deliveries under officially certified Goods Received Notes (GRNs) completed prior to ${effectiveDate} remain valid in our master ledger. Any outstanding commercial invoices with certified GRNs will be reconciled through standard 3-Way matching and settled as per contractual payment terms subject to statutory NRA withholding tax.

2. CESSATION OF PROCUREMENT PARTICIPATION & SOLICITATIONS:
   Effective immediately upon issuance of this notice, your firm is deregistered from active vendor bidding rosters. Your organization will no longer receive Requests for Quotation (RFQs), invitations to competitive tender, or new Purchase Order awards from any BCF-SL directorate, programme office, or regional depot.

3. REVISION OF MASTER RECORD:
   Your entity profile in the BCF-SL Vendor & Supplier Master Register has been updated to "Terminated". All historical order records, delivery audit logs, and spend analytics are permanently retained for statutory compliance and donor audit integrity.

4. INQUIRIES & APPEALS PROCEDURE:
   If you wish to seek clarification or submit formal representation regarding this decision, your legal representative may address the Central Procurement Governance Committee in writing within fourteen (14) calendar days to:
   Email: ${EMAIL_CONFIG.user}
   Phone: +23278242826
   Address: Central Procurement Directorate, BCF-SL Headquarters, Freetown, Sierra Leone.

Issued under the authority of:
DIRECTORATE OF PROCUREMENT & SUPPLY CHAIN MANAGEMENT
Bandama Charity Foundation – Sierra Leone (BCF-SL)
Official Email: ${EMAIL_CONFIG.user} | Phone: +23278242826
Timestamp: ${timestamp}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BCF-SL Official Notice of Vendor Agreement Termination</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Bar (Crimson / Deep Rose for Official Termination) -->
          <tr>
            <td style="background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%); padding: 26px 28px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                <tr>
                  <!-- Left: Official BCF-SL Logo -->
                  <td width="135" align="left" valign="middle" style="width: 135px; text-align: left;">
                    <div style="background-color: #ffffff; padding: 6px 8px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid rgba(255, 255, 255, 0.5);">
                      <img src="cid:bcf_official_logo" alt="BCF-SL Logo" width="120" style="display: block; width: 120px; max-width: 120px; height: auto; border: 0;" />
                    </div>
                  </td>

                  <!-- Center: Header & Directorate -->
                  <td align="center" valign="middle" style="text-align: center; padding: 0 8px;">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-bottom: 7px; border: 1px solid rgba(255, 255, 255, 0.3);">
                      Official Procurement Governance Notice
                    </div>
                    <h1 style="color: #ffffff; font-size: 19px; font-weight: 900; margin: 0; letter-spacing: -0.3px; line-height: 1.25; text-align: center;">
                      BANDAMA CHARITY FOUNDATION
                    </h1>
                    <div style="color: #fecaca; font-size: 12px; font-weight: 600; margin-top: 3px; letter-spacing: 0.2px; text-align: center;">
                      SIERRA LEONE (BCF-SL) &bull; Central Procurement Directorate
                    </div>
                  </td>

                  <!-- Right: Status Badge -->
                  <td width="135" align="right" valign="middle" style="width: 135px; text-align: right;">
                    <div style="background-color: #ffffff; border-radius: 10px; padding: 7px 12px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.5); display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); min-width: 100px;">
                      <span style="display: block; font-size: 9px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Agreement Status</span>
                      <span style="font-size: 11px; font-weight: 900; color: #991b1b;">TERMINATED</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Termination Callout Banner -->
          <tr>
            <td style="padding: 24px 36px 12px;">
              <div style="background-color: #fff1f2; border: 2px solid #fecdd3; border-radius: 12px; padding: 18px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #e11d48; color: #ffffff; font-size: 18px; font-weight: bold; text-align: center; line-height: 32px;">
                        &#10006;
                      </div>
                    </td>
                    <td style="padding-left: 14px;">
                      <h2 style="color: #9f1239; font-size: 14.5px; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.3px;">
                        Notice of Master Vendor Agreement Termination
                      </h2>
                      <p style="color: #be123c; font-size: 13px; font-weight: 600; margin: 0; line-height: 1.5;">
                        This document serves as formal notification that the procurement agreement and accredited vendor standing of <strong>${companyName}</strong> has been officially terminated.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 12px 36px 20px;">
              <p style="font-size: 14px; color: #334155; margin: 0 0 14px 0;">
                Dear <strong>${contactPerson}</strong>,
              </p>
              <p style="font-size: 13.5px; color: #475569; margin: 0 0 16px 0; line-height: 1.6;">
                The Directorate of Procurement &amp; Supply Chain Management of <strong>Bandama Charity Foundation – Sierra Leone (BCF-SL)</strong> hereby provides formal notice that the institutional vendor agreement between BCF-SL and your organization (Vendor ID: <strong>${vendorId}</strong>) has been formally terminated with effect from <strong>${effectiveDate}</strong>.
              </p>

              <!-- Reason for Termination Card -->
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 18px; border-radius: 0 10px 10px 0; margin-bottom: 22px;">
                <span style="display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #991b1b; letter-spacing: 0.5px; margin-bottom: 6px;">
                  Official Reason &amp; Justification for Termination:
                </span>
                <p style="margin: 0; font-size: 13px; color: #7f1d1d; font-style: italic; line-height: 1.6;">
                  &ldquo;${reason}&rdquo;
                </p>
              </div>

              <!-- Vendor Metadata Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 12px; margin-bottom: 22px;">
                <tr>
                  <td colspan="2" style="background-color: #f1f5f9; padding: 8px 16px; border-radius: 11px 11px 0 0; font-weight: 800; font-size: 11px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">
                    Termination Record Details
                  </td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9; width: 40%;">Vendor Entity Name</td>
                  <td style="padding: 9px 16px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${companyName}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Unique Vendor ID</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 800; color: #334155; border-bottom: 1px solid #f1f5f9;">${vendorId}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Designated Official Email</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 700; color: #0037b0; border-bottom: 1px solid #f1f5f9;">${to}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Effective Termination Date</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 700; color: #b91c1c; border-bottom: 1px solid #f1f5f9;">${effectiveDate}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600;">Governance Authority</td>
                  <td style="padding: 9px 16px; font-weight: 700; color: #334155;">${terminatedBy}</td>
                </tr>
              </table>

              <!-- Institutional Implications -->
              <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.3px;">
                Contractual Standing &amp; Regulatory Implications:
              </h3>
              <ul style="font-size: 12.5px; color: #475569; padding-left: 20px; margin: 0 0 24px 0; line-height: 1.6;">
                <li style="margin-bottom: 6px;">
                  <strong>Preservation of Fulfilled Commitments:</strong> All verified Purchase Orders and accepted Goods Received Notes (GRNs) completed prior to this termination date remain documented in our master register. Authorized commercial invoices currently in processing will be settled in accordance with contract terms and NRA statutory withholding requirements.
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Exclusion from Future Bidding &amp; RFQs:</strong> Effective immediately, your organization is barred from participating in future Requests for Quotation (RFQs), selective tendering, or new Purchase Order issuances across all BCF-SL programs.
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Master Ledger Integrity:</strong> In compliance with national NGO regulations and donor audit requirements, historical procurement records will remain archived in the BCF-SL procurement ledger.
                </li>
              </ul>

              <!-- Sign-off & Inquiries -->
              <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 14px 18px; border-radius: 0 10px 10px 0;">
                <div style="font-weight: 800; font-size: 13px; color: #334155;">
                  DIRECTORATE OF PROCUREMENT &amp; SUPPLY CHAIN MANAGEMENT
                </div>
                <div style="font-size: 12px; color: #475569; font-weight: 600; margin-top: 2px;">
                  Bandama Charity Foundation – Sierra Leone (BCF-SL)
                </div>
                <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">
                  Official Email: <a href="mailto:${EMAIL_CONFIG.user}" style="color: #0037b0; text-decoration: none; font-weight: bold;">${EMAIL_CONFIG.user}</a> | Phone: +23278242826
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; border-top: 1px solid #e2e8f0; padding: 20px 36px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                Official Institutional Notice dispatched from BCF-SL Administration Hub.<br/>
                Bandama Charity Foundation (SL) &bull; National NGO Reg: SL-NNGO-2023-084 &bull; Freetown &amp; Bo, Sierra Leone
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

    const info = await sendMail({
      to,
      subject,
      text: plainText,
      html,
      attachments,
    });

    console.log(`[BCF-SL VENDOR TERMINATION EMAIL SENT] Dispatched to ${to} for Vendor ${vendorId} (${companyName}). MessageId: ${info.messageId}`);

    return NextResponse.json(
      {
        success: true,
        method: "GMAIL_SMTP_AUTOMATED",
        messageId: info.messageId,
        vendorId,
        companyName,
        recipient: to,
        effectiveDate,
        reason,
        sentAt: timestamp,
        message: `Official termination notice successfully transmitted to ${to}`,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error("[BCF-SL VENDOR TERMINATION EMAIL ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to dispatch vendor termination email",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
