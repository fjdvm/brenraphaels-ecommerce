import type { Order } from "../orders/orders";
import { createBrevoTransport } from "./brevo-transport";

/** Sent once, when Staff record the courier booking; carries the live tracking link when there is one. Rider details are for Staff only and never go to the Customer. */
export async function sendOrderDispatchedEmail(recipient: string, order: Order) {
  if (!order.courier) return;
  const { courier } = order;
  const { transport, sender } = createBrevoTransport();
  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} is on its way`,
    text: [
      `Your order is on the way! Order #${order.id} has been dispatched with ${courier.name}.`,
      "",
      ...(courier.trackingUrl
        ? [`Track your delivery: ${courier.trackingUrl}`, "", `The tracking link is from ${courier.name} and may stop working after delivery.`]
        : [`Courier: ${courier.name}`, "A tracking link is not available yet."]),
    ].join("\n"),
    to: recipient,
  });
}
