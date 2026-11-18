import { describe, expect, test, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: "s@x.com" }),
  requiredEnvironment: () => "https://shop.test",
}));

vi.mock("@/lib/pickup/instructions", async (original) => ({ ...(await original<object>()), loadPickupInstructions: async () => null }));

import { renderOnlinePickupConfirmedEmail, sendOrderOnlinePickupConfirmedEmail } from "@/lib/email/order-online-pickup-confirmed-email";

const base = {
  id: 9, fulfillmentMethod: "pickup", paymentMethod: "gcash", status: "confirmed",
  subtotalInCentavos: 50000, deliveryFeeInCentavos: null, approvedDiscountInCentavos: 2500, totalInCentavos: 47500,
  lines: [{ productName: "Ube Halaya", sizeLabel: "250g", priceInCentavos: 25000, quantity: 2 }],
};
const order = base as never;
const url = "https://shop.test/profile/orders?order=9";

describe("Online payment + Pickup confirmation email", () => {
  test("shows items, discount, total amount to pay and Pay for Your Order", () => {
    const { html, text, subject } = renderOnlinePickupConfirmedEmail(order, url);
    expect(subject).toBe("Order #9 confirmed");
    for (const body of [html, text]) {
      expect(body).toContain("Ube Halaya — 250g × 2");
      expect(body).toContain("Senior/PWD discount");
      expect(body).toContain("Total amount to pay");
      expect(body).toContain("₱475");
      expect(body).toContain("Pay for Your Order");
      expect(body).toContain(url);
    }
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain(">Pay for Your Order<");
    expect(html).toContain("#4A2373");
    expect(html).not.toContain("View Order");
  });

  test("omits the discount line without one and falls back to subtotal less discount", () => {
    const noDiscount = { ...base, approvedDiscountInCentavos: 0, totalInCentavos: null } as never;
    const { html, text } = renderOnlinePickupConfirmedEmail(noDiscount, url);
    for (const body of [html, text]) {
      expect(body).not.toContain("Senior/PWD discount");
      expect(body).toContain("₱500");
    }
  });

  test("carries the pickup instructions, and the original-ID reminder only when a discount applies", () => {
    const instructions = { address: "1 Ube St, Makati", hours: "Mon-Sat 9-5", note: "Ring the bell" };
    const withDiscount = renderOnlinePickupConfirmedEmail(order, url, instructions);
    for (const body of [withDiscount.html, withDiscount.text]) {
      expect(body).toContain("1 Ube St, Makati");
      expect(body).toContain("Mon-Sat 9-5");
      expect(body).toContain("original Senior Citizen or PWD ID");
    }
    const noDiscount = renderOnlinePickupConfirmedEmail({ ...base, approvedDiscountInCentavos: 0, totalInCentavos: null } as never, url, instructions);
    expect(noDiscount.text).toContain("1 Ube St, Makati");
    expect(noDiscount.text).not.toContain("original Senior Citizen or PWD ID");
  });

  test("shows the saved payment deadline", () => {
    const placed = { ...base, createdAt: new Date("2026-11-18T06:14:00Z") } as never;
    const { html, text } = renderOnlinePickupConfirmedEmail(placed, url);
    for (const body of [html, text]) expect(body).toContain("Pay by Nov 19, 2026 · 2:14 PM");
  });

  test("sends HTML, text and the logo, linking the Customer's own Order", async () => {
    sendMail.mockReset();
    await sendOrderOnlinePickupConfirmedEmail("a@b.com", order);
    const sent = sendMail.mock.calls[0][0];
    expect(sent.to).toBe("a@b.com");
    expect(sent.html).toContain(url);
    expect(sent.attachments[0].cid).toBe("bren-raphaels-logo");
  });
});
