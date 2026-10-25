import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

import { customers, orders, orderLines, orderReturns, orderReturnImages, orderReturnItems } from "../lib/db/schema";
import { createOrderStore } from "../lib/orders/orders";
import { listCustomerReturns } from "../lib/returns/customer-reads";

const { currentVisitor, getDatabase } = vi.hoisted(() => ({ currentVisitor: vi.fn(), getDatabase: vi.fn() }));
vi.mock("../lib/customer/current-visitor", () => ({ currentVisitor }));
vi.mock("../lib/db", () => ({ getDatabase }));
import { GET } from "../app/api/returns/route";

let client: PGlite;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await migrate(db, { migrationsFolder: "drizzle" });
});
afterAll(async () => { await client.close(); });

async function customer(id: string) {
  await db.insert(customers).values({ id, firstName: "Maria", lastName: id, fullName: `Maria ${id}`,
    email: `${id}@example.com`, contactNumber: "09171234567", marketingOptIn: false });
}
async function order(customerId: string, extra: Partial<typeof orders.$inferInsert> = {}) {
  const [row] = await db.insert(orders).values({ customerId, status: "delivered", fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, ...extra }).returning();
  const [line] = await db.insert(orderLines).values({ orderId: row.id, productName: "Halaya", sizeLabel: "Small", quantity: 2, priceInCentavos: 5000 }).returning();
  return { orderId: row.id, lineId: line.id };
}
async function aReturn(o: { orderId: number; lineId: number }, values: Partial<typeof orderReturns.$inferInsert>, photos: string[] = ["photo-a"]) {
  const [row] = await db.insert(orderReturns).values({ orderId: o.orderId, reason: "damaged", amountInCentavos: 10000, ...values }).returning();
  await db.insert(orderReturnItems).values({ returnId: row.id, orderLineId: o.lineId, productName: "Halaya", sizeLabel: "Small", quantity: 2, priceInCentavos: 5000 });
  await db.insert(orderReturnImages).values(photos.map((fileId, index) => ({ returnId: row.id, position: index + 1, fileId })));
  return row;
}

beforeEach(async () => {
  await client.exec("TRUNCATE customers CASCADE");
  await customer("c1");
  await customer("c2");
});

test("a Customer sees only their own Returns, newest first, in every status", async () => {
  const mine = await order("c1");
  const theirs = await order("c2");
  const first = await aReturn(mine, { status: "cancelled", requestedAt: new Date("2026-10-20T08:00:00Z") });
  const second = await aReturn(theirs, { requestedAt: new Date("2026-10-21T08:00:00Z") });
  const third = await aReturn(mine, { status: "requested", requestedAt: new Date("2026-10-22T08:00:00Z") });

  const result = await listCustomerReturns(db, "c1");
  expect(result.map((r) => r.id)).toEqual([third.id, first.id]);
  expect(result.map((r) => r.id)).not.toContain(second.id);
  expect(await listCustomerReturns(db, "nobody")).toEqual([]);
});

test("a Return carries its number, Order, items, Resolutions, evidence, decline reason and refund proof", async () => {
  const o = await order("c1");
  const declined = await aReturn(o, { status: "declined", declineReason: "No defect visible.", requestedAt: new Date("2026-10-20T08:00:00Z") });
  const refunded = await aReturn(o, { status: "refunded", preferredResolution: "replacement", finalResolution: "refund",
    goodsRequired: false, videoFileId: "video-1", refundProofFileId: "proof-1", refundedAt: new Date("2026-10-23T08:00:00Z"),
    requestedAt: new Date("2026-10-21T08:00:00Z") }, ["photo-a", "photo-b"]);

  const [r, d] = await listCustomerReturns(db, "c1");
  expect(r).toMatchObject({ id: refunded.id, number: `RMA-${refunded.id}`, orderId: o.orderId, status: "refunded",
    preferredResolution: "replacement", finalResolution: "refund", declineReason: null, refundProofFileId: "proof-1",
    videoFileId: "video-1", photoFileIds: ["photo-a", "photo-b"], amountInCentavos: 10000,
    items: [{ productName: "Halaya", sizeLabel: "Small", quantity: 2, priceInCentavos: 5000 }] });
  expect(d).toMatchObject({ id: declined.id, status: "declined", declineReason: "No defect visible.", refundProofFileId: null, finalResolution: null });
});

test("Orders expose the Delivery photo, or null for Orders delivered earlier", async () => {
  const withPhoto = await order("c1", { deliveryPhotoFileId: "delivery-1" });
  const without = await order("c1");
  const orderList = await createOrderStore(db).listForCustomer("c1");
  expect(orderList.find((o) => o.id === withPhoto.orderId)?.deliveryPhotoFileId).toBe("delivery-1");
  expect(orderList.find((o) => o.id === without.orderId)?.deliveryPhotoFileId).toBeNull();
});

test("GET /api/returns requires a signed-in Customer and returns only their Returns", async () => {
  getDatabase.mockReturnValue(db);
  const r = await aReturn(await order("c1"), {});
  await aReturn(await order("c2"), {});
  currentVisitor.mockResolvedValue({ state: "anonymous" });
  expect((await GET()).status).toBe(401);
  currentVisitor.mockResolvedValue({ state: "customer", customer: { userId: "c1" } });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const body = await response.json();
  expect(body.returns.map((x: { id: number }) => x.id)).toEqual([r.id]);
});
