import type { Order } from "../orders/orders";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** The one email after the third rejected proof: why, and that a Manager now reviews the payment. It replaces the normal rejection email. */
export async function sendPaymentUnderReviewEmail(recipient: string, order: Order, reason: string) {
  const { transport, sender } = createBrevoTransport();
  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} payment is under Manager review`,
    text: [
      "We couldn't accept the third payment proof for your Order from Bren Raphael's.",
      "",
      `Reason: ${reason}`,
      "",
      "Your payment is under Manager review, so you can't send another proof. We will contact you once it is decided.",
      `${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders?order=${order.id}`,
    ].join("\n"),
    to: recipient,
  });
}
