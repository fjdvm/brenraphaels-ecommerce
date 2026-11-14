import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";

import { customerNotifications, customers, orders, products, sizes, ticketMessages, tickets } from "../lib/db/schema";
import { sendPendingCustomerNotifications } from "../lib/notifications/outbox";
import { createCartStore } from "../lib/orders/cart";
import { createOrderStore } from "../lib/orders/orders";
import { createFeedbackRequestStore, sendDueFeedbackRequests } from "../lib/orders/feedback-requests";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
beforeAll(async () => {
  client = await createTestDatabase(); db = drizzle(client);
});
beforeEach(async () => {
  await client.exec("TRUNCATE customers CASCADE");
  await db.insert(customers).values({ id: "c1", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe",
    email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.test/");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => { await client.close(); });
async function order(status = "placed", paymentMethod = "cash-on-delivery") {
  const [row] = await db.insert(orders).values({ customerId: "c1", status, paymentMethod,
    fulfillmentMethod: "delivery", subtotalInCentavos: 10000 }).returning();
  return row;
}

test("quotes the fee and asks for GCash payment once, then Preparing sends nothing and dispatch has its own words", async () => {
  const row = await order("placed", "gcash");
  const store = createOrderStore(db);
  await store.advance(row.id, { status: "confirmed", deliveryFeeInCentavos: 5000 });
  await expect(store.advance(row.id, { status: "confirmed", deliveryFeeInCentavos: 5000 })).rejects.toThrow();
  const send = vi.fn().mockResolvedValue(undefined);
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(2);
  expect(send.mock.calls.map(([n]) => n)).toEqual(expect.arrayContaining([
    expect.objectContaining({ userId: "c1", type: "order.delivery-fee", body: expect.stringContaining("₱50.00"), link: `https://shop.test/profile/orders?order=${row.id}` }),
    expect.objectContaining({ type: "order.payment-needed", body: expect.stringContaining("GCash") }),
  ]));
  await store.submitPaymentProof("c1", row.id, { gcashReferenceNumber: "1234567890123" });
  await store.advance(row.id, { status: "paid", staffId: "ana", staffName: "Ana" });
  await store.advance(row.id, { status: "preparing" });
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(0);
  await store.advance(row.id, { status: "dispatched", courier: { name: "Grab", trackingUrl: "https://grab.test/t" } });
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(1);
  expect(send.mock.lastCall?.[0]).toMatchObject({ type: "order.dispatched", title: `Order #${row.id} dispatched` });
});

test("an outage leaves cancellation committed and retries an ambiguous acceptance with the same key", async () => {
  const row = await order();
  await createOrderStore(db).cancel("c1", row.id);
  const visible = new Set<string>();
  const send = vi.fn(async (n) => {
    visible.add(n.idempotencyKey);
    if (send.mock.calls.length === 1) throw new Error("accepted but response timed out");
  });
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(0);
  expect((await createOrderStore(db).listForCustomer("c1"))[0].status).toBe("cancelled");
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(1);
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(0);
  expect(visible).toEqual(new Set([`order.cancelled:${row.id}`]));
  expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0]);
});

test("Staff replies on Tickets with no Linked order are durable, Customer Messages send none, and rollback sends none", async () => {
  const [ticket] = await db.insert(tickets).values({ customerId: "c1", subject: "Help", category: "Other" }).returning();
  await db.insert(ticketMessages).values({ ticketId: ticket.id, sender: "customer", body: "Hello" });
  await expect(db.transaction(async (tx) => {
    await tx.insert(ticketMessages).values({ ticketId: ticket.id, sender: "staff", body: "Rolled back" });
    throw new Error("rollback");
  })).rejects.toThrow("rollback");
  expect(await db.select().from(customerNotifications)).toEqual([]);
  // The CREOMS writer has INSERT access to Messages, but no outbox access.
  await client.exec("CREATE ROLE reply_writer; GRANT USAGE ON SCHEMA public TO reply_writer; GRANT INSERT, SELECT ON ticket_messages TO reply_writer; GRANT USAGE ON SEQUENCE ticket_messages_id_seq TO reply_writer; SET ROLE reply_writer");
  try {
    await db.insert(ticketMessages).values({ ticketId: ticket.id, sender: "staff", body: "We can help" });
  } finally { await client.exec("RESET ROLE"); }
  const send = vi.fn().mockResolvedValue(undefined);
  expect(await sendPendingCustomerNotifications(db, undefined, send)).toBe(1);
  expect(send.mock.calls[0][0]).toMatchObject({ userId: "c1", type: "ticket.reply", title: `New reply on Ticket TKT-${ticket.id}`, link: `https://shop.test/support/${ticket.id}` });
  expect(await sendPendingCustomerNotifications(db, undefined, send)).toBe(0);
});

test("a Feedback Notification outage never repeats the request email or creates a second Notification", async () => {
  const row = await order("delivered");
  await client.query("update orders set delivered_at = '2026-10-20T00:00:00Z' where id = $1", [row.id]);
  const sendEmail = vi.fn().mockResolvedValue(undefined);
  const deps = { store: createFeedbackRequestStore(db), send: sendEmail, audit: vi.fn().mockResolvedValue(undefined) };
  const now = new Date("2026-10-23T00:00:00Z");
  expect(await sendDueFeedbackRequests(now, deps)).toBe(1);
  const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(0);
  expect(await sendDueFeedbackRequests(now, deps)).toBe(0);
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(1);
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(0);
  expect(send.mock.calls[0][0]).toMatchObject({ type: "feedback.request", idempotencyKey: `feedback.request:${row.id}`, userId: "c1" });
  expect(await db.select().from(customerNotifications)).toHaveLength(1);
});


test("a Pickup GCash checkout asks for Payment once; Cash on Delivery asks for none", async () => {
  await db.insert(products).values({ slug: "jam", name: "Jam", description: "Jam" });
  const [size] = await db.insert(sizes).values({ productSlug: "jam", label: "Small", priceInCentavos: 10000, available: true }).returning();
  const cart = createCartStore(db);
  const store = createOrderStore(db);
  const send = vi.fn().mockResolvedValue(undefined);
  await cart.addSize("c1", size.id, 1);
  const pickup = await store.place("c1", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
  expect(await sendPendingCustomerNotifications(db, pickup.id, send)).toBe(1);
  expect(send.mock.calls[0][0]).toMatchObject({ type: "order.payment-needed", userId: "c1" });
  const cod = await order();
  await store.advance(cod.id, { status: "confirmed", deliveryFeeInCentavos: 0 });
  expect(await sendPendingCustomerNotifications(db, cod.id, send)).toBe(1);
  expect(send.mock.lastCall?.[0]).toMatchObject({ type: "order.delivery-fee", body: expect.stringContaining("₱0.00") });
});

test("Delivered retains its once-only Refund window Notification", async () => {
  const row = await order("dispatched");
  await createOrderStore(db).advance(row.id, { status: "delivered", deliveryPhotoFileId: "photo-1" });
  const send = vi.fn().mockResolvedValue(undefined);
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(1);
  expect(send.mock.calls[0][0]).toMatchObject({ type: "order.delivered", body: expect.stringContaining("24 hours"), idempotencyKey: `order.delivered:${row.id}` });
  expect(await sendPendingCustomerNotifications(db, row.id, send)).toBe(0);
});
