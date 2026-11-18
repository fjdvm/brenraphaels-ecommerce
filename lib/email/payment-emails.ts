import { formatPeso } from "../catalog/currency";
import { formatPlacedAt, orderTotalInCentavos, paymentDeadline } from "../orders/order-view";
import type { Order } from "../orders/orders";
import { createBrevoTransport } from "./brevo-transport";
import { EMAIL_TOKENS as t, emailButton, emailHeading, emailParagraph, escapeHtml, logoAttachment, renderEmailLayout } from "./layout";
import { viewOrderUrl } from "./order-pickup-confirmed-email";
import { stableMessageId } from "./stable-message-id";

/** Email kinds the payment lifecycle owns. Each has one stable id per event occurrence (see `stableEmailId`). */
export const PAYMENT_EMAIL_KINDS = ["payment-verified", "payment-rejected", "payment-expired", "manager-review-started"] as const;
export type PaymentEmailKind = (typeof PAYMENT_EMAIL_KINDS)[number];

/** The reason Staff gave for the n-th rejected proof ("1", "2"); with no occurrence, the latest one. Read from the saved history so a retry or Resend says the same thing. */
export function rejectionReasonFor(order: Pick<Order, "paymentProofHistory" | "paymentProofRejection">, occurrence = "") {
  const rejected = (order.paymentProofHistory ?? []).flatMap((proof) => (proof.rejection ? [proof.rejection.reason] : []));
  const n = Number(occurrence);
  const reason = Number.isInteger(n) && n >= 1 ? rejected[n - 1] : rejected[rejected.length - 1];
  return reason || order.paymentProofRejection?.reason || "The proof could not be accepted.";
}

const note = (text: string) => `<p style="margin:0 0 16px;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.body};">${text}</p>`;
const reasonBlock = (reason: string) =>
  `<div style="margin:0 0 16px;padding:12px 16px;background:${t.lavenderSoft};border-radius:12px;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.ink};"><span style="font-weight:500;">Reason:</span> ${escapeHtml(reason)}</div>`;

/** Payment verified: Staff marked the Order paid. */
export function renderPaymentVerifiedEmail(order: Order, orderUrl: string) {
  const total = formatPeso(orderTotalInCentavos(order));
  const line = `We verified your payment for Order #${order.id}. We're preparing it now.`;
  const html = renderEmailLayout({
    preheader: line,
    content: [emailHeading(`Order #${order.id}`, "Payment verified"), emailParagraph(line), note(`Total paid: <span style="font-weight:500;color:${t.ink};">${escapeHtml(total)}</span>`), `<div style="margin:24px 0 0;">${emailButton("View Order", orderUrl)}</div>`].join("\n"),
  });
  return { subject: `Order #${order.id} payment verified`, html, text: [line, "", `Total paid: ${total}`, "", `View Order: ${orderUrl}`].join("\n") };
}

/** Payment rejected: the reason, the fresh payment deadline and the link to submit again. */
export function renderPaymentRejectedEmail(order: Order, reason: string, orderUrl: string) {
  const deadline = formatPlacedAt(paymentDeadline(order));
  const line = `We couldn't accept your payment proof for Order #${order.id}.`;
  const html = renderEmailLayout({
    preheader: `${line} Submit again by ${deadline}.`,
    content: [
      emailHeading(`Order #${order.id}`, "Payment not accepted"), emailParagraph(line), reasonBlock(reason),
      note(`Your order is still waiting for payment. <span style="font-weight:500;color:${t.ink};">Submit a new proof by ${escapeHtml(deadline)}</span>, or the order will be cancelled.`),
      `<div style="margin:24px 0 0;">${emailButton("Submit your payment proof", orderUrl)}</div>`,
    ].join("\n"),
  });
  return { subject: `Order #${order.id} payment proof not accepted`, html, text: [line, "", `Reason: ${reason}`, "", `Your order is still waiting for payment. Submit a new proof by ${deadline}, or the order will be cancelled.`, "", `Submit your payment proof: ${orderUrl}`].join("\n") };
}

/** The payment window ran out: the Order is cancelled and the stock released. */
export function renderPaymentExpiredEmail(order: Order, orderUrl: string) {
  const line = `Order #${order.id} was cancelled because the payment window expired.`;
  const html = renderEmailLayout({
    preheader: line,
    content: [emailHeading(`Order #${order.id}`, "Your order was cancelled"), emailParagraph("Your order was cancelled because the payment window expired."), note("Its reserved items were released. You can place a new order any time."), `<div style="margin:24px 0 0;">${emailButton("View Order", orderUrl)}</div>`].join("\n"),
  });
  return { subject: `Order #${order.id} cancelled`, html, text: ["Your order was cancelled because the payment window expired.", "", "Its reserved items were released. You can place a new order any time.", "", `View Order: ${orderUrl}`].join("\n") };
}

/** The third rejection: only this email, with the reason, no resubmit button and no new deadline. */
export function renderManagerReviewEmail(order: Order, reason: string, orderUrl: string) {
  const line = `We couldn't accept the third payment proof for Order #${order.id}.`;
  const html = renderEmailLayout({
    preheader: "Your payment is under Manager review.",
    content: [
      emailHeading(`Order #${order.id}`, "Your payment is under Manager review"), emailParagraph(line), reasonBlock(reason),
      note("A Manager is now checking your payment, so you can't send another proof. We will contact you once it is decided."),
      `<div style="margin:24px 0 0;">${emailButton("View Order", orderUrl)}</div>`,
    ].join("\n"),
  });
  return { subject: `Order #${order.id} payment is under Manager review`, html, text: [line, "", `Reason: ${reason}`, "", "Your payment is under Manager review, so you can't send another proof. We will contact you once it is decided.", "", `View Order: ${orderUrl}`].join("\n") };
}

type Rendered = { subject: string; html: string; text: string };

/** Renders the email of `kind` for this Order and occurrence; the one place that decides each kind's content. */
export function renderPaymentEmail(kind: PaymentEmailKind, order: Order, occurrence = ""): Rendered {
  const url = viewOrderUrl(order.id);
  if (kind === "payment-verified") return renderPaymentVerifiedEmail(order, url);
  if (kind === "payment-expired") return renderPaymentExpiredEmail(order, url);
  if (kind === "manager-review-started") return renderManagerReviewEmail(order, rejectionReasonFor(order), url);
  return renderPaymentRejectedEmail(order, rejectionReasonFor(order, occurrence), url);
}

/** Sends one payment email under its stable id and hands back Notification's accepted message id. */
export async function sendPaymentEmail(kind: PaymentEmailKind, recipient: string, order: Order, email?: { id: string }, occurrence = "") {
  const { transport, sender } = createBrevoTransport();
  const message = renderPaymentEmail(kind, order, occurrence);
  const info = await transport.sendMail({ from: sender, to: recipient, ...message, ...stableMessageId(sender, email), attachments: [await logoAttachment()] });
  return typeof info?.messageId === "string" ? { messageId: info.messageId } : {};
}
