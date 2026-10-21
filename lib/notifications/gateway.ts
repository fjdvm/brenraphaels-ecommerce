import type { DueFeedbackRequest as FeedbackRequest } from "../orders/feedback-requests";
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

export type AppNotification = {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
};

/** Sends an in-app Notification to one Customer through the api-gateway's notifications service. */
export async function sendAppNotification(notification: AppNotification, fetcher: typeof fetch = fetch): Promise<void> {
  const base = required("API_GATEWAY_URL").replace(/\/$/, "");
  const { userId, ...content } = notification;
  const response = await fetcher(`${base}/notifications/notifications`, {
    method: "POST",
    headers: { Authorization: `Bearer ${required("API_GATEWAY_CALLER_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...content, sendingApp: "ecommerce", targetApp: "ecommerce", userIds: [userId] }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`The gateway refused the notification: ${response.status}`);
}

/** The same words for the email and the in-app Notification; the link lands on the Order's Feedback form. */
export function feedbackRequestContent(orderId: number, siteUrl: string) {
  return {
    title: `How was your Order #${orderId}?`,
    body: "Your Order from Bren Raphael's was delivered. Tell us how it went; your Feedback is private and helps us do better.",
    button: { label: "Give Feedback", link: `${siteUrl.replace(/\/$/, "")}/profile/orders?order=${orderId}` },
  };
}

/** Sends the Feedback request as an email and an in-app Notification; throws if either fails. */
export async function sendFeedbackRequest(request: FeedbackRequest, fetcher: typeof fetch = fetch): Promise<void> {
  const { title, body, button } = feedbackRequestContent(request.orderId, required("NEXT_PUBLIC_SITE_URL"));
  await sendAppEmail({ to: request.email, title, body, button }, fetcher);
  await sendAppNotification(
    { userId: request.customerId, type: "feedback.request", title, body, link: button.link },
    fetcher,
  );
}
