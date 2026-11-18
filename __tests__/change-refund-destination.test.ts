import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { createTestDatabase } from "./helpers/test-database";
import { customerRefundDestinations, customers, orderReturns, orders } from "../lib/db/schema";
import { changeRefundDestination } from "../lib/returns/change-refund-destination";

const clients: Awaited<ReturnType<typeof createTestDatabase>>[] = [];
afterEach(async () => { for (const db of clients.splice(0)) await db.close(); });
const staff = { staffId: "mario", staffName: "Mario Cruz" };
const next = { method: "maya", accountName: "Maria S. Santos", accountNumber: "09189876543", bankName: null, reason: "Her GCash was closed", customerConfirmed: true, ...staff };

async function fixture(patch: Partial<typeof orderReturns.$inferInsert> = {}) {
  const client = await createTestDatabase(); clients.push(client);
  const db = drizzle(client);
  await db.insert(customers).values({ id: "c1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos", email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
  const [order] = await db.insert(orders).values({ customerId: "c1", status: "delivered", fulfillmentMethod: "delivery", paymentMethod: "gcash", subtotalInCentavos: 300000, deliveryFeeInCentavos: 0, deliveredAt: new Date() }).returning();
  const [ret] = await db.insert(orderReturns).values({ orderId: order.id, reason: "damaged", amountInCentavos: 300000, status: "approved", preferredResolution: "refund", finalResolution: "refund",
    refundMethod: "gcash", refundAccountName: "Maria Santos", refundAccountNumber: "09171234567", ...patch }).returning();
  return { db, ret, change: changeRefundDestination(db, () => new Date("2026-11-19T01:00:00Z")) };
}

test("changes an approved refund's destination and keeps it as the Customer's confirmed details", async () => {
  const { db, ret, change } = await fixture();
  expect(await change(ret.id, next)).toEqual({ returnId: ret.id, changedAt: new Date("2026-11-19T01:00:00Z") });
  expect((await db.select().from(orderReturns).where(eq(orderReturns.id, ret.id)))[0]).toMatchObject({ refundMethod: "maya", refundAccountNumber: "09189876543", refundBankName: null });
  expect(await db.select().from(customerRefundDestinations)).toEqual([expect.objectContaining({ customerId: "c1", method: "maya", accountNumber: "09189876543" })]);
});

test("refuses once money was sent, on a replacement, or for a missing Return", async () => {
  expect(await (async () => { const { ret, change } = await fixture({ status: "refunded" }); return change(ret.id, next).catch((e: Error) => e.message); })()).toMatch(/already sent/);
  expect(await (async () => { const { ret, change } = await fixture({ finalResolution: "replacement" }); return change(ret.id, next).catch((e: Error) => e.message); })()).toMatch(/not an approved refund/);
  const { change } = await fixture();
  await expect(change(999, next)).rejects.toThrow("Return not found.");
});

test("needs the Customer's confirmation, a reason and valid details", async () => {
  const { db, ret, change } = await fixture();
  await expect(change(ret.id, { ...next, customerConfirmed: false })).rejects.toThrow();
  await expect(change(ret.id, { ...next, reason: " " })).rejects.toThrow();
  await expect(change(ret.id, { ...next, accountNumber: "123" })).rejects.toThrow();
  expect((await db.select().from(orderReturns))[0].refundAccountNumber).toBe("09171234567");
});
