import type { Ticket } from "../support/tickets";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Thanks the Customer after they complete their Ticket. */
export async function sendTicketCompletedEmail(recipient: string, ticket: Ticket) {
  const { transport, sender } = createBrevoTransport();

  await transport.sendMail({
    from: sender,
    subject: `Ticket #${ticket.id} completed`,
    text: [
      "Thank you for letting us know. We're glad we could help.",
      "",
      `Your Ticket #${ticket.id} (${ticket.subject}) is now completed.`,
      "",
      "If something else comes up, you can open a new Ticket any time:",
      `${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/support/new`,
    ].join("\n"),
    to: recipient,
  });
}
