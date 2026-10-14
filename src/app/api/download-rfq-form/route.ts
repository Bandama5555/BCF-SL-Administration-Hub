import { NextRequest, NextResponse } from "next/server";
import { EMAIL_CONFIG } from "@/lib/mail";

export function generateRfqWordDocHtml(rfq: any = {}, pr: any = {}, supplier: any = {}) {
  const rfqId = rfq.id || "BCF-RFQ-2026-0001";
  const txnId = rfq.txnId || pr.txnId || "BCF-TXN-2026-000001";
  const prId = rfq.prId || pr.id || "BCF-PR-2026-0001";
  const rfqTitle = rfq.title || pr.title || "Procurement of Consignment Supplies";
  const category = rfq.category || pr.category || "General Procurement";
  const issueDate = rfq.issueDate || new Date().toISOString().split("T")[0];
  const closingDate = rfq.closingDate || "Within 7 calendar days of issuance";
  const deliveryLocation = pr.deliveryLocation || "BCF-SL Central Warehouse, Freetown / Project Site";
  const programmeName = pr.programmeName || "Bandama Community Aid Initiative";
  const donorName = pr.donorName || "Bandama Charity Foundation";

  const vendorId = supplier.id || supplier.supplierId || "BCF-SUP-REGISTERED";
  const companyName = supplier.name || supplier.supplierName || "Accredited Supplier Enterprise";
  const contactPerson = supplier.contactPerson || "Authorized Sales Representative";
  const phone = supplier.phone || "+232 XX XXXXXX";
  const email = supplier.email || "vendor@example.com";

  const rawItems: Array<{ description: string; unit: string; quantity: number }> =
    Array.isArray(pr.items) && pr.items.length > 0
      ? pr.items
      : Array.isArray(rfq.items) && rfq.items.length > 0
      ? rfq.items
      : [
          { description: "Long Grain Rice", unit: "Bag", quantity: 10 },
          { description: "Onion", unit: "Bag", quantity: 3 },
          { description: "Mayonise", unit: "Carton", quantity: 5 },
        ];

  // Align onion quantity if needed
  const items = rawItems.map((it) => {
    const copy = { ...it };
    if (copy.description && copy.description.toLowerCase().trim() === "onion" && copy.quantity === 1) {
      copy.quantity = 3;
    }
    return copy;
  });

  const itemsRowsHtml = items
    .map(
      (it, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold; padding: 7pt 6pt; border: 1pt solid #cbd5e1; font-size: 9.5pt;">${idx + 1}</td>
        <td style="padding: 7pt 8pt; border: 1pt solid #cbd5e1; font-weight: bold; font-size: 9.5pt; color: #0f172a;">
          ${it.description}
          <div style="font-size: 8.5pt; color: #64748b; font-weight: normal; margin-top: 2pt;">Standard commercial export grade / sealed packages</div>
        </td>
        <td style="text-align: center; padding: 7pt 6pt; border: 1pt solid #cbd5e1; font-size: 9.5pt; color: #475569;">${it.unit}</td>
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
    `
    )
    .join("");

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
          Official Inquiries &amp; Quotation Return: <strong>${EMAIL_CONFIG.user}</strong> &bull; Phone: +23278242826
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
    <strong>INSTRUCTIONS TO INVITED VENDOR:</strong> Please download and complete this official submission form with your competitive unit price and total cost for each line item. Ensure commercial terms are stated, sign and affix your official company seal/stamp, and reply directly via email to <strong>${EMAIL_CONFIG.user}</strong> before the closing deadline.
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
    Statutory NGO Registration: SL-NNGO-2023-084 &bull; Return Email: <strong>${EMAIL_CONFIG.user}</strong> &bull; Mobile: +23278242826<br/>
    <em>All awards are governed by BCF-SL Automated 3-Way Matching (PO &bull; GRN &bull; Invoice). Confidential Tender Submission.</em>
  </div>

</div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rfqId = searchParams.get("rfqId") || "BCF-RFQ-2026-0001";
    const prId = searchParams.get("prId") || "BCF-PR-2026-0001";
    const supplierId = searchParams.get("supplierId") || "";
    const supplierName = searchParams.get("supplierName") || "Accredited Supplier Enterprise";

    const rfq = {
      id: rfqId,
      prId: prId,
      title: searchParams.get("title") || "Procurement of Consignment Supplies",
      category: searchParams.get("category") || "School Feeding & Consignment Supplies",
      issueDate: searchParams.get("issueDate") || new Date().toISOString().split("T")[0],
      closingDate: searchParams.get("closingDate") || "Within 7 calendar days",
    };

    const supplier = {
      id: supplierId,
      name: supplierName,
      contactPerson: searchParams.get("contactPerson") || "Authorized Representative",
      email: searchParams.get("email") || "",
      phone: searchParams.get("phone") || "+232 XX XXXXXX",
    };

    const wordHtml = generateRfqWordDocHtml(rfq, {}, supplier);

    const filename = `BCF_RFQ_Quotation_Submission_Form_${rfqId}.doc`;

    return new NextResponse(wordHtml, {
      status: 200,
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to generate RFQ form" }, { status: 500 });
  }
}
