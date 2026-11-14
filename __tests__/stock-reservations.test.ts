import { drizzle } from "drizzle-orm/pglite";
import { afterEach, expect, test } from "vitest";
import { createTestDatabase } from "./helpers/test-database";
import { customers, products, sizes } from "../lib/db/schema";
import { createCartStore } from "../lib/orders/cart";
import { createOrderStore } from "../lib/orders/orders";

const clients: Awaited<ReturnType<typeof createTestDatabase>>[] = [];
afterEach(async () => { vi.unstubAllEnvs(); for (const client of clients.splice(0)) await client.close(); });

test("checkout fails without placing an Order or emptying the Cart when IMS is unavailable", async () => {
  const client = await createTestDatabase(); clients.push(client);
  const db = drizzle(client);
  await db.insert(customers).values({ id: "jane", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
  await db.insert(products).values({ slug: "ube", name: "Ube", description: "Jam" });
  const [size] = await db.insert(sizes).values({ productSlug: "ube", label: "250g", priceInCentavos: 10000, available: true }).returning();
  const cart = createCartStore(db);
  await cart.addSize("jane", size.id, 1);
  const store = createOrderStore(db);
  await expect(store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" })).rejects.toThrow("Try again in a few minutes");
  expect(await store.listForCustomer("jane")).toEqual([]);
  expect((await cart.get("jane")).lines).toHaveLength(1);
});

test("checkout reserves every line; refusing a later line releases earlier stock and preserves the Cart", async () => {
  const { cart, stock, store, first, second } = await fixture();
  stock.failProduct = stock.productForSize(second.id);
  await expect(store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" })).rejects.toThrow("not enough stock");
  expect(await store.listForCustomer("jane")).toEqual([]);
  expect((await cart.get("jane")).lines).toHaveLength(2);
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
  stock.failProduct = undefined;
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  expect(order.lines).toHaveLength(2);
  expect(stock.remaining(stock.productForSize(first.id))).toBe(48);
  expect(stock.remaining(stock.productForSize(second.id))).toBe(49);
  expect((await cart.get("jane")).lines).toEqual([]);
});

import { FakeShopStock } from "./helpers/fake-shop-stock";
import { createStockReservations } from "../lib/orders/stock-reservations";
import { eq } from "drizzle-orm";
import { orderLines, orders } from "../lib/db/schema";
import { vi } from "vitest";

async function fixture() {
  const client = await createTestDatabase(); clients.push(client);
  const db = drizzle(client);
  await db.insert(customers).values({ id: "jane", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
  await db.insert(products).values({ slug: "ube", name: "Ube", description: "Jam" });
  const [first, second] = await db.insert(sizes).values([
    { productSlug: "ube", label: "250g", priceInCentavos: 10000, available: true },
    { productSlug: "ube", label: "500g", priceInCentavos: 20000, available: true },
  ]).returning();
  const cart = createCartStore(db);
  await cart.addSize("jane", first.id, 2);
  await cart.addSize("jane", second.id, 1);
  const stock = new FakeShopStock();
  const store = createOrderStore(db, undefined, stock);
  return { client, db, cart, stock, store, first, second, maintenance: createStockReservations(db, stock) };
}

test("zero available stock blocks checkout", async () => {
  const { cart, stock, store, first } = await fixture();
  stock.available.set(stock.productForSize(first.id), 0);
  await expect(store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" })).rejects.toThrow("not enough stock");
  expect(await store.listForCustomer("jane")).toEqual([]);
  expect((await cart.get("jane")).lines).toHaveLength(2);
});

test("Customer and Staff cancellations release stock, with replay-safe audit events", async () => {
  const { cart, stock, store, maintenance, first, second } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  await store.cancel("jane", order.id);
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
  expect(stock.remaining(stock.productForSize(second.id))).toBe(50);
  await maintenance.drain();
  const events: import("../lib/audit/gateway").AuditEvent[] = [];
  const email = vi.fn(async () => {});
  await maintenance.sendPending({ audit: async event => { events.push(event); }, email });
  await maintenance.sendPending({ audit: async event => { events.push(event); }, email });
  expect(events.filter(event => event.action === "order.stock_reserved")).toHaveLength(2);
  expect(events.filter(event => event.action === "order.stock_released")).toHaveLength(2);
  expect(new Set(events.map(event => event.idempotency_key)).size).toBe(4);
  expect(events.every(event => event.actor.display_name === "Jane Doe")).toBe(true);
  await cart.addSize("jane", first.id, 1);
  const next = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  await store.advance(next.id, { status: "cancelled", staffId: "ana", staffName: "Ana" });
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
});

test("partial cancellation releases only the cancelled whole line", async () => {
  const { db, stock, store, first, second } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  const [line] = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
  await store.cancelItems(order.id, [line.id], { staffId: "ana", staffName: "Ana" }, "confirmed");
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
  expect(stock.remaining(stock.productForSize(second.id))).toBe(49);
  expect((await store.listForCustomer("jane"))[0].lines).toHaveLength(1);
});

test("ambiguous reserve replies leave no Order and durable recovery releases the orphan without double-reserving", async () => {
  const { cart, stock, store, maintenance, first } = await fixture();
  stock.loseReserveReplies = true;
  await expect(store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" })).rejects.toThrow();
  expect(await store.listForCustomer("jane")).toEqual([]);
  expect((await cart.get("jane")).lines).toHaveLength(2);
  expect(stock.remaining(stock.productForSize(first.id))).toBe(48);
  stock.loseReserveReplies = false;
  await maintenance.drain();
  await maintenance.drain();
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
});

test("an IMS outage during cancellation is retried durably without reopening the Order", async () => {
  const { stock, store, maintenance, first } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  stock.unavailable = true;
  await store.cancel("jane", order.id);
  expect((await store.listForCustomer("jane"))[0].status).toBe("cancelled");
  stock.unavailable = false;
  await maintenance.drain();
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
});

test.each(["gcash", "maya", "bank-transfer"])("%s expires at exactly 24 hours, releases stock and emails once", async method => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");
  const { db, stock, store, maintenance, first } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  const placed = new Date("2026-11-01T00:00:00Z");
  await db.update(orders).set({ createdAt: placed, paymentMethod: method }).where(eq(orders.id, order.id));
  const audit = vi.fn(async () => {}), email = vi.fn(async () => {});
  expect(await maintenance.expire(new Date("2026-11-01T23:59:59.999Z"))).toBe(0);
  expect((await store.listForCustomer("jane"))[0].status).toBe("confirmed");
  expect(await maintenance.expire(new Date("2026-11-02T00:00:00Z"))).toBe(1);
  await maintenance.drain();
  await maintenance.sendPending({ audit, email });
  await maintenance.expire(new Date("2026-11-03T00:00:00Z"));
  await maintenance.drain();
  await maintenance.sendPending({ audit, email });
  expect((await store.listForCustomer("jane"))[0].status).toBe("cancelled");
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
  expect(email).toHaveBeenCalledTimes(1);
  expect(email).toHaveBeenCalledWith(expect.objectContaining({ to: "jane@example.com", title: "Your order was cancelled", idempotencyKey: `order.unpaid-cancelled:${order.id}` }));
});

test.each(["cash-on-delivery", "paid", "preparing", "dispatched", "delivered", "received", "cancelled"])("expiry leaves %s Orders untouched", async state => {
  const { db, stock, store, maintenance, first } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: state === "cash-on-delivery" ? "cash-on-delivery" : "gcash" });
  await db.update(orders).set({ createdAt: new Date("2026-10-01T00:00:00Z"), ...(state === "cash-on-delivery" ? {} : { status: state }) }).where(eq(orders.id, order.id));
  expect(await maintenance.expire(new Date("2026-11-01T00:00:00Z"))).toBe(0);
  expect(stock.remaining(stock.productForSize(first.id))).toBe(48);
  expect((await store.listForCustomer("jane"))[0].status).toBe(state === "cash-on-delivery" ? "confirmed" : state);
});

test("abandoned checkout recovery survives a process crash before Order commit", async () => {
  const { cart, stock, maintenance, first } = await fixture();
  const snapshot = await cart.get("jane");
  const id = await maintenance.begin("jane", snapshot);
  await maintenance.reserve(id, snapshot); // simulate a worker dying before it can commit the Order
  expect(stock.remaining(stock.productForSize(first.id))).toBe(48);
  await maintenance.drain(new Date(Date.now() + 11 * 60_000));
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
});

test("expiry email waits for stock release and retries an ambiguous gateway acknowledgement with the same key", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");
  const { db, store, stock, maintenance } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  await db.update(orders).set({ createdAt: new Date("2026-10-01T00:00:00Z") }).where(eq(orders.id, order.id));
  await maintenance.expire(new Date("2026-11-01T00:00:00Z"));
  const audit = vi.fn(async () => {});
  const received = new Set<string>();
  let dropAcknowledgement = true;
  const email = vi.fn(async (message: import("../lib/notifications/gateway").AppEmail) => {
    received.add(message.idempotencyKey!);
    if (dropAcknowledgement) { dropAcknowledgement = false; throw new Error("Acknowledgement lost"); }
  });
  stock.unavailable = true;
  await maintenance.drain();
  await maintenance.sendPending({ audit, email });
  expect(email).not.toHaveBeenCalled();
  stock.unavailable = false;
  await maintenance.drain();
  await maintenance.sendPending({ audit, email });
  await maintenance.sendPending({ audit, email });
  expect(received).toEqual(new Set([`order.unpaid-cancelled:${order.id}`]));
  expect(email).toHaveBeenCalledTimes(2);
});
