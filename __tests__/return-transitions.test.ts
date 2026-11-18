import { refundDetails } from "./helpers/refund-details";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, expect, test } from "vitest";

import { customers, orders, orderReturns, orderReturnHistory } from "../lib/db/schema";
import { createReturnStore } from "../lib/returns/returns";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let orderId: number;
const at = new Date("2026-10-24T08:00:00Z");
const staff = { type: "staff" as const, id: "ana", name: "Ana Reyes" };

beforeEach(async () => {
  client = await createTestDatabase();
  db = drizzle(client);
  await db.insert(customers).values({ id: "customer-1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
    email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
  const [order] = await db.insert(orders).values({ customerId: "customer-1", status: "delivered", fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 100000, codCollectedAt: new Date("2026-10-24T07:00:00Z"), codCollectedAmountInCentavos: 100000 }).returning();
  orderId = order.id;
});
afterEach(async () => { await client.close(); });

test("approval defaults to the Customer's Resolution and atomically records the Staff member and time", async () => {
  const [requested] = await db.insert(orderReturns).values({ orderId, reason: "damaged", amountInCentavos: 10000, requestedAt: new Date("2026-10-23T00:00:00Z"),
    preferredResolution: "replacement", videoFileId: "defect-video" }).returning();
  const store = createReturnStore(db, { now: () => at });
  const approved = await store.transition(requested.id, staff, { status: "approved" });
  expect(approved).toMatchObject({ number: `RMA-${requested.id}`, status: "approved", preferredResolution: "replacement",
    finalResolution: "replacement", goodsRequired: false, videoFileId: "defect-video", actedBy: { ...staff, at } });
  expect(await db.select().from(orderReturnHistory)).toMatchObject([{ status: "approved", actorId: "ana", actorName: "Ana Reyes", occurredAt: at }]);
});

test("refund and replacement follow goods-back decisions, require proof and keep the Order delivered", async () => {
  const store = createReturnStore(db, { now: () => at });
  for (const resolution of ["refund", "replacement"] as const) {
    for (const goodsRequired of [false, true]) {
      const [requested] = await db.insert(orderReturns).values({ orderId, reason: "defective", amountInCentavos: 10000, requestedAt: new Date("2026-10-23T00:00:00Z") }).returning();
      const approved = await store.transition(requested.id, staff, { status: "approved", finalResolution: resolution, goodsRequired });
      expect(approved.finalResolution).toBe(resolution);
      const status = resolution === "refund" ? "refunded" : "replaced";
      const completion = { status, ...(resolution === "refund" ? { refundProofFileId: "private-proof", ...refundDetails(10000, "2026-10-24") } : {}) };
      if (goodsRequired) {
        await expect(store.transition(requested.id, staff, completion)).rejects.toThrow("not allowed");
        await store.transition(requested.id, staff, { status: "goods received" });
      } else {
        await expect(store.transition(requested.id, staff, { status: "goods received" })).rejects.toThrow("not allowed");
      }
      if (resolution === "refund") {
        await expect(store.transition(requested.id, staff, { status: "refunded" })).rejects.toThrow();
      }
      const completed = await store.transition(requested.id, staff, completion);
      expect(completed).toMatchObject({ status, finalResolution: resolution,
        refundedAt: resolution === "refund" ? at : null, replacedAt: resolution === "replacement" ? at : null,
        refundProofFileId: resolution === "refund" ? "private-proof" : null });
    }
  }
  expect(await db.select().from(orders)).toMatchObject([{ id: orderId, status: "delivered" }]);
});

test("decline needs a reason, cancellation belongs to the Customer and both are final", async () => {
  const store = createReturnStore(db, { now: () => at });
  const [requested] = await db.insert(orderReturns).values({ orderId, reason: "other", amountInCentavos: 10000 }).returning();
  await expect(store.transition(requested.id, staff, { status: "declined", declineReason: "   " })).rejects.toThrow();
  const declined = await store.transition(requested.id, staff, { status: "declined", declineReason: "  No defect found.  " });
  expect(declined).toMatchObject({ status: "declined", declineReason: "No defect found.", actedBy: { ...staff, at } });
  await expect(store.transition(requested.id, staff, { status: "approved" })).rejects.toThrow("not allowed");

  const [another] = await db.insert(orderReturns).values({ orderId, reason: "other", amountInCentavos: 10000 }).returning();
  const owner = { type: "customer" as const, id: "customer-1", name: "Maria Santos" };
  await expect(store.transition(another.id, { ...owner, id: "someone-else" }, { status: "cancelled" })).rejects.toThrow("not found");
  await expect(store.transition(another.id, staff, { status: "cancelled" })).rejects.toThrow("not allowed");
  await expect(store.transition(another.id, owner, { status: "approved" })).rejects.toThrow("not allowed");
  expect(await store.transition(another.id, owner, { status: "cancelled" })).toMatchObject({ status: "cancelled", actedBy: { ...owner, at } });
  await expect(store.transition(another.id, staff, { status: "approved" })).rejects.toThrow("not allowed");
  expect(await db.select().from(orderReturnHistory)).toMatchObject([
    { returnId: requested.id, status: "declined", actorType: "staff", note: "No defect found." },
    { returnId: another.id, status: "cancelled", actorType: "customer", actorId: "customer-1" },
  ]);
});

test("every status move is checked against the Resolution and goods-back decision", async () => {
  const store = createReturnStore(db, { now: () => at });
  const owner = { type: "customer" as const, id: "customer-1", name: "Maria Santos" };
  const statuses = ["requested", "approved", "goods received", "refunded", "replaced", "declined", "cancelled"] as const;
  const decisions = [
    { status: "approved" }, { status: "declined", declineReason: "No defect." },
    { status: "goods received" }, { status: "refunded", refundProofFileId: "proof", ...refundDetails(10000, "2026-10-24") },
    { status: "replaced" }, { status: "cancelled" },
  ];
  for (const from of statuses) {
    for (const finalResolution of ["refund", "replacement"] as const) {
      for (const goodsRequired of [false, true]) {
        // Independent list of allowed destinations from the specification.
        const allowed = from === "requested" ? ["approved", "declined", "cancelled"]
          : from === "approved" ? (goodsRequired ? ["goods received"] : [finalResolution === "refund" ? "refunded" : "replaced"])
          : from === "goods received" ? [finalResolution === "refund" ? "refunded" : "replaced"] : [];
        for (const decision of decisions) {
          const [current] = await db.insert(orderReturns).values({ orderId, reason: "damaged", amountInCentavos: 10000, requestedAt: new Date("2026-10-23T00:00:00Z"),
            status: from, finalResolution, goodsRequired }).returning();
          const result = store.transition(current.id, decision.status === "cancelled" ? owner : staff, decision);
          if (allowed.includes(decision.status)) {
            expect(await result).toMatchObject({ status: decision.status });
          } else {
            await expect(result).rejects.toThrow("not allowed");
          }
        }
      }
    }
  }
});

test("a failed history write rolls back the decision, and competing decisions have one winner", async () => {
  const store = createReturnStore(db, { now: () => at });
  const [requested] = await db.insert(orderReturns).values({ orderId, reason: "damaged", amountInCentavos: 10000 }).returning();
  await client.exec("ALTER TABLE order_return_history ADD CONSTRAINT reject_history CHECK (false)");
  await expect(store.transition(requested.id, staff, { status: "approved" })).rejects.toThrow();
  expect(await db.select().from(orderReturns)).toEqual([requested]);
  await client.exec("ALTER TABLE order_return_history DROP CONSTRAINT reject_history");
  const results = await Promise.allSettled([
    store.transition(requested.id, staff, { status: "approved" }),
    store.transition(requested.id, staff, { status: "declined", declineReason: "No defect." }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  expect(await db.select().from(orderReturnHistory)).toHaveLength(1);
});
