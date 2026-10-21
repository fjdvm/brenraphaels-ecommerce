import type { DueFeedbackRequest as FeedbackRequest } from "../orders/feedback-requests";
import { postToGateway, required } from "../gateway";
import { thankYouEmail } from "../orders/feedback-thank-you";

export type AppEmail = {
  to: string;
  title: string;
  body: string;
  button?: { label: string; link: string };
};

/** Queues an App email through the api-gateway's notifications service, as the storefront's Caller. */
export function sendAppEmail(email: AppEmail, fetcher: typeof fetch = fetch): Promise<void> {
  return postToGateway("/notifications/emails/app", { ...email, app: "ecommerce" }, "email", fetcher);
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
export function sendAppNotification(notification: AppNotification, fetcher: typeof fetch = fetch): Promise<void> {
  const { userId, ...content } = notification;
  return postToGateway(
    "/notifications/notifications",
    { ...content, sendingApp: "ecommerce", targetApp: "ecommerce", userIds: [userId] },
    "notification",
    fetcher,
  );
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
