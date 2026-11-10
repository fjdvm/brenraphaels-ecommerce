import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { customers, orders } from "../lib/db/schema";
import { mintCreomsCredential } from "../lib/orders/creoms-credential";
import { createOrderStore } from "../lib/orders/orders";
import { GET as retryNotifications } from "../app/api/cron/customer-notifications/route";
import { POST } from "../app/api/internal/orders/[id]/status/route";
import { createTestDatabase } from "./helpers/test-database";

const mocks = vi.hoisted(() => ({ database: vi.fn(), email: vi.fn(), afterTasks: [] as Array<() => Promise<void>> }));
vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => { mocks.afterTasks.push(task); } }));
vi.mock("@/lib/db", () => ({ getDatabase: mocks.database }));
vi.mock("@/lib/email/order-delivered-email", () => ({ sendOrderDeliveredEmail: mocks.email }));
let client: PGlite;
let db: ReturnType<typeof drizzle>;
let orderId: number;
let metadata: Record<string, unknown>;
let gateway: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  mocks.afterTasks.length = 0;
  vi.stubEnv("CREOMS_SERVICE_SECRET", "k".repeat(40));
  vi.stubEnv("API_GATEWAY_URL", "https://gateway.test");
  vi.stubEnv("API_GATEWAY_CALLER_KEY", "storefront-key");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.test");
  vi.stubEnv("CUSTOMER_NOTIFICATION_CRON_SECRET", "cron-key");
  client = await createTestDatabase();
  db = drizzle(client);
  mocks.database.mockReturnValue(db);
  mocks.email.mockResolvedValue(undefined);
  await db.insert(customers).values({ id: "customer-1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
    email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
  const [order] = await db.insert(orders).values({ customerId: "customer-1", status: "dispatched", fulfillmentMethod: "delivery",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000 }).returning();
  orderId = order.id;
  metadata = { id: "photo-1", status: "active", contentType: "image/jpeg", visibility: "private", retentionType: "temporary" };
  gateway = vi.fn(async () => Response.json(metadata));
  vi.stubGlobal("fetch", gateway);
});
afterEach(async () => { await client.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });

async function call(body: unknown = { status: "delivered", deliveryPhotoFileId: "photo-1" }) {
  const response = await POST(new Request(`https://storefront.test/api/internal/orders/${orderId}/status`, {
    method: "POST", headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: String(orderId) }) });
  for (const task of mocks.afterTasks.splice(0)) await task();
  return response;
}

async function persisted() {
  return (await createOrderStore(db).listForCustomer("customer-1"))[0];
}

test("delivers a dispatched Order with a verified Temporary photo, persists it and echoes its id", async () => {
  const before = Date.now();
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "delivered", deliveryPhotoFileId: "photo-1" });
  expect(await persisted()).toMatchObject({ status: "delivered", deliveryPhotoFileId: "photo-1" });
  const [row] = await db.select({ at: orders.deliveredAt }).from(orders);
  expect(row.at!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  expect(row.at!.getTime()).toBeLessThanOrEqual(Date.now());
  expect(gateway).toHaveBeenCalledWith("https://gateway.test/files/photo-1", expect.objectContaining({
    headers: { Authorization: "Bearer storefront-key" }, cache: "no-store", redirect: "error",
  }));
  expect(mocks.email).toHaveBeenCalledWith("maria@example.com", expect.objectContaining({ deliveryPhotoFileId: "photo-1" }));
});

test.each([
  [{ status: "delivered" }, "File id is required"],
  [{ status: "delivered", deliveryPhotoFileId: "" }, "File id is required"],
  [{ status: "preparing", deliveryPhotoFileId: "photo-1" }, "Unrecognized key"],
])("refuses an invalid photo request without changing the Order: %j", async (body, message) => {
  const response = await call(body);
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain(message);
  expect(await persisted()).toMatchObject({ status: "dispatched", deliveryPhotoFileId: null });
  expect(gateway).not.toHaveBeenCalled();
  expect(mocks.email).not.toHaveBeenCalled();
});

test.each([
  [{ id: "other-photo" }, "Delivery photo File was not found."],
  [{ status: "pending" }, "Delivery photo File must be Active."],
  [{ status: "deleted" }, "Delivery photo File must be Active."],
  [{ visibility: "public" }, "Delivery photo File must be Private."],
  [{ contentType: "application/pdf" }, "Delivery photo File must be an image."],
])("refuses an unusable File with a specific message: %j", async (change, message) => {
  Object.assign(metadata, change);
  const response = await call();
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: message });
  expect(await persisted()).toMatchObject({ status: "dispatched", deliveryPhotoFileId: null });
  expect(mocks.email).not.toHaveBeenCalled();
});

test("refuses an unknown File with a specific message", async () => {
  gateway.mockResolvedValue(new Response(null, { status: 404 }));
  const response = await call();
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Delivery photo File was not found." });
  expect(await persisted()).toMatchObject({ status: "dispatched", deliveryPhotoFileId: null });
});

