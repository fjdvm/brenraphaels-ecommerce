import type { Order } from "../orders/orders";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Invites a Customer to leave optional private Feedback after delivery. */
export async function sendOrderDeliveredEmail(recipient: string, order: Order) {
  const { transport, sender } = createBrevoTransport();
  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} delivered`,
    text: [
      "Your Order from Bren Raphael's has been delivered.",
      "",
      "If you would like, you can leave private Feedback from your Order history.",
      "",
      `View your Order: ${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders`,
    ].join("\n"),
    to: recipient,
  });
}
