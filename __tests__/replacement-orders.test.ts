import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTestDatabase } from "./helpers/test-database";
import { FakeShopStock } from "./helpers/fake-shop-stock";
import { customers, orderDeliveryAddresses, orderLines, orderReturnItems, orderReturns, orders, stockOutbox, stockReservations } from "../lib/db/schema";
import { createReplacementOrders } from "../lib/orders/replacement-orders";
import { createStockReservations } from "../lib/orders/stock-reservations";
import { returnWindow } from "../lib/returns/return-window";

const clients: Awaited<ReturnType<typeof createTestDatabase>>[] = [];
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example"));
afterEach(async () => { vi.unstubAllEnvs(); for (const db of clients.splice(0)) await db.close(); });
const staff = { staffId: "mario", staffName: "Mario Cruz" };

async function fixture(returnPatch: Partial<typeof orderReturns.$inferInsert> = {}) {
  const client = await createTestDatabase(); clients.push(client);
  const db = drizzle(client);
  await db.insert(customers).values({ id: "c1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos", email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
  const [order] = await db.insert(orders).values({ customerId: "c1", status: "delivered", fulfillmentMethod: "delivery", paymentMethod: "gcash",
    subtotalInCentavos: 300000, deliveryFeeInCentavos: 0, deliveredAt: new Date() }).returning();
  await db.insert(orderDeliveryAddresses).values({ orderId: order.id, label: "Home", street: "1 Rizal St", barangay: "Poblacion", city: "Makati", province: "Metro Manila", postalCode: "1200", country: "Philippines" });
  const [line] = await db.insert(orderLines).values({ orderId: order.id, productName: "Halaya tub", sizeLabel: "L", priceInCentavos: 150000, quantity: 2 }).returning();
  const stock = new FakeShopStock();
  await db.insert(stockReservations).values({ id: "orig", customerId: "c1", customerName: "Maria Santos", orderId: order.id, state: "placed",
    lines: [{ lineId: "size-1", productId: 101, quantity: 2, sizeId: 1, cartLineId: 1, priceInCentavos: 150000, orderLineId: line.id, deducted: true }] });
  const [ret] = await db.insert(orderReturns).values({ orderId: order.id, reason: "damaged", amountInCentavos: 300000, status: "approved",
    preferredResolution: "replacement", finalResolution: "replacement", goodsRequired: false, ...returnPatch }).returning();
  await db.insert(orderReturnItems).values({ returnId: ret.id, orderLineId: line.id, productName: "Halaya tub", sizeLabel: "L", quantity: 2, priceInCentavos: 150000 });
  return { db, order, ret, stock, service: createReplacementOrders(db, stock) };
}

test("creates a linked ₱0 Order with its own Reservation, the same Address, no Delivery fee quote", async () => {
  const { db, order, ret, stock, service } = await fixture();
  const { replacementOrderId } = await service.create(ret.id, staff);
  const [created] = await db.select().from(orders).where(eq(orders.id, replacementOrderId));
  expect(created).toMatchObject({ replacementForOrderId: order.id, replacementForReturnId: ret.id, subtotalInCentavos: 0, deliveryFeeInCentavos: 0,
    deliveryFeeQuoteRequired: false, status: "paid", customerId: "c1", fulfillmentMethod: "delivery" });
  expect(await db.select().from(orderLines).where(eq(orderLines.orderId, replacementOrderId))).toEqual([expect.objectContaining({ productName: "Halaya tub", quantity: 2, priceInCentavos: 0 })]);
  expect(await db.select().from(orderDeliveryAddresses).where(eq(orderDeliveryAddresses.orderId, replacementOrderId))).toHaveLength(1);
  const [reservation] = await db.select().from(stockReservations).where(eq(stockReservations.orderId, replacementOrderId));
  expect(reservation).toMatchObject({ state: "placed" });
  expect(stock.remaining(101)).toBe(48);
});

test("repeating the request returns the same Order, reserves once and emails once", async () => {
  const { db, ret, stock, service } = await fixture();
  const first = await service.create(ret.id, staff);
  expect(await service.create(ret.id, staff)).toEqual(first);
  expect(stock.remaining(101)).toBe(48);
  const email = vi.fn(async () => {}); const audit = vi.fn(async () => {});
  const outbox = createStockReservations(db);
  await outbox.sendPending({ audit, email }); await outbox.sendPending({ audit, email });
  expect(email).toHaveBeenCalledTimes(1);
  expect(email).toHaveBeenCalledWith(expect.objectContaining({ to: "maria@example.com", body: expect.stringContaining("costs you nothing") }));
  expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "order.replacement_created", actor: expect.objectContaining({ id: "mario" }) }));
  expect((await db.select().from(stockOutbox)).filter(row => row.key.endsWith(":email"))).toHaveLength(1);
});

test("refuses, creating no Order, when the stock is gone; a later attempt succeeds once restocked", async () => {
  const { db, ret, stock, service } = await fixture();
  stock.available.set(101, 1);
  await expect(service.create(ret.id, staff)).rejects.toThrow("out of stock");
  expect((await db.select().from(orders)).filter(o => o.replacementForReturnId !== null)).toHaveLength(0);
  stock.available.set(101, 10);
  const { replacementOrderId } = await service.create(ret.id, staff);
  expect(replacementOrderId).toBeGreaterThan(0);
  expect(stock.remaining(101)).toBe(8);
});

test.each([["refund", "approved"], ["replacement", "requested"], ["replacement", "declined"]] as const)(
  "only an approved replacement Return gets one (%s, %s)", async (finalResolution, status) => {
    const { ret, service } = await fixture({ finalResolution, status });
    await expect(service.create(ret.id, staff)).rejects.toThrow("not an approved replacement");
  });

test("requires Staff attribution", async () => {
  const { ret, service } = await fixture();
  await expect(service.create(ret.id, {})).rejects.toThrow();
});

test("extends the Refund window once by 24 hours with a reason, and the Customer window honours it", async () => {
  const { db, order, service } = await fixture();
  const { endsAt } = await service.extendWindow(order.id, { reason: "Customer was travelling", ...staff });
  const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
  expect(endsAt.getTime()).toBe(row.deliveredAt!.getTime() + 48 * 3600_000);
  expect(row).toMatchObject({ refundWindowExtensionReason: "Customer was travelling", refundWindowExtendedById: "mario", refundWindowExtendedByName: "Mario Cruz" });
  await expect(service.extendWindow(order.id, { reason: "Again", ...staff })).rejects.toThrow("already extended once");
  const delivered = row.deliveredAt!.getTime();
  expect(returnWindow(delivered, delivered + 30 * 3600_000)).toEqual({ state: "closed" });
  expect(returnWindow(delivered, delivered + 30 * 3600_000, true)).toMatchObject({ state: "open" });
  expect(returnWindow(delivered, delivered + 49 * 3600_000, true)).toEqual({ state: "closed" });
});

test("will not extend an Order that is not delivered, and needs a reason", async () => {
  const { db, order, service } = await fixture();
  await expect(service.extendWindow(order.id, { reason: "  ", ...staff })).rejects.toThrow();
  await db.update(orders).set({ status: "dispatched" }).where(eq(orders.id, order.id));
  await expect(service.extendWindow(order.id, { reason: "Why", ...staff })).rejects.toThrow("Only a delivered or picked up Order");
});
