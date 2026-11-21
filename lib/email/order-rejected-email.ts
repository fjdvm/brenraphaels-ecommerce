import { formatPeso } from "../catalog/currency";
import type { Order } from "../orders/orders";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";
import { stableMessageId } from "./stable-message-id";
import { EMAIL_TOKENS as t, emailButton, emailHeading, emailParagraph, emailSecondaryButton, escapeHtml, logoAttachment, renderEmailLayout } from "./layout";
import { viewOrderUrl } from "./order-pickup-confirmed-email";

/** The email kind recorded in `order_email_outcomes` when Staff reject or cancel an Order from CREOMS. */
export const ORDER_CANCELLED_BY_SHOP_EMAIL_KIND = "cancelled-by-shop";

/**
 * Builds the email a Customer gets when Staff reject a placed Order or cancel one before it is dispatched: Staff's
 * reason, whether any money is owed back, and links to the Order and the shop. "We couldn't accept your Order" before
 * confirmation; "Your Order was cancelled" after.
 */
export function renderOrderCancelledByShopEmail(order: Order, orderUrl: string, shopUrl: string) {
  const rejected = !order.confirmedAt;
  const title = rejected ? "We couldn't accept your Order" : "Your Order was cancelled";
  const reason = order.cancelReason?.trim() || null;
  const paid = Boolean(order.paidAt);
  const money = paid
    ? `You paid ${formatPeso(order.totalInCentavos ?? order.subtotalInCentavos)} for this Order. Our team will contact you about your refund.`
    : "You have not been charged for this Order.";
  const stock = "The items are back in stock for other orders.";

  const reasonBlock = reason
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;background:${t.lavenderSoft};border:1px solid ${t.line};"><tr><td style="padding:20px;">
<p style="margin:0 0 10px;font-family:${t.sans};font-size:12px;line-height:18px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${t.primary};">Reason</p>
<p style="margin:0;font-family:${t.sans};font-size:14px;line-height:21px;color:${t.body};">${escapeHtml(reason)}</p>
</td></tr></table>`
    : "";

  const html = renderEmailLayout({
    preheader: `${title}: Order #${order.id}.${reason ? ` ${reason}` : ""}`,
    content: [
      emailHeading(`Order #${order.id}`, title),
      emailParagraph(rejected
        ? "Thank you for ordering from Bren Raphael's. We're sorry, we couldn't accept this Order."
        : "We're sorry, we had to cancel this Order."),
      reasonBlock,
      emailParagraph(money),
      emailParagraph(stock),
      `<div style="margin:24px 0 0;">${emailSecondaryButton("View Order", orderUrl)}&nbsp;&nbsp;${emailButton("Shop again", shopUrl)}</div>`,
    ].join("\n"),
  });

  const text = [
    `${title}: Order #${order.id} from Bren Raphael's.`,
    ...(reason ? ["", `Reason: ${reason}`] : []),
    "",
    money,
    stock,
    "",
    `View Order: ${orderUrl}`,
    `Shop again: ${shopUrl}`,
  ].join("\n");

  return { subject: rejected ? `Order #${order.id} could not be accepted` : `Order #${order.id} cancelled`, html, text };
}

/** Sends the shop-cancellation email. Recorded once per Order by the caller, so a repeat never sends a second. */
export async function sendOrderCancelledByShopEmail(recipient: string, order: Order, email?: { id: string }) {
  const { transport, sender } = createBrevoTransport();
  const shopUrl = `${requiredEnvironment("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "")}/products`;
  const message = renderOrderCancelledByShopEmail(order, viewOrderUrl(order.id), shopUrl);
  const info = await transport.sendMail({ from: sender, to: recipient, ...message, ...stableMessageId(sender, email), attachments: [await logoAttachment()] });
  return typeof info?.messageId === "string" ? { messageId: info.messageId } : {};
}
