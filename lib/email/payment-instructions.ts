import { formatPeso } from "../catalog/currency";
import { PAYMENT_LABELS } from "../orders/payment-details";
import type { PaymentMethod } from "../orders/payment-methods";
import { paymentOffer, type PaymentAccountOption } from "../orders/payment-offer";
import { email as shopEmail, phones } from "../site/store-info";
import { EMAIL_TOKENS as t, escapeHtml } from "./layout";

/** One Payment account as an email shows it: its QR, when there is one, travels as an inline attachment named `qrCid`. */
export type EmailPaymentAccount = Omit<PaymentAccountOption, "qrUrl"> & { qrCid: string | null };

export type EmailPaymentOffer =
  | { kind: "accounts"; accounts: EmailPaymentAccount[]; switched: boolean }
  | { kind: "none" };

export type InlineAttachment = { filename: string; content: Buffer; cid: string; contentType: string };

const QR_MAX_BYTES = 5 * 1024 * 1024;
const QR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg" };

/**
 * Downloads one QR through its short-lived signed link so the email can carry the image itself: a link would expire
 * long before the Customer opens the email. Null when it cannot be fetched, is not a PNG or JPEG, or is over 5 MB;
 * the account is then shown without its QR.
 */
export async function fetchQrImage(url: string, send: typeof fetch = fetch): Promise<{ content: Buffer; contentType: string; ext: string } | null> {
  try {
    if (new URL(url).protocol !== "https:") return null;
    const response = await send(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = QR_TYPES[contentType];
    if (!ext) return null;
    const content = Buffer.from(await response.arrayBuffer());
    if (content.length === 0 || content.length > QR_MAX_BYTES) return null;
    return { content, contentType: contentType === "image/jpg" ? "image/jpeg" : contentType, ext };
  } catch {
    return null;
  }
}

/**
 * The accounts the Order's "Pay your Order" email offers (its own method's active accounts, else another enabled
 * method's), each QR fetched and turned into an inline attachment. Read when the email is sent, so a retry or Resend
 * shows the accounts as they are then.
 */
export async function emailPaymentOffer(
  method: PaymentMethod,
  accounts: PaymentAccountOption[],
  fetchQr: (url: string) => Promise<Awaited<ReturnType<typeof fetchQrImage>>> = fetchQrImage,
): Promise<{ offer: EmailPaymentOffer; attachments: InlineAttachment[] }> {
  const offer = paymentOffer(method, accounts);
  if (offer.kind === "none") return { offer, attachments: [] };
  const attachments: InlineAttachment[] = [];
  const shown = await Promise.all(offer.accounts.map(async ({ qrUrl, ...account }) => {
    const image = qrUrl ? await fetchQr(qrUrl).catch(() => null) : null;
    if (!image) return { ...account, qrCid: null };
    const cid = `payment-qr-${account.id}`;
    attachments.push({ filename: `qr-${account.id}.${image.ext}`, content: image.content, cid, contentType: image.contentType });
    return { ...account, qrCid: cid };
  }));
  return { offer: { kind: "accounts", accounts: shown, switched: offer.switched }, attachments };
}

const eyebrow = `margin:0 0 10px;font-family:${t.sans};font-size:12px;line-height:18px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${t.primary};`;
const small = `margin:0;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.body};`;

/** `copyable` makes one click select the whole value (web and desktop mail), so it can be copied in a single step. */
function detail(label: string, value: string, copyable = false) {
  if (copyable) {
    return `<tr><td style="padding:2px 16px 2px 0;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.muted};">${escapeHtml(label)}</td><td style="padding:2px 0;font-family:${t.sans};font-size:16px;line-height:24px;color:${t.ink};font-weight:600;letter-spacing:0.5px;"><span style="-webkit-user-select:all;user-select:all;">${escapeHtml(value)}</span> <span style="font-size:12px;font-weight:400;color:${t.muted};letter-spacing:0;">(tap and hold to copy)</span></td></tr>`;
  }
  return `<tr><td style="padding:2px 16px 2px 0;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.muted};">${escapeHtml(label)}</td><td style="padding:2px 0;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.ink};font-weight:500;">${escapeHtml(value)}</td></tr>`;
}

function accountTitle(account: EmailPaymentAccount) {
  return `${account.label} · ${PAYMENT_LABELS[account.method]}`;
}

/** The "How to pay" block of the Pay your Order email: amount, every offered account with its number and QR, and the next step. */
export function renderPaymentInstructions(orderId: number, method: PaymentMethod, amountInCentavos: number, offer: EmailPaymentOffer) {
  const amount = formatPeso(amountInCentavos);
  const contact = `${shopEmail}${phones[0] ? ` · ${phones[0].number}` : ""}`;

  if (offer.kind === "none") {
    const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:${t.lavenderSoft};border:1px solid ${t.line};"><tr><td style="padding:20px;">
<p style="${eyebrow}">How to pay</p>
<p style="${small}color:${t.ink};font-weight:500;">Online payment isn&#39;t available right now</p>
<p style="${small}">Please contact the shop and we&#39;ll help you complete your payment. Your deadline and total stay the same.</p>
<p style="${small}color:${t.ink};">${escapeHtml(contact)}</p>
</td></tr></table>`;
    const text = ["How to pay:", "Online payment isn't available right now. Please contact the shop and we'll help you complete your payment. Your deadline and total stay the same.", contact];
    return { html, text };
  }

  const cards = offer.accounts.map((account) => {
    const rows = [
      ...(account.bankName ? [detail("Bank", account.bankName)] : []),
      detail("Account name", account.accountName),
      detail("Account number", account.accountNumber, true),
    ].join("");
    // Like the Order page: the details first, a divider, then the QR centred and large below them.
    const qr = account.qrCid
      ? `<tr><td align="center" style="padding:16px 0 0;border-top:1px solid ${t.line};"><img src="cid:${escapeHtml(account.qrCid)}" width="240" height="240" alt="${escapeHtml(`QR for ${account.label}`)}" style="display:block;margin:0 auto;width:240px;max-width:100%;height:240px;border:1px solid ${t.line};background:${t.white};"></td></tr>`
      : "";
    return `<tr><td style="padding:16px 0;border-top:1px solid ${t.line};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td valign="top" style="padding:0 0 16px;"><p style="margin:0 0 6px;font-family:${t.sans};font-size:16px;line-height:24px;font-weight:500;color:${t.ink};">${escapeHtml(accountTitle(account))}</p>
<table role="presentation" cellpadding="0" cellspacing="0">${rows}</table></td></tr>${qr}
</table></td></tr>`;
  }).join("");

  const switched = offer.switched
    ? `<p style="${small}margin:0 0 12px;">${escapeHtml(`${PAYMENT_LABELS[method]} is no longer available. Pay with one of these instead; your deadline and total stay the same.`)}</p>`
    : "";
  const steps = [
    `Send exactly ${amount} to one of these accounts. Scan the QR or enter the account number.`,
    `Write "Order #${orderId}" in the transfer note.`,
    "Tap Pay order and upload the reference number and a screenshot of your transfer.",
  ];

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:${t.lavenderSoft};border:1px solid ${t.line};" data-testid="payment-accounts"><tr><td style="padding:20px;">
<p style="${eyebrow}">How to pay</p>
${switched}<ol style="margin:0 0 12px;padding-left:20px;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.body};">${steps.map((s) => `<li style="margin:0 0 4px;">${escapeHtml(s)}</li>`).join("")}</ol>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.white};padding:0 16px;">${cards}</table>
<p style="${small}margin:12px 0 0;color:${t.muted};">Your Order is paid once our team has checked your transfer. We will email you when it is.</p>
</td></tr></table>`;

  const text = [
    "How to pay:",
    ...(offer.switched ? [`${PAYMENT_LABELS[method]} is no longer available. Pay with one of these instead; your deadline and total stay the same.`] : []),
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    ...offer.accounts.flatMap((account) => [
      accountTitle(account),
      ...(account.bankName ? [`  Bank: ${account.bankName}`] : []),
      `  Account name: ${account.accountName}`,
      `  Account number: ${account.accountNumber}`,
      ...(account.qrCid ? ["  QR code: shown in the HTML version of this email"] : []),
      "",
    ]),
    "Your Order is paid once our team has checked your transfer. We will email you when it is.",
  ];
  return { html, text };
}
