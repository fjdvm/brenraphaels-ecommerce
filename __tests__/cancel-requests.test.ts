import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, products, sizes } from "../lib/db/schema";
import { listCustomerCancelRequests } from "../lib/orders/cancel-requests";
import { createOrderStore } from "../lib/orders/orders";
import { createStockReservations } from "../lib/orders/stock-reservations";
import { createTestDatabase } from "./helpers/test-database";

vi.mock("../lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail: vi.fn(async () => {}) }, sender: "shop@example.com" }),
  requiredEnvironment: () => "https://shop.example.com",
}));

let client: PGlite;
const staff = { staffId: "ana", staffName: "Ana" };

beforeEach(async () => {
  client = await createTestDatabase();
  const db = drizzle(client);
  await db.insert(customers).values([
    { id: "customer-1", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false },
    { id: "customer-2", firstName: "Joe", lastName: "Roe", fullName: "Joe Roe", email: "joe@example.com", contactNumber: "09170000000", marketingOptIn: false },
  ]);
  await db.insert(products).values({ slug: "ube-jam", name: "Ube Jam", description: "Ube jam." });
  await db.insert(sizes).values({ productSlug: "ube-jam", label: "250g", priceInCentavos: 21900, available: true });
});
afterEach(async () => { await client.close(); });

async function order(status = "placed", method = "cash-on-delivery") {
  const row = await client.query<{ id: number }>(
    "insert into orders (customer_id, fulfillment_method, payment_method, status, subtotal_in_centavos) values ('customer-1','pickup',$1,$2,21900) returning id", [method, status]);
  return row.rows[0].id;
}
const statusOf = async (id: number) => (await client.query<{ status: string }>("select status from orders where id=$1", [id])).rows[0].status;
const requestStatus = async (id: string) => (await client.query<{ status: string }>("select status from order_cancel_requests where id=$1", [id])).rows[0].status;

