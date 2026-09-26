export type MagicLinkType = "email-verification" | "forget-password";

type MagicLinkTemplateInput = {
  linkType: MagicLinkType;
  /** Where the button and the pasted-link fallback go. */
  destination: string;
  /** Absolute URL of the logo; email clients cannot load a path on our site. */
  logoUrl: string;
};

// Same tokens as app/globals.css, written out because email clients have no CSS variables.
const muted = "#4a4450";
const quiet = "#625981";
const brand = "#452175";
const hairline = "#ccc3d2";
const page = "#fbf9fc";
const serif = "Georgia,'Times New Roman',serif";
const sans = "Helvetica,Arial,sans-serif";

const brandName = "Bren Raphael's Ube Jam & Halaya";

const copy = {
  "email-verification": {
    action: "Verify your email",
    heading: "Please verify your email",
    body: "Welcome to Bren Raphael's. Confirm your email address to finish creating your account.",
    button: "Verify my email",
    reason: `You're receiving this email because you signed up at ${brandName}. If this wasn't you, you can safely ignore it.`,
  },
  "forget-password": {
    action: "Reset your password",
    heading: "Reset your password",
    body: "We received a request to reset the password for your account. Use the button below to choose a new one.",
    button: "Reset password",
    reason:
      "If you didn't ask to reset your password, you can safely ignore this email. Your password will not change.",
  },
} satisfies Record<MagicLinkType, Record<string, string>>;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderMagicLinkEmail({
  linkType,
  destination,
  logoUrl,
}: MagicLinkTemplateInput) {
  const text = copy[linkType];
  const link = escapeHtml(destination);
  const subject = `${text.action} — ${brandName}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(text.body)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${page};">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${hairline};border-top:3px solid ${brand};">
<tr><td align="center" style="padding:48px 40px 0;">
<img src="${escapeHtml(logoUrl)}" width="56" height="56" alt="Bren Raphael's" style="display:block;border:0;width:56px;height:56px;">
</td></tr>
<tr><td align="center" style="padding:20px 40px 0;font-family:${sans};font-size:11px;line-height:16px;letter-spacing:3px;text-transform:uppercase;color:${quiet};">
Bren Raphael's &middot; Ube Jam &amp; Halaya
</td></tr>
<tr><td align="center" style="padding:32px 40px 0;font-family:${serif};font-size:32px;line-height:40px;font-weight:normal;color:${brand};">
${escapeHtml(text.heading)}
</td></tr>
<tr><td align="center" style="padding:16px 48px 0;font-family:${sans};font-size:16px;line-height:26px;color:${muted};">
${escapeHtml(text.body)}
</td></tr>
<tr><td align="center" style="padding:36px 40px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${brand}" style="background:${brand};">
<a href="${link}" style="display:inline-block;padding:16px 40px;font-family:${sans};font-size:13px;line-height:16px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(text.button)}</a>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:32px 48px 0;font-family:${sans};font-size:12px;line-height:20px;color:${quiet};">
Or paste this link into your browser:<br>
<a href="${link}" style="color:${brand};word-break:break-all;">${link}</a>
</td></tr>
<tr><td style="padding:40px 40px 0;"><div style="height:1px;line-height:1px;font-size:1px;background:${hairline};">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:24px 48px 48px;font-family:${sans};font-size:12px;line-height:20px;color:${quiet};">
${escapeHtml(text.reason)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const plain = `${brandName}\n\n${text.heading}\n\n${text.body}\n\n${text.button}: ${destination}\n\n${text.reason}`;

  return { subject, html, text: plain };
}
