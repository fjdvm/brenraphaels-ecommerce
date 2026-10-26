import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { customers, orders, orderReturns, returnStatuses } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { createOrderReceiptStore } from "../lib/orders/receipt";
import { createOrderStore } from "../lib/orders/orders";
import { createDeliveryPhotoRetentionStore } from "../lib/orders/delivery-photo-retention";

const client = new PGlite();
const db = drizzle(client);
const store = createOrderStore(db);
const now = new Date("2026-10-26T12:00:00Z");
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(customers).values({ id: "retention", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
    email: "retention@example.com", contactNumber: "09171234567", marketingOptIn: false });
});
beforeEach(async () => {
  await db.delete(orderReturns);
  await db.delete(orders);
});
afterAll(async () => { await client.close(); });

test("removes a received Order's photo at seven days and records removal through the Order store", async () => {
  const [order] = await db.insert(orders).values({ customerId: "retention", status: "received", fulfillmentMethod: "delivery",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, deliveryPhotoFileId: "received-photo",
    deliveredAt: new Date("2026-10-01T12:00:00Z"), receivedAt: new Date("2026-10-19T12:00:00Z") }).returning();
  const deleted: string[] = [];
  const retention = createDeliveryPhotoRetentionStore(db, async (id) => { deleted.push(id); });
  expect(await retention.removeDue(new Date("2026-10-26T11:59:59.999Z"))).toEqual({ removed: 0, failed: 0 });
  expect(await retention.removeDue(now)).toEqual({ removed: 1, failed: 0 });
  expect(deleted).toEqual(["received-photo"]);
  expect((await store.listForCustomer("retention")).find((row) => row.id === order.id)).toMatchObject({
    deliveryPhotoFileId: null, deliveryPhotoRemovedAt: now,
  });
  expect(await retention.removeDue(now)).toEqual({ removed: 0, failed: 0 });
  expect(deleted).toEqual(["received-photo"]);
});

test("a never-received Order keeps its photo until exactly eight days after delivery", async () => {
  const [order] = await db.insert(orders).values({ customerId: "retention", status: "delivered", fulfillmentMethod: "delivery",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, deliveryPhotoFileId: "delivered-photo",
    deliveredAt: new Date("2026-10-18T12:00:00Z") }).returning();
  const deleted: string[] = [];
  const retention = createDeliveryPhotoRetentionStore(db, async (id) => { deleted.push(id); });
  expect(await retention.removeDue(new Date("2026-10-26T11:59:59.999Z"))).toEqual({ removed: 0, failed: 0 });
  expect(await retention.removeDue(now)).toEqual({ removed: 1, failed: 0 });
  expect(deleted).toEqual(["delivered-photo"]);
  expect((await store.listForCustomer("retention")).find((row) => row.id === order.id)?.deliveryPhotoRemovedAt).toEqual(now);
});

test.each(returnStatuses)("only an open Return holds an overdue photo: %s", async (status) => {
  const [order] = await db.insert(orders).values({ customerId: "retention", status: "delivered", fulfillmentMethod: "delivery",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, deliveryPhotoFileId: "held-photo",
    deliveredAt: new Date("2026-10-01T12:00:00Z") }).returning();
  const [claim] = await db.insert(orderReturns).values({ orderId: order.id, status, reason: "damaged", amountInCentavos: 10000 }).returning();
  const deleted: string[] = [];
  const retention = createDeliveryPhotoRetentionStore(db, async (id) => { deleted.push(id); });
  if (["requested", "approved", "goods received"].includes(status)) {
    // A decided Return alongside an open one must not release the hold.
    await db.insert(orderReturns).values({ orderId: order.id, status: "declined", reason: "damaged", amountInCentavos: 10000 });
    expect(await retention.removeDue(now)).toEqual({ removed: 0, failed: 0 });
    expect(deleted).toEqual([]);
    expect((await store.listForCustomer("retention"))[0]).toMatchObject({ deliveryPhotoFileId: "held-photo", deliveryPhotoRemovedAt: null });
    await db.update(orderReturns).set({ status: "refunded" }).where(eq(orderReturns.id, claim.id));
  }
  expect(await retention.removeDue(now)).toEqual({ removed: 1, failed: 0 });
  expect(deleted).toEqual(["held-photo"]);
});

