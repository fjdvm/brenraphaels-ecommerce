import { createBrevoTransport, requiredEnvironment } from "./brevo-transport";

/** Tells the Customer the result of their ID check, once. Never carries the ID number. */
export async function sendSeniorPwdDecisionEmail(
  recipient: string,
  decision: { status: "approved" | "declined" | "revoked"; expiresOn: string | null; reason: string | null },
) {
  const { transport, sender } = createBrevoTransport();
  const shop = requiredEnvironment("NEXT_PUBLIC_SITE_URL");
  const text = decision.status === "approved"
    ? ["Your Senior Citizen / PWD ID is verified.", "",
      `You get 5% off one item per order until your ID expires on ${decision.expiresOn}. We deleted the photo and keep only that you're verified.`]
    : decision.status === "declined"
      ? ["We couldn't approve your Senior Citizen / PWD ID.", "", `Reason: ${decision.reason}`, "",
        "Your order continues at full price. You can send your ID again at checkout on a new order."]
      : ["Your Senior Citizen / PWD verification was withdrawn.", "", `Reason: ${decision.reason}`, "",
        "The 5% discount no longer applies to new orders."];
  await transport.sendMail({
    from: sender, to: recipient,
    subject: `Your Senior Citizen / PWD ID: ${decision.status}`,
    text: [...text, "", shop].join("\n"),
  });
}
