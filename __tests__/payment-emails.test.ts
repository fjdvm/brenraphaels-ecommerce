import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, orderEmailOutcomes, orders, products, sizes } from "../lib/db/schema";
import { stableEmailId } from "../lib/email/outcomes";
import { renderPaymentEmail, rejectionReasonFor } from "../lib/email/payment-emails";
import { sendExpiredOrderEmails } from "../lib/email/payment-expired";
import { createCartStore } from "../lib/orders/cart";
import { createOrderStore, type Order } from "../lib/orders/orders";
import { createStockReservations } from "../lib/orders/stock-reservations";
import { FakeShopStock } from "./helpers/fake-shop-stock";
import { createTestDatabase } from "./helpers/test-database";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("../lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: { address: "shop@brenraphaels.test" } }),
  requiredEnvironment: () => "https://shop.example.test",
}));
vi.mock("../lib/email/layout", async (importOriginal) => ({ ...(await importOriginal<typeof import("../lib/email/layout")>()), logoAttachment: async () => ({ filename: "logo.jpeg", content: Buffer.from(""), cid: "x" }) }));
vi.mock("../lib/orders/payment-details", () => ({ paymentRecipient: async () => "09171234567" }));

const order = (extra: Partial<Order> = {}) => ({
  id: 8, status: "awaiting payment", subtotalInCentavos: 116600, deliveryFeeInCentavos: 0,
  createdAt: new Date("2026-11-01T00:00:00Z"), confirmedAt: new Date("2026-11-01T00:00:00Z"),
  paymentDeadlineAt: new Date("2026-11-03T04:00:00Z"),
  paymentProofHistory: [
    { reference: "1", submittedAt: new Date(), rejection: { reason: "Blurry screenshot", at: new Date() } },
    { reference: "2", submittedAt: new Date(), rejection: { reason: "Wrong amount", at: new Date() } },
    { reference: "3", submittedAt: new Date(), rejection: { reason: "Not our account", at: new Date() } },
  ],
  paymentProofRejection: { reason: "Not our account", at: new Date() },
  ...extra,
}) as unknown as Order;

describe("the four payment emails", () => {
  test("Payment verified says the Order is being prepared and shows the total paid", () => {
    const { subject, html, text } = renderPaymentEmail("payment-verified", order());
    expect(subject).toBe("Order #8 payment verified");
    expect(text).toContain("We verified your payment for Order #8. We're preparing it now.");
    expect(text).toContain("Total paid: ₱1,166");
    expect(html).toContain("Payment verified");
  });

  test("Payment rejected carries the reason of its own occurrence, the new deadline and a resubmit link", () => {
    const second = renderPaymentEmail("payment-rejected", order(), "2");
    expect(second.text).toContain("Reason: Wrong amount");
    expect(second.text).not.toContain("Blurry");
    expect(second.text).toContain("Submit a new proof by Nov 3, 2026 · 12:00 PM");
    expect(second.text).toContain("Submit your payment proof: https://shop.example.test/profile/orders?order=8");
    expect(second.html).toContain("Submit your payment proof");
    expect(renderPaymentEmail("payment-rejected", order(), "1").text).toContain("Reason: Blurry screenshot");
  });

  test("Payment expired says the window expired and offers no resubmission", () => {
    const { subject, text, html } = renderPaymentEmail("payment-expired", order({ status: "cancelled" }));
    expect(subject).toBe("Order #8 cancelled");
    expect(text).toContain("Your order was cancelled because the payment window expired.");
    expect(html).not.toContain("Submit your payment proof");
  });

  test("Manager review started has the reason, no resubmit and no new deadline", () => {
    const { text, html } = renderPaymentEmail("manager-review-started", order());
    expect(text).toContain("Reason: Not our account");
    expect(text).toContain("Your payment is under Manager review");
    for (const body of [text, html]) {
      expect(body).not.toContain("Submit");
      expect(body).not.toMatch(/by Nov/);
    }
  });

  test("the reason is read from the saved history, so a Resend says the same thing", () => {
    expect(rejectionReasonFor(order(), "3")).toBe("Not our account");
    expect(rejectionReasonFor(order())).toBe("Not our account");
    expect(rejectionReasonFor(order({ paymentProofHistory: [] }), "1")).toBe("Not our account");
  });

  test("each email has a stable id per occurrence: the same on a retry, different for two rejections", () => {
    expect(stableEmailId(8, "payment-rejected", "1")).toBe(stableEmailId(8, "payment-rejected", "1"));
    expect(stableEmailId(8, "payment-rejected", "1")).not.toBe(stableEmailId(8, "payment-rejected", "2"));
    expect(new Set(["payment-verified", "payment-rejected", "payment-expired", "manager-review-started"].map((k) => stableEmailId(8, k))).size).toBe(4);
  });
});

describe("the expiry sweep", () => {
  let client: PGlite;
  beforeAll(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.test"; });
  beforeEach(() => { sendMail.mockReset().mockResolvedValue({ messageId: "<accepted@x>" }); });
  afterEach(async () => { await client.close(); });

  async function expiredOrder() {
    client = await createTestDatabase();
    const db = drizzle(client);
    await db.insert(customers).values({ id: "jane", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
    await db.insert(products).values({ slug: "ube", name: "Ube", description: "Jam" });
    const [size] = await db.insert(sizes).values({ productSlug: "ube", label: "250g", priceInCentavos: 10000, available: true }).returning();
    await createCartStore(db).addSize("jane", size.id, 1);
    const stock = new FakeShopStock();
    const store = createOrderStore(db, undefined, stock, () => {});
    const placed = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
    await db.update(orders).set({ confirmedAt: new Date("2026-11-01T00:00:00Z") }).where(eq(orders.id, placed.id));
    const maintenance = createStockReservations(db, stock);
    await maintenance.expire(new Date("2026-11-02T00:00:00Z"));
    await maintenance.drain();
    return { db, id: placed.id };
  }

  test("emails an expired Order once, under its stable id, and never again on a repeat run", async () => {
    const { db, id } = await expiredOrder();
    expect(await sendExpiredOrderEmails(db as never)).toBe(1);
    expect(await sendExpiredOrderEmails(db as never)).toBe(0);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: "jane@example.com", subject: `Order #${id} cancelled`, messageId: `<${stableEmailId(id, "payment-expired")}@brenraphaels.test>` });
    const [row] = await db.select().from(orderEmailOutcomes).where(eq(orderEmailOutcomes.orderId, id));
    expect(row).toMatchObject({ kind: "payment-expired", status: "sent", messageId: "<accepted@x>" });
  });

  test("a failed send stays recorded for the retry job and the Order stays cancelled", async () => {
    const { db, id } = await expiredOrder();
    sendMail.mockRejectedValue(new Error("SMTP down"));
    await sendExpiredOrderEmails(db as never);
    const [row] = await db.select().from(orderEmailOutcomes).where(eq(orderEmailOutcomes.orderId, id));
    expect(row).toMatchObject({ status: "retrying", reason: "SMTP down" });
    expect(await sendExpiredOrderEmails(db as never)).toBe(0);
    expect((await db.select().from(orders).where(eq(orders.id, id)))[0].status).toBe("cancelled");
  });

  test("waits while the reserved items are not yet released", async () => {
    const { db } = await expiredOrder();
    await client.exec("update stock_reservations set state = 'reserved'");
    expect(await sendExpiredOrderEmails(db as never)).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