test.each([
  ["preparing", null, '"delivered" is not a legal transition from "preparing".'],
  ["dispatched", "original-photo", "Delivery photo is already set."],
  ["delivered", "original-photo", "Delivery photo is already set."],
])("refuses delivery from %s with photo %s and preserves the Order", async (status, photo, message) => {
  await db.update(orders).set({ status, deliveryPhotoFileId: photo });
  const response = await call();
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: message });
  expect(await persisted()).toMatchObject({ status, deliveryPhotoFileId: photo });
  const [row] = await db.select({ at: orders.deliveredAt }).from(orders);
  expect(row.at).toBeNull();
  expect(mocks.email).not.toHaveBeenCalled();
});

test("a failed delivery email never fails the committed status and photo change", async () => {
  mocks.email.mockRejectedValueOnce(new Error("Mailer unavailable"));
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "delivered", deliveryPhotoFileId: "photo-1" });
  expect(await persisted()).toMatchObject({ status: "delivered", deliveryPhotoFileId: "photo-1" });
});

test("gateway failure leaves delivery unmodified and asks Staff to refresh", async () => {
  gateway.mockRejectedValueOnce(new Error("Gateway unavailable"));
  const response = await call();
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain("Refresh before retrying");
  expect(await persisted()).toMatchObject({ status: "dispatched", deliveryPhotoFileId: null });
});

test("concurrent delivery requests cannot replace the winning photo", async () => {
  const responses = await Promise.all([call(), call()]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  expect(await persisted()).toMatchObject({ status: "delivered", deliveryPhotoFileId: "photo-1" });
  expect(mocks.email).toHaveBeenCalledTimes(1);
});

test("stores and sends one delivered Notification for the Customer, naming the Refund window", async () => {
  expect((await call()).status).toBe(200);
  const sends = gateway.mock.calls.filter(([url]) => String(url).endsWith("/notifications/notifications"));
  expect(sends).toHaveLength(1);
  const payload = JSON.parse((sends[0] as unknown as [string, RequestInit])[1].body as string);
  expect(payload).toMatchObject({
    userIds: ["customer-1"], sendingApp: "ecommerce", targetApp: "ecommerce", type: "order.delivered",
    idempotencyKey: `order.delivered:${orderId}`, link: `https://shop.test/profile/orders?order=${orderId}`,
  });
  expect(payload.body).toContain("24 hours");
  expect(payload.body).toContain("Refund window");
});

function retry(authorization = "Bearer cron-key") {
  return retryNotifications(new Request("https://shop.test/api/cron/customer-notifications", {
    headers: { authorization },
  }));
}

test.each(["failure", "timeout"])("retries a Notification after %s while delivery and email still succeed", async (failure) => {
  const inbox = new Map<string, unknown>();
  let offline = true;
  const attempts: string[] = [];
  gateway.mockImplementation(async (url: string, init?: RequestInit) => {
    if (!url.endsWith("/notifications/notifications")) return Response.json(metadata);
    const notification = JSON.parse(init!.body as string);
    attempts.push(notification.idempotencyKey);
    if (failure === "timeout" || !offline) inbox.set(notification.idempotencyKey, notification);
    if (offline) {
      if (failure === "timeout") throw new DOMException("Response lost", "TimeoutError");
      return new Response(null, { status: 503 });
    }
    return Response.json({}, { status: 201 });
  });
  expect((await call()).status).toBe(200);
  expect(await persisted()).toMatchObject({ status: "delivered" });
  expect(mocks.email).toHaveBeenCalledTimes(1);
  expect((await call()).status).toBe(409);
  offline = false;
  expect(await (await retry()).json()).toEqual({ sent: 1 });
  expect(await (await retry()).json()).toEqual({ sent: 0 });
  expect(attempts).toEqual([`order.delivered:${orderId}`, `order.delivered:${orderId}`]);
  expect(inbox.size).toBe(1);
  expect(mocks.email).toHaveBeenCalledTimes(1);
});

test("only an authorized cron job may retry Customer Notifications", async () => {
  expect((await retry("Bearer wrong")).status).toBe(401);
  vi.stubEnv("CUSTOMER_NOTIFICATION_CRON_SECRET", "");
  expect((await retry()).status).toBe(401);
  expect(gateway).not.toHaveBeenCalled();
});

test("a failed Notification does not prevent a later pending Notification being sent", async () => {
  gateway.mockImplementation(async (url: string) => url.endsWith("/notifications/notifications")
    ? new Response(null, { status: 503 }) : Response.json(metadata));
  expect((await call()).status).toBe(200);
  const [second] = await db.insert(orders).values({ customerId: "customer-1", status: "dispatched", fulfillmentMethod: "delivery",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000 }).returning();
  const firstOrderId = orderId;
  orderId = second.id;
  expect((await call()).status).toBe(200);
  gateway.mockImplementation(async (_url: string, init: RequestInit) => {
    const notification = JSON.parse(init.body as string);
    return new Response(null, { status: notification.idempotencyKey === `order.delivered:${firstOrderId}` ? 503 : 201 });
  });
  expect(await (await retry()).json()).toEqual({ sent: 1 });
});
