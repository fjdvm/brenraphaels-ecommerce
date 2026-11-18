import { refundDetails } from "./helpers/refund-details";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { customers, orders, orderReturns } from "../lib/db/schema";
import { amountPaid, checkRefund, type RefundOrder } from "../lib/returns/refund-rules";
import { createReturnStore } from "../lib/returns/returns";
import { createTestDatabase } from "./helpers/test-database";

const order: RefundOrder = { paymentMethod: "gcash", fulfillmentMethod: "delivery", subtotalInCentavos: 100000, approvedDiscountInCentavos: 10000,
  deliveryFeeInCentavos: 15000, totalInCentavos: 105000, codCollectedAmountInCentavos: null, codCollectedAt: null };

describe("refund rules", () => {
  test("items only by default; the Delivery fee never comes back unasked", () => {
    expect(checkRefund({ order, reason: "defective", itemsInCentavos: 90000, prior: [] })).toEqual({ ok: true, deliveryFeeInCentavos: 0 });
  });
  test("a Manager's reason adds the Order's own fee for a wrong or defective item only", () => {
    expect(checkRefund({ order, reason: "wrong item", itemsInCentavos: 50000, prior: [], deliveryFeeReason: "Shop sent the wrong flavour" })).toEqual({ ok: true, deliveryFeeInCentavos: 15000 });
    expect(checkRefund({ order, reason: "other", itemsInCentavos: 50000, prior: [], deliveryFeeReason: "x" })).toMatchObject({ ok: false });
    expect(checkRefund({ order, reason: "defective", itemsInCentavos: 50000, prior: [], deliveryFeeReason: "  " })).toMatchObject({ ok: false });
  });
  test("free delivery or pickup adds nothing", () => {
    expect(checkRefund({ order: { ...order, deliveryFeeInCentavos: 0 }, reason: "defective", itemsInCentavos: 1000, prior: [], deliveryFeeReason: "x" })).toEqual({ ok: true, deliveryFeeInCentavos: 0 });
    expect(checkRefund({ order: { ...order, fulfillmentMethod: "pickup" }, reason: "defective", itemsInCentavos: 1000, prior: [], deliveryFeeReason: "x" })).toEqual({ ok: true, deliveryFeeInCentavos: 0 });
  });
  test("at most once per Order", () => {
    expect(checkRefund({ order, reason: "defective", itemsInCentavos: 1000, prior: [{ itemsInCentavos: 1000, deliveryFeeInCentavos: 15000 }], deliveryFeeReason: "x" }))
      .toEqual({ ok: false, error: "The Delivery fee was already refunded on this Order." });
  });
  test("cumulative refunds never exceed what was paid", () => {
    expect(amountPaid(order)).toBe(105000);
    expect(checkRefund({ order, reason: "defective", itemsInCentavos: 60000, prior: [{ itemsInCentavos: 50000, deliveryFeeInCentavos: 0 }] })).toMatchObject({ ok: false });
    expect(checkRefund({ order, reason: "defective", itemsInCentavos: 55000, prior: [{ itemsInCentavos: 50000, deliveryFeeInCentavos: 0 }] })).toMatchObject({ ok: true });
  });
  test("Cash on Delivery is refundable only after the cash was collected, and only what was collected", () => {
    const cod = { ...order, paymentMethod: "cash-on-delivery" };
    expect(checkRefund({ order: cod, reason: "defective", itemsInCentavos: 1000, prior: [] })).toMatchObject({ ok: false });
    const collected = { ...cod, codCollectedAt: new Date(), codCollectedAmountInCentavos: 90000 };
    expect(checkRefund({ order: collected, reason: "defective", itemsInCentavos: 90000, prior: [] })).toMatchObject({ ok: true });
    expect(checkRefund({ order: collected, reason: "defective", itemsInCentavos: 91000, prior: [] })).toMatchObject({ ok: false });
  });
});

describe("the refund transition applies the rules and records the fee", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle>;
  const staff = { type: "staff" as const, id: "ana", name: "Ana Reyes" };
  beforeEach(async () => {
    client = await createTestDatabase();
    db = drizzle(client);
    await db.insert(customers).values({ id: "c1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos", email: "m@example.com", contactNumber: "09171234567", marketingOptIn: false });
  });
  afterEach(async () => { await client.close(); });
  async function approved(reason: "defective" | "other", amount: number, patch: Partial<typeof orders.$inferInsert> = {}, orderId?: number) {
    if (orderId === undefined) {
      [{ id: orderId }] = await db.insert(orders).values({ customerId: "c1", status: "delivered", fulfillmentMethod: "delivery", paymentMethod: "gcash",
        subtotalInCentavos: 100000, deliveryFeeInCentavos: 15000, totalInCentavos: 115000, ...patch }).returning({ id: orders.id });
    }
    const [ret] = await db.insert(orderReturns).values({ orderId, reason, amountInCentavos: amount, requestedAt: new Date("2026-11-18T00:00:00Z"), status: "approved", goodsRequired: false, preferredResolution: "refund", finalResolution: "refund" }).returning();
    return { id: ret.id, orderId };
  }
  const paid = (centavos: number) => refundDetails(centavos, "2026-11-19");
  const store = () => createReturnStore(db, { now: () => new Date("2026-11-19T01:00:00Z") });

  test("stores the Order's own fee and the reason, once per Order", async () => {
    const first = await approved("defective", 40000);
    await store().transition(first.id, staff, { status: "refunded", refundProofFileId: "p1", deliveryFeeReason: "Wrong item sent", ...paid(55000) });
    expect((await db.select().from(orderReturns))[0]).toMatchObject({ refundDeliveryFeeInCentavos: 15000, refundDeliveryFeeReason: "Wrong item sent" });
    const second = await approved("defective", 30000, {}, first.orderId);
    await expect(store().transition(second.id, staff, { status: "refunded", refundProofFileId: "p2", deliveryFeeReason: "again", ...paid(30000) })).rejects.toThrow("already refunded");
    await store().transition(second.id, staff, { status: "refunded", refundProofFileId: "p2", ...paid(30000) });
  });
  test("refuses a refund that would pass what was paid, and a repeat of a Refunded Return", async () => {
    const first = await approved("other", 100000);
    await store().transition(first.id, staff, { status: "refunded", refundProofFileId: "p1", ...paid(100000) });
    await expect(store().transition(first.id, staff, { status: "refunded", refundProofFileId: "p1", ...paid(100000) })).rejects.toThrow("not allowed");
    const second = await approved("other", 20000, {}, first.orderId);
    await expect(store().transition(second.id, staff, { status: "refunded", refundProofFileId: "p2", ...paid(20000) })).rejects.toThrow("more than the Customer paid");
  });
  test("a Cash on Delivery refund waits for the collected cash", async () => {
    const { id, orderId } = await approved("other", 10000, { paymentMethod: "cash-on-delivery" });
    await expect(store().transition(id, staff, { status: "refunded", refundProofFileId: "p1", ...paid(10000) })).rejects.toThrow("No cash was collected");
    await db.update(orders).set({ codCollectedAt: new Date(), codCollectedAmountInCentavos: 115000 }).where((await import("drizzle-orm")).eq(orders.id, orderId));
    await store().transition(id, staff, { status: "refunded", refundProofFileId: "p1", ...paid(10000) });
  });
});
