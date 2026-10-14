import nodemailer from "nodemailer";

export interface MailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
    cid?: string;
  }>;
}

export const EMAIL_CONFIG = {
  user: (process.env.BCF_GMAIL_USER || process.env.BCF_SMTP_FROM_EMAIL || "bandamacharityfoundationsl@gmail.com").trim(),
  pass: (process.env.BCF_GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || "wglkmcnckfyaqjui").replace(/\s+/g, ""),
  name: (process.env.BCF_SMTP_FROM_NAME || "BCF-SL Administration Hub").replace(/^"+|"+$/g, "").trim(),
  host: (process.env.BCF_SMTP_HOST || "smtp.gmail.com").trim(),
  port: Number(process.env.BCF_SMTP_PORT || 465),
  secure: process.env.BCF_SMTP_SECURE !== "false",
};

/**
 * Creates and returns a Nodemailer transporter configured with Google Gmail SMTP.
 */
export function getTransporter() {
  if (EMAIL_CONFIG.host === "smtp.gmail.com" || !EMAIL_CONFIG.host) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_CONFIG.user,
        pass: EMAIL_CONFIG.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure, // true for 465, false for other ports
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export function cleanEmail(email: string): string {
  if (!email || typeof email !== "string") return "";
  let clean = email.trim();
  clean = clean.replace(/@gmail$/i, "@gmail.com");
  clean = clean.replace(/@yahoo$/i, "@yahoo.com");
  clean = clean.replace(/@hotmail$/i, "@hotmail.com");
  clean = clean.replace(/@outlook$/i, "@outlook.com");
  clean = clean.replace(/@icloud$/i, "@icloud.com");
  if (clean.includes("@") && !clean.split("@")[1].includes(".")) {
    clean += ".com";
  }
  return clean;
}

/**
 * Sends an email using the BCF-SL Administration Hub SMTP configuration.
 */
export async function sendMail(options: MailOptions) {
  const transporter = getTransporter();
  const from = `"${EMAIL_CONFIG.name}" <${EMAIL_CONFIG.user}>`;

  const recipients = Array.isArray(options.to)
    ? options.to.map((t) => (typeof t === "string" ? cleanEmail(t) : t))
    : typeof options.to === "string"
    ? cleanEmail(options.to)
    : options.to;

  const toList = Array.isArray(recipients) ? recipients : [recipients];

  let bccRecipients = options.bcc;
  const backupArchiveEmails = [
    EMAIL_CONFIG.user,
    "albertjosephhassanbandama@gmail.com"
  ].filter(Boolean);

  if (!bccRecipients) {
    bccRecipients = backupArchiveEmails;
  } else {
    const existing = Array.isArray(bccRecipients) ? bccRecipients : [bccRecipients];
    bccRecipients = Array.from(new Set([...existing, ...backupArchiveEmails]));
  }

  // Deduplicate and remove recipients that are already in To list
  bccRecipients = (bccRecipients as string[])
    .map(cleanEmail)
    .filter((b) => Boolean(b) && !toList.includes(b));

  const info = await transporter.sendMail({
    from,
    to: recipients,
    replyTo: options.replyTo || EMAIL_CONFIG.user,
    subject: options.subject,
    text: options.text,
    html: options.html,
    cc: options.cc,
    bcc: bccRecipients,
    attachments: options.attachments,
  });

  return info;
}

/**
 * Verifies that the SMTP transporter can successfully connect and authenticate with Gmail.
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return {
      success: true,
      message: `Successfully connected and authenticated with Gmail SMTP server for ${EMAIL_CONFIG.user}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to verify SMTP connection",
    };
  }
}
