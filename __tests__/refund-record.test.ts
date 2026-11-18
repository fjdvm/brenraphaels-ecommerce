import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { customers, orders, orderReturns } from "../lib/db/schema";
import { checkRefundRecord } from "../lib/returns/refund-record";
import { createReturnStore, returnDecisionSchema } from "../lib/returns/returns";
import { refundDetails } from "./helpers/refund-details";
import { createTestDatabase } from "./helpers/test-database";

const base = { amountInCentavos: 25000, method: "gcash" as const, refundedOn: "2026-10-22", expectedInCentavos: 25000, destinationMethod: null,
  requestedAt: new Date("2026-10-20T00:00:00Z"), now: new Date("2026-10-23T08:00:00Z") };

describe("the refund record rules (epic-crms#613)", () => {
  test("accepts details that match the refund", () => {
    expect(checkRefundRecord(base)).toEqual({ ok: true });
  });
  test("refuses an amount that is not the refund, a method other than the confirmed one, and impossible dates", () => {
    expect(checkRefundRecord({ ...base, amountInCentavos: 24900 })).toMatchObject({ ok: false, error: expect.stringContaining("must match") });
    expect(checkRefundRecord({ ...base, destinationMethod: "maya" })).toMatchObject({ ok: false, error: expect.stringContaining("Customer confirmed") });
    expect(checkRefundRecord({ ...base, destinationMethod: "gcash" })).toEqual({ ok: true });
    expect(checkRefundRecord({ ...base, refundedOn: "2026-02-30" })).toMatchObject({ ok: false });
    expect(checkRefundRecord({ ...base, refundedOn: "2026-10-25" })).toMatchObject({ ok: false, error: "The refund date cannot be in the future." });
    expect(checkRefundRecord({ ...base, refundedOn: "2026-10-19" })).toMatchObject({ ok: false, error: "The refund date cannot be before the Return was requested." });
  });
  test("a refund decision cannot be parsed without every detail", () => {
    const full = { status: "refunded", refundProofFileId: "p1", ...refundDetails(25000, "2026-10-22") };
    expect(returnDecisionSchema.safeParse(full).success).toBe(true);
    for (const key of ["refundAmountInCentavos", "refundPaidMethod", "refundedOn", "refundReference"]) {
      const { [key]: _omitted, ...rest } = full as Record<string, unknown>;
      expect(returnDecisionSchema.safeParse(rest).success, key).toBe(false);
    }
    expect(returnDecisionSchema.safeParse({ ...full, refundPaidMethod: "cash" }).success).toBe(false);
    expect(returnDecisionSchema.safeParse({ ...full, refundReference: "abc" }).success).toBe(false);
  });
});

describe("the refund transition stores the record", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle>;
  const staff = { type: "staff" as const, id: "ana", name: "Ana Reyes" };
  const at = new Date("2026-10-23T08:00:00Z");
  beforeEach(async () => {
    client = await createTestDatabase();
    db = drizzle(client);
    await db.insert(customers).values({ id: "c1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos", email: "m@example.com", contactNumber: "09171234567", marketingOptIn: false });
  });
  afterEach(async () => { await client.close(); });
  async function approved(patch: Partial<typeof orderReturns.$inferInsert> = {}) {
    const [order] = await db.insert(orders).values({ customerId: "c1", status: "delivered", fulfillmentMethod: "pickup", paymentMethod: "gcash", subtotalInCentavos: 100000 }).returning();
    const [ret] = await db.insert(orderReturns).values({ orderId: order.id, reason: "other", amountInCentavos: 25000, requestedAt: new Date("2026-10-20T00:00:00Z"),
      status: "approved", goodsRequired: false, finalResolution: "refund", ...patch }).returning();
    return ret.id;
  }
  const store = () => createReturnStore(db, { now: () => at });

  test("saves the amount, method, date and reference with the status and returns them", async () => {
    const id = await approved();
    const done = await store().transition(id, staff, { status: "refunded", refundProofFileId: "p1", ...refundDetails(25000, "2026-10-22") });
    expect(done).toMatchObject({ status: "refunded", refundAmountInCentavos: 25000, refundPaidMethod: "gcash", refundPaidOn: "2026-10-22", refundReference: "GC-2026-0001" });
    expect((await db.select().from(orderReturns))[0]).toMatchObject({ refundAmountInCentavos: 25000, refundPaidMethod: "gcash", refundPaidOn: "2026-10-22" });
  });
  test("refuses a wrong amount or another method, and leaves the Return approved", async () => {
    const id = await approved({ refundMethod: "maya" });
    await expect(store().transition(id, staff, { status: "refunded", refundProofFileId: "p1", ...refundDetails(24000, "2026-10-22") })).rejects.toThrow("must match");
    await expect(store().transition(id, staff, { status: "refunded", refundProofFileId: "p1", ...refundDetails(25000, "2026-10-22") })).rejects.toThrow("Customer confirmed");
    expect((await db.select().from(orderReturns))[0]).toMatchObject({ status: "approved", refundAmountInCentavos: null, refundReference: null });
  });
});