test("receipt starts a fresh seven-day timer even when delivery was long ago", async () => {
  const [order] = await db.insert(orders).values({ customerId: "retention", status: "delivered", fulfillmentMethod: "delivery",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, deliveryPhotoFileId: "new-receipt",
    deliveredAt: new Date("2026-01-01T12:00:00Z") }).returning();
  const before = new Date();
  await createOrderReceiptStore(db).markReceived("retention", order.id);
  const after = new Date();
  const retention = createDeliveryPhotoRetentionStore(db, async () => {});
  expect(await retention.removeDue(new Date(before.getTime() + 7 * 86400000 - 1))).toEqual({ removed: 0, failed: 0 });
  expect(await retention.removeDue(new Date(after.getTime() + 7 * 86400000))).toEqual({ removed: 1, failed: 0 });
});

test("a deletion failure preserves the photo for retry and does not stop other Orders", async () => {
  await db.insert(orders).values(["retry-photo", "other-photo"].map((id) => ({ customerId: "retention", status: "delivered",
    fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, deliveryPhotoFileId: id,
    deliveredAt: new Date("2026-10-01T12:00:00Z") })));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const deleted: string[] = [];
  let fail = true;
  const retention = createDeliveryPhotoRetentionStore(db, async (id) => {
    if (id === "retry-photo" && fail) throw new Error("Storage unavailable");
    deleted.push(id);
  });
  try {
    expect(await retention.removeDue(now)).toEqual({ removed: 1, failed: 1 });
    expect((await store.listForCustomer("retention")).find((o) => o.deliveryPhotoFileId === "retry-photo"))
      .toMatchObject({ deliveryPhotoRemovedAt: null });
    fail = false;
    expect(await retention.removeDue(now)).toEqual({ removed: 1, failed: 0 });
    expect(deleted).toEqual(["other-photo", "retry-photo"]);
  } finally { log.mockRestore(); }
});

test("legacy Orders with unknown receipt or delivery times and Orders without photos are left alone", async () => {
  await db.insert(orders).values([
    { status: "received", deliveredAt: new Date("2026-01-01"), deliveryPhotoFileId: "unknown-receipt" },
    { status: "delivered", deliveredAt: null, deliveryPhotoFileId: "unknown-delivery" },
    { status: "dispatched", deliveredAt: new Date("2026-01-01"), deliveryPhotoFileId: "not-delivered" },
    { status: "delivered", deliveredAt: new Date("2026-01-01"), deliveryPhotoFileId: null },
  ].map((row) => ({ ...row, customerId: "retention", fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000 })));
  const deleted: string[] = [];
  expect(await createDeliveryPhotoRetentionStore(db, async (id) => { deleted.push(id); }).removeDue(now)).toEqual({ removed: 0, failed: 0 });
  expect(deleted).toEqual([]);
  expect((await store.listForCustomer("retention")).every((o) => o.deliveryPhotoRemovedAt === null)).toBe(true);
});

test("overlapping runs delete a photo only once", async () => {
  await db.insert(orders).values({ customerId: "retention", status: "delivered", fulfillmentMethod: "delivery",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, deliveryPhotoFileId: "concurrent-photo",
    deliveredAt: new Date("2026-10-01T12:00:00Z") });
  const deleted: string[] = [];
  const retention = createDeliveryPhotoRetentionStore(db, async (id) => { deleted.push(id); });
  const results = await Promise.all([retention.removeDue(now), retention.removeDue(now)]);
  expect(results.reduce((total, result) => total + result.removed, 0)).toBe(1);
  expect(results.every((result) => result.failed === 0)).toBe(true);
  expect(deleted).toEqual(["concurrent-photo"]);
});
