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
    const reason = (body.reason || supplier.reinstatementReason || "Compliance review completed and agreement successfully renewed by Procurement Directorate").trim();
    const effectiveDate = body.effectiveDate || supplier.reinstatedDate || new Date().toISOString().split("T")[0];
    const reinstatedBy = body.reinstatedBy || "Directorate of Procurement & Supply Chain Management";

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
    const totalOrders = supplier.totalOrders || 0;
    const totalSpend = supplier.totalSpend ? `NLe ${Number(supplier.totalSpend).toLocaleString()}` : "NLe 0.00";

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

    const subject = `OFFICIAL NOTICE: Reinstatement & Renewal of Vendor Accreditation Agreement [${vendorId}] — Bandama Charity Foundation`;

    const plainText = `================================================================================
BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL)
CENTRAL PROCUREMENT & SUPPLY CHAIN MANAGEMENT DIRECTORATE
Official Registration: SL-NNGO-2023-084
Headquarters: Freetown, Sierra Leone | Regional Hub: Bo, Sierra Leone
Official Email: ${EMAIL_CONFIG.user} | Official Inquiries: +23278242826
================================================================================

OFFICIAL NOTICE OF VENDOR ACCREDITATION REINSTATEMENT & RENEWAL

Dear ${contactPerson},
Attn: Executive Management of ${companyName} (${tradingName})
Vendor Master ID: ${vendorId}
Official Designated Email: ${to}

This formal communication serves as official institutional notice from Bandama Charity Foundation – Sierra Leone (BCF-SL) that the Master Vendor Agreement and Institutional Accreditation for ${companyName} has been OFFICIALLY REINSTATED AND RENEWED, effective ${effectiveDate}.

--------------------------------------------------------------------------------
OFFICIAL JUSTIFICATION & BASIS FOR REINSTATEMENT:
--------------------------------------------------------------------------------
"${reason}"

--------------------------------------------------------------------------------
REINSTATEMENT PROVISIONS & ACTIVE STANDING:
--------------------------------------------------------------------------------
1. FULL RESTORATION OF PROCUREMENT ELIGIBILITY:
   Effective immediately, your organization has been restored to the Approved Vendor & Supplier Master List in Active and Compliant standing. Your firm is once again authorized and accredited to:
   • Receive direct Requests for Quotation (RFQs) and competitive bidding solicitations
   • Submit binding commercial bids and tender responses
   • Be awarded Purchase Orders (POs) and execute supply contracts across all BCF-SL programmes

2. RETENTION OF HISTORICAL TRANSACTION LEDGER:
   Your complete previous track record (${totalOrders} fulfilled POs, cumulative spend of ${totalSpend}) remains fully preserved in the Master Procurement Ledger, ensuring your historical compliance and delivery ratings are maintained.

3. GOVERNANCE & 3-WAY MATCHING COMMITMENT:
   All future order fulfillment will proceed under BCF-SL standard 3-Way Matching protocols (PO vs. Certified Goods Received Note vs. Tax Invoice) through the Finance Directorate.

Authorized Signatory:
DIRECTORATE OF PROCUREMENT & SUPPLY CHAIN MANAGEMENT
Bandama Charity Foundation – Sierra Leone (BCF-SL)
Official Email: ${EMAIL_CONFIG.user} | Phone: +23278242826
Timestamp: ${timestamp}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BCF-SL Official Notice of Vendor Agreement Reinstatement</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Bar (Emerald / Forest Green for Official Reinstatement) -->
          <tr>
            <td style="background: linear-gradient(135deg, #047857 0%, #065f46 100%); padding: 26px 28px; text-align: center;">
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
                    <div style="color: #a7f3d0; font-size: 12px; font-weight: 600; margin-top: 3px; letter-spacing: 0.2px; text-align: center;">
                      SIERRA LEONE (BCF-SL) &bull; Central Procurement Directorate
                    </div>
                  </td>

                  <!-- Right: Status Badge -->
                  <td width="135" align="right" valign="middle" style="width: 135px; text-align: right;">
                    <div style="background-color: #ffffff; border-radius: 10px; padding: 7px 12px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.5); display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); min-width: 100px;">
                      <span style="display: block; font-size: 9px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px;">Agreement Status</span>
                      <span style="font-size: 11px; font-weight: 900; color: #047857;">REINSTATED</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Document Subheader -->
          <tr>
            <td style="padding: 16px 28px; background-color: #ecfdf5; border-bottom: 1px solid #d1fae5;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left">
                    <span style="font-size: 11px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">Notice Classification:</span>
                    <span style="font-size: 11px; font-weight: 700; color: #047857; margin-left: 4px;">Accreditation Reinstatement &amp; Renewal</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">Effective Date:</span>
                    <span style="font-size: 11px; font-family: monospace; font-weight: 700; color: #047857; margin-left: 4px;">${effectiveDate}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 28px;">
              <p style="font-size: 14px; color: #1e293b; margin: 0 0 16px 0;">
                Dear <strong>${contactPerson}</strong>,
              </p>
              <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
                The Directorate of Procurement &amp; Supply Chain Management of <strong>Bandama Charity Foundation – Sierra Leone (BCF-SL)</strong> formally confirms that following official review, the <strong>Vendor Master Accreditation Agreement</strong> for <strong>${companyName}</strong> (${tradingName}) has been <strong>OFFICIALLY REINSTATED AND RENEWED</strong>.
              </p>

              <!-- Reinstatement Announcement Callout Box -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px; padding: 18px 20px; margin-bottom: 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td valign="top" style="padding-right: 12px; width: 28px;">
                      <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #10b981; color: #ffffff; text-align: center; line-height: 24px; font-weight: bold; font-size: 14px;">&check;</div>
                    </td>
                    <td valign="top">
                      <div style="font-size: 11px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                        Official Statement of Reinstatement
                      </div>
                      <div style="font-size: 13.5px; font-weight: 700; color: #064e3b; line-height: 1.5;">
                        ${companyName} is fully restored to active standing on the BCF-SL Approved Vendor &amp; Supplier Master List. Your organization is once again accredited to participate in all ongoing and upcoming procurement solicitations.
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Basis for Reinstatement Box -->
              <div style="background-color: #ffffff; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 18px; margin-bottom: 22px;">
                <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                  Official Justification &amp; Basis for Renewal:
                </div>
                <div style="font-size: 13px; color: #1e293b; font-style: italic; line-height: 1.5; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px dashed #cbd5e1;">
                  &ldquo;${reason}&rdquo;
                </div>
              </div>

              <!-- Vendor Credentials Summary Grid -->
              <div style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 16px; margin-bottom: 22px;">
                <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                  Active Vendor Credentials &amp; Registry Snapshot
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 12px;">
                  <tr>
                    <td width="50%" style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">
                      <span style="color: #64748b; font-weight: 600;">Vendor ID:</span>
                      <strong style="color: #0f172a; font-family: monospace; margin-left: 6px;">${vendorId}</strong>
                    </td>
                    <td width="50%" style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">
                      <span style="color: #64748b; font-weight: 600;">Compliance Status:</span>
                      <strong style="color: #047857; margin-left: 6px;">Compliant &bull; Active</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">
                      <span style="color: #64748b; font-weight: 600;">Official Email:</span>
                      <strong style="color: #0037b0; margin-left: 6px; font-family: monospace;">${to}</strong>
                    </td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">
                      <span style="color: #64748b; font-weight: 600;">Contact Phone:</span>
                      <strong style="color: #0f172a; margin-left: 6px;">${phone}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 8px;">
                      <span style="color: #64748b; font-weight: 600;">Fulfilled Orders:</span>
                      <strong style="color: #0f172a; font-family: monospace; margin-left: 6px;">${totalOrders} POs</strong>
                    </td>
                    <td style="padding: 6px 8px;">
                      <span style="color: #64748b; font-weight: 600;">Cumulative Spend:</span>
                      <strong style="color: #0037b0; font-family: monospace; margin-left: 6px;">${totalSpend}</strong>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Operating Directives -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                  Procurement Directives &amp; Resumption of Activities:
                </div>
                <ul style="font-size: 12.5px; color: #334155; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">
                    <strong>RFQ Transmission:</strong> Your designated official email (<span style="font-family: monospace; color: #0037b0;">${to}</span>) will resume receiving Requests for Quotations for your accredited supply categories.
                  </li>
                  <li style="margin-bottom: 8px;">
                    <strong>Purchase Orders:</strong> Your organization is certified to enter into formal supply contracts and receive BCF-SL Purchase Orders.
                  </li>
                  <li style="margin-bottom: 8px;">
                    <strong>Historical Ledger Integrity:</strong> All previous purchase orders and settlement analytics have been fully preserved and reconciled for audit.
                  </li>
                  <li>
                    <strong>Governance Compliance:</strong> Continued accreditation is subject to adherence to BCF-SL procurement standards and prompt delivery.
                  </li>
                </ul>
              </div>

              <!-- Sign-off Block -->
              <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 24px;">
                <div style="font-size: 12px; color: #64748b; font-weight: 600;">Authorized By:</div>
                <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">
                  Directorate of Procurement &amp; Supply Chain Management
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

    console.log(`[BCF-SL VENDOR REINSTATEMENT EMAIL SENT] Dispatched to ${to} for Vendor ${vendorId} (${companyName}). MessageId: ${info.messageId}`);

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
        message: `Official reinstatement notice successfully transmitted to ${to}`,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error("[BCF-SL VENDOR REINSTATEMENT EMAIL ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to dispatch vendor reinstatement email",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