describe("a Customer's cancellation request", () => {
  test("is only a request: the Order stays as it is until a person approves", async () => {
    const store = createOrderStore(drizzle(client)), id = await order("confirmed");
    const { requestId, replayed } = await store.requestCancel("customer-1", id, "Wrong address");
    expect(replayed).toBe(false);
    expect(await statusOf(id)).toBe("confirmed");
    expect(await requestStatus(requestId)).toBe("waiting");
  });

  test("needs a reason, and only works on the Customer's own Order before payment", async () => {
    const store = createOrderStore(drizzle(client)), id = await order("placed");
    await expect(store.requestCancel("customer-1", id, "  ")).rejects.toThrow(/why you are cancelling/);
    await expect(store.requestCancel("customer-2", id, "Mine now")).rejects.toThrow("Order was not found.");
    const paid = await order("paid", "gcash");
    await expect(store.requestCancel("customer-1", paid, "Changed my mind")).rejects.toThrow(/not a legal transition/);
    const dispatched = await order("dispatched");
    await expect(store.requestCancel("customer-1", dispatched, "Changed my mind")).rejects.toThrow(/not a legal transition/);
  });

  test("a second ask while one is waiting returns the same request", async () => {
    const store = createOrderStore(drizzle(client)), id = await order("awaiting payment", "gcash");
    const first = await store.requestCancel("customer-1", id, "Changed my mind");
    const again = await store.requestCancel("customer-1", id, "Changed my mind");
    expect(again).toEqual({ requestId: first.requestId, replayed: true });
  });

  test("freezes the Order: Staff cannot confirm, pack or mark it paid, and the Customer cannot send a proof", async () => {
    const store = createOrderStore(drizzle(client));
    const placed = await order("placed");
    await store.requestCancel("customer-1", placed, "Changed my mind");
    await expect(store.advance(placed, { status: "confirmed" })).rejects.toThrow(/cancellation request is waiting/);
    await expect(store.advance(placed, { status: "cancelled", cancelReason: "Out of stock" })).rejects.toThrow(/cancellation request is waiting/);
    const cod = await order("confirmed");
    await store.requestCancel("customer-1", cod, "Changed my mind");
    await expect(store.advance(cod, { status: "preparing", ...staff })).rejects.toThrow(/cancellation request is waiting/);
    const online = await order("awaiting payment", "gcash");
    await store.requestCancel("customer-1", online, "Changed my mind");
    await expect(store.advance(online, { status: "paid", ...staff })).rejects.toThrow(/cancellation request is waiting/);
    await expect(store.submitPaymentProof("customer-1", online, { gcashReferenceNumber: "1234567890123" } as never)).rejects.toThrow(/waiting for a decision/);
    expect(await statusOf(placed)).toBe("placed");
  });

  test("approving cancels the Order with the Customer's reason and closes the request, once", async () => {
    const store = createOrderStore(drizzle(client)), id = await order("confirmed");
    const { requestId } = await store.requestCancel("customer-1", id, "Wrong address");
    const cancelled = await store.advance(id, { status: "cancelled", cancelReason: "Wrong address", cancelRequestId: requestId, ...staff });
    expect(cancelled).toMatchObject({ status: "cancelled", cancelReason: "Wrong address" });
    expect(await requestStatus(requestId)).toBe("approved");
    const decided = await client.query<{ decided_by_name: string }>("select decided_by_name from order_cancel_requests where id=$1", [requestId]);
    expect(decided.rows[0].decided_by_name).toBe("Ana");
    await expect(store.advance(id, { status: "cancelled", cancelReason: "Wrong address", cancelRequestId: requestId, ...staff })).rejects.toThrow();
  });

  test("declining needs a reason, keeps the Order, unfreezes it, and lets the Customer ask again", async () => {
    const store = createOrderStore(drizzle(client)), id = await order("confirmed");
    const { requestId } = await store.requestCancel("customer-1", id, "Changed my mind");
    await expect(store.declineCancel(id, requestId, "  ", staff)).rejects.toThrow(/reason/);
    await expect(store.declineCancel(id, requestId, "Already packed", staff)).resolves.toEqual({ replayed: false });
    await expect(store.declineCancel(id, requestId, "Already packed", staff)).resolves.toEqual({ replayed: true });
    expect(await statusOf(id)).toBe("confirmed");
    await expect(store.advance(id, { status: "preparing", ...staff })).resolves.toMatchObject({ status: "preparing" });
    const note = await client.query("select 1 from customer_notifications where order_id=$1 and type='order.cancel-declined'", [id]);
    expect(note.rowCount).toBe(1);
    const other = await order("confirmed");
    const first = await store.requestCancel("customer-1", other, "Changed my mind");
    await store.declineCancel(other, first.requestId, "No", staff);
    const next = await store.requestCancel("customer-1", other, "Please, wrong address");
    expect(next.requestId).not.toBe(first.requestId);
    expect(next.replayed).toBe(false);
  });

  test("the Customer can withdraw a waiting request, and the Order carries on", async () => {
    const store = createOrderStore(drizzle(client)), id = await order("confirmed");
    const { requestId } = await store.requestCancel("customer-1", id, "Changed my mind");
    await expect(store.withdrawCancel("customer-2", id)).rejects.toThrow("Order was not found.");
    await store.withdrawCancel("customer-1", id);
    expect(await requestStatus(requestId)).toBe("withdrawn");
    await expect(store.withdrawCancel("customer-1", id)).rejects.toThrow(/no waiting cancellation request/);
    await expect(store.advance(id, { status: "preparing", ...staff })).resolves.toMatchObject({ status: "preparing" });
  });

  test("is refused once packing has started", async () => {
    const store = createOrderStore(drizzle(client)), id = await order("confirmed");
    await client.query("update orders set packing_started_at = now() where id=$1", [id]);
    await expect(store.requestCancel("customer-1", id, "Changed my mind")).rejects.toThrow(/not a legal transition/);
  });

  test("the Customer's list shows the latest request per Order and nobody else's", async () => {
    const store = createOrderStore(drizzle(client)), id = await order("confirmed");
    const first = await store.requestCancel("customer-1", id, "Changed my mind");
    await store.declineCancel(id, first.requestId, "Already packed", staff);
    await store.requestCancel("customer-1", id, "Really sure");
    const mine = await listCustomerCancelRequests(drizzle(client), "customer-1");
    expect(mine.get(id)).toMatchObject({ status: "waiting", reason: "Really sure" });
    expect((await listCustomerCancelRequests(drizzle(client), "customer-2")).size).toBe(0);
  });

  test("payment-window expiry still cancels the Order and closes the waiting request", async () => {
    const db = drizzle(client), store = createOrderStore(db), id = await order("confirmed", "gcash");
    await client.query("update orders set confirmed_at = '2026-11-01T00:00:00Z', payment_deadline_at = '2026-11-02T00:00:00Z' where id=$1", [id]);
    const { requestId } = await store.requestCancel("customer-1", id, "Changed my mind");
    const stock = { productForSize: async () => "p1", move: async () => "released" } as never;
    expect(await createStockReservations(db, stock).expire(new Date("2026-11-02T00:00:01Z"))).toBe(1);
    expect(await statusOf(id)).toBe("cancelled");
    expect(await requestStatus(requestId)).toBe("approved");
  });
});
