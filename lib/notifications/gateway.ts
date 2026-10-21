import { thankYouEmail } from "../orders/feedback-thank-you";

export type AppEmail = {
  to: string;
  title: string;
  body: string;
  button?: { label: string; link: string };
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; see .env.production.example`);
  return value;
}

/** Queues an App email through the api-gateway's notifications service, as the storefront's Caller. */
export async function sendAppEmail(email: AppEmail, fetcher: typeof fetch = fetch): Promise<void> {
  const base = required("API_GATEWAY_URL").replace(/\/$/, "");
  const response = await fetcher(`${base}/notifications/emails/app`, {
    method: "POST",
    headers: { Authorization: `Bearer ${required("API_GATEWAY_CALLER_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...email, app: "ecommerce" }),
    // A hung gateway must not hold up the Customer's submit.
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`The gateway refused the email: ${response.status}`);
}

/** Queues the Feedback thank-you email. */
export function queueFeedbackThankYou(recipient: string, rating: number): Promise<void> {
  return sendAppEmail({ to: recipient, ...thankYouEmail(rating, required("NEXT_PUBLIC_SITE_URL")) });
}
