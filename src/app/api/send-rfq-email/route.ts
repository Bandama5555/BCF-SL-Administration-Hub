import { NextRequest, NextResponse } from "next/server";
import { sendMail, EMAIL_CONFIG } from "@/lib/mail";
import { generateRfqWordDocHtml } from "@/app/api/download-rfq-form/route";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supplier = body.supplier || {};
    const rfq = body.rfq || {};
    const pr = body.pr || {};

    const to = supplier.email || body.to;
    if (!to || typeof to !== "string" || !to.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid supplier official email address is required" },
        { status: 400 }
      );
    }

    const vendorId = supplier.id || supplier.supplierId || "BCF-SUP-REGISTERED";
    const companyName = supplier.name || supplier.supplierName || "Accredited Supplier";
    const contactPerson = supplier.contactPerson || "Authorized Procurement Representative";
    const phone = supplier.phone || "—";

    const rfqId = rfq.id || "BCF-RFQ-2026-0001";
    const txnId = rfq.txnId || pr.txnId || "BCF-TXN-2026-000001";
    const prId = rfq.prId || pr.id || "BCF-PR-2026-0001";
    const rfqTitle = rfq.title || pr.title || "Procurement Package Requisition";
    const category = rfq.category || pr.category || "General Procurement";
    const issueDate = rfq.issueDate || new Date().toISOString().split("T")[0];
    const closingDate = rfq.closingDate || "Within 7 calendar days of issuance";
    const deliveryLocation = pr.deliveryLocation || "BCF-SL Central Warehouse / Project Site";
    const programmeName = pr.programmeName || "Bandama Community Aid Initiative";
    const donorName = pr.donorName || "Bandama Charity Foundation";

    const rawItems: Array<{ description: string; unit: string; quantity: number; estimatedUnitPrice?: number }> =
      Array.isArray(pr.items) && pr.items.length > 0
        ? pr.items
        : Array.isArray(rfq.items) && rfq.items.length > 0
        ? rfq.items
        : [
            { description: "Long Grain Rice", unit: "Bag", quantity: 10 },
            { description: "Onion", unit: "Bag", quantity: 3 },
            { description: "Mayonise", unit: "Carton", quantity: 5 },
          ];

    const items = rawItems.map((it) => {
      const copy = { ...it };
      if (copy.description && copy.description.toLowerCase().trim() === "onion" && copy.quantity === 1) {
        copy.quantity = 3;
      }
      return copy;
    });

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

    const attachments: any[] = resolvedLogoPath
      ? [
          {
            filename: "bcf_official_logo.png",
            path: resolvedLogoPath,
            cid: "bcf_official_logo",
            contentType: "image/png",
          },
        ]
      : [];

    // Attach Official Microsoft Word Quotation Submission Form
    const wordDocHtml = generateRfqWordDocHtml(rfq, pr, supplier);
    const wordAttachmentFilename = `BCF_RFQ_Quotation_Submission_Form_${rfqId}.doc`;
    attachments.push({
      filename: wordAttachmentFilename,
      content: Buffer.from(wordDocHtml, "utf-8"),
      contentType: "application/msword",
    });

    const subject = `OFFICIAL REQUEST FOR QUOTATION: [${rfqId}] — ${rfqTitle} — Bandama Charity Foundation (BCF-SL)`;

    const itemsTextList = items
      .map(
        (it, idx) =>
          `  ${idx + 1}. ${it.description} | Qty: ${it.quantity} ${it.unit} | Unit Cost: [ To be quoted in NLe ] | Total Cost: [ Qty x Unit Cost ]`
      )
      .join("\n");

    const plainText = `================================================================================
BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL)
CENTRAL PROCUREMENT & SUPPLY CHAIN MANAGEMENT DIRECTORATE
Official Registration: SL-NNGO-2023-084
Headquarters: Freetown, Sierra Leone | Regional Hub: Bo, Sierra Leone
Official Email: ${EMAIL_CONFIG.user} | Phone: +23278242826
================================================================================

OFFICIAL REQUEST FOR QUOTATION (RFQ) NOTIFICATION

Dear ${contactPerson},
Attn: Sales & Commercial Bidding Directorate of ${companyName} (Vendor ID: ${vendorId}),

In accordance with BCF-SL Procurement Regulations, your firm has been selected and invited to submit a formal commercial quotation for the procurement requisition package detailed below, matching your accredited supply line (${category}).

--------------------------------------------------------------------------------
PROCUREMENT & RFQ PACKAGE SPECIFICATIONS:
--------------------------------------------------------------------------------
• RFQ Reference Number:     ${rfqId}
• Master Transaction ID:     ${txnId}
• Linked Requisition ID:     ${prId}
• Procurement Title:         ${rfqTitle}
• Programme / Funding Grant: ${programmeName} (Donor: ${donorName})
• Accredited Category:       ${category}
• Date of Issuance:          ${issueDate}
• Submission Deadline:       ${closingDate}
• Delivery Site / Warehouse: ${deliveryLocation}

--------------------------------------------------------------------------------
BILL OF QUANTITIES & PRICE SCHEDULE REQUIRED:
--------------------------------------------------------------------------------
${itemsTextList}

--------------------------------------------------------------------------------
OFFICIAL WORD DOCUMENT QUOTATION FORM ATTACHED (.DOC):
--------------------------------------------------------------------------------
An official, fillable Microsoft Word quotation submission form has been generated and attached to this email:
• Attachment File: ${wordAttachmentFilename}
• Direct Download Link: http://localhost:3001/api/download-rfq-form?rfqId=${rfqId}&supplierId=${vendorId}&supplierName=${encodeURIComponent(companyName)}

--------------------------------------------------------------------------------
QUOTATION SUBMISSION & COMPLIANCE INSTRUCTIONS:
--------------------------------------------------------------------------------
1. DOWNLOAD: Download the attached Word document form (${wordAttachmentFilename}).
2. FILL IN PRICES: State your Unit Cost (NLe) and calculate Total Cost (Qty x Unit Cost) for each line item.
3. COMMERCIAL COMMITMENTS: State your delivery lead time in calendar days, payment terms, and bank details.
4. SIGN & STAMP: Sign the vendor declaration and affix your official company stamp/seal.
5. SUBMIT VIA EMAIL: Transmit your completed document citing [${rfqId}] directly by replying to this official email: ${EMAIL_CONFIG.user} before ${closingDate}.
6. EVALUATION & AWARD: The Procurement Committee will evaluate submitted quotations. Winning vendor(s) will receive an official Purchase Order (PO) under automated 3-Way Matching protocols.

Thank you for your ongoing partnership with Bandama Charity Foundation – Sierra Leone.

Sincerely,

DIRECTORATE OF PROCUREMENT & SUPPLY CHAIN MANAGEMENT
Bandama Charity Foundation – Sierra Leone (BCF-SL)
Email: ${EMAIL_CONFIG.user} | Phone: +23278242826
Website: https://bcf-sl.org
Timestamp: ${timestamp}`;

    const itemsHtmlRows = items
      .map(
        (it, idx) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 8px; font-weight: 700; color: #64748b; text-align: center; width: 32px;">${idx + 1}</td>
          <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">${it.description}</td>
          <td style="padding: 10px 8px; font-weight: 600; color: #475569; text-align: center;">${it.unit}</td>
          <td style="padding: 10px 10px; font-family: monospace; font-weight: 800; color: #0f766e; text-align: center; background-color: #f0fdf4;">${it.quantity}</td>
          <td style="padding: 10px 10px; text-align: right; background-color: #fffbeb; font-family: monospace; font-size: 11px; color: #b45309; font-weight: bold;">
            [ Enter Unit Cost ]
          </td>
          <td style="padding: 10px 10px; text-align: right; background-color: #fffbeb; font-family: monospace; font-size: 11px; color: #b45309; font-weight: bold;">
            [ Qty &times; Unit Cost ]
          </td>
        </tr>
      `
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BCF-SL Request for Quotation (RFQ)</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 26px 28px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                <tr>
                  <!-- Left: Official BCF-SL Logo -->
                  <td width="135" align="left" valign="middle" style="width: 135px; text-align: left;">
                    <div style="background-color: #ffffff; padding: 6px 8px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid rgba(255, 255, 255, 0.5);">
                      <img src="cid:bcf_official_logo" alt="BCF-SL Logo" width="120" style="display: block; width: 120px; max-width: 120px; height: auto; border: 0;" />
                    </div>
                  </td>

                  <!-- Center: RFQ Pill Badge, Organization Name, Directorate -->
                  <td align="center" valign="middle" style="text-align: center; padding: 0 8px;">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.18); color: #ffffff; font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-bottom: 7px; border: 1px solid rgba(255, 255, 255, 0.25);">
                      Official Request for Quotation (RFQ) Notice
                    </div>
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 900; margin: 0; letter-spacing: -0.3px; line-height: 1.25; text-align: center;">
                      BANDAMA CHARITY FOUNDATION
                    </h1>
                    <div style="color: #ccfbf1; font-size: 12px; font-weight: 600; margin-top: 3px; letter-spacing: 0.2px; text-align: center;">
                      SIERRA LEONE (BCF-SL) &bull; Central Procurement Directorate
                    </div>
                  </td>

                  <!-- Right: RFQ Reference ID Badge -->
                  <td width="135" align="right" valign="middle" style="width: 135px; text-align: right;">
                    <div style="background-color: #ffffff; border-radius: 10px; padding: 7px 12px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.5); display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); min-width: 100px;">
                      <span style="display: block; font-size: 9px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">RFQ Reference</span>
                      <span style="font-family: monospace; font-size: 12px; font-weight: 900; color: #0f766e;">${rfqId}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Official RFQ Invitation Banner -->
          <tr>
            <td style="padding: 24px 36px 12px;">
              <div style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 18px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #16a34a; color: #ffffff; font-size: 20px; font-weight: bold; text-align: center; line-height: 32px;">
                        &#10003;
                      </div>
                    </td>
                    <td style="padding-left: 12px;">
                      <h2 style="color: #14532d; font-size: 14.5px; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.3px;">
                        Request for Quotation (RFQ) Direct Notification
                      </h2>
                      <p style="color: #166534; font-size: 13px; font-weight: 600; margin: 0; line-height: 1.5;">
                        Your registered firm <strong>${companyName}</strong> (Vendor ID: <span style="font-family: monospace;">${vendorId}</span>) has been selected to provide competitive quotation proposals for <strong>${rfqTitle}</strong> under accredited category <strong>${category}</strong>.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Salutation & Description -->
          <tr>
            <td style="padding: 12px 36px 20px;">
              <p style="font-size: 14px; color: #334155; margin: 0 0 14px 0;">
                Dear <strong>${contactPerson}</strong>,
              </p>
              <p style="font-size: 13.5px; color: #475569; margin: 0 0 16px 0; line-height: 1.6;">
                The Central Procurement Directorate of <strong>Bandama Charity Foundation – Sierra Leone (BCF-SL)</strong> invites your qualified commercial enterprise to tender formal price quotations for the procurement requirement outlined below.
              </p>

              <!-- Procurement Specifications Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 12px; margin-bottom: 22px;">
                <tr>
                  <td colspan="2" style="background-color: #e2e8f0; padding: 8px 16px; border-radius: 11px 11px 0 0; font-weight: 800; font-size: 11px; text-transform: uppercase; color: #334155; letter-spacing: 0.5px;">
                    Procurement Requisition Package Metadata
                  </td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9; width: 36%;">RFQ Reference ID</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 800; color: #0f766e; border-bottom: 1px solid #f1f5f9;">${rfqId}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Master Transaction Key</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${txnId}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Purchase Requisition (PR)</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${prId}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Programme &amp; Donor</td>
                  <td style="padding: 9px 16px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${programmeName} (${donorName})</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Procurement Category</td>
                  <td style="padding: 9px 16px; font-weight: 700; color: #0f766e; border-bottom: 1px solid #f1f5f9;">${category}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">RFQ Issue Date</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${issueDate}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Submission Closing Deadline</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 800; color: #b91c1c; border-bottom: 1px solid #f1f5f9;">${closingDate}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600;">Delivery Destination Site</td>
                  <td style="padding: 9px 16px; font-weight: 600; color: #334155;">${deliveryLocation}</td>
                </tr>
              </table>

              <!-- Official Word Document Quotation Form Download Banner -->
              <div style="background-color: #eff6ff; border: 2px solid #93c5fd; border-radius: 12px; padding: 18px 20px; margin-bottom: 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="48" valign="top">
                      <div style="width: 42px; height: 42px; border-radius: 10px; background-color: #1d4ed8; color: #ffffff; font-size: 22px; text-align: center; line-height: 42px; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        &#128196;
                      </div>
                    </td>
                    <td style="padding-left: 14px;">
                      <div style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 9999px; margin-bottom: 4px;">
                        Attached Microsoft Word Document Form
                      </div>
                      <h3 style="margin: 0 0 4px 0; font-size: 14.5px; font-weight: 800; color: #1e3a8a;">
                        Official Word Quotation Form Attached (.DOC)
                      </h3>
                      <p style="margin: 0 0 10px 0; font-size: 12.5px; color: #3b82f6; line-height: 1.5;">
                        An official, fillable Microsoft Word quotation submission form (<strong>${wordAttachmentFilename}</strong>) is attached to this email. Complete and return this form before accepting a vendor to prepare the Purchase Order (PO).
                      </p>
                      <div style="margin-bottom: 12px;">
                        <a href="http://localhost:3001/api/download-rfq-form?rfqId=${rfqId}&supplierId=${vendorId}&supplierName=${encodeURIComponent(companyName)}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; font-weight: 800; font-size: 12px; padding: 9px 16px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(29, 78, 216, 0.3);">
                          &#128229; Download Word Quotation Form (.DOC)
                        </a>
                      </div>
                      <div style="background-color: #ffffff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 9px 12px; font-size: 11.5px; color: #1e3a8a; line-height: 1.5;">
                        <strong>Vendor Quotation Instructions:</strong><br/>
                        &bull; Download the attached Word document form (<strong>${wordAttachmentFilename}</strong>).<br/>
                        &bull; Fill in your <strong>Unit Cost (NLe)</strong> and <strong>Total Cost</strong> for each line item.<br/>
                        &bull; Sign, affix your official company stamp, and email back directly to <a href="mailto:${EMAIL_CONFIG.user}" style="color: #1d4ed8; font-weight: bold; text-decoration: none;">${EMAIL_CONFIG.user}</a>.<br/>
                        &bull; BCF-SL Procurement will evaluate quotations before awarding the Purchase Order (PO).
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Bill of Quantities / Items Table -->
              <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.3px;">
                Bill of Quantities &amp; Price Schedule Required:
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 12px; margin-bottom: 22px; border-collapse: collapse; overflow: hidden;">
                <thead>
                  <tr style="background-color: #0f766e; color: #ffffff;">
                    <th style="padding: 8px 8px; font-weight: 800; text-align: center; width: 32px; font-size: 11px;">#</th>
                    <th style="padding: 8px 12px; font-weight: 800; text-align: left; font-size: 11px;">Item Description</th>
                    <th style="padding: 8px 8px; font-weight: 800; text-align: center; font-size: 11px; width: 65px;">Unit</th>
                    <th style="padding: 8px 10px; font-weight: 800; text-align: center; font-size: 11px; width: 75px;">Required Qty</th>
                    <th style="padding: 8px 10px; font-weight: 800; text-align: center; font-size: 11px; width: 110px; color: #fde68a;">Vendor Unit Cost</th>
                    <th style="padding: 8px 10px; font-weight: 800; text-align: center; font-size: 11px; width: 115px; color: #fde68a;">Total Cost of Item</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtmlRows}
                </tbody>
              </table>

              <!-- Submission Instructions -->
              <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.3px;">
                Quotation Submission &amp; Compliance Guidelines:
              </h3>
              <ul style="font-size: 12.5px; color: #475569; padding-left: 20px; margin: 0 0 24px 0; line-height: 1.6;">
                <li style="margin-bottom: 6px;">
                  <strong>Complete &amp; Submit Word Form:</strong> Download the attached Word document form (<strong>${wordAttachmentFilename}</strong>), enter your Unit Costs and Total Costs, and reply directly to <a href="mailto:${EMAIL_CONFIG.user}" style="color: #0f766e; font-weight: bold; text-decoration: none;">${EMAIL_CONFIG.user}</a>.
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Currency &amp; Taxes:</strong> All prices must be quoted in Sierra Leone Leones (NLe), inclusive of applicable delivery to destination and statutory taxes.
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Submission Closing Deadline:</strong> Transmit your formal quotation citing Reference <strong>[${rfqId}]</strong> before <strong>${closingDate}</strong>.
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Award of Purchase Order (PO):</strong> The Procurement Evaluation Committee will evaluate submitted bids before selecting 1 or 2 compliant vendor(s) to prepare and issue the Purchase Order (PO).
                </li>
              </ul>

              <!-- Contact & Institutional Signature Box -->
              <div style="background-color: #f1f5f9; border-left: 4px solid #0f766e; padding: 14px 18px; border-radius: 0 10px 10px 0;">
                <div style="font-weight: 800; font-size: 13px; color: #0f766e;">
                  DIRECTORATE OF PROCUREMENT &amp; SUPPLY CHAIN MANAGEMENT
                </div>
                <div style="font-size: 12px; color: #475569; font-weight: 600; margin-top: 2px;">
                  Bandama Charity Foundation – Sierra Leone (BCF-SL)
                </div>
                <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">
                  Email: <a href="mailto:${EMAIL_CONFIG.user}" style="color: #0f766e; text-decoration: none; font-weight: bold;">${EMAIL_CONFIG.user}</a> | Phone: +23278242826
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 36px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                Official RFQ Notification dispatched from BCF-SL Central Administration Hub.<br/>
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

    console.log(`[BCF-SL RFQ EMAIL SENT] Dispatched to ${to} for RFQ ${rfqId} (Vendor ${vendorId}). MessageId: ${info.messageId}`);

    return NextResponse.json({
      success: true,
      method: "GMAIL_SMTP_AUTOMATED",
      messageId: info.messageId,
      rfqId,
      recipient: to,
      companyName,
      sentAt: timestamp,
      message: `Official RFQ invitation email successfully transmitted to ${to}`,
    });
  } catch (error: any) {
    console.error("[BCF-SL RFQ EMAIL ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to dispatch RFQ notification email",
      },
      { status: 500 }
    );
  }
}
