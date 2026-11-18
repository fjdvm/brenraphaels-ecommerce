import type { Order } from "../orders/orders";
import { FEE_TO_FOLLOW_COPY } from "@/lib/orders/fee-to-follow-copy";
import { FREE_DELIVERY_CONFIRMATION_NOTICE } from "@/lib/orders/free-delivery";
import { formatPeso } from "../catalog/currency";
import { loadPickupInstructions, pickupInstructionLines } from "../pickup/instructions";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Sends the Customer confirmation that their Order was placed. */
export async function sendOrderPlacedEmail(recipient: string, order: Order) {
  const { transport, sender } = createBrevoTransport();
  const lines = order.lines.map((line) => (
    `${line.productName} — ${line.sizeLabel} × ${line.quantity}: ${formatPeso(line.priceInCentavos * line.quantity)}`
  ));

  const pickup = order.fulfillmentMethod === "pickup" ? pickupInstructionLines(await loadPickupInstructions(), order) : [];

  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} ${order.fulfillmentMethod === "delivery" ? "placed" : "confirmed"}`,
    text: [
      "Thank you for your order from Bren Raphael's.",
      "",
      order.fulfillmentMethod === "delivery"
        ? `Your Delivery Order is placed. ${order.freeDelivery ? `Delivery: Free. ${FREE_DELIVERY_CONFIRMATION_NOTICE}.` : FEE_TO_FOLLOW_COPY}`
        : "Your Pickup Order is confirmed. Please pay cash when you collect it.",
      "",
      ...(pickup.length ? [...pickup, ""] : []),
      "Your items:",
      ...lines,
      "",
      `Subtotal: ${formatPeso(order.subtotalInCentavos)}`,
      order.fulfillmentMethod === "delivery" ? (order.freeDelivery ? "Delivery fee: Free" : "Delivery fee: To be confirmed") : "Delivery fee: None (Pickup)",
      "",
      `View your order: ${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders`,
    ].join("\n"),
    to: recipient,
  });
}
