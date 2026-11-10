import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, test } from "vitest";

import { customers, orders, orderReturns, returnStatuses } from "../lib/db/schema";
import { createOrderFeedbackStore } from "../lib/orders/feedback";
import { createFeedbackRequestStore } from "../lib/orders/feedback-requests";
import { parseInternalOrderStatusUpdate } from "../lib/orders/internal-status";
import { orderBadges, orderFilterOf, orderTrackerSteps } from "../lib/orders/order-view";
import { createOrderStore, orderStatuses, type OrderStatus } from "../lib/orders/orders";
import { createOrderReceiptStore, OrderReceiptConflictError, OrderReceiptNotFoundError } from "../lib/orders/receipt";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
const deliveredAt = new Date("2026-10-01T12:00:00Z");
let receipt: ReturnType<typeof createOrderReceiptStore>;
let store: ReturnType<typeof createOrderStore>;

beforeAll(async () => {
  client = await createTestDatabase();
  db = drizzle(client);
  receipt = createOrderReceiptStore(db);
  store = createOrderStore(db);
  await db.insert(customers).values({ id: "customer-1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
    email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
});
afterAll(async () => { await client.close(); });

async function order(status: OrderStatus = "delivered") {
  const [created] = await db.insert(orders).values({ customerId: "customer-1", status, fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, deliveredAt }).returning();
  return created;
}

test("the owning Customer can permanently receive an old delivered Order without changing its payment or delivery data", async () => {
  const created = await order();
  const before = (await store.listForCustomer("customer-1")).find((o) => o.id === created.id);
  expect(await receipt.markReceived("customer-1", created.id)).toEqual({ id: created.id, status: "received" });
  expect((await store.listForCustomer("customer-1")).find((o) => o.id === created.id)).toEqual({ ...before, status: "received" });
  await expect(receipt.markReceived("customer-1", created.id)).rejects.toBeInstanceOf(OrderReceiptConflictError);
  for (const status of orderStatuses) {
    await expect(store.advance(created.id, { status })).rejects.toThrow("not a legal transition");
  }
  await expect(store.cancel("customer-1", created.id)).rejects.toThrow("not a legal transition");
});

test.each(orderStatuses.filter((status) => status !== "delivered"))("refuses receipt of a %s Order without changing it", async (status) => {
  const created = await order(status);
  await expect(receipt.markReceived("customer-1", created.id)).rejects.toBeInstanceOf(OrderReceiptConflictError);
  expect((await store.listForCustomer("customer-1")).find((o) => o.id === created.id)?.status).toBe(status);
});

test("another Customer and a missing Order have the same refusal", async () => {
  const created = await order();
  await expect(receipt.markReceived("someone-else", created.id)).rejects.toBeInstanceOf(OrderReceiptNotFoundError);
  await expect(receipt.markReceived("customer-1", 999999)).rejects.toBeInstanceOf(OrderReceiptNotFoundError);
  expect((await store.listForCustomer("customer-1")).find((o) => o.id === created.id)?.status).toBe("delivered");
});

test.each(returnStatuses)("only in-progress Returns block receipt: %s", async (status) => {
  const created = await order();
  await db.insert(orderReturns).values({ orderId: created.id, status, reason: "damaged", amountInCentavos: 10000 });
  if (["requested", "approved", "goods received"].includes(status)) {
    await expect(receipt.markReceived("customer-1", created.id)).rejects.toThrow("Return in progress");
    expect((await store.listForCustomer("customer-1")).find((o) => o.id === created.id)?.status).toBe("delivered");
  } else {
    expect(await receipt.markReceived("customer-1", created.id)).toEqual({ id: created.id, status: "received" });
  }
});

test("an active Return still blocks receipt alongside a declined Return", async () => {
  const created = await order();
  await db.insert(orderReturns).values(["declined", "requested"].map((status) => ({ orderId: created.id,
    status: status as "declined" | "requested", reason: "damaged" as const, amountInCentavos: 10000 })));
  await expect(receipt.markReceived("customer-1", created.id)).rejects.toThrow("Return in progress");
});

test("competing receipt confirmations commit only once", async () => {
  const created = await order();
  const results = await Promise.allSettled([receipt.markReceived("customer-1", created.id), receipt.markReceived("customer-1", created.id)]);
  expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
});

test("receipt preserves the original two-day Feedback timer, and completed display", async () => {
  const created = await order();
  const feedbackRequests = createFeedbackRequestStore(db);
  await receipt.markReceived("customer-1", created.id);
  expect((await feedbackRequests.due(new Date("2026-10-01T11:59:59Z"))).some((o) => o.orderId === created.id)).toBe(false);
  expect((await feedbackRequests.due(deliveredAt)).some((o) => o.orderId === created.id)).toBe(true);
  const received = (await store.listForCustomer("customer-1")).find((o) => o.id === created.id)!;
  expect(orderFilterOf(received)).toBe("completed");
  expect(orderTrackerSteps(received)?.every((step) => step.state === "done")).toBe(true);
  expect(orderBadges(received)).toEqual([{ text: "Received", tone: "lavender" }]);
  await expect(createOrderFeedbackStore(db).submit("customer-1", { orderId: created.id, rating: 5, comment: "Thank you" }))
    .resolves.toMatchObject({ orderId: created.id, rating: 5 });
});

test("Staff cannot request the received status through the internal status contract", () => {
  expect(() => parseInternalOrderStatusUpdate({ status: "received" })).toThrow();
});

test("lists only the Customer's Orders with a Return in progress", async () => {
  const inProgress = await order();
  const closed = await order();
  const none = await order();
  await db.insert(orderReturns).values([
    { orderId: inProgress.id, status: "approved", reason: "damaged", amountInCentavos: 10000 },
    { orderId: inProgress.id, status: "declined", reason: "damaged", amountInCentavos: 10000 },
    { orderId: closed.id, status: "refunded", reason: "damaged", amountInCentavos: 10000 },
  ]);
  const ids = await receipt.orderIdsWithReturnInProgress("customer-1");
  expect(ids.has(inProgress.id)).toBe(true);
  expect(ids.has(closed.id)).toBe(false);
  expect(ids.has(none.id)).toBe(false);
  expect((await receipt.orderIdsWithReturnInProgress("someone-else")).size).toBe(0);
});
