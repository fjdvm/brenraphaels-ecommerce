import { formatPeso } from "../catalog/currency";
import type { Order } from "../orders/orders";
import { createBrevoTransport } from "./brevo-transport";
import { stableMessageId } from "./stable-message-id";
import { EMAIL_TOKENS as t, emailButton, emailHeading, emailParagraph, escapeHtml, logoAttachment, renderEmailLayout } from "./layout";
import { loadPickupInstructions, pickupInstructionLines, type PickupInstructions } from "../pickup/instructions";
import { deadlineNotice, pickupBlock, totalPayableAtPickup, viewOrderUrl } from "./order-pickup-confirmed-email";

function row(label: string, value: string, strong = false) {
  const style = `padding:6px 0;font-family:${t.sans};font-size:${strong ? 16 : 14}px;line-height:21px;${strong ? `font-weight:500;color:${t.ink}` : `color:${t.body}`};`;
  return `<tr><td style="${style}">${escapeHtml(label)}</td><td align="right" style="${style}">${escapeHtml(value)}</td></tr>`;
}

/** Builds the subject, HTML and plain text of the Online payment + Pickup confirmation, so tests can render it without sending. */
export function renderOnlinePickupConfirmedEmail(order: Order, orderUrl: string, instructions: PickupInstructions | null = null) {
  const discount = order.approvedDiscountInCentavos ?? 0;
  const total = totalPayableAtPickup(order);
  const deadline = deadlineNotice(order);
  const items = order.lines.map((l) => ({ name: `${l.productName} — ${l.sizeLabel} × ${l.quantity}`, amount: formatPeso(l.priceInCentavos * l.quantity) }));
  const border = `margin:8px 0 0;border-top:1px solid ${t.line};`;

  const html = renderEmailLayout({
    preheader: `Order #${order.id} is confirmed. Pay ${formatPeso(total)} online to get it ready for pickup.`,
    content: [
      emailHeading(`Order #${order.id}`, "Your Pickup Order is confirmed"),
      emailParagraph("Thank you for ordering from Bren Raphael's. Pay for your order online and we will get it ready for pickup."),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${border}">${items.map((i) => row(i.name, i.amount)).join("")}</table>`,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${border}">${row("Subtotal", formatPeso(order.subtotalInCentavos))}${discount > 0 ? row("Senior/PWD discount", `-${formatPeso(discount)}`) : ""}${row("Total amount to pay", formatPeso(total), true)}</table>`,
      pickupBlock(instructions, order),
      deadline?.html ?? "",
      `<div style="margin:24px 0 0;">${emailButton("Pay for Your Order", orderUrl)}</div>`,
    ].join("\n"),
  });

  const text = [
    `Your Pickup Order #${order.id} is confirmed.`,
    "Pay for your order online and we will get it ready for pickup.",
    "",
    "Your items:",
    ...items.map((i) => `${i.name}: ${i.amount}`),
    "",
    `Subtotal: ${formatPeso(order.subtotalInCentavos)}`,
    ...(discount > 0 ? [`Senior/PWD discount: -${formatPeso(discount)}`] : []),
    `Total amount to pay: ${formatPeso(total)}`,
    "",
    ...pickupInstructionLines(instructions, order),
    ...(deadline ? ["", deadline.text] : []),
    "",
    `Pay for Your Order: ${orderUrl}`,
  ].join("\n");

  return { subject: `Order #${order.id} confirmed`, html, text };
}

/** Sends the Customer the confirmation of an Online payment Pickup Order after Staff confirm it. */
export async function sendOrderOnlinePickupConfirmedEmail(recipient: string, order: Order, email?: { id: string }) {
  const { transport, sender } = createBrevoTransport();
  const message = renderOnlinePickupConfirmedEmail(order, viewOrderUrl(order.id), await loadPickupInstructions());
  const info = await transport.sendMail({ from: sender, to: recipient, ...message, ...stableMessageId(sender, email), attachments: [await logoAttachment()] });
  return typeof info?.messageId === "string" ? { messageId: info.messageId } : {};
}
