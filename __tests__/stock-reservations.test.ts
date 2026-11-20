import { drizzle } from "drizzle-orm/pglite";
import { afterEach, expect, test } from "vitest";
import { createTestDatabase } from "./helpers/test-database";
import { customers, products, sizes } from "../lib/db/schema";
import { createCartStore } from "../lib/orders/cart";
import { createOrderStore } from "../lib/orders/orders";

const clients: Awaited<ReturnType<typeof createTestDatabase>>[] = [];
afterEach(async () => { vi.unstubAllEnvs(); vi.restoreAllMocks(); for (const client of clients.splice(0)) await client.close(); });

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
import { orderLines, orders, stockOutbox } from "../lib/db/schema";
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
  const scheduled: Promise<void>[] = [];
  const store = createOrderStore(db, undefined, stock, work => { scheduled.push(work()); });
  return { client, db, cart, stock, store, first, second, scheduled, maintenance: createStockReservations(db, stock) };
}

test("zero available stock blocks checkout and says which item is sold out", async () => {
  const { cart, stock, store, first } = await fixture();
  stock.available.set(stock.productForSize(first.id), 0);
  await expect(store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" })).rejects.toThrow("Ube (250g): Sold out");
  expect(await store.listForCustomer("jane")).toEqual([]);
  expect((await cart.get("jane")).lines).toHaveLength(2);
});

test("Customer and Staff cancellations release stock, with replay-safe audit events", async () => {
  const { cart, stock, store, maintenance, first, second, scheduled } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  await store.cancel("jane", order.id, "Changed my mind");
  await Promise.all(scheduled);
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
  await Promise.all(scheduled);
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
});

test("partial cancellation releases only the cancelled whole line", async () => {
  const { db, stock, store, first, second, scheduled } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  const [line] = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
  await store.cancelItems(order.id, [line.id], { staffId: "ana", staffName: "Ana" }, "confirmed");
  await Promise.all(scheduled);
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
  const { stock, store, maintenance, first, scheduled } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  stock.unavailable = true;
  await store.cancel("jane", order.id, "Changed my mind");
  await Promise.all(scheduled);
  expect((await store.listForCustomer("jane"))[0].status).toBe("cancelled");
  stock.unavailable = false;
  await maintenance.drain();
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
});

test.each(["gcash", "maya", "bank-transfer"])("%s expires at exactly 24 hours, releases stock and leaves one expiry record", async method => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");
  const { client, db, stock, store, maintenance, first } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  const placed = new Date("2026-11-01T00:00:00Z");
  await db.update(orders).set({ confirmedAt: placed, paymentMethod: method }).where(eq(orders.id, order.id));
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
  // The Customer's email is the storefront's own Payment expired email (sent by the expiry sweep); the gateway gets none.
  expect(email).not.toHaveBeenCalled();
  const { rows } = await client.query("select idempotency_key from customer_notifications where order_id = $1", [order.id]);
  expect(rows).toContainEqual({ idempotency_key: `order.expired:${order.id}` });
});

test.each(["cash-on-delivery", "paid", "preparing", "dispatched", "delivered", "received", "cancelled"])("expiry leaves %s Orders untouched", async state => {
  const { db, stock, store, maintenance, first } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: state === "cash-on-delivery" ? "cash-on-delivery" : "gcash" });
  await db.update(orders).set({ confirmedAt: new Date("2026-10-01T00:00:00Z"), ...(state === "cash-on-delivery" ? {} : { status: state }) }).where(eq(orders.id, order.id));
  expect(await maintenance.expire(new Date("2026-11-01T00:00:00Z"))).toBe(0);
  expect(stock.remaining(stock.productForSize(first.id))).toBe(48);
  expect((await store.listForCustomer("jane"))[0].status).toBe(state === "cash-on-delivery" ? "confirmed" : state);
});

