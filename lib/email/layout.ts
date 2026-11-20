import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The shared Customer email layout. Colors, type and spacing are copied from the Figma Foundations page
 * (Bren Raphael's UI/UX Redesign, node 0:1): ube palette, Libre Baskerville headings and DM Sans body.
 * Email clients cannot load our fonts reliably, so each stack falls back to Georgia and Arial.
 */
export const EMAIL_TOKENS = {
  primary: "#4A2373",
  ink: "#2B1B45",
  body: "#4B4458",
  muted: "#7D7590",
  lavender: "#E9DDFB",
  lavenderSoft: "#F4EEFC",
  accent: "#C9A8F0",
  bg: "#FAF8FC",
  white: "#FFFFFF",
  line: "#E4DDEC",
  serif: "'Libre Baskerville', Georgia, 'Times New Roman', serif",
  sans: "'DM Sans', Arial, Helvetica, sans-serif",
} as const;

const t = EMAIL_TOKENS;

export const LOGO_CID = "bren-raphaels-logo";

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** The brand logo as an inline attachment the layout's `cid:` image points at. */
export async function logoAttachment() {
  return { filename: "logo.jpeg", content: await readFile(path.join(process.cwd(), "public", "logo.jpeg")), cid: LOGO_CID };
}

/** Primary button (Figma Button, Variant=Primary, Size=L): pill, ube fill, white DM Sans 18px. */
export function emailButton(label: string, href: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${t.primary};color:${t.white};font-family:${t.sans};font-size:18px;line-height:27px;text-decoration:none;padding:16px 32px;border-radius:50px;">${escapeHtml(label)}</a>`;
}

/** Secondary button: the same pill with an ube outline and ube text, for the lesser choice beside the primary one. */
export function emailSecondaryButton(label: string, href: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${t.white};color:${t.primary};border:1px solid ${t.primary};font-family:${t.sans};font-size:18px;line-height:27px;text-decoration:none;padding:15px 31px;border-radius:50px;">${escapeHtml(label)}</a>`;
}

/** A heading with the Figma Eyebrow above it (DM Sans Medium 12px, uppercase). */
export function emailHeading(eyebrow: string, title: string) {
  return `<p style="margin:0 0 8px;font-family:${t.sans};font-size:12px;line-height:18px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${t.muted};">${escapeHtml(eyebrow)}</p>
<h1 style="margin:0 0 16px;font-family:${t.serif};font-size:28px;line-height:35px;font-weight:400;color:${t.primary};">${escapeHtml(title)}</h1>`;
}

export function emailParagraph(text: string) {
  return `<p style="margin:0 0 16px;font-family:${t.sans};font-size:16px;line-height:26px;color:${t.body};">${escapeHtml(text)}</p>`;
}

/** Wraps `content` in the header (logo and wordmark), card and footer every shop email shares. */
export function renderEmailLayout({ preheader, content }: { preheader: string; content: string }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${t.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.bg};">
<tr><td align="center" style="padding:30px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
<tr><td style="padding:0 0 20px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px;"><img src="cid:${LOGO_CID}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0;"></td>
<td><div style="font-family:${t.serif};font-size:20px;line-height:26px;color:${t.primary};">Bren Raphael&#39;s</div>
<div style="font-family:${t.sans};font-size:10px;line-height:15px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${t.muted};">Ube Jam &amp; Halaya</div></td>
</tr></table>
</td></tr>
<tr><td style="background:${t.white};border:1px solid ${t.line};padding:40px 30px;">${content}</td></tr>
<tr><td style="padding:20px 0 0;font-family:${t.sans};font-size:12px;line-height:18px;color:${t.muted};">Bren Raphael&#39;s Premium Ube Jam &amp; Halaya · Rich, creamy, and proudly homemade.</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
