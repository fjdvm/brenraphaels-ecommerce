import { formatPeso } from "../catalog/currency";
import { formatPlacedAt } from "../orders/order-view";
import type { Order } from "../orders/orders";
import { loadPickupInstructions, pickupInstructionLines, type PickupInstructions } from "../pickup/instructions";
import { createBrevoTransport } from "./brevo-transport";
import { EMAIL_TOKENS as t, emailButton, emailHeading, emailParagraph, escapeHtml, logoAttachment, renderEmailLayout } from "./layout";
import { pickupBlock, viewOrderUrl } from "./order-pickup-confirmed-email";
import { stableMessageId } from "./stable-message-id";

/**
 * The four fulfilment Status emails (epic-crms#608). Each has one stable id per Order (`order-<id>-<kind>`), so a
 * repeated save, a retry or a Resend of the same event can never be a second email.
 */
export const FULFILMENT_EMAIL_KINDS = ["preparing", "dispatched", "ready-for-pickup", "completed"] as const;
export type FulfilmentEmailKind = (typeof FULFILMENT_EMAIL_KINDS)[number];

type Rendered = { subject: string; html: string; text: string };

const note = (text: string) => `<p style="margin:0 0 16px;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.body};">${text}</p>`;
const button = (url: string) => `<div style="margin:24px 0 0;">${emailButton("View Order", url)}</div>`;
const panel = (label: string, lines: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:${t.lavenderSoft};border:1px solid ${t.line};"><tr><td style="padding:20px;">
<p style="margin:0 0 10px;font-family:${t.sans};font-size:12px;line-height:18px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${t.primary};">${escapeHtml(label)}</p>
${lines.map((line) => `<p style="margin:0 0 6px;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.body};">${line}</p>`).join("\n")}
</td></tr></table>`;
const strong = (text: string) => `<span style="font-weight:500;color:${t.ink};">${escapeHtml(text)}</span>`;

/** Preparing: sent only when the Order first enters Preparing. */
export function renderPreparingEmail(order: Order, orderUrl: string): Rendered {
  const line = `We're now preparing Order #${order.id}.`;
  const next = order.fulfillmentMethod === "pickup" ? "We'll email you again when it is ready for pickup." : "We'll email you again when it is out for delivery.";
  return {
    subject: `Order #${order.id} is being prepared`,
    html: renderEmailLayout({ preheader: line, content: [emailHeading(`Order #${order.id}`, "We're preparing your order"), emailParagraph(line), note(next), button(orderUrl)].join("\n") }),
    text: [line, next, "", `View Order: ${orderUrl}`].join("\n"),
  };
}

/** Dispatched (Out for delivery): the courier, and Track Your Order only when Staff saved a link. Rider details never go to the Customer. */
export function renderDispatchedEmail(order: Order, orderUrl: string): Rendered {
  const courier = order.courier;
  const name = courier?.name ?? "our courier";
  const link = courier?.trackingUrl ?? null;
  const line = `Your order is on the way! Order #${order.id} has been dispatched with ${name}.`;
  const body = [
    panel("Courier", [`${strong("Courier:")} ${escapeHtml(name)}`, ...(link ? [] : ["A tracking link is not available yet."])]),
    link ? `<div style="margin:0 0 16px;">${emailButton("Track Your Order", link)}</div>${note(`The tracking link is from ${escapeHtml(name)} and may stop working after delivery.`)}` : "",
    link ? `<p style="margin:0;font-family:${t.sans};font-size:14px;line-height:21px;"><a href="${escapeHtml(orderUrl)}" style="color:${t.primary};">View Order</a></p>` : button(orderUrl),
  ];
  return {
    subject: `Order #${order.id} is on its way`,
    html: renderEmailLayout({ preheader: line, content: [emailHeading(`Order #${order.id}`, "Your order is on the way"), emailParagraph(line), ...body].join("\n") }),
    text: [line, "", ...(link ? [`Track Your Order: ${link}`, "", `The tracking link is from ${name} and may stop working after delivery.`] : [`Courier: ${name}`, "A tracking link is not available yet."]), "", `View Order: ${orderUrl}`].join("\n"),
  };
}

/** Ready for pickup: where and when to collect it. */
export function renderReadyForPickupEmail(order: Order, instructions: PickupInstructions | null, orderUrl: string): Rendered {
  const line = `Order #${order.id} is ready for pickup.`;
  return {
    subject: `Order #${order.id} is ready for pickup`,
    html: renderEmailLayout({ preheader: line, content: [emailHeading(`Order #${order.id}`, "Your order is ready for pickup"), emailParagraph(line), pickupBlock(instructions, order), button(orderUrl)].join("\n") }),
    text: [line, "", ...pickupInstructionLines(instructions, order), "", `View Order: ${orderUrl}`].join("\n"),
  };
}

/** Delivered or Picked up. A Cash on Delivery Order whose cash Staff recorded also confirms the payment collected, in this one email. */
export function renderCompletedEmail(order: Order, orderUrl: string): Rendered {
  const pickup = order.fulfillmentMethod === "pickup";
  const done = pickup ? "picked up" : "delivered";
  const line = `Order #${order.id} was ${done}. Thank you for ordering from Bren Raphael's.`;
  const collected = order.paymentMethod === "cash-on-delivery" ? order.codCollected ?? null : null;
  const collectedText = collected ? `Payment collected: ${formatPeso(collected.amountInCentavos)} on ${formatPlacedAt(collected.at)}.` : null;
  const window = `You have 24 hours from ${pickup ? "pickup" : "delivery"} to request a Return. Marking the order received closes the window early.`;
  return {
    subject: `Order #${order.id} ${done}`,
    html: renderEmailLayout({
      preheader: collectedText ? `${line} ${collectedText}` : line,
      content: [
        emailHeading(`Order #${order.id}`, pickup ? "Your order was picked up" : "Your order was delivered"), emailParagraph(line),
        collected ? panel("Payment collected", [`${strong(formatPeso(collected.amountInCentavos))} on ${escapeHtml(formatPlacedAt(collected.at))}`]) : "",
        note(escapeHtml(window)), button(orderUrl),
      ].join("\n"),
    }),
    text: [line, ...(collectedText ? ["", collectedText] : []), "", window, "", `View Order: ${orderUrl}`].join("\n"),
  };
}

/** Renders the email of `kind` for this Order as it is now; the one place that decides each kind's content. */
export async function renderFulfilmentEmail(kind: FulfilmentEmailKind, order: Order): Promise<Rendered> {
  const url = viewOrderUrl(order.id);
  if (kind === "preparing") return renderPreparingEmail(order, url);
  if (kind === "dispatched") return renderDispatchedEmail(order, url);
  if (kind === "ready-for-pickup") return renderReadyForPickupEmail(order, await loadPickupInstructions(), url);
  return renderCompletedEmail(order, url);
}

/** Sends one fulfilment email under its stable id and hands back Notification's accepted message id. */
export async function sendFulfilmentEmail(kind: FulfilmentEmailKind, recipient: string, order: Order, email?: { id: string }) {
  const { transport, sender } = createBrevoTransport();
  const message = await renderFulfilmentEmail(kind, order);
  const info = await transport.sendMail({ from: sender, to: recipient, ...message, ...stableMessageId(sender, email), attachments: [await logoAttachment()] });
  return typeof info?.messageId === "string" ? { messageId: info.messageId } : {};
}
