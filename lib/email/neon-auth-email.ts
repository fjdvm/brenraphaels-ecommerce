import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";
import { renderMagicLinkEmail, type MagicLinkType } from "./magic-link-template";

type MagicLinkEmail = {
  linkType: MagicLinkType;
  recipient: string;
  token: string;
};

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
  const { transport, sender } = createBrevoTransport();
  const destination = appLink(linkType, token);
  const { html, subject, text } = renderMagicLinkEmail({
    destination,
    linkType,
    logoUrl: logoUrl(),
  });

  await transport.sendMail({
    from: sender,
    html,
    subject,
    text,
    to: recipient,
  });
}
