import { formatPeso } from "../catalog/currency";
import { formatAddressLine } from "../address/format";
import type { Order } from "../orders/orders";
import { createBrevoTransport } from "./brevo-transport";
import { stableMessageId } from "./stable-message-id";
import { EMAIL_TOKENS as t, emailButton, emailHeading, emailParagraph, escapeHtml, logoAttachment, renderEmailLayout } from "./layout";
import { totalPayableUponDelivery } from "./order-delivery-confirmed-email";
import { viewOrderUrl } from "./order-pickup-confirmed-email";

function row(label: string, value: string, strong = false) {
  const style = `padding:6px 0;font-family:${t.sans};font-size:${strong ? 16 : 14}px;line-height:21px;${strong ? `font-weight:500;color:${t.ink}` : `color:${t.body}`};`;
  return `<tr><td style="${style}">${escapeHtml(label)}</td><td align="right" style="${style}">${escapeHtml(value)}</td></tr>`;
}

/** Builds the subject, HTML and plain text of the Online payment + Delivery confirmation, so tests can render it without sending. */
export function renderOnlineDeliveryConfirmedEmail(order: Order, orderUrl: string) {
  const discount = order.approvedDiscountInCentavos ?? 0;
  const fee = order.deliveryFeeInCentavos ?? 0;
  const feeText = fee === 0 ? "Free" : formatPeso(fee);
  const total = totalPayableUponDelivery(order);
  const address = order.deliveryAddress ? formatAddressLine(order.deliveryAddress) : null;
  const items = order.lines.map((l) => ({ name: `${l.productName} — ${l.sizeLabel} × ${l.quantity}`, amount: formatPeso(l.priceInCentavos * l.quantity) }));
  const border = `margin:8px 0 0;border-top:1px solid ${t.line};`;

  const addressBlock = address
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:${t.lavenderSoft};border:1px solid ${t.line};"><tr><td style="padding:20px;">
<p style="margin:0 0 10px;font-family:${t.sans};font-size:12px;line-height:18px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${t.primary};">Delivery address</p>
<p style="margin:0;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.body};">${escapeHtml(address)}</p>
</td></tr></table>`
    : "";

  const html = renderEmailLayout({
    preheader: `Order #${order.id} is confirmed. Pay ${formatPeso(total)} online and we will deliver it.`,
    content: [
      emailHeading(`Order #${order.id}`, "Your Delivery Order is confirmed"),
      emailParagraph("Thank you for ordering from Bren Raphael's. Pay for your order online and we will deliver it to your address."),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${border}">${items.map((i) => row(i.name, i.amount)).join("")}</table>`,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${border}">${row("Subtotal", formatPeso(order.subtotalInCentavos))}${discount > 0 ? row("Senior/PWD discount", `-${formatPeso(discount)}`) : ""}${row("Delivery fee", feeText)}${row("Total amount to pay", formatPeso(total), true)}</table>`,
      addressBlock,
      `<div style="margin:24px 0 0;">${emailButton("Pay for Your Order", orderUrl)}</div>`,
    ].join("\n"),
  });

  const text = [
    `Your Delivery Order #${order.id} is confirmed.`,
    "Pay for your order online and we will deliver it to your address.",
    "",
    "Your items:",
    ...items.map((i) => `${i.name}: ${i.amount}`),
    "",
    `Subtotal: ${formatPeso(order.subtotalInCentavos)}`,
    ...(discount > 0 ? [`Senior/PWD discount: -${formatPeso(discount)}`] : []),
    `Delivery fee: ${feeText}`,
    `Total amount to pay: ${formatPeso(total)}`,
    ...(address ? ["", `Delivery address: ${address}`] : []),
    "",
    `Pay for Your Order: ${orderUrl}`,
  ].join("\n");

  return { subject: `Order #${order.id} confirmed`, html, text };
}

/** Sends the Customer the confirmation of an Online payment Delivery Order once its fee is confirmed. */
export async function sendOrderOnlineDeliveryConfirmedEmail(recipient: string, order: Order, email?: { id: string }) {
  const { transport, sender } = createBrevoTransport();
  const message = renderOnlineDeliveryConfirmedEmail(order, viewOrderUrl(order.id));
  const info = await transport.sendMail({ from: sender, to: recipient, ...message, ...stableMessageId(sender, email), attachments: [await logoAttachment()] });
  return typeof info?.messageId === "string" ? { messageId: info.messageId } : {};
}
