import { NextRequest, NextResponse } from "next/server";
import { sendMail, EMAIL_CONFIG } from "@/lib/mail";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supplier = body.supplier || body;

    const to = supplier.email || body.to;
    if (!to || typeof to !== "string" || !to.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid vendor official email address is required" },
        { status: 400 }
      );
    }

    const vendorId = supplier.id || "BCF-SUP-PENDING";
    const companyName = supplier.name || "Vendor Partner";
    const tradingName = supplier.tradingName || companyName;
    const contactPerson = supplier.contactPerson || "Authorized Representative";
    const phone = supplier.phone || "—";
    const regNo = supplier.registrationNo || "—";
    const taxId = supplier.taxId || "—";
    const complianceStatus = supplier.complianceStatus || "Compliant";
    const district = supplier.district || "Sierra Leone";
    const address = supplier.address || "Sierra Leone";
    const categories = Array.isArray(supplier.categories)
      ? supplier.categories.join(", ")
      : (supplier.categories || "General Goods & Services");
    const bankName = supplier.bankName || "—";
    const bankAccount = supplier.bankAccount || "—";
    const registeredDate = supplier.registeredDate || new Date().toISOString().split("T")[0];
    const timestamp = new Date().toUTCString();

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

    const subject = `OFFICIAL NOTIFICATION: Enlistment in BCF-SL Approved Vendor & Supplier Registry [${vendorId}] — Bandama Charity Foundation`;

    const plainText = `================================================================================
BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL)
CENTRAL PROCUREMENT & SUPPLY CHAIN MANAGEMENT DIRECTORATE
Official Registration: SL-NNGO-2023-084
Headquarters: Freetown, Sierra Leone | Regional Hub: Bo, Sierra Leone
Official Email: ${EMAIL_CONFIG.user} | Phone: +23278242826
================================================================================

OFFICIAL STATEMENT OF ENLISTMENT IN BCF-SL VENDOR / SUPPLIER MASTER LIST

Dear ${contactPerson},
Attn: Management & Executive Leadership of ${companyName} (${tradingName}),

We are pleased to officially inform you that ${companyName} has been successfully verified, accredited, and officially enrolled into the BANDAMA CHARITY FOUNDATION – SIERRA LEONE (BCF-SL) APPROVED VENDOR AND SUPPLIER MASTER LIST.

THIS SERVES AS OFFICIAL CONFIRMATION THAT YOUR ORGANIZATION IS NOW AN ACCREDITED INSTITUTIONAL VENDOR FOR BCF-SL PROCUREMENT ACTIVITIES, DONOR-FUNDED AID PROGRAMS, AND COMMUNITY INITIATIVES ACROSS SIERRA LEONE.

--------------------------------------------------------------------------------
OFFICIAL VENDOR MASTER RECORD DETAILS:
--------------------------------------------------------------------------------
• Unique Vendor ID:          ${vendorId}
• Legal / Registered Name:   ${companyName}
• Trading Name:              ${tradingName}
• Business Registration No:  ${regNo}
• NRA Tax TIN:               ${taxId}
• Compliance Standing:       ${complianceStatus}
• Accredited Supply Lines:   ${categories}
• Primary Contact Person:    ${contactPerson} (${phone})
• Official Email on Record:  ${to}
• Operating Address:         ${address}, ${district}
• Settlement Bank Details:   ${bankName} (Acc: ${bankAccount})
• Enlistment Effective Date: ${registeredDate}

--------------------------------------------------------------------------------
WHAT THIS ENLISTMENT MEANS FOR YOUR BUSINESS:
--------------------------------------------------------------------------------
1. ELIGIBILITY FOR REQUESTS FOR QUOTATION (RFQs):
   Your firm is now pre-qualified to receive official Requests for Quotations (RFQs) and Invitation to Tender (ITT) documents for procurement packages matching your accredited supply lines.

2. DIRECT PURCHASE ORDERS & CONTRACTS:
   All future Purchase Orders (POs) issued by BCF-SL will cite your designated Vendor ID (${vendorId}) and will be delivered directly to this official email address (${to}).

3. FINANCIAL TRANSPARENCY & 3-WAY MATCHING:
   Payments are disbursed according to BCF-SL Finance Regulations, governed by automated 3-Way Matching (Purchase Order, Goods Received Note / GRN, and Verified Commercial Invoice).

Thank you for your commitment to transparent, high-integrity procurement partnerships that support vulnerable communities throughout Sierra Leone.

Sincerely,

DIRECTORATE OF PROCUREMENT & SUPPLY CHAIN
Bandama Charity Foundation – Sierra Leone (BCF-SL)
Email: ${EMAIL_CONFIG.user} | Phone: +23278242826
Website: https://bcf-sl.org
Timestamp: ${timestamp}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BCF-SL Vendor Enlistment Confirmation</title>
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

                  <!-- Center: Registry Confirmation, Organization Name, Directorate -->
                  <td align="center" valign="middle" style="text-align: center; padding: 0 8px;">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.18); color: #ffffff; font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-bottom: 7px; border: 1px solid rgba(255, 255, 255, 0.25);">
                      Official Procurement Registry Confirmation
                    </div>
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 900; margin: 0; letter-spacing: -0.3px; line-height: 1.25; text-align: center;">
                      BANDAMA CHARITY FOUNDATION
                    </h1>
                    <div style="color: #ccfbf1; font-size: 12px; font-weight: 600; margin-top: 3px; letter-spacing: 0.2px; text-align: center;">
                      SIERRA LEONE (BCF-SL) &bull; Central Procurement Directorate
                    </div>
                  </td>

                  <!-- Right: Vendor ID Badge -->
                  <td width="135" align="right" valign="middle" style="width: 135px; text-align: right;">
                    <div style="background-color: #ffffff; border-radius: 10px; padding: 7px 12px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.5); display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); min-width: 100px;">
                      <span style="display: block; font-size: 9px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">Vendor ID</span>
                      <span style="font-family: monospace; font-size: 13px; font-weight: 900; color: #0f766e;">${vendorId}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Official Statement Banner -->
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
                      <h2 style="color: #14532d; font-size: 15px; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.3px;">
                        Official Enlistment Statement
                      </h2>
                      <p style="color: #166534; font-size: 13.5px; font-weight: 600; margin: 0; line-height: 1.5;">
                        We are pleased to confirm that <strong>${companyName}</strong> is now officially accredited and registered on the <strong>BCF-SL Approved Vendor &amp; Supplier Master List</strong>.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Salutation & Body -->
          <tr>
            <td style="padding: 12px 36px 20px;">
              <p style="font-size: 14px; color: #334155; margin: 0 0 14px 0;">
                Dear <strong>${contactPerson}</strong>,
              </p>
              <p style="font-size: 13.5px; color: #475569; margin: 0 0 16px 0; line-height: 1.6;">
                On behalf of the Governing Board, Executive Leadership, and the Central Procurement Committee of <strong>Bandama Charity Foundation – Sierra Leone (BCF-SL)</strong>, this document provides formal notification that your business entity has successfully satisfied our due diligence and vendor verification criteria.
              </p>
              <p style="font-size: 13.5px; color: #475569; margin: 0 0 20px 0; line-height: 1.6;">
                Your firm is now officially enrolled in our central transaction engine as an <strong>Approved Institutional Vendor</strong>. Below are the registered master credentials recorded in our supplier database:
              </p>

              <!-- Credentials Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 12.5px; margin-bottom: 24px;">
                <tr>
                  <td colspan="2" style="background-color: #e2e8f0; padding: 8px 16px; border-radius: 11px 11px 0 0; font-weight: 800; font-size: 11px; text-transform: uppercase; color: #334155; letter-spacing: 0.5px;">
                    Verified Master Registry Credentials
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9; width: 38%;">Vendor Identification ID</td>
                  <td style="padding: 10px 16px; font-family: monospace; font-weight: 800; color: #0f766e; border-bottom: 1px solid #f1f5f9;">${vendorId}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Legal Company Name</td>
                  <td style="padding: 10px 16px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${companyName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Trading Name</td>
                  <td style="padding: 10px 16px; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${tradingName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Business Registration No.</td>
                  <td style="padding: 10px 16px; font-family: monospace; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${regNo}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">NRA Tax TIN</td>
                  <td style="padding: 10px 16px; font-family: monospace; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">${taxId}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Compliance Standing</td>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9;">
                    <span style="background-color: #dcfce7; color: #15803d; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; border: 1px solid #bbf7d0;">
                      ${complianceStatus}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Accredited Categories</td>
                  <td style="padding: 10px 16px; font-weight: 700; color: #0f766e; border-bottom: 1px solid #f1f5f9;">${categories}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Designated Email Address</td>
                  <td style="padding: 10px 16px; font-weight: 700; color: #0284c7; border-bottom: 1px solid #f1f5f9;">${to}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Operating District / Address</td>
                  <td style="padding: 10px 16px; color: #334155; border-bottom: 1px solid #f1f5f9;">${address}, ${district}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; color: #64748b; font-weight: 600;">Settlement Bank &amp; Account</td>
                  <td style="padding: 10px 16px; color: #334155; font-weight: 600;">${bankName} &bull; <span style="font-family: monospace;">${bankAccount}</span></td>
                </tr>
              </table>

              <!-- Next Steps / Procurement Guidelines -->
              <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.3px;">
                Procurement Operations &amp; What Happens Next:
              </h3>
              <ul style="font-size: 13px; color: #475569; padding-left: 20px; margin: 0 0 24px 0; line-height: 1.6;">
                <li style="margin-bottom: 6px;">
                  <strong>Request for Quotation (RFQ) Notifications:</strong> When BCF-SL initiates procurement requisitions in your registered categories, RFQs will be transmitted directly to this official email address.
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Issuance of Purchase Orders (POs):</strong> All approved purchase awards are confirmed through formal Purchase Orders bearing your Vendor ID (<strong>${vendorId}</strong>) and a unique Master Transaction ID.
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Delivery &amp; 3-Way Matching:</strong> Goods and services delivered to BCF-SL warehouses and regional project sites are inspected via Goods Received Notes (GRNs) and reconciled against your invoice before payment release.
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
                This is an official automated communication from the BCF-SL Central Administration Hub.<br/>
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

    console.log(`[BCF-SL VENDOR REGISTRATION EMAIL SENT] Dispatched to ${to} for Vendor ID ${vendorId}. MessageId: ${info.messageId}`);

    return NextResponse.json({
      success: true,
      method: "GMAIL_SMTP_AUTOMATED",
      messageId: info.messageId,
      vendorId,
      recipient: to,
      companyName,
      sentAt: timestamp,
      message: `Official vendor enlistment confirmation email successfully sent to ${to}`,
    });
  } catch (error: any) {
    console.error("[BCF-SL VENDOR REGISTRATION EMAIL ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to dispatch vendor enlistment email",
      },
      { status: 500 }
    );
  }
}
