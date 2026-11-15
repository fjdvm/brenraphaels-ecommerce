import { feedbackRequestContent } from "./feedback-request-content";
export { feedbackRequestContent } from "./feedback-request-content";
import type { DueFeedbackRequest as FeedbackRequest } from "../orders/feedback-requests";
import { postToGateway, required } from "../gateway";
import { thankYouEmail } from "../orders/feedback-thank-you";

export type AppEmail = {
  idempotencyKey?: string;
  to: string;
  title: string;
  body: string;
  button?: { label: string; link: string };
};

/** Queues an App email through the api-gateway's notifications service, as the storefront's Caller. */
export function sendAppEmail(email: AppEmail, fetcher: typeof fetch = fetch): Promise<void> {
  return postToGateway("/notifications/emails/app", { ...email, app: "ecommerce" }, "email", fetcher, email.idempotencyKey);
}

/** Queues the Feedback thank-you email. */
export function queueFeedbackThankYou(recipient: string, rating: number): Promise<void> {
  return sendAppEmail({ to: recipient, ...thankYouEmail(rating, required("NEXT_PUBLIC_SITE_URL")) });
}

export type AppNotification = {
  idempotencyKey?: string;
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

/** Sends the Feedback request email. Recording the request stores its Notification in the outbox. */
export async function sendFeedbackRequest(request: FeedbackRequest, fetcher: typeof fetch = fetch): Promise<void> {
  const { title, body, button } = feedbackRequestContent(request.orderId, required("NEXT_PUBLIC_SITE_URL"));
  await sendAppEmail({ to: request.email, title, body, button }, fetcher);
}

/** Tells CREOMS to discover new Orders; it owns alert contents and Staff eligibility. */
export function sendOrderPlacedSignal(fetcher: typeof fetch = fetch): Promise<void> {
  return postToGateway("/creoms/notifications/signal", { kind: "Order" }, "Order signal", fetcher);
}
