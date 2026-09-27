import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";
import { renderMagicLinkEmail, type MagicLinkType } from "./magic-link-template";

type MagicLinkEmail = {
  linkType: MagicLinkType;
  recipient: string;
  token: string;
  /** `/careers` keeps Applicant email flows away from Customer routes. */
  pathPrefix?: "/careers";
};

function appLink(linkType: MagicLinkType, token: string, pathPrefix = "") {
  const siteUrl = requiredEnvironment("NEXT_PUBLIC_SITE_URL");
  const path = `${pathPrefix}${linkType === "email-verification" ? "/verify-email" : "/reset-password"}`;
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
  pathPrefix,
}: MagicLinkEmail) {
  const { transport, sender } = createBrevoTransport();
  const destination = appLink(linkType, token, pathPrefix);
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
