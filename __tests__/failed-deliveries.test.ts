import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";
import { createTestDatabase } from "./helpers/test-database";
import { FakeShopStock } from "./helpers/fake-shop-stock";
import { customers, orders, failedDeliveries, stockReservations, stockOutbox } from "../lib/db/schema";
import { createFailedDeliveries } from "../lib/orders/failed-deliveries";
import { createStockReservations } from "../lib/orders/stock-reservations";
const clients: Awaited<ReturnType<typeof createTestDatabase>>[] = [];
afterEach(async () => { for (const db of clients.splice(0)) await db.close(); });
const staff = { staffId: "ana", staffName: "Ana Reyes" };
async function fixture() {
  const client = await createTestDatabase(); clients.push(client);
  const db = drizzle(client);
  await db.insert(customers).values({ id: "c1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos", email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
  const [order] = await db.insert(orders).values({ customerId: "c1", status: "dispatched", fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000 }).returning();
  const stock = new FakeShopStock();
  const reservationId = randomUUID();
  const line = { lineId: "size-1", productId: 101, quantity: 2, sizeId: 1, cartLineId: 1, priceInCentavos: 5000, deducted: true };
  await stock.move("reserve", reservationId, line); await stock.move("deduct", reservationId, line);
  await db.insert(stockReservations).values({ id: reservationId, customerId: "c1", customerName: "Maria Santos", orderId: order.id, state: "placed", lines: [line] });
  const service = createFailedDeliveries(db, stock);
  const input = { action: "record", attemptId: randomUUID(), reason: "Customer not home", nextStep: "rebook", customerMessage: "Staff will rebook the courier.", ...staff };
  return { db, order, stock, service, input };
}
test("records one failure and one email, keeps dispatched and retains history when rebooked", async () => {
  const { db, order, service, input } = await fixture();
  await service.change(order.id, input); await service.change(order.id, input);
  expect(await db.select().from(failedDeliveries)).toHaveLength(1);
  expect((await db.select().from(orders))[0].status).toBe("dispatched");
  const email = vi.fn(async () => {}); const audit = vi.fn(async () => {});
  const outbox = createStockReservations(db);
  await outbox.sendPending({ audit, email }); await outbox.sendPending({ audit, email });
  expect(email).toHaveBeenCalledTimes(1); expect(email).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining("Staff will rebook") }));
  expect(audit).toHaveBeenCalledTimes(1);
  await service.change(order.id, { action: "rebook", attemptId: input.attemptId, courier: { name: "Grab", trackingUrl: "https://grab.example/new", riderName: "Ben" }, ...staff });
  expect((await db.select().from(orders))[0]).toMatchObject({ status: "dispatched", courier: "Grab", courierTrackingUrl: "https://grab.example/new", riderName: "Ben" });
  expect((await db.select().from(failedDeliveries))[0].reason).toBe(input.reason);
});
test.each(["restock", "write-off"])("%s is idempotent and prevents rebooking disposed goods", async action => {
  const { db, order, service, input, stock } = await fixture();
  await service.change(order.id, input);
  await service.change(order.id, { action, attemptId: input.attemptId, ...staff });
  await service.change(order.id, { action, attemptId: input.attemptId, ...staff });
  expect(stock.remaining(101)).toBe(action === "restock" ? 50 : 48);
  await expect(service.change(order.id, { action: "rebook", attemptId: input.attemptId, courier: { name: "Grab", trackingUrl: "https://grab.example/new" }, ...staff })).rejects.toThrow("cannot be rebooked");
  expect((await db.select().from(stockReservations))[0].lines[0].released).toBe(true);
  expect((await db.select().from(stockOutbox)).filter(event => event.key.startsWith(action === "restock" ? "delivery.restocked" : "writeoff.approved"))).toHaveLength(1);
});
test("an unavailable restock fences a write-off and resumes with the same IMS references", async () => {
  const { db, order, service, input, stock } = await fixture();
  await service.change(order.id, input); stock.unavailable = true;
  await expect(service.change(order.id, { action: "restock", attemptId: input.attemptId, ...staff })).rejects.toThrow();
  await expect(service.change(order.id, { action: "write-off", attemptId: input.attemptId, ...staff })).rejects.toThrow("already changed");
  stock.unavailable = false;
  await service.change(order.id, { action: "restock", attemptId: input.attemptId, ...staff });
  expect((await db.select().from(failedDeliveries))[0].disposedAt).not.toBeNull();
});
test("refuses empty reasons, Customer choices, Pickup and Orders no longer dispatched", async () => {
  const { db, order, service, input } = await fixture();
  await expect(service.change(order.id, { ...input, reason: " " })).rejects.toThrow();
  await expect(service.change(order.id, { ...input, nextStep: "ask-customer" })).rejects.toThrow();
  await db.update(orders).set({ fulfillmentMethod: "pickup" }).where(eq(orders.id, order.id));
  await expect(service.change(order.id, input)).rejects.toThrow("dispatched Delivery");
  await db.update(orders).set({ status: "delivered", fulfillmentMethod: "delivery" }).where(eq(orders.id, order.id));
  await expect(service.change(order.id, input)).rejects.toThrow("dispatched Delivery");
});
