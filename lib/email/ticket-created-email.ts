import type { Ticket } from "../support/tickets";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Sends the Customer confirmation that their Ticket was opened. */
export async function sendTicketCreatedEmail(recipient: string, ticket: Ticket) {
  const { transport, sender } = createBrevoTransport();

  await transport.sendMail({
    from: sender,
    subject: `Ticket #${ticket.id} received`,
    text: [
      "Thank you for contacting Bren Raphael's Support.",
      "",
      `We received your Ticket #${ticket.id}: ${ticket.subject}`,
      `Category: ${ticket.category}`,
      ticket.orderId === null ? undefined : `Order: #${ticket.orderId}`,
      "",
      "We will reply as soon as we can. You can follow the conversation and add Messages any time.",
      "",
      `View your Ticket: ${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/support/${ticket.id}`,
    ]
      .filter((line) => line !== undefined)
      .join("\n"),
    to: recipient,
  });
}
