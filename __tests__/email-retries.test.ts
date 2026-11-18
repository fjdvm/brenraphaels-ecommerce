import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, orderEmailOutcomes, orders } from "../lib/db/schema";
import { MAX_EMAIL_ATTEMPTS, resendFailedEmail, retryDueEmails, sendOnceAndRecord } from "../lib/email/outcomes";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let orderId: number;
beforeAll(async () => { client = await createTestDatabase(); db = drizzle(client); });
afterAll(async () => { await client.close(); });
beforeEach(async () => {
  await client.exec("TRUNCATE customers CASCADE");
  await db.insert(customers).values({ id: "c1", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe",
    email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
  [{ id: orderId }] = await db.insert(orders).values({ customerId: "c1", status: "confirmed", paymentMethod: "cash-on-delivery",
    fulfillmentMethod: "pickup", subtotalInCentavos: 10000 }).returning({ id: orders.id });
});
const row = async () => (await db.select().from(orderEmailOutcomes).where(eq(orderEmailOutcomes.orderId, orderId)))[0];
const makeDue = () => client.exec("UPDATE order_email_outcomes SET next_attempt_at = now() - interval '1 minute'");
const kind = "pickup-confirmed";

describe("Order email retries", () => {
  test("send: a good first send is stored as sent with one attempt", async () => {
    expect(await sendOnceAndRecord(orderId, kind, async () => {}, db as never)).toBe("sent");
    expect(await row()).toMatchObject({ status: "sent", attempts: 1, reason: null, nextAttemptAt: null });
  });

  test("fail: a failed first send is stored with its reason and a time for the retry, and the Order stays confirmed", async () => {
    expect(await sendOnceAndRecord(orderId, kind, async () => { throw new Error("SMTP down"); }, db as never)).toBe("retrying");
    expect(await row()).toMatchObject({ status: "retrying", attempts: 1, reason: "SMTP down" });
    expect((await row()).nextAttemptAt).toBeInstanceOf(Date);
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order.status).toBe("confirmed");
  });

  test("retry: not due yet means nothing is sent; once due it sends and the outcome becomes sent", async () => {
    await sendOnceAndRecord(orderId, kind, async () => { throw new Error("SMTP down"); }, db as never);
    const resend = vi.fn().mockResolvedValue(undefined);
    expect(await retryDueEmails(resend, db as never)).toBe(0);
    expect(resend).not.toHaveBeenCalled();
    await makeDue();
    expect(await retryDueEmails(resend, db as never)).toBe(1);
    expect(resend).toHaveBeenCalledWith(orderId, kind, "", { id: `order-${orderId}-${kind}` });
    expect(await row()).toMatchObject({ status: "sent", attempts: 2, reason: null, nextAttemptAt: null });
    expect(await retryDueEmails(resend, db as never)).toBe(0);
  });

  test("retry: a failing retry stays retrying with the newest reason", async () => {
    await sendOnceAndRecord(orderId, kind, async () => { throw new Error("first"); }, db as never);
    await makeDue();
    expect(await retryDueEmails(async () => { throw new Error("second"); }, db as never)).toBe(0);
    expect(await row()).toMatchObject({ status: "retrying", attempts: 2, reason: "second" });
  });

  test("exhausted: after the last attempt the outcome is failed with the reason and no more retries", async () => {
    await sendOnceAndRecord(orderId, kind, async () => { throw new Error("down"); }, db as never);
    const resend = vi.fn().mockRejectedValue(new Error("still down"));
    for (let attempt = 2; attempt <= MAX_EMAIL_ATTEMPTS; attempt++) {
      await makeDue();
      await retryDueEmails(resend, db as never);
    }
    expect(await row()).toMatchObject({ status: "failed", attempts: MAX_EMAIL_ATTEMPTS, reason: "still down", nextAttemptAt: null });
    await client.exec("UPDATE order_email_outcomes SET updated_at = now() - interval '1 day'");
    await retryDueEmails(resend, db as never);
    expect(resend).toHaveBeenCalledTimes(MAX_EMAIL_ATTEMPTS - 1);
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order.status).toBe("confirmed");
  });

  test("a send stuck mid-way is retried, and a second run cannot send it twice at once", async () => {
    await db.insert(orderEmailOutcomes).values({ orderId, kind, status: "sending", attempts: 1 });
    await client.exec("UPDATE order_email_outcomes SET updated_at = now() - interval '1 hour'");
    const resend = vi.fn().mockResolvedValue(undefined);
    const [a, b] = await Promise.all([retryDueEmails(resend, db as never), retryDueEmails(resend, db as never)]);
    expect(a + b).toBe(1);
    expect(resend).toHaveBeenCalledTimes(1);
  });
});

