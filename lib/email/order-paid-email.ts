import { formatPeso } from "../catalog/currency";
import type { Order } from "../orders/orders";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Sends the Customer confirmation once staff verify their GCash payment. */
export async function sendOrderPaidEmail(recipient: string, order: Order) {
  const { transport, sender } = createBrevoTransport();
  const total = order.subtotalInCentavos + (order.deliveryFeeInCentavos ?? 0);
  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} payment received`,
    text: [
      "We received your GCash payment for your Order from Bren Raphael's.",
      "",
      `Total paid: ${formatPeso(total)}`,
      "",
      `View your Order: ${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders`,
    ].join("\n"),
    to: recipient,
  });
}
