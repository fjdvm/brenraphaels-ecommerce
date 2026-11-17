import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

const brandName = "Bren Raphael's Ube Jam & Halaya";
const brand = "#452175";
const muted = "#4a4450";
const quiet = "#625981";
const hairline = "#ccc3d2";
const page = "#fbf9fc";
const serif = "Georgia,'Times New Roman',serif";
const sans = "Helvetica,Arial,sans-serif";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderWelcomeEmail({
  firstName,
  shopUrl,
  logoUrl,
}: {
  firstName: string;
  shopUrl: string;
  logoUrl: string;
}) {
  const subject = `Welcome to ${brandName}`;
  const heading = `Welcome, ${firstName}`;
  const body =
    "Your account is ready. Browse our ube jam and halaya, and order whenever you like.";
  const reason = `You're receiving this email because you signed up at ${brandName}.`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${page};"><tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${hairline};border-top:3px solid ${brand};">
<tr><td align="center" style="padding:48px 40px 0;"><img src="${escapeHtml(logoUrl)}" width="56" height="56" alt="Bren Raphael's" style="display:block;border:0;"></td></tr>
<tr><td align="center" style="padding:32px 40px 0;font-family:${serif};font-size:32px;line-height:40px;color:${brand};">${escapeHtml(heading)}</td></tr>
<tr><td align="center" style="padding:16px 48px 0;font-family:${sans};font-size:16px;line-height:26px;color:${muted};">${escapeHtml(body)}</td></tr>
<tr><td align="center" style="padding:36px 40px 0;"><a href="${escapeHtml(shopUrl)}" style="display:inline-block;padding:16px 40px;background:${brand};font-family:${sans};font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Start shopping</a></td></tr>
<tr><td align="center" style="padding:40px 48px 48px;font-family:${sans};font-size:12px;line-height:20px;color:${quiet};">${escapeHtml(reason)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${brandName}\n\n${heading}\n\n${body}\n\nStart shopping: ${shopUrl}\n\n${reason}`;
  return { subject, html, text };
}

export async function sendWelcomeEmail(recipient: string, firstName: string) {
  const siteUrl = requiredEnvironment("NEXT_PUBLIC_SITE_URL");
  const { transport, sender } = createBrevoTransport();
  const { subject, html, text } = renderWelcomeEmail({
    firstName,
    shopUrl: new URL("/shop", siteUrl).toString(),
    logoUrl: new URL("/logo.jpeg", siteUrl).toString(),
  });
  await transport.sendMail({ from: sender, to: recipient, subject, html, text });
}
