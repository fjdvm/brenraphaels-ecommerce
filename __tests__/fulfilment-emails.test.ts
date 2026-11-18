import { beforeEach, describe, expect, test, vi } from "vitest";

import { stableEmailId } from "../lib/email/outcomes";
import { FULFILMENT_EMAIL_KINDS, renderCompletedEmail, renderDispatchedEmail, renderPreparingEmail, renderReadyForPickupEmail, sendFulfilmentEmail } from "../lib/email/fulfilment-emails";
import { resendOrderEmail } from "../lib/email/retry";
import type { Order } from "../lib/orders/orders";

const { sendMail, loadPickup } = vi.hoisted(() => ({ sendMail: vi.fn(), loadPickup: vi.fn() }));
vi.mock("../lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: { address: "shop@brenraphaels.test" } }),
  requiredEnvironment: () => "https://shop.example.test",
}));
vi.mock("../lib/email/layout", async (importOriginal) => ({ ...(await importOriginal<typeof import("../lib/email/layout")>()), logoAttachment: async () => ({ filename: "logo.jpeg", content: Buffer.from(""), cid: "x" }) }));
vi.mock("../lib/pickup/instructions", async (importOriginal) => ({ ...(await importOriginal<typeof import("../lib/pickup/instructions")>()), loadPickupInstructions: loadPickup }));

const order = (extra: Partial<Order> = {}) => ({ id: 8, fulfillmentMethod: "delivery", paymentMethod: "gcash", subtotalInCentavos: 100000, courier: null, ...extra }) as unknown as Order;
const url = "https://shop.example.test/profile/orders?order=8";

beforeEach(() => { sendMail.mockReset(); sendMail.mockResolvedValue({ messageId: "<m1>" }); loadPickup.mockResolvedValue({ address: "12 Ube St, Quezon City", hours: "9am-5pm", note: "" }); });

describe("Preparing", () => {
  test("says the Order is being prepared and what comes next", () => {
    const { subject, text } = renderPreparingEmail(order(), url);
    expect(subject).toBe("Order #8 is being prepared");
    expect(text).toContain("out for delivery");
    expect(renderPreparingEmail(order({ fulfillmentMethod: "pickup" }), url).text).toContain("ready for pickup");
  });
});

describe("Dispatched", () => {
  test("shows the courier and a Track Your Order button only when there is a link, never rider details", () => {
    const withLink = renderDispatchedEmail(order({ courier: { name: "Grab", trackingUrl: "https://grab.test/1", riderName: "Jo", riderPhone: "0917" } as never }), url);
    expect(withLink.html).toContain("Track Your Order");
    expect(withLink.text).toContain("Track Your Order: https://grab.test/1");
    expect(withLink.text).not.toMatch(/Jo\b|0917/);
    const noLink = renderDispatchedEmail(order({ courier: { name: "Lalamove", trackingUrl: null } }), url);
    expect(noLink.html).not.toContain("Track Your Order");
    expect(noLink.text).toContain("A tracking link is not available yet.");
    expect(noLink.text).toContain("dispatched with Lalamove");
  });
});

describe("Ready for pickup", () => {
  test("carries the pickup address and hours", async () => {
    const { subject, text, html } = renderReadyForPickupEmail(order({ fulfillmentMethod: "pickup" }), await loadPickup(), url);
    expect(subject).toBe("Order #8 is ready for pickup");
    expect(text).toContain("Pickup address: 12 Ube St, Quezon City");
    expect(html).toContain("9am-5pm");
  });
});

describe("Delivered or Picked up", () => {
  test("a COD Order with recorded cash confirms the payment collected in the same email", () => {
    const at = new Date("2026-11-10T02:00:00Z");
    const { text, html, subject } = renderCompletedEmail(order({ paymentMethod: "cash-on-delivery", codCollected: { amountInCentavos: 123450, at } }), url);
    expect(subject).toBe("Order #8 delivered");
    expect(text).toContain("Payment collected: ₱1,234.5");
    expect(html).toContain("Payment collected");
  });
  test("a prepaid Order, or COD with nothing recorded, says nothing about collected payment", () => {
    expect(renderCompletedEmail(order({ codCollected: null }), url).text).not.toContain("Payment collected");
    expect(renderCompletedEmail(order({ paymentMethod: "cash-on-delivery", codCollected: null }), url).text).not.toContain("Payment collected");
  });
  test("a Pickup Order says picked up", () => {
    expect(renderCompletedEmail(order({ fulfillmentMethod: "pickup" }), url).subject).toBe("Order #8 picked up");
  });
});

describe("stable ids and Resend", () => {
  test.each(FULFILMENT_EMAIL_KINDS)("%s goes out under one stable id", async (kind) => {
    await sendFulfilmentEmail(kind, "a@b.com", order({ courier: { name: "Grab", trackingUrl: null } }), { id: stableEmailId(8, kind) });
    expect(sendMail.mock.calls[0][0].messageId).toBe(`<order-8-${kind}@brenraphaels.test>`);
  });
  test("every kind is a known Resend kind", async () => {
    for (const kind of FULFILMENT_EMAIL_KINDS) await expect(resendOrderEmail(8, kind, { } as never)).rejects.not.toThrow(/Unknown email kind/);
  });
});
