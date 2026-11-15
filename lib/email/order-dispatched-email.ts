import type { Order } from "../orders/orders";
import { createBrevoTransport } from "./brevo-transport";

/** Sent once, when Staff record the courier booking; carries the live tracking link and any rider details. */
export async function sendOrderDispatchedEmail(recipient: string, order: Order) {
  if (!order.courier) return;
  const { courier } = order;
  const { transport, sender } = createBrevoTransport();
  const rider = [
    courier.riderName && `Rider: ${courier.riderName}`,
    courier.riderPlate && `Plate no.: ${courier.riderPlate}`,
    courier.riderPhone && `Rider contact: ${courier.riderPhone}`,
  ].filter((line): line is string => Boolean(line));
  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} is on its way`,
    text: [
      `Your order is on the way! Order #${order.id} has been dispatched with ${courier.name}.`,
      "",
      `Track your delivery: ${courier.trackingUrl}`,
      ...(rider.length ? ["", `Courier: ${courier.name}`, ...rider] : []),
      "",
      `The tracking link is from ${courier.name} and may stop working after delivery. You can always see your rider details in My orders.`,
    ].join("\n"),
    to: recipient,
  });
}
