import { formatPeso } from "../catalog/currency";
import type { Order } from "../orders/orders";
import { loadPickupInstructions, pickupInstructionLines, type PickupInstructions, pickupReminder } from "../pickup/instructions";
import { formatPlacedAt, paymentDeadline } from "../orders/order-view";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";
import { stableMessageId } from "./stable-message-id";
import { EMAIL_TOKENS as t, emailButton, emailHeading, emailParagraph, escapeHtml, logoAttachment, renderEmailLayout } from "./layout";

/** The Customer's own Order page, where the View Order button lands. */
/** The Orders page with the cancel dialog open; the Customer signs in first if they are signed out. */
export function cancelOrderUrl(orderId: number) {
  return `${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders?order=${orderId}&action=cancel`;
}

/** The Orders page with this Order open on its payment form. */
export function payOrderUrl(orderId: number) {
  return `${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders?order=${orderId}&action=pay`;
}

export function viewOrderUrl(orderId: number) {
  return `${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders?order=${orderId}`;
}

/** The amount to pay at the counter: the confirmed total, or the subtotal less the approved discount before it is saved. */
export function totalPayableAtPickup(order: Order) {
  return order.totalInCentavos ?? order.subtotalInCentavos - (order.approvedDiscountInCentavos ?? 0);
}

function row(label: string, value: string, strong = false) {
  const weight = strong ? "font-weight:500;color:" + t.ink : "color:" + t.body;
  return `<tr><td style="padding:6px 0;font-family:${t.sans};font-size:${strong ? 16 : 14}px;line-height:21px;${weight};">${escapeHtml(label)}</td><td align="right" style="padding:6px 0;font-family:${t.sans};font-size:${strong ? 16 : 14}px;line-height:21px;${weight};">${escapeHtml(value)}</td></tr>`;
}

/** The Delivery fee line: "Free Delivery — ₱0" when it is nothing, otherwise the amount. */
export function deliveryFeeText(feeInCentavos: number) {
  return feeInCentavos === 0 ? `Free Delivery — ${formatPeso(0)}` : formatPeso(feeInCentavos);
}

/** The Customer's saved payment deadline (24 hours after placing, the same one the Order page shows), or null when the Order has no placing time. */
export function paymentDeadlineText(order: Pick<Order, "createdAt">) {
  return order.createdAt instanceof Date ? formatPlacedAt(paymentDeadline(order)) : null;
}

/** The "pay by" notice an Online payment email carries. */
export function deadlineNotice(order: Pick<Order, "createdAt">) {
  const deadline = paymentDeadlineText(order);
  if (!deadline) return null;
  return { text: `Pay by ${deadline}, or the order will be cancelled.`, html: `<p style="margin:16px 0 0;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.body};"><span style="font-weight:500;color:${t.ink};">Pay by ${escapeHtml(deadline)}</span>, or the order will be cancelled.</p>` };
}

export function pickupBlock(instructions: PickupInstructions | null, order: Order) {
  const reminder = pickupReminder(order);
  if (!instructions && !reminder) return "";
  const line = (label: string, value: string) => `<p style="margin:0 0 6px;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.body};"><span style="font-weight:500;color:${t.ink};">${escapeHtml(label)}</span> ${escapeHtml(value)}</p>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:${t.lavenderSoft};border:1px solid ${t.line};"><tr><td style="padding:20px;">
<p style="margin:0 0 10px;font-family:${t.sans};font-size:12px;line-height:18px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${t.primary};">Pickup instructions</p>
${instructions ? line("Address:", instructions.address) + line("Hours:", instructions.hours) + (instructions.note ? line("Note:", instructions.note) : "") : ""}
${reminder ? line("Please bring:", reminder) : ""}
</td></tr></table>`;
}

/** Builds the subject, HTML and plain text of the COD + Pickup confirmation, so tests can render it without sending. */
export function renderPickupConfirmedEmail(order: Order, instructions: PickupInstructions | null, orderUrl: string) {
  const discount = order.approvedDiscountInCentavos ?? 0;
  const total = totalPayableAtPickup(order);
  const items = order.lines.map((l) => ({ name: `${l.productName} — ${l.sizeLabel} × ${l.quantity}`, amount: formatPeso(l.priceInCentavos * l.quantity) }));

  const itemRows = items.map((i) => row(i.name, i.amount)).join("");
  const html = renderEmailLayout({
    preheader: `Order #${order.id} is confirmed. Pay ${formatPeso(total)} in cash when you pick it up.`,
    content: [
      emailHeading(`Order #${order.id}`, "Your Pickup Order is confirmed"),
      emailParagraph("Thank you for ordering from Bren Raphael's. Pay in cash when you collect your order."),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;border-top:1px solid ${t.line};">${itemRows}</table>`,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;border-top:1px solid ${t.line};">${row("Subtotal", formatPeso(order.subtotalInCentavos))}${discount > 0 ? row("Senior/PWD discount", `-${formatPeso(discount)}`) : ""}${row("Total payable upon pickup", formatPeso(total), true)}</table>`,
      pickupBlock(instructions, order),
      `<div style="margin:24px 0 0;">${emailButton("View Order", orderUrl)}</div>`,
    ].join("\n"),
  });

  const text = [
    `Your Pickup Order #${order.id} is confirmed.`,
    "Pay in cash when you collect your order.",
    "",
    "Your items:",
    ...items.map((i) => `${i.name}: ${i.amount}`),
    "",
    `Subtotal: ${formatPeso(order.subtotalInCentavos)}`,
    ...(discount > 0 ? [`Senior/PWD discount: -${formatPeso(discount)}`] : []),
    `Total payable upon pickup: ${formatPeso(total)}`,
    "",
    ...pickupInstructionLines(instructions, order),
    "",
    `View Order: ${orderUrl}`,
  ].join("\n");

  return { subject: `Order #${order.id} confirmed`, html, text };
}

/** Sends the Customer the confirmation of a Cash on Delivery Pickup Order after Staff confirm it. */
export async function sendOrderPickupConfirmedEmail(recipient: string, order: Order, email?: { id: string }) {
  const { transport, sender } = createBrevoTransport();
  const message = renderPickupConfirmedEmail(order, await loadPickupInstructions(), viewOrderUrl(order.id));
  const info = await transport.sendMail({ from: sender, to: recipient, ...message, ...stableMessageId(sender, email), attachments: [await logoAttachment()] });
  return typeof info?.messageId === "string" ? { messageId: info.messageId } : {};
}