test("the 24-hour clock starts at confirmation, not placement, and unconfirmed Orders never expire", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");
  const { db, store, maintenance, stock, first } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  await db.update(orders).set({ status: "placed", createdAt: new Date("2026-10-01T00:00:00Z"), confirmedAt: null }).where(eq(orders.id, order.id));
  expect(await maintenance.expire(new Date("2026-11-01T00:00:00Z"))).toBe(0);
  await db.update(orders).set({ status: "confirmed", confirmedAt: new Date("2026-10-31T12:00:00Z") }).where(eq(orders.id, order.id));
  expect(await maintenance.expire(new Date("2026-11-01T11:59:59.999Z"))).toBe(0);
  expect(stock.remaining(stock.productForSize(first.id))).toBe(48);
  expect(await maintenance.expire(new Date("2026-11-01T12:00:00Z"))).toBe(1);
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

test.each(["confirmed", "awaiting payment"])("expiry includes unpaid %s Orders", async status => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");
  const { db, store, maintenance, stock, first } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  await db.update(orders).set({ status, confirmedAt: new Date("2026-11-01T00:00:00Z") }).where(eq(orders.id, order.id));
  expect(await maintenance.expire(new Date("2026-11-02T00:00:00Z"))).toBe(1);
  await maintenance.drain();
  expect((await store.listForCustomer("jane"))[0].status).toBe("cancelled");
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
});

test("two simultaneous checkouts of one Cart place only one Order", async () => {
  const { store, stock, first } = await fixture();
  const input = { fulfillmentMethod: "pickup", paymentMethod: "gcash" } as const;
  const attempts = await Promise.allSettled([store.place("jane", input), store.place("jane", input)]);
  expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(await store.listForCustomer("jane")).toHaveLength(1);
  expect(stock.remaining(stock.productForSize(first.id))).toBe(48);
});


test("recovery retains one audit per released line when a later external release fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { cart, stock, maintenance, second } = await fixture();
  const snapshot = await cart.get("jane");
  const id = await maintenance.begin("jane", snapshot);
  await maintenance.reserve(id, snapshot);
  await maintenance.abandon(id);
  stock.failReleaseProduct = stock.productForSize(second.id);
  await maintenance.drain();
  stock.failReleaseProduct = undefined;
  await maintenance.drain();
  const audit = vi.fn(async () => {});
  await maintenance.sendPending({ audit, email: async () => {} });
  await maintenance.sendPending({ audit, email: async () => {} });
  expect(audit).toHaveBeenCalledTimes(2);
  expect(audit.mock.calls).toEqual(expect.arrayContaining([
    [expect.objectContaining({ action: "order.stock_released", idempotency_key: `order.stock_released:${id}:size-1` })],
    [expect.objectContaining({ action: "order.stock_released", idempotency_key: `order.stock_released:${id}:size-2` })],
  ]));
});

test("a cancellation confirms before deferred IMS recovery runs", async () => {
  const { db, stock, store } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  const work: (() => Promise<void>)[] = [];
  const staffStore = createOrderStore(db, undefined, stock, task => { work.push(task); });
  stock.unavailable = true;
  expect((await staffStore.advance(order.id, { status: "cancelled", staffId: "ana", staffName: "Ana" })).status).toBe("cancelled");
  expect(work).toHaveLength(1);
  stock.unavailable = false;
  await work[0]();
  expect(stock.remaining(101)).toBe(50);
});

test("packing deducts each reserved Size once and records the packing Staff and time", async () => {
  const { store, stock } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  const packed = await store.advance(order.id, { status: "preparing", staffId: "ana", staffName: "Ana" });
  expect(packed).toMatchObject({ status: "preparing", packedBy: { id: "ana", name: "Ana", at: expect.any(Date) } });
  expect([...stock.reservations.values()].map(line => line.state)).toEqual(["deducted", "deducted"]);
  await expect(store.advance(order.id, { status: "preparing", staffId: "ben", staffName: "Ben" })).rejects.toThrow();
  expect((await store.listForCustomer("jane"))[0]).toMatchObject({ packedBy: { id: "ana", name: "Ana", at: packed.packedBy?.at } });
});

