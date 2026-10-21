export type ThankYouEmail = {
  title: string;
  body: string;
  button?: { label: string; link: string };
};

/** The same text for every rating, never quoting the comment; 1 to 3 stars add a link to support. */
export function thankYouEmail(rating: number, siteUrl: string): ThankYouEmail {
  const email: ThankYouEmail = {
    title: "Thank you for your Feedback",
    body: "We received your Feedback on your Order from Bren Raphael's. It is private and helps us do better.",
  };
  if (rating <= 3) {
    email.button = { label: "Contact support", link: `${siteUrl.replace(/\/$/, "")}/support/new` };
  }
  return email;
}
