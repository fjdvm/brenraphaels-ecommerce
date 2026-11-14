import type { Order } from "../orders/orders";
import { createBrevoTransport } from "./brevo-transport";

/** Sent once, when Staff record the courier booking; carries the live tracking link. */
export async function sendOrderDispatchedEmail(recipient: string, order: Order) {
  if (!order.courier) return;
  const { transport, sender } = createBrevoTransport();
  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} is on its way`,
    text: [
      `Your Order from Bren Raphael's has been dispatched with ${order.courier.name}.`,
      "",
      `Track your delivery: ${order.courier.trackingUrl}`,
    ].join("\n"),
    to: recipient,
  });
}
