import type { Order } from "../orders/orders";
import { FEE_TO_FOLLOW_COPY } from "@/lib/orders/fee-to-follow-copy";
import { formatPeso } from "../catalog/currency";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Sends the Customer confirmation that their Order was placed. */
export async function sendOrderPlacedEmail(recipient: string, order: Order) {
  const freeDelivery = order.fulfillmentMethod === "delivery" && order.subtotalInCentavos > 250_000 && order.deliveryFeeInCentavos === 0;
  const { transport, sender } = createBrevoTransport();
  const lines = order.lines.map((line) => (
    `${line.productName} — ${line.sizeLabel} × ${line.quantity}: ${formatPeso(line.priceInCentavos * line.quantity)}`
  ));

  await transport.sendMail({
    from: sender,
    subject: freeDelivery ? `Order confirmed · free delivery · #${order.id}` : `Order #${order.id} ${order.fulfillmentMethod === "delivery" ? "placed" : "confirmed"}`,
    text: [
      "Thank you for your order from Bren Raphael's.",
      "",
      freeDelivery ? "Your Order is confirmed with free delivery. No quote is needed." : order.fulfillmentMethod === "delivery"
        ? `Your Delivery Order is placed. ${FEE_TO_FOLLOW_COPY}`
        : "Your Pickup Order is confirmed. Please pay cash when you collect it.",
      "",
      "Your items:",
      ...lines,
      "",
      `Subtotal: ${formatPeso(order.subtotalInCentavos)}`,
      freeDelivery ? "Delivery fee: Free (₱0.00)" : order.fulfillmentMethod === "delivery" ? "Delivery fee: To be confirmed" : "Delivery fee: None (Pickup)",
      "",
      `View your order: ${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders`,
    ].join("\n"),
    to: recipient,
  });
}