describe("retry job wiring", () => {
  test("resend refuses an unknown kind, and the cron route retries emails after Notifications", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({ getDatabase: () => db }));
    const { resendOrderEmail } = await import("../lib/email/retry");
    await expect(resendOrderEmail(orderId, "nope", db as never)).rejects.toThrow("Unknown email kind");
    await expect(resendOrderEmail(999999, "pickup-confirmed", db as never)).rejects.toThrow("Order was not found");
    vi.doUnmock("@/lib/db");
  });
});

describe("stable ids, occurrences and Resend (epic-crms#605)", () => {
  const find = async (occurrence = "") => (await db.select().from(orderEmailOutcomes).where(eq(orderEmailOutcomes.orderId, orderId)))
    .find((r) => r.occurrence === occurrence)!;

  test("the sender gets one stable id per event, and a repeat of the same event sends nothing", async () => {
    const send = vi.fn().mockResolvedValue({ messageId: "<m1>" });
    expect(await sendOnceAndRecord(orderId, "rejected", send, db as never, "1")).toBe("sent");
    expect(send).toHaveBeenCalledWith({ id: `order-${orderId}-rejected-1` });
    expect(await sendOnceAndRecord(orderId, "rejected", send, db as never, "1")).toBe("skipped");
    expect(send).toHaveBeenCalledTimes(1);
    expect(await find("1")).toMatchObject({ status: "sent", messageId: "<m1>" });
  });

  test("two real rejections each get their own row, id and email", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await sendOnceAndRecord(orderId, "rejected", send, db as never, "1");
    expect(await sendOnceAndRecord(orderId, "rejected", send, db as never, "2")).toBe("sent");
    expect(send.mock.calls.map((c) => c[0].id)).toEqual([`order-${orderId}-rejected-1`, `order-${orderId}-rejected-2`]);
  });

  const failForGood = async (occurrence: string, messageId?: string) => {
    await db.insert(orderEmailOutcomes).values({ orderId, kind: "rejected", occurrence, status: "failed", attempts: MAX_EMAIL_ATTEMPTS, reason: "down", messageId });
  };

  test("Resend sends under the same stable id, records sent and leaves the other occurrence alone", async () => {
    await failForGood("1"); await failForGood("2");
    const send = vi.fn().mockResolvedValue({ messageId: "<m9>" });
    expect(await resendFailedEmail(orderId, "rejected", "2", send, db as never)).toEqual({ ok: true, status: "sent" });
    expect(send).toHaveBeenCalledWith({ id: `order-${orderId}-rejected-2` });
    expect(await find("2")).toMatchObject({ status: "sent", reason: null, messageId: "<m9>" });
    expect(await find("1")).toMatchObject({ status: "failed" });
  });

  test("Resend reconciles first when Notification already accepted the email, and sends nothing", async () => {
    await failForGood("1", "<accepted>");
    const send = vi.fn();
    expect(await resendFailedEmail(orderId, "rejected", "1", send, db as never)).toEqual({ ok: true, status: "reconciled" });
    expect(send).not.toHaveBeenCalled();
    expect(await find("1")).toMatchObject({ status: "sent", reason: null });
  });

  test("two Resends at once send once; the second is refused", async () => {
    await failForGood("1");
    const send = vi.fn().mockResolvedValue(undefined);
    const results = await Promise.all([resendFailedEmail(orderId, "rejected", "1", send, db as never), resendFailedEmail(orderId, "rejected", "1", send, db as never)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ refused: "not-failed" });
  });

  test("a failing Resend puts it back to failed with the new reason and never touches the Order", async () => {
    await failForGood("1");
    const result = await resendFailedEmail(orderId, "rejected", "1", async () => { throw new Error("still down"); }, db as never);
    expect(result).toMatchObject({ ok: false, refused: "send-failed" });
    expect(await find("1")).toMatchObject({ status: "failed", reason: "still down" });
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order.status).toBe("confirmed");
  });

  test("Resend refuses an email that is sent, retrying or unknown", async () => {
    await sendOnceAndRecord(orderId, "rejected", async () => {}, db as never, "1");
    const send = vi.fn();
    expect(await resendFailedEmail(orderId, "rejected", "1", send, db as never)).toMatchObject({ ok: false, refused: "not-failed" });
    expect(await resendFailedEmail(orderId, "rejected", "9", send, db as never)).toMatchObject({ ok: false, refused: "not-failed" });
    expect(send).not.toHaveBeenCalled();
  });

  test("the retry job records an email Notification already accepted instead of sending it again", async () => {
    await db.insert(orderEmailOutcomes).values({ orderId, kind, status: "sending", attempts: 1, messageId: "<m>" });
    await client.exec("UPDATE order_email_outcomes SET updated_at = now() - interval '1 hour'");
    const resend = vi.fn();
    expect(await retryDueEmails(resend, db as never)).toBe(1);
    expect(resend).not.toHaveBeenCalled();
    expect(await find()).toMatchObject({ status: "sent" });
  });
});
