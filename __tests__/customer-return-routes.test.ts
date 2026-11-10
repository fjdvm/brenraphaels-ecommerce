import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { customers, orders, orderLines, orderReturns, orderReturnHistory } from "../lib/db/schema";
import { createTestDatabase } from "./helpers/test-database";

const { currentVisitor, getDatabase, revalidatePath, prepare, read } = vi.hoisted(() => ({
  currentVisitor: vi.fn(), getDatabase: vi.fn(), revalidatePath: vi.fn(), prepare: vi.fn(), read: vi.fn(),
}));
vi.mock("../lib/customer/current-visitor", () => ({ currentVisitor }));
vi.mock("../lib/db", () => ({ getDatabase }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("../lib/returns/evidence-files", async (original) => ({
  ...await original<typeof import("../lib/returns/evidence-files")>(), gatewayReturnEvidence: () => ({ prepare, read }),
}));

import { POST as requestReturn } from "../app/api/orders/[id]/returns/route";
import { POST as uploadEvidence } from "../app/api/orders/[id]/returns/uploads/route";
import { POST as cancelReturn } from "../app/api/returns/[id]/cancel/route";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let orderId: number;
let lineId: number;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZWQAAAAASUVORK5CYII=", "base64");
const context = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
function json(body: unknown) {
  return new Request("https://store.test/api/returns", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://store.test" }, body: JSON.stringify(body) });
}
const input = () => ({ orderLineIds: [lineId], reason: "damaged", note: "Broken seal.", preferredResolution: "refund", photoUploadTokens: ["photo-1"] });

beforeAll(async () => {
  client = await createTestDatabase();
  db = drizzle(client);
});
beforeEach(async () => {
  vi.clearAllMocks();
  getDatabase.mockReturnValue(db);
  currentVisitor.mockResolvedValue({ state: "customer", customer: { userId: "customer-1" } });
  read.mockResolvedValue({ id: "file-1", bytes: png });
  prepare.mockResolvedValue({ id: "file-1", uploadUrl: "https://storage.test/upload", uploadToken: "photo-1" });
  await client.exec("TRUNCATE customers CASCADE");
  await db.insert(customers).values({ id: "customer-1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
    email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
  const [order] = await db.insert(orders).values({ customerId: "customer-1", status: "delivered", fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, deliveredAt: new Date() }).returning();
  orderId = order.id;
  const [line] = await db.insert(orderLines).values({ orderId, productName: "Halaya", sizeLabel: "Small", quantity: 2, priceInCentavos: 5000 }).returning();
  lineId = line.id;
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await client.close(); });

test("the authenticated Customer uploads evidence, requests an RMA and cancels it through the HTTP endpoints", async () => {
  const upload = await uploadEvidence(json({ role: "photo", contentType: "image/png", size: png.length }), context(orderId));
  expect(upload.status).toBe(201);
  expect(await upload.json()).toMatchObject({ uploadUrl: "https://storage.test/upload", uploadToken: "photo-1" });
  const response = await requestReturn(json(input()), context(orderId));
  expect(response.status).toBe(201);
  const result = await response.json();
  expect(result).toEqual({ id: expect.any(Number), number: `RMA-${result.id}`, status: "requested" });
  const cancelled = await cancelReturn(new Request("https://store.test/api/returns", { method: "POST" }), context(result.id));
  expect(cancelled.status).toBe(200);
  expect(await cancelled.json()).toEqual({ id: result.id, status: "cancelled" });
  expect(await db.select().from(orderReturnHistory)).toMatchObject([{ status: "requested", actorId: "customer-1" }, { status: "cancelled", actorId: "customer-1" }]);
  expect(revalidatePath).toHaveBeenCalledTimes(2);
});

test.each(["signed-out", "needs-details"])("%s cannot access any Return mutation", async (state) => {
  currentVisitor.mockResolvedValue({ state });
  for (const post of [requestReturn, uploadEvidence, cancelReturn]) {
    const response = await post(json(input()), context(orderId));
    expect(response.status).toBe(401);
  }
  expect(getDatabase).not.toHaveBeenCalled();
});

test("cannot impersonate another Customer or select an inaccessible Order", async () => {
  currentVisitor.mockResolvedValue({ state: "customer", customer: { userId: "customer-2" } });
  expect((await requestReturn(json(input()), context(orderId))).status).toBe(404);
  expect((await uploadEvidence(json({ role: "photo", contentType: "image/png", size: 20 }), context(orderId))).status).toBe(404);
  currentVisitor.mockResolvedValue({ state: "customer", customer: { userId: "customer-1" } });
  expect((await requestReturn(json({ ...input(), customerId: "customer-2" }), context(orderId))).status).toBe(400);
  expect(read).not.toHaveBeenCalled();
});

test("returns clear conflicts for overlapping requests and repeated cancellation", async () => {
  const response = await requestReturn(json(input()), context(orderId));
  const result = await response.json();
  expect((await requestReturn(json(input()), context(orderId))).status).toBe(409);
  expect((await cancelReturn(json({}), context(result.id))).status).toBe(200);
  expect((await cancelReturn(json({}), context(result.id))).status).toBe(409);
});

test("refuses malformed JSON, ids, non-JSON submissions and foreign origins", async () => {
  expect((await requestReturn(json(input()), context("12.5"))).status).toBe(400);
  expect((await requestReturn(new Request("https://store.test/api/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }), context(orderId))).status).toBe(400);
  expect((await requestReturn(new Request("https://store.test/api/returns", { method: "POST", body: JSON.stringify(input()) }), context(orderId))).status).toBe(400);
  const crossOrigin = json(input());
  crossOrigin.headers.set("origin", "https://attacker.test");
  expect((await requestReturn(crossOrigin, context(orderId))).status).toBe(403);
  expect((await cancelReturn(json({ status: "approved" }), context(1))).status).toBe(400);
  expect(await db.select().from(orderReturns)).toEqual([]);
});

test("file-storage failure does not persist a Return or expose internal error details", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  read.mockRejectedValueOnce(new Error("secret upstream details"));
  const response = await requestReturn(json(input()), context(orderId));
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("secret");
  expect(await db.select().from(orderReturns)).toEqual([]);
  expect(revalidatePath).not.toHaveBeenCalled();
});
