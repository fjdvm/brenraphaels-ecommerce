import { describe, expect, test } from "vitest";

import { categoryOf, iconOf, linkTarget } from "@/lib/notifications/inbox-view";

describe("Inbox rows", () => {
  test.each([
    ["ticket.reply", "support"],
    ["order.delivered", "orders"],
    ["feedback.request", "orders"],
  ])("%s is filed under %s", (type, category) => {
    expect(categoryOf({ type })).toBe(category);
  });

  test.each([
    ["ticket.reply", "support"],
    ["payment.needed", "payment"],
    ["order.delivered", "confirmed"],
    ["feedback.request", "confirmed"],
    ["order.dispatched", "delivery"],
    ["order.something-new", "order"],
  ])("%s shows the %s icon", (type, icon) => {
    expect(iconOf({ type })).toBe(icon);
  });

  test("a link into the storefront becomes a local path", () => {
    expect(linkTarget("https://shop.test/profile/orders?order=7", "https://shop.test")).toBe("/profile/orders?order=7");
  });

  test("another site's link, or a link with no site configured, is left as written", () => {
    expect(linkTarget("https://elsewhere.test/a", "https://shop.test")).toBe("https://elsewhere.test/a");
    expect(linkTarget("https://shop.test/a", undefined)).toBe("https://shop.test/a");
    expect(linkTarget("/profile/orders", "https://shop.test")).toBe("/profile/orders");
  });
});
