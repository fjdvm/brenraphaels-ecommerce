import type { Ticket } from "../support/tickets";
import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Tells the Customer their Resolved Ticket was completed after 3 days without a reply. */
export async function sendTicketAutoCompletedEmail(recipient: string, ticket: Ticket) {
  const { transport, sender } = createBrevoTransport();

  await transport.sendMail({
    from: sender,
    subject: `Ticket #${ticket.id} completed`,
    text: [
      "Thank you for contacting us. We're glad we could help.",
      "",
      `Your Ticket #${ticket.id} (${ticket.subject}) was marked resolved and has been closed after 3 days without a reply, so it is now completed.`,
      "",
      "If something else comes up, you can open a new Ticket any time:",
      `${requiredEnvironment("NEXT_PUBLIC_SITE_URL")}/support/new`,
    ].join("\n"),
    to: recipient,
  });
}
