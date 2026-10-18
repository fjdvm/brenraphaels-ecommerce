import type { ContactMessage } from "../contact/contact-message";
import { email as shopEmail } from "../site/store-info";
import { createBrevoTransport } from "./brevo-transport";

/** Emails a contact-form message to the shop; the Customer's address is the reply-to. */
export async function sendContactMessageEmail(message: ContactMessage) {
  const { transport, sender } = createBrevoTransport();

  await transport.sendMail({
    from: sender,
    replyTo: { address: message.email, name: message.name },
    subject: `Contact form (${message.topic}): ${message.name || message.email}`,
    text: [
      `Name: ${message.name || "(not given)"}`,
      `Email: ${message.email}`,
      `Phone: ${message.phone || "(not given)"}`,
      `Topic: ${message.topic}`,
      "",
      message.comment,
    ].join("\n"),
    to: shopEmail,
  });
}
