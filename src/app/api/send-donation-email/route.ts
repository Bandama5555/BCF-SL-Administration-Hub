import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, html, text, donation } = body;

    const senderEmail = process.env.BCF_GMAIL_USER || "bandamacharityfoundationsl@gmail.com";
    const senderName = process.env.BCF_SMTP_FROM_NAME || "BCF-SL Administration Hub";
    const appPassword = process.env.BCF_GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || "wglkmcnckfyaqjui";

    if (!to || typeof to !== "string" || !to.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid recipient organization email is required" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const donationId = donation?.id || "N/A";
    const orgName = donation?.orgName || "Esteemed Donor Organization";
    const mailSubject = subject || `OFFICIAL CONFIRMATION: Donation ${donationId} Registered in BCF-SL Database - Bandama Charity Foundation SL`;

    // Construct fallback text and html if not passed
    const mailText = text || `OFFICIAL CONFIRMATION OF DONATION REGISTRATION
BANDAMA CHARITY FOUNDATION - SIERRA LEONE (BCF-SL)
REG. NO: SL-NNGO-2023-084

This is official confirmation that donation ${donationId} from ${orgName} has been officially registered and recorded into the BCF-SL Central Donation Database.

Organization: BANDAMA CHARITY FOUNDATION - SIERRA LEONE
Sender: ${senderName} <${senderEmail}>
Recipient: ${to}
Timestamp: ${timestamp}

Thank you for your generous partnership.`;

    const mailHtml = html || `
      <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="color: #0f766e; margin: 0;">BANDAMA CHARITY FOUNDATION &ndash; SIERRA LEONE (BCF-SL)</h2>
          <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Non-Governmental Organization &bull; Sierra Leone &bull; REG. NO: SL-NNGO-2023-084</p>
          <p style="color: #64748b; font-size: 11px; margin: 2px 0 0 0;">Southern Region Office: 2 Ernest Gborie Street Off Gerihun Road Bo, Sierra Leone &bull; Headquarters: Freetown, Sierra Leone</p>
          <p style="color: #0f766e; font-size: 11px; font-weight: bold; margin: 2px 0 0 0;">${senderEmail} &bull; +23278242826</p>
        </div>
        <p style="font-size: 14px; color: #1e293b;">Dear Leadership of <strong>${orgName}</strong>,</p>
        <p style="font-size: 13px; color: #334155; line-height: 1.6;">
          We write on behalf of the Governing Board, Executive Leadership, and beneficiary communities of <strong>BANDAMA CHARITY FOUNDATION &ndash; SIERRA LEONE (BCF-SL)</strong> to formally confirm that your generous donation has been received, verified, and officially recorded into the <strong>BCF-SL Central Donation Database</strong>.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin: 16px 0;">
          <h4 style="margin: 0 0 8px 0; color: #0f766e; font-size: 12px; text-transform: uppercase;">Official Registration Details:</h4>
          <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <tr><td style="padding: 4px; color: #64748b; width: 40%;">Donation ID:</td><td style="padding: 4px; font-weight: bold; color: #0f766e;">${donationId}</td></tr>
            <tr><td style="padding: 4px; color: #64748b;">Organization:</td><td style="padding: 4px; font-weight: bold; color: #1e293b;">${orgName}</td></tr>
            <tr><td style="padding: 4px; color: #64748b;">Official Status:</td><td style="padding: 4px; font-weight: bold; color: #059669;">Recorded in BCF-SL Ledger</td></tr>
            <tr><td style="padding: 4px; color: #64748b;">Transmitted From:</td><td style="padding: 4px; color: #1e293b;">${senderName} &lt;${senderEmail}&gt;</td></tr>
          </table>
        </div>
        <p style="font-size: 12px; color: #64748b; font-style: italic;">
          Thank you for partnering with BCF-SL to deliver sustainable humanitarian impact across Sierra Leone.
        </p>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; font-size: 11px; color: #64748b;">
          <strong>Directorate of Donor Relations &amp; Strategic Partnerships</strong><br/>
          BANDAMA CHARITY FOUNDATION &ndash; SIERRA LEONE (BCF-SL)<br/>
          ${senderEmail} | +23278242826
        </div>
      </div>
    `;

    // Check if Google App Password is provided for automated headless sending
    if (appPassword && appPassword.trim().length >= 10) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: senderEmail,
          pass: appPassword.replace(/\s+/g, ""), // strip spaces often copied from Google App Passwords
        },
      });

      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: to,
        replyTo: senderEmail,
        subject: mailSubject,
        text: mailText,
        html: mailHtml,
      });

      console.log(`[BCF-SL EMAIL DISPATCH SUCCESS] Sent via Gmail SMTP from ${senderEmail} to ${to}. MessageId: ${info.messageId}`);

      return NextResponse.json({
        success: true,
        method: "GMAIL_SMTP_AUTOMATED",
        sender: senderEmail,
        recipient: to,
        messageId: info.messageId,
        donationId,
        sentAt: timestamp,
        message: `Official confirmation email successfully dispatched via Gmail SMTP from ${senderEmail} to ${to}`,
      });
    }

    // If App Password not yet populated in .env.local, log and return prepared status
    console.log(`[BCF-SL EMAIL DISPATCH AUDIT] From: ${senderEmail} -> To: ${to} | Subject: ${mailSubject} | Note: For headless SMTP, add BCF_GMAIL_APP_PASSWORD to frontend/.env.local`);

    return NextResponse.json({
      success: true,
      method: "GMAIL_READY",
      sender: senderEmail,
      recipient: to,
      donationId,
      sentAt: timestamp,
      needsAppPassword: true,
      message: `Official registration email prepared from ${senderEmail} to ${to}. Web Gmail and mail client dispatch ready.`,
    });
  } catch (error: any) {
    console.error("[BCF-SL EMAIL DISPATCH ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process email dispatch" },
      { status: 500 }
    );
  }
}
