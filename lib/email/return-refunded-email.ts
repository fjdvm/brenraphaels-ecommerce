import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { formatPeso } from "../catalog/currency";
import { orderReturnItems, orderReturns } from "../db/schema";
import { formatReturnNumber } from "../returns/returns";
import { refundMethodLabels, type RefundMethod } from "../returns/refund-destination";
import { gatewayTicketFiles } from "../support/ticket-files";
import { createBrevoTransport } from "./brevo-transport";
import { EMAIL_TOKENS as t, emailButton, emailHeading, emailParagraph, escapeHtml, logoAttachment, renderEmailLayout } from "./layout";
import { viewOrderUrl } from "./order-pickup-confirmed-email";
import { stableMessageId } from "./stable-message-id";

/** The email kind and its one stable id per Return (`order-<id>-return-refunded-<return id>`), so a retry or Resend is never a second email (epic-crms#616). */
export const RETURN_REFUNDED_EMAIL_KIND = "return-refunded";

export const REFUND_PROOF_CID = "refund-proof";

export type RefundedReturnEmail = {
  orderId: number;
  returnId: number;
  items: { productName: string; sizeLabel: string; quantity: number; priceInCentavos: number }[];
  deliveryFeeInCentavos: number;
  amountInCentavos: number;
  paidOn: string;
  method: string;
  reference: string;
};

const methodLabel = (method: string) => refundMethodLabels[method as RefundMethod] ?? method;
const dateOnly = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" });
const paidOn = (value: string) => dateOnly.format(new Date(`${value}T00:00:00Z`));

const cell = (text: string, align = "left") => `<td style="padding:6px 0;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.body};text-align:${align};">${text}</td>`;
const row = (label: string, value: string) => `<tr>${cell(escapeHtml(label))}${cell(`<span style="font-weight:500;color:${t.ink};">${escapeHtml(value)}</span>`, "right")}</tr>`;

/** The refund email: order number, items, Delivery fee, amount, date, method, reference and the proof image (attached inline, so it never expires). */
export function renderReturnRefundedEmail(refund: RefundedReturnEmail, orderUrl: string, withProof: boolean) {
  const number = formatReturnNumber(refund.returnId);
  const line = `Your refund for Return ${number} (Order #${refund.orderId}) has been sent.`;
  const amount = formatPeso(refund.amountInCentavos);
  const items = refund.items.map((item) => `${item.productName} · ${item.sizeLabel} × ${item.quantity}`);
  const itemRows = refund.items.map((item) => row(`${item.productName} · ${item.sizeLabel} × ${item.quantity}`, formatPeso(item.priceInCentavos * item.quantity))).join("\n");
  const details = [["Method", methodLabel(refund.method)], ["Date sent", paidOn(refund.paidOn)], ["Reference", refund.reference]] as const;
  const html = renderEmailLayout({
    preheader: `${line} Amount: ${amount}.`,
    content: [
      emailHeading(`Order #${refund.orderId}`, "Your refund was sent"),
      emailParagraph(line),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:${t.lavenderSoft};border:1px solid ${t.line};"><tr><td style="padding:20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${itemRows}
${refund.deliveryFeeInCentavos > 0 ? row("Delivery fee", formatPeso(refund.deliveryFeeInCentavos)) : ""}
${row("Refund amount", amount)}
${details.map(([label, value]) => row(label, value)).join("\n")}
</table></td></tr></table>`,
      withProof ? `<p style="margin:0 0 8px;font-family:${t.sans};font-size:12px;line-height:18px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${t.muted};">Proof of refund</p><img src="cid:${REFUND_PROOF_CID}" alt="Proof of refund" style="display:block;max-width:100%;height:auto;border:1px solid ${t.line};margin:0 0 16px;" />` : "",
      `<div style="margin:24px 0 0;">${emailButton("View your Return", orderUrl)}</div>`,
    ].join("\n"),
  });
  const text = [line, "", ...items, ...(refund.deliveryFeeInCentavos > 0 ? [`Delivery fee: ${formatPeso(refund.deliveryFeeInCentavos)}`] : []),
    `Refund amount: ${amount}`, ...details.map(([label, value]) => `${label}: ${value}`),
    ...(withProof ? ["", "The proof of refund is attached."] : []), "", `View your Return: ${orderUrl}`].join("\n");
  return { subject: `Return ${number} refunded`, html, text };
}

/** Reads what the email says from the saved Return, so a retry or Resend says the same thing. */
export async function loadRefundedReturn<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(
  db: PgDatabase<TQueryResult, TSchema>, returnId: number,
): Promise<(RefundedReturnEmail & { proofFileId: string | null }) | null> {
  const [record] = await db.select().from(orderReturns).where(eq(orderReturns.id, returnId));
  if (!record || record.status !== "refunded" || record.refundAmountInCentavos == null || !record.refundPaidMethod || !record.refundPaidOn || !record.refundReference) return null;
  const items = await db.select().from(orderReturnItems).where(eq(orderReturnItems.returnId, returnId)).orderBy(orderReturnItems.orderLineId);
  return {
    orderId: record.orderId, returnId, proofFileId: record.refundProofFileId,
    items: items.map(({ productName, sizeLabel, quantity, priceInCentavos }) => ({ productName, sizeLabel, quantity, priceInCentavos })),
    deliveryFeeInCentavos: record.refundDeliveryFeeInCentavos ?? 0, amountInCentavos: record.refundAmountInCentavos,
    paidOn: record.refundPaidOn, method: record.refundPaidMethod, reference: record.refundReference,
  };
}

/** The proof image bytes, fetched from private file-storage for the owning Customer's own email only. */
export async function fetchRefundProof(fileId: string, send: typeof fetch = fetch) {
  const url = await gatewayTicketFiles().viewUrl(fileId);
  const response = await send(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`The refund proof could not be read: ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  return { content: Buffer.from(await response.arrayBuffer()), contentType };
}

/** Sends the refund email under its stable id and hands back Notification's accepted message id. A missing proof image fails the send, so it is retried. */
export async function sendReturnRefundedEmail(
  recipient: string, refund: RefundedReturnEmail & { proofFileId: string | null }, email?: { id: string }, readProof: typeof fetchRefundProof = fetchRefundProof,
) {
  const { transport, sender } = createBrevoTransport();
  const proof = refund.proofFileId ? await readProof(refund.proofFileId) : null;
  const message = renderReturnRefundedEmail(refund, viewOrderUrl(refund.orderId), Boolean(proof));
  const attachments = [await logoAttachment(), ...(proof ? [{ filename: `refund-proof.${proof.contentType === "image/png" ? "png" : "jpg"}`, content: proof.content, contentType: proof.contentType, cid: REFUND_PROOF_CID }] : [])];
  const info = await transport.sendMail({ from: sender, to: recipient, ...message, ...stableMessageId(sender, email), attachments });
  return typeof info?.messageId === "string" ? { messageId: info.messageId } : {};
}
