import nodemailer from "nodemailer";

type MagicLinkType = "email-verification" | "forget-password";

type MagicLinkEmail = {
  linkType: MagicLinkType;
  recipient: string;
  token: string;
};

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function appLink(linkType: MagicLinkType, token: string) {
  const siteUrl = requiredEnvironment("NEXT_PUBLIC_SITE_URL");
  const path = linkType === "email-verification" ? "/verify-email" : "/reset-password";
  const url = new URL(path, siteUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendMagicLinkEmail({
  linkType,
  recipient,
  token,
}: MagicLinkEmail) {
  const smtpPort = Number(requiredEnvironment("BREVO_SMTP_PORT"));
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
    throw new Error("BREVO_SMTP_PORT must be a valid port number");
  }

  const destination = appLink(linkType, token);
  const isVerification = linkType === "email-verification";
  const action = isVerification ? "Verify your email" : "Reset your password";
  const senderName = requiredEnvironment("EMAIL_FROM_NAME");
  const transport = nodemailer.createTransport({
    auth: {
      pass: requiredEnvironment("BREVO_SMTP_KEY"),
      user: requiredEnvironment("BREVO_SMTP_USER"),
    },
    host: requiredEnvironment("BREVO_SMTP_HOST"),
    connectionTimeout: 2_000,
    greetingTimeout: 2_000,
    port: smtpPort,
    secure: smtpPort === 465,
    socketTimeout: 3_000,
  });

  await transport.sendMail({
    from: {
      address: requiredEnvironment("EMAIL_FROM_ADDRESS"),
      name: senderName,
    },
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#2E1065"><h1 style="margin:0 0 20px;color:#5B21B6">Bren Raphael's Ube Jam &amp; Halaya</h1><p>${isVerification ? "Welcome! Please verify your email address to finish signing up." : "We received a request to reset your password."}</p><p style="margin:28px 0"><a href="${destination}" style="display:inline-block;background:#5B21B6;border-radius:6px;color:#ffffff;padding:12px 20px;text-decoration:none">${action}</a></p><p>If the button does not work, copy and paste this link into your browser:</p><p style="overflow-wrap:anywhere">${destination}</p><p>If you did not request this, you can safely ignore this email.</p></div>`,
    subject: `${action} — Bren Raphael's Ube Jam & Halaya`,
    text: `Bren Raphael's Ube Jam & Halaya\n\n${isVerification ? "Please verify your email address to finish signing up." : "We received a request to reset your password."}\n\n${action}: ${destination}\n\nIf you did not request this, you can safely ignore this email.`,
    to: recipient,
  });
}
