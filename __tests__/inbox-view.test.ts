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
    ["order.delivery-fee", "fee"],
    ["order.payment-needed", "payment"],
    ["order.dispatched", "delivery"],
    ["order.delivered", "confirmed"],
    ["order.cancelled", "cancelled"],
    ["ticket.reply", "support"],
    ["return.approved", "return"],
    ["return.declined", "return"],
    ["feedback.request", "feedback"],
    ["order.something-new", "order"],
  ])("%s shows the %s icon", (type, icon) => {
    expect(iconOf({ type })).toBe(icon);
  });

  test.each(["order.delivery-fee", "order.payment-needed", "order.dispatched", "order.delivered", "order.cancelled", "return.requested", "feedback.request"])(
    "%s is filed under orders",
    (type) => expect(categoryOf({ type })).toBe("orders"),
  );

  test("a link into the storefront becomes a local path", () => {
    expect(linkTarget("https://shop.test/profile/orders?order=7", "https://shop.test")).toBe("/profile/orders?order=7");
  });

  test("another site's link, or a link with no site configured, is left as written", () => {
    expect(linkTarget("https://elsewhere.test/a", "https://shop.test")).toBe("https://elsewhere.test/a");
    expect(linkTarget("https://shop.test/a", undefined)).toBe("https://shop.test/a");
    expect(linkTarget("/profile/orders", "https://shop.test")).toBe("/profile/orders");
  });
});