test("partial packing failure fences cancellation and resumes without double deduction", async () => {
  const { store, stock, second } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  stock.failDeductProduct = stock.productForSize(second.id);
  await expect(store.advance(order.id, { status: "preparing", staffId: "ana", staffName: "Ana" })).rejects.toThrow();
  expect((await store.listForCustomer("jane"))[0]).toMatchObject({ status: "confirmed", packedBy: null });
  await expect(store.cancel("jane", order.id, "Changed my mind")).rejects.toThrow();
  await expect(store.cancelItems(order.id, [1], { staffId: "ben", staffName: "Ben" }, "confirmed")).rejects.toThrow("Packing has started");
  stock.failDeductProduct = undefined;
  expect(await store.advance(order.id, { status: "preparing", staffId: "ana", staffName: "Ana" })).toMatchObject({ status: "preparing", packedBy: { id: "ana" } });
  expect(stock.deductions).toBe(2);
});

test("a lost deduction reply resumes under another Staff member without deducting twice", async () => {
  const { store, stock } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  stock.loseDeductReplies = true;
  await expect(store.advance(order.id, { status: "preparing", staffId: "ana", staffName: "Ana" })).rejects.toThrow();
  stock.loseDeductReplies = false;
  expect(await store.advance(order.id, { status: "preparing", staffId: "ben", staffName: "Ben" })).toMatchObject({ packedBy: { id: "ben", name: "Ben" } });
  expect(stock.deductions).toBe(2);
});

test("cancelling a packed Order adds deducted items back once", async () => {
  const { store, stock, scheduled, maintenance } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  await store.advance(order.id, { status: "preparing", staffId: "ana", staffName: "Ana" });
  await store.advance(order.id, { status: "cancelled", staffId: "ana", staffName: "Ana" });
  await Promise.all(scheduled);
  await maintenance.drain();
  expect([...stock.reservations.values()].map(line => line.state)).toEqual(["added_back", "added_back"]);
  expect(await stock.read(1)).toEqual({ quantity: 50, reserved: 0, available: 50 });
});

test("packing audit survives a lost acknowledgement and keeps the original Staff and time", async () => {
  const { store, maintenance } = await fixture();
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  const packed = await store.advance(order.id, { status: "preparing", staffId: "ana", staffName: "Ana" });
  const accepted = new Map<string, import("../lib/audit/gateway").AuditEvent>();
  let loseReply = true;
  const audit = vi.fn(async (event: import("../lib/audit/gateway").AuditEvent) => {
    accepted.set(event.idempotency_key!, event);
    if (event.action === "order.packed" && loseReply) { loseReply = false; throw new Error("Reply lost"); }
  });
  await maintenance.sendPending({ audit, email: async () => {} });
  await maintenance.sendPending({ audit, email: async () => {} });
  expect([...accepted.values()].filter(event => event.action === "order.packed")).toEqual([
    expect.objectContaining({ actor: { type: "staff", id: "ana", display_name: "Ana" }, occurred_at: packed.packedBy!.at.toISOString() }),
  ]);
  expect(audit.mock.calls.filter(([event]) => event.action === "order.packed").map(([event]) => event.idempotency_key)).toEqual([`order:${order.id}:order.packed`, `order:${order.id}:order.packed`]);
});

async function confirmed(window?: number) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");
  const f = await fixture();
  const order = await f.store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  const placed = await f.db.select().from(orders).where(eq(orders.id, order.id));
  expect(placed[0].paymentDeadlineAt).toBeNull();
  return { ...f, order };
}

