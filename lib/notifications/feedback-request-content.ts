/** The same words for the email and the in-app Notification; the link lands on the Order's Feedback form. */
export function feedbackRequestContent(orderId: number, siteUrl: string) {
  return {
    title: `How was your Order #${orderId}?`,
    body: "Your Order from Bren Raphael's was delivered. Tell us how it went; your Feedback is private and helps us do better.",
    button: { label: "Give Feedback", link: `${siteUrl.replace(/\/$/, "")}/profile/orders?order=${orderId}` },
  };
}

