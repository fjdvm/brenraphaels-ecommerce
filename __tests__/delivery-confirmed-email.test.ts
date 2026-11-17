import { describe, expect, test, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: "s@x.com" }),
  requiredEnvironment: () => "https://shop.test",
}));

import { renderDeliveryConfirmedEmail, sendOrderDeliveryConfirmedEmail, totalPayableUponDelivery } from "@/lib/email/order-delivery-confirmed-email";

const base = {
  id: 9, fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", status: "confirmed",
  subtotalInCentavos: 50000, deliveryFeeInCentavos: 8000, approvedDiscountInCentavos: 2500, totalInCentavos: 55500,
  deliveryAddress: { label: "Home", street: "12 Main St", barangay: "Poblacion", city: "Makati", province: "", postalCode: "1210", country: "PH" },
  lines: [{ productName: "Ube Halaya", sizeLabel: "250g", priceInCentavos: 25000, quantity: 2 }],
};
const order = base as never;
const url = "https://shop.test/profile/orders?order=9";

describe("COD + Delivery confirmation email", () => {
  test("shows items, discount, Delivery fee, total payable upon delivery, address and View Order", () => {
    const { html, text, subject } = renderDeliveryConfirmedEmail(order, url);
    expect(subject).toBe("Order #9 confirmed");
    for (const body of [html, text]) {
      expect(body).toContain("Ube Halaya — 250g × 2");
      expect(body).toContain("Senior/PWD discount");
      expect(body).toContain("Delivery fee");
      expect(body).toContain("₱80");
      expect(body).toContain("Total payable upon delivery");
      expect(body).toContain("₱555");
      expect(body).toContain("12 Main St, Poblacion, Makati 1210");
      expect(body).toContain(url);
    }
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain(">View Order<");
    expect(html).toContain("#4A2373");
  });

  test("shows a ₱0 Delivery fee as Free and omits the discount line without one", () => {
    const free = { ...base, deliveryFeeInCentavos: 0, approvedDiscountInCentavos: 0, totalInCentavos: 50000 } as never;
    const { html, text } = renderDeliveryConfirmedEmail(free, url);
    for (const body of [html, text]) {
      expect(body).toContain("Free");
      expect(body).not.toContain("Senior/PWD discount");
      expect(body).toContain("₱500");
    }
  });

  test("total falls back to subtotal less discount plus fee", () => {
    expect(totalPayableUponDelivery({ ...base, totalInCentavos: null } as never)).toBe(55500);
  });

  test("escapes the address", () => {
    const { html } = renderDeliveryConfirmedEmail({ ...base, deliveryAddress: { ...base.deliveryAddress, street: "<b>x</b>" } } as never, url);
    expect(html).not.toContain("<b>x</b>");
  });

  test("sends HTML, text and the logo, linking the Customer's own Order", async () => {
    sendMail.mockReset();
    await sendOrderDeliveryConfirmedEmail("a@b.com", order);
    const sent = sendMail.mock.calls[0][0];
    expect(sent.to).toBe("a@b.com");
    expect(sent.html).toContain(url);
    expect(sent.attachments[0].cid).toBe("bren-raphaels-logo");
  });
});
