import { formatPeso } from "../catalog/currency";
import type { Order } from "../orders/orders";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Sends the Customer the total after staff confirm a Delivery fee. */
export async function sendOrderConfirmedEmail(recipient: string, order: Order) {
  if (order.deliveryFeeInCentavos === null) {
    throw new Error("A confirmed Delivery Order must include its Delivery fee.");
  }

  const { transport, sender } = createBrevoTransport();
  const total = order.subtotalInCentavos + order.deliveryFeeInCentavos;
  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} confirmed`,
    text: [
      "Your Delivery Order from Bren Raphael's is confirmed.",
      "",
      `Items subtotal: ${formatPeso(order.subtotalInCentavos)}`,
      `Delivery fee: ${formatPeso(order.deliveryFeeInCentavos)}`,
      `Updated total: ${formatPeso(total)}`,
      "",
      "Not okay with the fee? You can cancel for free from My orders before we pack your order.",
      "",
      `View your Order: ${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders`,
    ].join("\n"),
    to: recipient,
  });
}
