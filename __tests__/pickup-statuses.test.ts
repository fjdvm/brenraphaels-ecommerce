import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, test } from "vitest";

import { customers, orders } from "../lib/db/schema";
import { completedAtOf } from "../lib/orders/completion";
import { createFeedbackRequestStore } from "../lib/orders/feedback-requests";
import { parseInternalOrderStatusUpdate } from "../lib/orders/internal-status";
import { orderBadges, orderFilterOf, orderTrackerSteps } from "../lib/orders/order-view";
import { createOrderStore, type OrderStatus } from "../lib/orders/orders";
import { createOrderReceiptStore } from "../lib/orders/receipt";
import { createReplacementOrders } from "../lib/orders/replacement-orders";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let store: ReturnType<typeof createOrderStore>;
const booking = { name: "Lalamove", trackingUrl: "https://share.lalamove.test/abc" } as const;

beforeAll(async () => {
  client = await createTestDatabase();
  db = drizzle(client);
  store = createOrderStore(db);
  await db.insert(customers).values({ id: "c1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
    email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
});
afterAll(async () => { await client.close(); });

async function order(fulfillmentMethod: "pickup" | "delivery", status: OrderStatus, extra: Partial<typeof orders.$inferInsert> = {}) {
  const [row] = await db.insert(orders).values({ customerId: "c1", status, fulfillmentMethod, paymentMethod: "cash-on-delivery",
    subtotalInCentavos: 10000, deliveryFeeInCentavos: fulfillmentMethod === "delivery" ? 8000 : null, ...extra }).returning();
  return row.id;
}

test("a Pickup Order goes preparing, ready for pickup, collected, received", async () => {
  const id = await order("pickup", "preparing");
  await expect(store.advance(id, { status: "ready for pickup" })).resolves.toMatchObject({ status: "ready for pickup" });
  const before = Date.now();
  const collected = await store.advance(id, { status: "collected" });
  expect(collected.status).toBe("collected");
  const saved = (await client.query<{ collected_at: Date; delivered_at: Date | null }>("select collected_at, delivered_at from orders where id = $1", [id])).rows[0];
  expect(saved.collected_at.getTime()).toBeGreaterThanOrEqual(before - 1000);
  expect(saved.delivered_at).toBeNull();
  await expect(createOrderReceiptStore(db).markReceived("c1", id)).resolves.toEqual({ id, status: "received" });
});

test("a Delivery Order goes preparing, dispatched, delivered, received", async () => {
  const id = await order("delivery", "preparing");
  await expect(store.advance(id, { status: "dispatched", courier: booking })).resolves.toMatchObject({ status: "dispatched" });
  await expect(store.advance(id, { status: "delivered", deliveryPhotoFileId: "photo-1" })).resolves.toMatchObject({ status: "delivered" });
  await expect(createOrderReceiptStore(db).markReceived("c1", id)).resolves.toEqual({ id, status: "received" });
});

test.each([
  ["a Pickup Order from preparing to dispatched", "pickup", "preparing", "dispatched"],
  ["a Pickup Order from preparing to collected", "pickup", "preparing", "collected"],
  ["a Pickup Order from ready for pickup to delivered", "pickup", "ready for pickup", "delivered"],
  ["a Delivery Order from preparing to ready for pickup", "delivery", "preparing", "ready for pickup"],
  ["a Delivery Order from preparing to collected", "delivery", "preparing", "collected"],
  ["a Delivery Order from dispatched to collected", "delivery", "dispatched", "collected"],
  ["a Pickup Order from collected back to ready for pickup", "pickup", "collected", "ready for pickup"],
] as const)("refuses %s", async (_name, method, from, to) => {
  const id = await order(method, from);
  await expect(store.advance(id, { status: to, courier: undefined, deliveryPhotoFileId: to === "delivered" ? "p" : undefined })).rejects.toThrow();
  const [row] = (await client.query<{ status: string }>("select status from orders where id = $1", [id])).rows;
  expect(row.status).toBe(from);
});

test("a Delivery Order cannot be ready for pickup even when it was dispatched", async () => {
  const id = await order("delivery", "ready for pickup");
  await expect(store.advance(id, { status: "collected" })).rejects.toThrow("not a legal transition");
});

test("legacy Pickup Orders already dispatched stay completable", async () => {
  const id = await order("pickup", "dispatched");
  await expect(store.advance(id, { status: "delivered", deliveryPhotoFileId: "photo-1" })).resolves.toMatchObject({ status: "delivered" });
  const done = await order("pickup", "delivered", { deliveredAt: new Date() });
  await expect(createOrderReceiptStore(db).markReceived("c1", done)).resolves.toMatchObject({ status: "received" });
});

test("marking received does not restart timers: the collection time stays and nothing else is stamped", async () => {
  const collectedAt = new Date("2026-10-01T12:00:00Z");
  const id = await order("pickup", "collected", { collectedAt });
  await createOrderReceiptStore(db).markReceived("c1", id);
  const row = (await client.query<{ collected_at: Date; delivered_at: Date | null; received_at: Date }>("select collected_at, delivered_at, received_at from orders where id = $1", [id])).rows[0];
  expect(row.collected_at.getTime()).toBe(collectedAt.getTime());
  expect(row.delivered_at).toBeNull();
  expect(completedAtOf({ deliveredAt: null, collectedAt })).toEqual(collectedAt);
});

test("the Feedback request timer counts from collected_at, once", async () => {
  const collectedAt = new Date("2026-10-01T12:00:00Z");
  const collected = await order("pickup", "collected", { collectedAt });
  const received = await order("pickup", "received", { collectedAt, receivedAt: new Date() });
  const due = await createFeedbackRequestStore(db).due(new Date("2026-10-03T12:00:00Z"));
  expect(due.map((request) => request.orderId)).toEqual(expect.arrayContaining([collected, received]));
  expect((await createFeedbackRequestStore(db).due(new Date("2026-10-01T11:00:00Z"))).map((request) => request.orderId)).not.toContain(collected);
});

test("a Manager can extend the Refund window of a collected Order from collected_at", async () => {
  const collectedAt = new Date("2026-10-01T12:00:00Z");
  const id = await order("pickup", "collected", { collectedAt });
  const result = await createReplacementOrders(db).extendWindow(id, { reason: "Customer was away", staffId: "m1", staffName: "Manager" });
  expect(result.endsAt).toEqual(new Date("2026-10-03T12:00:00Z"));
});

test("the new statuses are accepted by the internal status request and show as the Customer expects", () => {
  expect(parseInternalOrderStatusUpdate({ status: "ready for pickup" })).toEqual({ status: "ready for pickup" });
  expect(parseInternalOrderStatusUpdate({ status: "collected", staffId: "a", staffName: "Ana" })).toEqual({ status: "collected" });
  const view = { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery", status: "collected", deliveryFeeInCentavos: null,
    paymentProof: null, paymentProofRejection: null, paymentUnderManagerReview: false } as const;
  expect(orderBadges(view)[0].text).toBe("Picked up");
  expect(orderFilterOf(view)).toBe("completed");
  expect(orderFilterOf({ ...view, status: "ready for pickup" })).not.toBe("completed");
  expect(orderTrackerSteps(view)!.every((step) => step.state === "done")).toBe(true);
});
