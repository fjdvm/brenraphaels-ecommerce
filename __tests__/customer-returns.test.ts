import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { customerNotifications, customers, orders, orderLines, orderReturnHistory, orderReturnImages, orderReturnItems, orderReturns, customerRefundDestinations } from "../lib/db/schema";
import { createCustomerReturns } from "../lib/returns/customer-returns";
import { createReturnStore } from "../lib/returns/returns";
import { createOrderReceiptStore } from "../lib/orders/receipt";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let orderId: number;
let lineIds: number[];
const at = new Date("2026-10-24T08:00:00Z");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZWQAAAAASUVORK5CYII=", "base64");
const files = { prepare: vi.fn(), read: vi.fn(async () => ({ id: "file-1", bytes: new Uint8Array(png) })) };
const request = () => ({ orderLineIds: lineIds, reason: "damaged", note: "  Broken seal.  ", preferredResolution: "replacement", photoUploadTokens: ["photo-1"] });
const service = () => createCustomerReturns(db, { files, now: () => at });

beforeAll(async () => {
  client = await createTestDatabase();
  db = drizzle(client);
});
beforeEach(async () => {
  await client.exec("TRUNCATE customers CASCADE");
  files.prepare.mockReset();
  files.read.mockReset().mockResolvedValue({ id: "file-1", bytes: new Uint8Array(png) });
  await db.insert(customers).values({ id: "customer-1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
    email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
  const [order] = await db.insert(orders).values({ customerId: "customer-1", status: "delivered", fulfillmentMethod: "delivery",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 25000, deliveryFeeInCentavos: 5000,
    deliveredAt: new Date(at.getTime() - 3600000) }).returning();
  orderId = order.id;
  const lines = await db.insert(orderLines).values([
    { orderId, productName: "Halaya", sizeLabel: "Small", quantity: 2, priceInCentavos: 10000 },
    { orderId, productName: "Jam", sizeLabel: "Small", quantity: 1, priceInCentavos: 5000 },
  ]).returning();
  lineIds = lines.map((line) => line.id);
});
afterAll(async () => { await client.close(); });
afterEach(() => { vi.useRealTimers(); });

test("requests whole lines, uploads verified evidence and records the RMA and Customer history atomically", async () => {
  const result = await service().request("customer-1", orderId, request());
  expect(result).toMatchObject({ number: `RMA-${result.id}`, status: "requested", amountInCentavos: 25000,
    note: "Broken seal.", preferredResolution: "replacement", requestedAt: at });
  expect(files.read).toHaveBeenCalledWith({ customerId: "customer-1", orderId }, "photo", "photo-1");
  expect(await db.select().from(orderReturnImages)).toMatchObject([{ fileId: "file-1", position: 1 }]);
  expect(await db.select().from(orderReturnItems)).toMatchObject([{ quantity: 2, priceInCentavos: 10000 }, { quantity: 1, priceInCentavos: 5000 }]);
  expect(await db.select().from(orderReturnHistory)).toMatchObject([{ status: "requested", actorType: "customer",
    actorId: "customer-1", actorName: "Maria Santos", occurredAt: at }]);
  expect(await db.select().from(orders)).toMatchObject([{ status: "delivered" }]);
  expect(await db.select().from(orderReturns)).toHaveLength(1);
  expect(await db.select().from(customerNotifications)).toMatchObject([{
    idempotencyKey: `return.requested:${result.id}`, customerId: "customer-1", type: "return.requested",
  }]);
});

test.each([
  ["the exact 24-hour cutoff", { deliveredAt: new Date(at.getTime() - 86400000) }, "24-hour"],
  ["after the cutoff", { deliveredAt: new Date(at.getTime() - 86400001) }, "24-hour"],
  ["undelivered", { status: "dispatched" }, "delivered"],
  ["received", { status: "received" }, "received"],
  ["unpaid GCash", { paymentMethod: "gcash", status: "awaiting payment", paidAt: null }, "payment"],
  ["missing delivery time", { deliveredAt: null }, "delivery time"],
  ["future delivery time", { deliveredAt: new Date(at.getTime() + 1) }, "delivery time"],
])("refuses %s before reading evidence", async (_label, update, message) => {
  await db.update(orders).set(update).where(eq(orders.id, orderId));
  await expect(service().request("customer-1", orderId, request())).rejects.toThrow(message);
  expect(files.read).not.toHaveBeenCalled();
  expect(await db.select().from(orderReturns)).toEqual([]);
});

test("accepts paid GCash, delivered Pickup, and the last millisecond of the window", async () => {
  await db.update(orders).set({ paymentMethod: "gcash", paidAt: new Date(at.getTime() - 86400000),
    fulfillmentMethod: "pickup", deliveredAt: new Date(at.getTime() - 86399999) }).where(eq(orders.id, orderId));
  expect(await service().request("customer-1", orderId, request())).toMatchObject({ amountInCentavos: 25000 });
});

test("the refund is what was paid after discounts, spread over the lines, with no Delivery fee", async () => {
  await db.update(orders).set({ approvedDiscountInCentavos: 5000 }).where(eq(orders.id, orderId));
  expect(await service().request("customer-1", orderId, request())).toMatchObject({ amountInCentavos: 20000 });
});

test("legacy GCash Orders delivered through the paid lifecycle remain eligible without paidAt attribution", async () => {
  await db.update(orders).set({ paymentMethod: "gcash", paidAt: null }).where(eq(orders.id, orderId));
  expect(await service().request("customer-1", orderId, request())).toMatchObject({ status: "requested" });
});

test("partial selections use purchased prices and exclude the Delivery fee", async () => {
  expect(await service().request("customer-1", orderId, { ...request(), orderLineIds: [lineIds[0]] }))
    .toMatchObject({ amountInCentavos: 20000 });
});

test("caps the refund at the recorded paid subtotal", async () => {
  await db.update(orders).set({ subtotalInCentavos: 20000 }).where(eq(orders.id, orderId));
  expect(await service().request("customer-1", orderId, request())).toMatchObject({ amountInCentavos: 20000 });
});

test("splitting an adjusted historical subtotal across Returns cannot multiply the refund cap", async () => {
  await db.update(orders).set({ subtotalInCentavos: 20000 }).where(eq(orders.id, orderId));
  expect(await service().request("customer-1", orderId, { ...request(), orderLineIds: [lineIds[0]] })).toMatchObject({ amountInCentavos: 16000 });
  expect(await service().request("customer-1", orderId, { ...request(), orderLineIds: [lineIds[1]] })).toMatchObject({ amountInCentavos: 4000 });
});

test.each([
  { orderLineIds: [] }, { orderLineIds: [99999] }, { orderLineIds: [1, 1] },
  { quantity: 1 }, { orderLineIds: [{ id: 1, quantity: 1 }] }, { amountInCentavos: 999999 },
  { reason: "changed my mind" }, { preferredResolution: "credit" }, { note: "bad\u000bnote" },
  { note: "<script>oops</script>" }, { photoUploadTokens: [] },
  { photoUploadTokens: ["a", "b", "c", "d"] }, { photoUploadTokens: ["a", "a"] },
  { videoUploadToken: ["a", "b"] }, { photoFileIds: ["foreign-file"] },
])("refuses malformed input without persistence: %j", async (update) => {
  await expect(service().request("customer-1", orderId, { ...request(), ...update })).rejects.toThrow();
  expect(files.read).not.toHaveBeenCalled();
  expect(await db.select().from(orderReturns)).toEqual([]);
});

test("unrelated lines and another Customer's Orders are refused", async () => {
  await expect(service().request("someone-else", orderId, request())).rejects.toThrow("not found");
  const [other] = await db.insert(orders).values({ customerId: "customer-1", status: "delivered", fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, deliveredAt: at }).returning();
  await expect(service().request("customer-1", other.id, request())).rejects.toThrow("belonging to this Order");
  expect(files.read).not.toHaveBeenCalled();
});

test.each(["requested", "approved", "goods received", "refunded", "replaced"] as const)("%s items cannot be requested again", async (status) => {
  const first = await service().request("customer-1", orderId, { ...request(), orderLineIds: [lineIds[0]] });
  await db.update(orderReturns).set({ status }).where(eq(orderReturns.id, first.id));
  await expect(service().request("customer-1", orderId, request())).rejects.toThrow("already in");
  expect(await service().request("customer-1", orderId, { ...request(), orderLineIds: [lineIds[1]] }))
    .toMatchObject({ amountInCentavos: 5000 });
});

test.each(["declined", "cancelled"] as const)("a new Return is allowed after %s", async (status) => {
  const first = await service().request("customer-1", orderId, request());
  if (status === "cancelled") await service().cancel("customer-1", first.id);
  else await createReturnStore(db).transition(first.id, { type: "staff", id: "ana", name: "Ana Reyes" }, { status: "declined", declineReason: "Please provide clearer photos." });
  expect(await service().request("customer-1", orderId, request())).toMatchObject({ status: "requested" });
});

test("only the owner can cancel a Requested Return, even after its window closes", async () => {
  const first = await service().request("customer-1", orderId, request());
  await expect(service().cancel("someone-else", first.id)).rejects.toThrow("not found");
  const later = createCustomerReturns(db, { files, now: () => new Date(at.getTime() + 86400000) });
  expect(await later.cancel("customer-1", first.id)).toMatchObject({ status: "cancelled" });
  await expect(later.cancel("customer-1", first.id)).rejects.toThrow("not allowed");
  expect(await db.select().from(orderReturnHistory)).toHaveLength(2);
});

test.each(["approved", "goods received", "refunded", "replaced", "declined"] as const)("Customers cannot cancel %s Returns", async (status) => {
  const first = await service().request("customer-1", orderId, request());
  await db.update(orderReturns).set({ status }).where(eq(orderReturns.id, first.id));
  await expect(service().cancel("customer-1", first.id)).rejects.toThrow("not allowed");
});

test("competing requests and competing approval/cancellation each have one winner", async () => {
  const results = await Promise.allSettled([service().request("customer-1", orderId, request()), service().request("customer-1", orderId, request())]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const [first] = await db.select().from(orderReturns);
  const moves = await Promise.allSettled([service().cancel("customer-1", first.id),
    createReturnStore(db).transition(first.id, { type: "staff", id: "ana", name: "Ana Reyes" }, { status: "approved" })]);
  expect(moves.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(await db.select().from(orderReturnHistory)).toHaveLength(2);
});

test("rechecks received status and elapsed time after reading evidence", async () => {
  files.read.mockImplementationOnce(async () => {
    await db.update(orders).set({ status: "received" }).where(eq(orders.id, orderId));
    return { id: "photo-1", bytes: new Uint8Array(png) };
  });
  await expect(service().request("customer-1", orderId, request())).rejects.toThrow("received");
  await db.update(orders).set({ status: "delivered" }).where(eq(orders.id, orderId));
  files.read.mockImplementationOnce(async () => {
    await db.update(orders).set({ deliveredAt: new Date(at.getTime() - 86400000) }).where(eq(orders.id, orderId));
    return { id: "photo-1", bytes: new Uint8Array(png) };
  });
  await expect(service().request("customer-1", orderId, request())).rejects.toThrow("24-hour");
  expect(await db.select().from(orderReturns)).toEqual([]);
});

test("requesting a Return and marking received race through the same Order lock", async () => {
  const results = await Promise.allSettled([
    service().request("customer-1", orderId, request()),
    createOrderReceiptStore(db).markReceived("customer-1", orderId),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  const returns = await db.select().from(orderReturns);
  expect(order.status === "received" ? returns.length === 0 : order.status === "delivered" && returns.length === 1).toBe(true);
});

test("a committed Return prevents receipt, and committed receipt prevents a Return", async () => {
  const first = await service().request("customer-1", orderId, request());
  await expect(createOrderReceiptStore(db).markReceived("customer-1", orderId)).rejects.toThrow("Return in progress");
  await service().cancel("customer-1", first.id);
  await createOrderReceiptStore(db).markReceived("customer-1", orderId);
  await expect(service().request("customer-1", orderId, request())).rejects.toThrow("received");
});

test("a history failure rolls back the Return and all snapshots", async () => {
  await client.exec("ALTER TABLE order_return_history ADD CONSTRAINT reject_request_history CHECK (false)");
  try {
    await expect(service().request("customer-1", orderId, request())).rejects.toThrow();
    expect(await db.select().from(orderReturns)).toEqual([]);
    expect(await db.select().from(orderReturnItems)).toEqual([]);
    expect(await db.select().from(orderReturnImages)).toEqual([]);
  } finally { await client.exec("ALTER TABLE order_return_history DROP CONSTRAINT reject_request_history"); }
});

test.each([new Uint8Array(), new TextEncoder().encode("<script>fake PNG</script>"), new Uint8Array(5 * 1024 * 1024 + 1)])("rejects empty, forged or oversized photo bytes", async (bytes) => {
  files.read.mockResolvedValueOnce({ id: "fake-photo", bytes });
  await expect(service().request("customer-1", orderId, request())).rejects.toThrow();
  expect(await db.select().from(orderReturns)).toEqual([]);
});

test("accepts three photos plus a video and stores only confirmed File ids", async () => {
  // ISO BMFF MP4 file-type header, independent of filename or browser MIME.
  const video = new Uint8Array(Buffer.from("00000018667479706d703432000000006d70343269736f6d", "hex"));
  files.read.mockResolvedValueOnce({ id: "photo-1", bytes: new Uint8Array(png) })
    .mockResolvedValueOnce({ id: "photo-2", bytes: new Uint8Array(png) })
    .mockResolvedValueOnce({ id: "photo-3", bytes: new Uint8Array(png) })
    .mockResolvedValueOnce({ id: "video-1", bytes: video });
  expect(await service().request("customer-1", orderId, { ...request(), photoUploadTokens: ["p1", "p2", "p3"], videoUploadToken: "v1" }))
    .toMatchObject({ videoFileId: "video-1" });
  expect(await db.select().from(orderReturnImages)).toHaveLength(3);
});

const destination = { method: "gcash", accountName: "  Maria  Santos ", accountNumber: "0917 123 4567", confirmed: true };
const refundRequest = (patch: Record<string, unknown> = {}) => ({ ...request(), preferredResolution: "refund", refundDestination: destination, ...patch });
const collected = () => db.update(orders).set({ codCollectedAt: at, codCollectedAmountInCentavos: 25000 }).where(eq(orders.id, orderId));

describe("Refund destination", () => {
  test("is stored cleaned on the Return and remembered as the Customer's next pre-fill", async () => {
    await collected();
    const result = await service().request("customer-1", orderId, refundRequest());
    expect(result).toMatchObject({ refundMethod: "gcash", refundAccountName: "Maria Santos", refundAccountNumber: "09171234567",
      refundBankName: null, refundDestinationConfirmedAt: at });
    expect(await db.select().from(customerRefundDestinations)).toMatchObject([{ customerId: "customer-1", method: "gcash",
      accountName: "Maria Santos", accountNumber: "09171234567", bankName: null }]);
  });

  test("is required for a refund, and never taken from the Order's payment proof", async () => {
    await collected();
    await db.update(orders).set({ paymentProofFileId: "proof-1" }).where(eq(orders.id, orderId));
    await expect(service().request("customer-1", orderId, refundRequest({ refundDestination: undefined }))).rejects.toThrow("refund details");
    expect(files.read).not.toHaveBeenCalled();
    expect(await db.select().from(orderReturns)).toEqual([]);
  });

  test.each([
    ["unconfirmed", { ...destination, confirmed: false }, "Confirm your refund details"],
    ["no method", { ...destination, method: "cheque" }, "where to send"],
    ["a wallet number that is not a mobile number", { ...destination, accountNumber: "12345" }, "11 digits"],
    ["a bank without a bank name", { method: "bank-transfer", accountName: "Maria Santos", accountNumber: "123456789", confirmed: true }, "bank name"],
  ])("refuses %s", async (_label, refundDestination, message) => {
    await collected();
    await expect(service().request("customer-1", orderId, refundRequest({ refundDestination }))).rejects.toThrow(message);
    expect(await db.select().from(orderReturns)).toEqual([]);
  });

  test("keeps the bank name only for a bank transfer", async () => {
    await collected();
    const result = await service().request("customer-1", orderId, refundRequest({ refundDestination: {
      method: "bank-transfer", accountName: "Maria Santos", accountNumber: "1234-5678-90", bankName: " BDO ", confirmed: true } }));
    expect(result).toMatchObject({ refundMethod: "bank-transfer", refundBankName: "BDO", refundAccountNumber: "1234567890" });
  });

  test("a Cash on Delivery Order whose cash was not collected has nothing to refund", async () => {
    await expect(service().request("customer-1", orderId, refundRequest())).rejects.toThrow("nothing to refund");
    expect(await db.select().from(orderReturns)).toEqual([]);
  });

  test("a replacement carries no refund details and does not touch the saved ones", async () => {
    await expect(service().request("customer-1", orderId, { ...request(), refundDestination: destination })).rejects.toThrow("only for a refund");
    const result = await service().request("customer-1", orderId, request());
    expect(result.refundMethod).toBeNull();
    expect(await db.select().from(customerRefundDestinations)).toEqual([]);
  });

  test("a later confirmed refund replaces the remembered details", async () => {
    await collected();
    await service().request("customer-1", orderId, refundRequest({ orderLineIds: [lineIds[0]] }));
    await service().request("customer-1", orderId, refundRequest({ orderLineIds: [lineIds[1]],
      refundDestination: { ...destination, method: "maya", accountNumber: "09180000000" } }));
    expect(await db.select().from(customerRefundDestinations)).toMatchObject([{ method: "maya", accountNumber: "09180000000" }]);
  });
});
