import type { Order } from "../orders/orders";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Confirms that a Customer's Order was cancelled before dispatch. */
export async function sendOrderCancelledEmail(recipient: string, order: Order) {
  const { transport, sender } = createBrevoTransport();
  await transport.sendMail({
    from: sender,
    subject: `Order #${order.id} cancelled`,
    text: [
      `Your Order #${order.id} from Bren Raphael's has been cancelled.`,
      "",
      "You can view your Order history at:",
      `${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/profile/orders`,
    ].join("\n"),
    to: recipient,
  });
}
