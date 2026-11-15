import type { Order } from "../orders/orders";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Tells the Customer why their payment proof was not accepted and links them to upload again. */
export async function sendPaymentRejectedEmail(recipient: string, order: Order, reason: string) {
  const { transport, sender } = createBrevoTransport();
  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} payment proof not accepted`,
    text: [
      "We couldn't accept the payment proof for your Order from Bren Raphael's.",
      "",
      `Reason: ${reason}`,
      "",
      "Your Order is still waiting for payment. Please upload your payment proof again:",
      `${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders?order=${order.id}`,
    ].join("\n"),
    to: recipient,
  });
}
