import type { Order } from "../orders/orders";
import { formatPeso } from "../catalog/currency";
import { createBrevoTransport } from "./brevo-transport";

/** Sends the Customer the confirmation for a successfully placed Order. */
export async function sendOrderPlacedEmail(recipient: string, order: Order) {
  const { transport, sender } = createBrevoTransport();
  const lines = order.lines.map((line) => (
    `${line.productName} — ${line.sizeLabel} × ${line.quantity}: ${formatPeso(line.priceInCentavos * line.quantity)}`
  ));

  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} confirmed`,
    text: [
      "Thank you for your order from Bren Raphael's.",
      "",
      "Your Pickup order is confirmed. Please pay cash when you collect it.",
      "",
      "Your items:",
      ...lines,
      "",
      `Subtotal: ${formatPeso(order.subtotalInCentavos)}`,
      "Delivery fee: None (Pickup)",
      "",
      `View your order: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://brenraphaels.com"}/profile/orders`,
    ].join("\n"),
    to: recipient,
  });
}
