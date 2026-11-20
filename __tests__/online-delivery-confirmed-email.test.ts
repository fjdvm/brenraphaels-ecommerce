import { describe, expect, test, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: "s@x.com" }),
  requiredEnvironment: () => "https://shop.test",
}));

import { renderOnlineDeliveryConfirmedEmail, sendOrderOnlineDeliveryConfirmedEmail } from "@/lib/email/order-online-delivery-confirmed-email";

const base = {
  id: 9, fulfillmentMethod: "delivery", paymentMethod: "gcash", status: "confirmed",
  subtotalInCentavos: 50000, deliveryFeeInCentavos: 8000, approvedDiscountInCentavos: 2500, totalInCentavos: 55500,
  deliveryAddress: { label: "Home", street: "12 Main St", barangay: "Poblacion", city: "Makati", province: "", postalCode: "1210", country: "PH" },
  lines: [{ productName: "Ube Halaya", sizeLabel: "250g", priceInCentavos: 25000, quantity: 2 }],
};
const order = base as never;
const url = "https://shop.test/profile/orders?order=9&action=pay";
const cancelUrl = "https://shop.test/profile/orders?order=9&action=cancel";

describe("Online payment + Delivery confirmation email", () => {
  test("shows items, discount, Delivery fee, total amount to pay, address and Pay order / Cancel order", () => {
    const { html, text, subject } = renderOnlineDeliveryConfirmedEmail(order, url, cancelUrl);
    expect(subject).toBe("Order #9 confirmed");
    for (const body of [html, text]) {
      expect(body).toContain("Ube Halaya — 250g × 2");
      expect(body).toContain("Senior/PWD discount");
      expect(body).toContain("Delivery fee");
      expect(body).toContain("₱80");
      expect(body).toContain("Total amount to pay");
      expect(body).toContain("₱555");
      expect(body).toContain("12 Main St, Poblacion, Makati 1210");
      expect(body).toContain("Pay order");
      expect(body).toContain("Cancel order");
    }
    expect(text).toContain(url);
    expect(text).toContain(cancelUrl);
    expect(html).toContain("Pay your Order");
    expect(html).toContain(`href="${url.replace("&", "&amp;")}"`);
    expect(html).toContain(">Pay order<");
    expect(html).not.toContain("View Order");
    expect(html).toContain("#4A2373");
  });

  test("shows a ₱0 Delivery fee as Free Delivery — ₱0 and omits the discount line without one", () => {
    const free = { ...base, deliveryFeeInCentavos: 0, approvedDiscountInCentavos: 0, totalInCentavos: 50000 } as never;
    const { html, text } = renderOnlineDeliveryConfirmedEmail(free, url, cancelUrl);
    for (const body of [html, text]) {
      expect(body).toContain("Free Delivery — ₱0");
      expect(body).not.toContain("Senior/PWD discount");
      expect(body).toContain("₱500");
    }
  });

  test("escapes the address", () => {
    const { html } = renderOnlineDeliveryConfirmedEmail({ ...base, deliveryAddress: { ...base.deliveryAddress, street: "<b>x</b>" } } as never, url, cancelUrl);
    expect(html).not.toContain("<b>x</b>");
  });

  test("shows the saved payment deadline, 24 hours after placing, in the shop's time zone", () => {
    const placed = { ...base, createdAt: new Date("2026-11-18T06:14:00Z") } as never;
    const { html, text } = renderOnlineDeliveryConfirmedEmail(placed, url, cancelUrl);
    for (const body of [html, text]) {
      expect(body).toContain("Pay by Nov 19, 2026 · 2:14 PM");
      expect(body).toContain("or the order will be cancelled");
    }
  });

  test("sends HTML, text and the logo, linking the Customer's own Order", async () => {
    sendMail.mockReset();
    await sendOrderOnlineDeliveryConfirmedEmail("a@b.com", order);
    const sent = sendMail.mock.calls[0][0];
    expect(sent.to).toBe("a@b.com");
    expect(sent.html).toContain(url.replace("&", "&amp;"));
    expect(sent.html).toContain(cancelUrl.replace("&", "&amp;"));
    expect(sent.attachments[0].cid).toBe("bren-raphaels-logo");
  });
});
