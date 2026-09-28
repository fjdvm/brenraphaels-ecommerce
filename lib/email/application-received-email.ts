import { createBrevoTransport } from "./brevo-transport";

/** Sends the local confirmation immediately; HR-ATS delivery is asynchronous. */
export async function sendApplicationReceivedEmail(recipient: string, application: { referenceNumber: string; jobTitle: string }) {
  const { transport, sender } = createBrevoTransport();
  await transport.sendMail({
    from: sender,
    to: recipient,
    subject: `Application received — ${application.referenceNumber}`,
    text: [
      "Thank you for applying to Bren Raphael's.",
      "",
      `We received your Application for ${application.jobTitle}.`,
      `Your permanent Reference number is ${application.referenceNumber}.`,
      "Keep this Reference number for your records.",
    ].join("\n"),
  });
}
