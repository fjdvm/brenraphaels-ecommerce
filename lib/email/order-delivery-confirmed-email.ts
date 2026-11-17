import { formatPeso } from "../catalog/currency";
import { formatAddressLine } from "../address/format";
import type { Order } from "../orders/orders";
import { createBrevoTransport } from "./brevo-transport";
import { EMAIL_TOKENS as t, emailButton, emailHeading, emailParagraph, escapeHtml, logoAttachment, renderEmailLayout } from "./layout";
import { viewOrderUrl } from "./order-pickup-confirmed-email";

/** The amount to pay the rider: the confirmed total, or subtotal less discount plus the Delivery fee before one is saved. */
export function totalPayableUponDelivery(order: Order) {
  return order.totalInCentavos ?? order.subtotalInCentavos - (order.approvedDiscountInCentavos ?? 0) + (order.deliveryFeeInCentavos ?? 0);
}

function row(label: string, value: string, strong = false) {
  const style = `padding:6px 0;font-family:${t.sans};font-size:${strong ? 16 : 14}px;line-height:21px;${strong ? `font-weight:500;color:${t.ink}` : `color:${t.body}`};`;
  return `<tr><td style="${style}">${escapeHtml(label)}</td><td align="right" style="${style}">${escapeHtml(value)}</td></tr>`;
}

/** Builds the subject, HTML and plain text of the COD + Delivery confirmation, so tests can render it without sending. */
export function renderDeliveryConfirmedEmail(order: Order, orderUrl: string) {
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
    preheader: `Order #${order.id} is confirmed. Pay ${formatPeso(total)} in cash when it arrives.`,
    content: [
      emailHeading(`Order #${order.id}`, "Your Delivery Order is confirmed"),
      emailParagraph("Thank you for ordering from Bren Raphael's. Pay in cash to the rider when your order arrives."),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${border}">${items.map((i) => row(i.name, i.amount)).join("")}</table>`,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${border}">${row("Subtotal", formatPeso(order.subtotalInCentavos))}${discount > 0 ? row("Senior/PWD discount", `-${formatPeso(discount)}`) : ""}${row("Delivery fee", feeText)}${row("Total payable upon delivery", formatPeso(total), true)}</table>`,
      addressBlock,
      `<div style="margin:24px 0 0;">${emailButton("View Order", orderUrl)}</div>`,
    ].join("\n"),
  });

  const text = [
    `Your Delivery Order #${order.id} is confirmed.`,
    "Pay in cash to the rider when your order arrives.",
    "",
    "Your items:",
    ...items.map((i) => `${i.name}: ${i.amount}`),
    "",
    `Subtotal: ${formatPeso(order.subtotalInCentavos)}`,
    ...(discount > 0 ? [`Senior/PWD discount: -${formatPeso(discount)}`] : []),
    `Delivery fee: ${feeText}`,
    `Total payable upon delivery: ${formatPeso(total)}`,
    ...(address ? ["", `Delivery address: ${address}`] : []),
    "",
    `View Order: ${orderUrl}`,
  ].join("\n");

  return { subject: `Order #${order.id} confirmed`, html, text };
}

/** Sends the Customer the confirmation of a Cash on Delivery Delivery Order once its fee is confirmed. */
export async function sendOrderDeliveryConfirmedEmail(recipient: string, order: Order) {
  const { transport, sender } = createBrevoTransport();
  const message = renderDeliveryConfirmedEmail(order, viewOrderUrl(order.id));
  await transport.sendMail({ from: sender, to: recipient, ...message, attachments: [await logoAttachment()] });
}
