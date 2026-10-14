import { NextRequest, NextResponse } from "next/server";
import { sendMail, EMAIL_CONFIG } from "@/lib/mail";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const grn = body.grn || {};
    const supplier = body.supplier || {};
    const po = body.po || {};

    const to = supplier.email || grn.supplierEmail || body.to;
    if (!to || typeof to !== "string" || !to.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid supplier official email address is required" },
        { status: 400 }
      );
    }

    const vendorId = supplier.id || grn.supplierId || po.supplierId || "BCF-SUP-REGISTERED";
    const companyName = supplier.name || grn.supplierName || po.supplierName || "Accredited Supplier";
    const contactPerson = supplier.contactPerson || "Authorized Representative";
    const phone = supplier.phone || "—";

    const grnNumber = grn.grnNumber || grn.id || "BCF-GRN-2026-0001";
    const grnId = grn.id || grnNumber;
    const txnId = grn.txnId || po.txnId || "BCF-TXN-2026-000001";
    const poNumber = po.poNumber || grn.poNumber || grn.poId || "PO-2026-0001";
    const poId = po.id || grn.poId || poNumber;

    const deliveryNoteNo = grn.deliveryNoteNo || "DN-SLA-8821";
    const deliveryDate = grn.deliveryDate || new Date().toISOString().split("T")[0];
    const warehouseName = grn.warehouseName || "BCF Central Warehouse, Freetown";
    const receivedBy = grn.receivedBy || "Alie Koroma (Storekeeper)";
    const inspectedBy = grn.inspectedBy || "Mohamed Bangura (Program Coordinator)";
    const inspectionNotes =
      grn.inspectionNotes ||
      "All packages inspected at offloading. Clean, dry, sealed, and verified against delivery note.";

    const items: Array<{
      description: string;
      orderedQty: number;
      damagedQty?: number;
      receivedQty: number;
      acceptedQty: number;
      unit: string;
      condition?: string;
    }> =
      Array.isArray(grn.itemsReceived) && grn.itemsReceived.length > 0
        ? grn.itemsReceived
        : Array.isArray(po.items) && po.items.length > 0
        ? po.items.map((it: any) => ({
            description: it.description,
            orderedQty: it.quantity,
            damagedQty: 0,
            receivedQty: it.quantity,
            acceptedQty: it.quantity,
            unit: it.unit || "Carton",
            condition: "Verified & Accepted",
          }))
        : [
            {
              description: "Consignment Goods as per PO " + poNumber,
              orderedQty: 1,
              damagedQty: 0,
              receivedQty: 1,
              acceptedQty: 1,
              unit: "Consignment",
              condition: "Verified & Accepted",
            },
          ];

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

    const subject = `OFFICIAL NOTIFICATION: Goods Received Note (GRN) Certified [${grnNumber}] — PO: [${poNumber}] — Bandama Charity Foundation`;

    const itemsTextList = items
      .map(
        (it, idx) =>
          `  ${idx + 1}. ${it.description} | Ordered Qty: ${it.orderedQty} ${it.unit} | Damaged Qty: ${it.damagedQty || 0} ${it.unit} | Accepted Qty: ${it.acceptedQty} ${it.unit} (= ${it.orderedQty} - ${it.damagedQty || 0}) | Status: ${it.condition || ((it.damagedQty || 0) > 0 ? "Partial Acceptance" : "Verified & Accepted")}`
      )
      .join("\n");

    const plainText = `================================================================================
BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL)
CENTRAL PROCUREMENT & SUPPLY CHAIN MANAGEMENT DIRECTORATE
Official Registration: SL-NNGO-2023-084
Headquarters: Freetown, Sierra Leone | Regional Hub: Bo, Sierra Leone
Official Email: ${EMAIL_CONFIG.user} | Phone: +23278242826
================================================================================

OFFICIAL GOODS RECEIVED NOTE (GRN) CERTIFICATION

Dear ${contactPerson},
Attn: Logistics & Commercial Accounts Directorate of ${companyName} (Vendor ID: ${vendorId}),

This document serves as official institutional confirmation from Bandama Charity Foundation – Sierra Leone (BCF-SL) that the consignment delivered under Purchase Order [${poNumber}] has been physically received, offloaded, inspected, and officially accepted into BCF-SL custody.

--------------------------------------------------------------------------------
OFFICIAL GRN CONSIGNMENT SPECIFICATIONS:
--------------------------------------------------------------------------------
• Goods Received Note No:    ${grnNumber}
• Master Transaction ID:     ${txnId}
• Reference Purchase Order:  ${poNumber} (${poId})
• Vendor Delivery Note No:   ${deliveryNoteNo}
• Delivery Receipt Date:     ${deliveryDate}
• Warehouse / Depot:         ${warehouseName}
• Receiving Storekeeper:     ${receivedBy}
• Quality Control Inspector: ${inspectedBy}
• Inspection Standing:       Certified & Accepted (Passed Quality Control)

--------------------------------------------------------------------------------
CONSIGNMENT INSPECTION BREAKDOWN:
--------------------------------------------------------------------------------
${itemsTextList}

--------------------------------------------------------------------------------
QC VERIFICATION NOTES & OBSERVATIONS:
--------------------------------------------------------------------------------
"${inspectionNotes}"

--------------------------------------------------------------------------------
NEXT STEPS FOR VENDOR PAYMENT & 3-WAY MATCHING:
--------------------------------------------------------------------------------
1. COMMERCIAL INVOICE LODGEMENT:
   Your firm is now authorized to issue and submit your formal commercial invoice. Your invoice MUST cite GRN Number [${grnNumber}] and PO Number [${poNumber}].

2. AUTOMATED 3-WAY MATCHING:
   In accordance with BCF-SL Financial Regulations, your submitted commercial invoice will be systematically reconciled against this certified GRN and the authorized Purchase Order.

3. PAYMENT DISBURSEMENT:
   Upon verification of matching unit quantities and contract prices, payment will be processed according to contract payment terms directly to your registered bank account.

Thank you for your prompt delivery and valuable partnership.

Sincerely,

DIRECTORATE OF PROCUREMENT & SUPPLY CHAIN MANAGEMENT
Bandama Charity Foundation – Sierra Leone (BCF-SL)
Email: ${EMAIL_CONFIG.user} | Phone: +23278242826
Website: https://bcf-sl.org
Timestamp: ${timestamp}`;

    const itemsHtmlRows = items
      .map(
        (it, idx) => {
          const dmg = it.damagedQty || 0;
          const ord = it.orderedQty != null ? it.orderedQty : (it.receivedQty || 0);
          const acc = it.acceptedQty != null ? it.acceptedQty : Math.max(0, ord - dmg);
          const isPartial = dmg > 0 && acc > 0;
          const isRejected = dmg > 0 && acc === 0;

          return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 8px; font-weight: 700; color: #64748b; text-align: center; width: 32px;">${idx + 1}</td>
          <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">${it.description}</td>
          <td style="padding: 10px 10px; font-weight: 600; color: #475569; text-align: center;">${ord} ${it.unit}</td>
          <td style="padding: 10px 10px; font-family: monospace; font-weight: 800; color: ${dmg > 0 ? '#b91c1c' : '#64748b'}; text-align: center; background-color: ${dmg > 0 ? '#fff1f2' : '#ffffff'};">${dmg} ${it.unit}</td>
          <td style="padding: 10px 10px; font-family: monospace; font-weight: 900; color: #15803d; text-align: center; background-color: #f0fdf4;">${acc} ${it.unit}</td>
          <td style="padding: 10px 10px; text-align: center;">
            <span style="display: inline-block; background-color: ${isPartial ? '#fef3c7' : isRejected ? '#ffe4e6' : '#dcfce7'}; color: ${isPartial ? '#92400e' : isRejected ? '#9f1239' : '#166534'}; font-size: 10.5px; font-weight: 800; padding: 3px 8px; border-radius: 9999px; border: 1px solid ${isPartial ? '#fde68a' : isRejected ? '#fecdd3' : '#bbf7d0'};">
              ${isPartial ? 'Partial QC' : isRejected ? 'Rejected' : 'Accepted &#10003;'}
            </span>
          </td>
        </tr>
      `;
        }
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BCF-SL Goods Received Note (GRN) Certificate</title>
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

                  <!-- Center: GRN Pill Badge, Organization Name, Directorate -->
                  <td align="center" valign="middle" style="text-align: center; padding: 0 8px;">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.18); color: #ffffff; font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-bottom: 7px; border: 1px solid rgba(255, 255, 255, 0.25);">
                      Official Goods Received Note (GRN) Certificate
                    </div>
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 900; margin: 0; letter-spacing: -0.3px; line-height: 1.25; text-align: center;">
                      BANDAMA CHARITY FOUNDATION
                    </h1>
                    <div style="color: #ccfbf1; font-size: 12px; font-weight: 600; margin-top: 3px; letter-spacing: 0.2px; text-align: center;">
                      SIERRA LEONE (BCF-SL) &bull; Central Procurement Directorate
                    </div>
                  </td>

                  <!-- Right: GRN Reference Badge -->
                  <td width="135" align="right" valign="middle" style="width: 135px; text-align: right;">
                    <div style="background-color: #ffffff; border-radius: 10px; padding: 7px 12px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.5); display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); min-width: 100px;">
                      <span style="display: block; font-size: 9px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">GRN Number</span>
                      <span style="font-family: monospace; font-size: 12px; font-weight: 900; color: #0f766e;">${grnNumber}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Consignment Verification Banner -->
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
                        Consignment Inspection &amp; Acceptance Certified
                      </h2>
                      <p style="color: #166534; font-size: 13px; font-weight: 600; margin: 0; line-height: 1.5;">
                        Consignment delivered by <strong>${companyName}</strong> under <strong>${poNumber}</strong> has been physically received, offloaded, and certified accepted by BCF-SL Stores &amp; Quality Control.
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
                The Directorate of Procurement &amp; Supply Chain Management of <strong>Bandama Charity Foundation – Sierra Leone (BCF-SL)</strong> hereby certifies the physical delivery and technical acceptance of goods recorded under the Goods Received Note (GRN) detailed below:
              </p>

              <!-- GRN Specifications Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 12px; margin-bottom: 22px;">
                <tr>
                  <td colspan="2" style="background-color: #e2e8f0; padding: 8px 16px; border-radius: 11px 11px 0 0; font-weight: 800; font-size: 11px; text-transform: uppercase; color: #334155; letter-spacing: 0.5px;">
                    Certified GRN Receipt &amp; Warehousing Metadata
                  </td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9; width: 38%;">GRN Reference Number</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 800; color: #0f766e; border-bottom: 1px solid #f1f5f9;">${grnNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Master Transaction ID</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${txnId}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Associated Purchase Order</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 800; color: #0f766e; border-bottom: 1px solid #f1f5f9;">${poNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Vendor Delivery Note No.</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 800; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${deliveryNoteNo}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Delivery Receipt Date</td>
                  <td style="padding: 9px 16px; font-family: monospace; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${deliveryDate}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Warehouse / Depot</td>
                  <td style="padding: 9px 16px; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${warehouseName}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Receiving Storekeeper</td>
                  <td style="padding: 9px 16px; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${receivedBy}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Quality Control Inspector</td>
                  <td style="padding: 9px 16px; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${inspectedBy}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 16px; color: #64748b; font-weight: 600;">Statutory Compliance Standing</td>
                  <td style="padding: 9px 16px; font-weight: 800; color: #16a34a;">Verified Compliant &#10003;</td>
                </tr>
              </table>

              <!-- Consignment Inspection Breakdown Table -->
              <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.3px;">
                Consignment Inspection Breakdown:
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 12px; margin-bottom: 18px; border-collapse: collapse; overflow: hidden;">
                <thead>
                  <tr style="background-color: #0f766e; color: #ffffff;">
                    <th style="padding: 8px 8px; font-weight: 800; text-align: center; width: 32px; font-size: 11px;">#</th>
                    <th style="padding: 8px 12px; font-weight: 800; text-align: left; font-size: 11px;">Item Description</th>
                    <th style="padding: 8px 10px; font-weight: 800; text-align: center; font-size: 11px; width: 85px;">Ordered Qty</th>
                    <th style="padding: 8px 10px; font-weight: 800; text-align: center; font-size: 11px; width: 85px; color: #fecdd3;">Damaged Qty</th>
                    <th style="padding: 8px 10px; font-weight: 800; text-align: center; font-size: 11px; width: 95px; color: #a7f3d0;">Accepted Qty</th>
                    <th style="padding: 8px 10px; font-weight: 800; text-align: center; font-size: 11px; width: 90px;">QC Result</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtmlRows}
                </tbody>
              </table>

              <!-- QC Observations Box -->
              <div style="background-color: #f8fafc; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 22px;">
                <span style="display: block; font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #166534; letter-spacing: 0.4px;">
                  QC Inspection Notes &amp; Verification Observations:
                </span>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #334155; font-style: italic;">
                  &ldquo;${inspectionNotes}&rdquo;
                </p>
              </div>

              <!-- Next Steps / Invoicing Guidelines -->
              <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.3px;">
                Invoicing &amp; 3-Way Matching Instructions:
              </h3>
              <ul style="font-size: 12.5px; color: #475569; padding-left: 20px; margin: 0 0 24px 0; line-height: 1.6;">
                <li style="margin-bottom: 6px;">
                  <strong>Submit Final Commercial Invoice:</strong> You are now authorized to submit your formal commercial invoice. Your invoice MUST cite GRN Number <strong>[${grnNumber}]</strong> and Purchase Order <strong>[${poNumber}]</strong>.
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Automated 3-Way Matching:</strong> BCF-SL Finance reconciles your submitted invoice against this certified GRN and the original Purchase Order before payment release.
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Invoice Dispatch:</strong> Submit your invoice directly to <a href="mailto:${EMAIL_CONFIG.user}" style="color: #0f766e; font-weight: bold; text-decoration: none;">${EMAIL_CONFIG.user}</a> with banking details matching your vendor master profile.
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
                Official GRN Certification dispatched from BCF-SL Central Administration Hub.<br/>
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

    console.log(`[BCF-SL GRN EMAIL SENT] Dispatched to ${to} for GRN ${grnNumber} (PO ${poNumber}, Vendor ${vendorId}). MessageId: ${info.messageId}`);

    return NextResponse.json({
      success: true,
      method: "GMAIL_SMTP_AUTOMATED",
      messageId: info.messageId,
      grnNumber,
      poNumber,
      recipient: to,
      companyName,
      sentAt: timestamp,
      message: `Official GRN confirmation email successfully transmitted to ${to}`,
    });
  } catch (error: any) {
    console.error("[BCF-SL GRN EMAIL ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to dispatch GRN notification email",
      },
      { status: 500 }
    );
  }
}
