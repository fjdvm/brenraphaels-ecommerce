import { describe, expect, test } from "vitest";

import { thankYouEmail } from "../lib/orders/feedback-thank-you";

const siteUrl = "https://shop.example.com";

describe("Feedback thank-you email", () => {
  test("says the same thing for every rating", () => {
    const [first, ...others] = [1, 2, 3, 4, 5].map((rating) => thankYouEmail(rating, siteUrl));

    for (const other of others) {
      expect(other.title).toBe(first.title);
      expect(other.body).toBe(first.body);
    }
  });

  test("links to support only for 1 to 3 stars", () => {
    for (const rating of [1, 2, 3]) {
      expect(thankYouEmail(rating, siteUrl).button).toEqual({ label: "Contact support", link: "https://shop.example.com/support/new" });
    }
    for (const rating of [4, 5]) {
      expect(thankYouEmail(rating, siteUrl).button).toBeUndefined();
    }
  });

  test("tolerates a trailing slash on the site address", () => {
    expect(thankYouEmail(1, `${siteUrl}/`).button?.link).toBe("https://shop.example.com/support/new");
  });
});
