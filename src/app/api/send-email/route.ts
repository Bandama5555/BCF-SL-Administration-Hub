import { NextRequest, NextResponse } from "next/server";
import { sendMail, verifySmtpConnection, EMAIL_CONFIG, cleanEmail } from "@/lib/mail";

function getCorsHeaders(req?: NextRequest) {
  const origin = req?.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

/**
 * GET /api/send-email
 * Verifies SMTP connection, or sends an email via GET query parameters / base64 fallback.
 * Allows zero-CORS fallback from file:/// and sandboxed iframes.
 */
export async function GET(req: NextRequest) {
  const cors = getCorsHeaders(req);
  const { searchParams } = new URL(req.url);
  let to = searchParams.get("to");
  let subject = searchParams.get("subject");
  let text = searchParams.get("text");
  let html = searchParams.get("html");
  const b64 = searchParams.get("b64");

  // Decode base64 payload if provided
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (parsed.to) to = parsed.to;
      if (parsed.subject) subject = parsed.subject;
      if (parsed.text) text = parsed.text;
      if (parsed.html) html = parsed.html;
    } catch (_) {}
  }

  // If a recipient is specified, perform a live email dispatch
  if (to) {
    try {
      const cleanedTo = cleanEmail(to);
      const finalSubject = subject || "[BCF-SL] SMTP Test Dispatch";
      const finalText = text || "This is a verification email from BCF-SL Administration Hub SMTP service.";
      const finalHtml = html || `<div style="font-family: sans-serif; padding: 20px;"><h2>BCF-SL SMTP Verification</h2><p>${finalText}</p><p>Sent at: ${new Date().toISOString()}</p></div>`;

      const info = await sendMail({
        to: cleanedTo,
        subject: finalSubject,
        text: finalText,
        html: finalHtml,
      });

      console.log(`[BCF-SL SMTP GET DISPATCH SUCCESS] MessageId: ${info.messageId} to ${cleanedTo}`);
      return NextResponse.json(
        {
          success: true,
          message: `Email successfully dispatched to ${cleanedTo}`,
          messageId: info.messageId,
          recipient: cleanedTo,
          sentAt: new Date().toISOString(),
        },
        { headers: cors }
      );
    } catch (error: any) {
      console.error("[BCF-SL SMTP GET DISPATCH ERROR]", error);
      return NextResponse.json(
        {
          success: false,
          error: error?.message || "Failed to dispatch email",
        },
        { status: 500, headers: cors }
      );
    }
  }

  const result = await verifySmtpConnection();
  return NextResponse.json(
    {
      ...result,
      account: {
        user: EMAIL_CONFIG.user,
        name: EMAIL_CONFIG.name,
        host: EMAIL_CONFIG.host,
        port: EMAIL_CONFIG.port,
        secure: EMAIL_CONFIG.secure,
      },
      timestamp: new Date().toISOString(),
    },
    { headers: cors }
  );
}

/**
 * POST /api/send-email
 * General email dispatch endpoint for BCF-SL modules.
 */
export async function POST(req: NextRequest) {
  const cors = getCorsHeaders(req);
  try {
    const body = await req.json();
    const { to, subject, html, text, replyTo, cc, bcc, attachments } = body;

    const cleanedTo = typeof to === "string" ? cleanEmail(to) : Array.isArray(to) ? to.map(cleanEmail) : to;
    console.log(`[BCF-SL SMTP POST RECEIVED] Sending to: ${cleanedTo} (raw: ${to}), subject: ${subject}`);

    if (!cleanedTo || (Array.isArray(cleanedTo) && cleanedTo.length === 0)) {
      return NextResponse.json(
        { success: false, error: "Recipient email ('to') is required" },
        { status: 400, headers: cors }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { success: false, error: "Email subject is required" },
        { status: 400, headers: cors }
      );
    }

    const info = await sendMail({
      to: cleanedTo,
      subject,
      html: html || undefined,
      text: text || undefined,
      replyTo: replyTo || undefined,
      cc: cc || undefined,
      bcc: bcc || undefined,
      attachments: attachments || undefined,
    });

    console.log(`[BCF-SL SMTP DISPATCH SUCCESS] MessageId: ${info.messageId} to ${cleanedTo}`);

    return NextResponse.json(
      {
        success: true,
        messageId: info.messageId,
        sender: `"${EMAIL_CONFIG.name}" <${EMAIL_CONFIG.user}>`,
        recipient: cleanedTo,
        subject,
        sentAt: new Date().toISOString(),
      },
      { headers: cors }
    );
  } catch (error: any) {
    console.error("[BCF-SL SMTP DISPATCH ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to dispatch email via SMTP",
      },
      { status: 500, headers: cors }
    );
  }
}
