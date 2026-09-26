import nodemailer from "nodemailer";

import { renderMagicLinkEmail, type MagicLinkType } from "./magic-link-template";

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

function logoUrl() {
  return new URL("/logo.jpeg", requiredEnvironment("NEXT_PUBLIC_SITE_URL")).toString();
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
  const { html, subject, text } = renderMagicLinkEmail({
    destination,
    linkType,
    logoUrl: logoUrl(),
  });
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
    html,
    subject,
    text,
    to: recipient,
  });
}
