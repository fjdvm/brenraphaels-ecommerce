import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, feedbackRequests, orderFeedback, orders } from "../lib/db/schema";

const { getDatabase, sendFeedbackRequest, writeAuditEvent } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  sendFeedbackRequest: vi.fn(),
  writeAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/notifications/gateway", () => ({ sendFeedbackRequest, sendAppNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/audit/gateway", () => ({ writeAuditEvent }));

import { GET } from "@/app/api/cron/feedback-requests/route";
import vercelConfig from "../vercel.json";

const now = new Date("2026-10-20T01:00:00Z");
const daysAgo = (days: number, extraMinutes = 0) => new Date(now.getTime() - days * 86_400_000 + extraMinutes * 60_000);

let client: PGlite;

const request = (authorization?: string) =>
  new Request("http://localhost/api/cron/feedback-requests", { headers: authorization ? { authorization } : {} });

const run = () => GET(request("Bearer s3cret"));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  vi.stubEnv("CRON_SECRET", "s3cret");
  client = new PGlite();
  const database = drizzle(client);
  await migrate(database, { migrationsFolder: "drizzle" });
  await database.insert(customers).values([
    { id: "customer-1", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false },
    { id: "customer-2", firstName: "John", lastName: "Doe", fullName: "John Doe", email: "john@example.com", contactNumber: "09181234567", marketingOptIn: false },
  ]);
  getDatabase.mockReset().mockReturnValue(database);
  sendFeedbackRequest.mockReset().mockResolvedValue(undefined);
  writeAuditEvent.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.useRealTimers();
  await client.close();
});

async function order(overrides: Partial<typeof orders.$inferInsert> = {}) {
  const [row] = await drizzle(client).insert(orders).values({
    customerId: "customer-1",
    fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery",
    status: "delivered",
    subtotalInCentavos: 21_900,
    deliveredAt: daysAgo(2),
    ...overrides,
  }).returning();
  return row;
}

const requestsSent = async () => (await drizzle(client).select().from(feedbackRequests)).map((row) => row.orderId);

describe("Feedback request cron route", () => {
  test("rejects a request without the cron secret", async () => {
    await order();

    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect(sendFeedbackRequest).not.toHaveBeenCalled();
  });

  test("rejects every request when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("Bearer "))).status).toBe(401);
  });

  test("asks the Customer of an Order delivered exactly 2 days ago, and records it", async () => {
    const due = await order();

    const response = await run();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sent: 1 });
    expect(sendFeedbackRequest).toHaveBeenCalledOnce();
    expect(sendFeedbackRequest).toHaveBeenCalledWith({
      orderId: due.id,
      customerId: "customer-1",
      customerName: "Jane Doe",
      email: "jane@example.com",
    });
    expect(await requestsSent()).toEqual([due.id]);
  });

  test("skips Orders delivered less than 2 days ago", async () => {
    await order({ deliveredAt: daysAgo(2, 1) });

    await run();

    expect(sendFeedbackRequest).not.toHaveBeenCalled();
    expect(await requestsSent()).toEqual([]);
  });

  test("skips Orders with no delivery time, such as ones delivered before the column existed", async () => {
    await order({ deliveredAt: null });

    await run();

    expect(sendFeedbackRequest).not.toHaveBeenCalled();
  });

  test("skips Orders that are not Delivered", async () => {
    await order({ status: "dispatched", deliveredAt: daysAgo(5) });

    await run();

    expect(sendFeedbackRequest).not.toHaveBeenCalled();
  });

  test("skips Orders that already have Feedback", async () => {
    const given = await order({ deliveredAt: daysAgo(4) });
    await drizzle(client).insert(orderFeedback).values({ orderId: given.id, rating: 5, comment: "Lovely." });

    await run();

    expect(sendFeedbackRequest).not.toHaveBeenCalled();
    expect(await requestsSent()).toEqual([]);
  });

  test("asks once per Order: a second run sends nothing", async () => {
    await order({ deliveredAt: daysAgo(3) });

    await run();
    const second = await run();

    await expect(second.json()).resolves.toEqual({ sent: 0 });
    expect(sendFeedbackRequest).toHaveBeenCalledOnce();
  });

  test("does not record a failed send, so the next run retries it", async () => {
    const due = await order();
    sendFeedbackRequest.mockRejectedValueOnce(new Error("gateway down"));

    const first = await run();
    expect(await first.json()).toEqual({ sent: 0 });
    expect(await requestsSent()).toEqual([]);
    expect(writeAuditEvent).not.toHaveBeenCalled();

    const second = await run();
    expect(await second.json()).toEqual({ sent: 1 });
    expect(await requestsSent()).toEqual([due.id]);
  });

  test("one failed send does not stop the others", async () => {
    const first = await order();
    const second = await order({ customerId: "customer-2" });
    sendFeedbackRequest.mockRejectedValueOnce(new Error("gateway down"));

    const response = await run();

    await expect(response.json()).resolves.toEqual({ sent: 1 });
    expect(await requestsSent()).toEqual([second.id]);
    expect(first.id).not.toBe(second.id);
  });

  test("writes a feedback.request_sent audit event naming the Customer and the Order", async () => {
    const due = await order();

    await run();

    expect(writeAuditEvent).toHaveBeenCalledOnce();
    expect(writeAuditEvent.mock.calls[0][0]).toMatchObject({
      source: "Ecommerce",
      action: "feedback.request_sent",
      outcome: "success",
      actor: { type: "system" },
      subject: { type: "customer", id: "customer-1", display_name: "Jane Doe" },
      target: { type: "order", id: String(due.id) },
      idempotency_key: `feedback.request_sent:order-${due.id}`,
    });
  });

  test("an audit failure does not fail the job or undo the record", async () => {
    const due = await order();
    writeAuditEvent.mockRejectedValue(new Error("audit-logs down"));

    const response = await run();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sent: 1 });
    expect(await requestsSent()).toEqual([due.id]);
  });

  test("is registered to run once a day", () => {
    expect(vercelConfig.crons).toContainEqual({ path: "/api/cron/feedback-requests", schedule: expect.stringMatching(/^\d+ \d+ \* \* \*$/) });
  });
});