test("confirming saves the confirmation time and the Admin's payment deadline together", async () => {
  const f = await fixture();
  const store = createOrderStore(f.db, undefined, f.stock, () => {}, async () => null, async () => 48);
  const order = await store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  const total = order.subtotalInCentavos;
  await f.db.update(orders).set({ status: "placed" }).where(eq(orders.id, order.id));
  await store.confirm(order.id, { subtotalInCentavos: total, approvedDiscountInCentavos: 0, totalInCentavos: total, deliveryFeeInCentavos: null });
  const [row] = await f.db.select().from(orders).where(eq(orders.id, order.id));
  expect(row.confirmedAt).not.toBeNull();
  expect(row.paymentDeadlineAt!.getTime() - row.confirmedAt!.getTime()).toBe(48 * 3_600_000);
  const again = await store.confirm(order.id, { subtotalInCentavos: total, approvedDiscountInCentavos: 0, totalInCentavos: total, deliveryFeeInCentavos: null });
  expect(again.replayed).toBe(true);
  const [after] = await f.db.select().from(orders).where(eq(orders.id, order.id));
  expect(after.paymentDeadlineAt).toEqual(row.paymentDeadlineAt);
});

test("an unreadable window setting defaults to 24 hours", async () => {
  const f = await fixture();
  const order = await f.store.place("jane", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  await f.db.update(orders).set({ status: "placed" }).where(eq(orders.id, order.id));
  await f.store.confirm(order.id, { subtotalInCentavos: order.subtotalInCentavos, approvedDiscountInCentavos: 0, totalInCentavos: order.subtotalInCentavos, deliveryFeeInCentavos: null });
  const [row] = await f.db.select().from(orders).where(eq(orders.id, order.id));
  expect(row.paymentDeadlineAt!.getTime() - row.confirmedAt!.getTime()).toBe(24 * 3_600_000);
});

test("expiry follows the saved deadline, not a fixed 24 hours", async () => {
  const { db, store, maintenance, order } = await confirmed();
  await db.update(orders).set({ status: "confirmed", confirmedAt: new Date("2026-11-01T00:00:00Z"), paymentDeadlineAt: new Date("2026-11-03T00:00:00Z") }).where(eq(orders.id, order.id));
  expect(await maintenance.expire(new Date("2026-11-02T12:00:00Z"))).toBe(0);
  expect(await maintenance.expire(new Date("2026-11-03T00:00:00Z"))).toBe(1);
  expect((await store.listForCustomer("jane"))[0].status).toBe("cancelled");
});

test("a proof waiting for Staff pauses expiry; a rejected proof does not, and expiry cancels once", async () => {
  const { db, stock, store, maintenance, order, first } = await confirmed();
  const past = new Date("2026-11-01T00:00:00Z"), later = new Date("2026-12-01T00:00:00Z");
  await db.update(orders).set({ status: "awaiting payment", confirmedAt: past, paymentDeadlineAt: past, paymentProofSubmittedAt: past, paymentProofRejectedAt: null }).where(eq(orders.id, order.id));
  expect(await maintenance.expire(later)).toBe(0);
  expect((await store.listForCustomer("jane"))[0].status).toBe("awaiting payment");
  await db.update(orders).set({ paymentProofRejectedAt: past }).where(eq(orders.id, order.id));
  expect(await maintenance.expire(later)).toBe(1);
  expect(await maintenance.expire(later)).toBe(0);
  await maintenance.drain();
  await maintenance.drain();
  expect(stock.remaining(stock.productForSize(first.id))).toBe(50);
});

test("a first proof after the deadline is refused; one in time is accepted", async () => {
  const { db, store, order } = await confirmed();
  await db.update(orders).set({ status: "confirmed", confirmedAt: new Date("2026-01-01T00:00:00Z"), paymentDeadlineAt: new Date("2026-01-02T00:00:00Z") }).where(eq(orders.id, order.id));
  await expect(store.submitPaymentProof("jane", order.id, { gcashReferenceNumber: "1234567890123" } as never)).rejects.toThrow("deadline");
});
