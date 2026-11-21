import { describe, expect, test, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: { name: "Shop", address: "s@x.com" } }),
  requiredEnvironment: () => "https://shop.test",
}));

import { renderOrderCancelledByShopEmail, sendOrderCancelledByShopEmail } from "@/lib/email/order-rejected-email";

const placed = { id: 9, status: "cancelled", subtotalInCentavos: 50000, totalInCentavos: null, confirmedAt: null, paidAt: null, cancelReason: "We don't deliver to that area yet" };
const orderUrl = "https://shop.test/profile/orders?order=9";
const shopUrl = "https://shop.test/products";

describe("Order rejected or cancelled by the shop email", () => {
  test("a rejected placed Order says we couldn't accept it, shows the reason and that nothing was charged", () => {
    const { subject, html, text } = renderOrderCancelledByShopEmail(placed as never, orderUrl, shopUrl);
    expect(subject).toBe("Order #9 could not be accepted");
    for (const body of [html, text]) {
      expect(body).toMatch(/We couldn(&#39;|')t accept your Order/);
      expect(body).toMatch(/We don(&#39;|')t deliver to that area yet/);
      expect(body).toContain("You have not been charged");
      expect(body).toContain("Shop again");
    }
    expect(html).toContain("#4A2373");
  });

  test("a paid Order cancelled after confirmation tells the Customer about the refund", () => {
    const paid = { ...placed, confirmedAt: new Date(), paidAt: new Date(), totalInCentavos: 55500, cancelReason: "Item damaged in packing" };
    const { subject, text } = renderOrderCancelledByShopEmail(paid as never, orderUrl, shopUrl);
    expect(subject).toBe("Order #9 cancelled");
    expect(text).toContain("Your Order was cancelled");
    expect(text).toContain("You paid ₱555");
    expect(text).toContain("refund");
    expect(text).not.toContain("not been charged");
  });

  test("omits the reason block without a reason and escapes the reason", () => {
    expect(renderOrderCancelledByShopEmail({ ...placed, cancelReason: null } as never, orderUrl, shopUrl).text).not.toContain("Reason:");
    expect(renderOrderCancelledByShopEmail({ ...placed, cancelReason: "<b>x</b>" } as never, orderUrl, shopUrl).html).not.toContain("<b>x</b>");
  });

  test("sends HTML, text and the logo with the stable message id", async () => {
    sendMail.mockReset().mockResolvedValue({ messageId: "m-1" });
    expect(await sendOrderCancelledByShopEmail("a@b.com", placed as never, { id: "order-9-cancelled-by-shop" })).toEqual({ messageId: "m-1" });
    const sent = sendMail.mock.calls[0][0];
    expect(sent.to).toBe("a@b.com");
    expect(sent.html).toContain(shopUrl);
    expect(sent.attachments[0].cid).toBe("bren-raphaels-logo");
  });
});
