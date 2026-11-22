import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createTestDatabase } from "./helpers/test-database";
import { FakeShopStock } from "./helpers/fake-shop-stock";
import { customers, orderLines, orderReturnItems, orderReturns, orders, stockOutbox, stockReservations } from "../lib/db/schema";
import { createReturnInspections } from "../lib/returns/inspection";
import { creomsReturnCredential, mintCreomsCredential } from "../lib/orders/creoms-credential";

const database = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDatabase: database.get }));
vi.mock("next/server", () => ({ after: () => {} }));

const clients: Awaited<ReturnType<typeof createTestDatabase>>[] = [];
beforeEach(() => vi.stubEnv("CREOMS_SERVICE_SECRET", "k".repeat(40)));
afterEach(async () => { vi.unstubAllEnvs(); for (const client of clients.splice(0)) await client.close(); });
const staff = { staffId: "ana", staffName: "Ana Reyes" };
const inspectionId = "2f1c0a5e-6b7d-4c8e-9f10-112233445566";

async function fixture(status: "goods received" | "approved" = "goods received") {
  const client = await createTestDatabase(); clients.push(client);
  const db = drizzle(client);
  await db.insert(customers).values({ id: "c1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos", email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
  const [order] = await db.insert(orders).values({ customerId: "c1", status: "delivered", fulfillmentMethod: "delivery", paymentMethod: "gcash",
    subtotalInCentavos: 50000, deliveryFeeInCentavos: 0, deliveredAt: new Date() }).returning();
  const [jam, halaya] = await db.insert(orderLines).values([
    { orderId: order.id, productName: "Ube Jam", sizeLabel: "200g", priceInCentavos: 21900, quantity: 1 },
    { orderId: order.id, productName: "Halaya tub", sizeLabel: "L", priceInCentavos: 14000, quantity: 2 },
  ]).returning();
  const stock = new FakeShopStock();
  const lines = [
    { lineId: "size-3", productId: 13, quantity: 1, sizeId: 3, cartLineId: 1, priceInCentavos: 21900, orderLineId: jam.id },
    { lineId: "size-4", productId: 14, quantity: 2, sizeId: 4, cartLineId: 2, priceInCentavos: 14000, orderLineId: halaya.id },
  ];
  for (const line of lines) { await stock.move("reserve", "orig", line); await stock.move("deduct", "orig", line); }
  await db.insert(stockReservations).values({ id: "orig", customerId: "c1", customerName: "Maria Santos", orderId: order.id, state: "placed",
    lines: lines.map(line => ({ ...line, deducted: true })) });
  const [ret] = await db.insert(orderReturns).values({ orderId: order.id, reason: "damaged", amountInCentavos: 49900, status,
    preferredResolution: "refund", finalResolution: "refund", goodsRequired: true }).returning();
  await db.insert(orderReturnItems).values([
    { returnId: ret.id, orderLineId: jam.id, productName: "Ube Jam", sizeLabel: "200g", quantity: 1, priceInCentavos: 21900 },
    { returnId: ret.id, orderLineId: halaya.id, productName: "Halaya tub", sizeLabel: "L", quantity: 2, priceInCentavos: 14000 },
  ]);
  database.get.mockReturnValue(db);
  return { db, ret, jam, halaya, stock, service: createReturnInspections(db, stock) };
}

const items = (jam: number, halaya: number) => [{ orderLineId: jam, condition: "sellable" }, { orderLineId: halaya, condition: "damaged" }];

test("records each item's condition and adds only the sellable ones back to IMS stock, once", async () => {
  const { db, ret, jam, halaya, stock, service } = await fixture();
  const before13 = stock.remaining(13), before14 = stock.remaining(14);
  const body = { action: "inspect", inspectionId, items: items(jam.id, halaya.id), ...staff };
  expect(await service.handle(ret.id, body)).toEqual({ id: ret.id, inspectionId, action: "inspect" });
  expect(await service.handle(ret.id, body)).toEqual({ id: ret.id, inspectionId, action: "inspect" });
  expect(stock.remaining(13)).toBe(before13 + 1);
  expect(stock.remaining(14)).toBe(before14);
  const rows = await db.select().from(orderReturnItems).where(eq(orderReturnItems.returnId, ret.id)).orderBy(orderReturnItems.orderLineId);
  expect(rows[0]).toMatchObject({ condition: "sellable", inspectionId, inspectedById: "ana", inspectedByName: "Ana Reyes", restockedAt: expect.any(Date) });
  expect(rows[1]).toMatchObject({ condition: "damaged", inspectionId, restockedAt: null });
  const [reservation] = await db.select().from(stockReservations);
  expect(reservation.lines.map(line => line.released ?? false)).toEqual([true, false]);
});

test("a restock that IMS could not confirm resumes on retry with the same inspection", async () => {
  const { db, ret, jam, halaya, stock, service } = await fixture();
  const body = { action: "inspect", inspectionId, items: items(jam.id, halaya.id), ...staff };
  stock.unavailable = true;
  await expect(service.handle(ret.id, body)).rejects.toThrow();
  expect((await db.select().from(orderReturnItems)).find(row => row.orderLineId === jam.id)).toMatchObject({ condition: "sellable", restockedAt: null });
  stock.unavailable = false;
  await service.handle(ret.id, body);
  expect((await db.select().from(orderReturnItems)).find(row => row.orderLineId === jam.id)?.restockedAt).toBeInstanceOf(Date);
});

test("refuses a Return that is not Goods received, a second different inspection, and missing items", async () => {
  const notReady = await fixture("approved");
  await expect(notReady.service.handle(notReady.ret.id, { action: "inspect", inspectionId, items: items(notReady.jam.id, notReady.halaya.id), ...staff }))
    .rejects.toThrow("not ready to inspect");
  const { ret, jam, halaya, service } = await fixture();
  await expect(service.handle(ret.id, { action: "inspect", inspectionId, items: [{ orderLineId: jam.id, condition: "sellable" }], ...staff }))
    .rejects.toThrow("Mark every item");
  await service.handle(ret.id, { action: "inspect", inspectionId, items: items(jam.id, halaya.id), ...staff });
  await expect(service.handle(ret.id, { action: "inspect", inspectionId: "7a1c0a5e-6b7d-4c8e-9f10-112233445566", items: items(jam.id, halaya.id), ...staff }))
    .rejects.toThrow("already inspected");
});

test("a write-off records the damaged items once, never adds them back, and emails the Customer once", async () => {
  const { db, ret, jam, halaya, stock, service } = await fixture();
  await expect(service.handle(ret.id, { action: "write-off", inspectionId, ...staff })).rejects.toThrow("Nothing to write off");
  await service.handle(ret.id, { action: "inspect", inspectionId, items: items(jam.id, halaya.id), ...staff });
  const before14 = stock.remaining(14);
  expect(await service.handle(ret.id, { action: "write-off", inspectionId, ...staff })).toEqual({ id: ret.id, inspectionId, action: "write-off" });
  expect(await service.handle(ret.id, { action: "write-off", inspectionId, ...staff })).toEqual({ id: ret.id, inspectionId, action: "write-off" });
  expect(stock.remaining(14)).toBe(before14);
  expect((await db.select().from(orderReturnItems)).find(row => row.orderLineId === halaya.id)?.writtenOffAt).toBeInstanceOf(Date);
  const [reservation] = await db.select().from(stockReservations);
  expect(reservation.lines.every(line => line.released)).toBe(true);
  const emails = (await db.select().from(stockOutbox)).filter(row => row.kind === "email");
  expect(emails).toEqual([expect.objectContaining({ payload: expect.objectContaining({ to: "maria@example.com", body: expect.stringContaining("Halaya tub") }) })]);
});

test("the route needs the Returns credential and echoes the inspection", async () => {
  const { ret, jam, halaya } = await fixture();
  const { POST } = await import("../app/api/internal/returns/[id]/inspection/route");
  const call = (token: string | null) => POST(new Request(`https://shop.test/api/internal/returns/${ret.id}/inspection`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: "inspect", inspectionId, items: items(jam.id, halaya.id).map(item => ({ ...item, condition: "damaged" })), ...staff }),
  }), { params: Promise.resolve({ id: String(ret.id) }) } as never);
  expect((await call(null)).status).toBe(401);
  const response = await call(mintCreomsCredential(creomsReturnCredential));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: ret.id, inspectionId, action: "inspect" });
});
