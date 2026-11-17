import { afterEach, expect, test, vi } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { createTestDatabase } from "./helpers/test-database";
import { FakeShopStock } from "./helpers/fake-shop-stock";
import { customers, orders } from "../lib/db/schema";

const scheduled = vi.hoisted(() => [] as (() => Promise<void>)[]);
const signals = vi.hoisted(() => ({ customer: vi.fn(async () => {}), staff: vi.fn() }));
let database: ReturnType<typeof drizzle>;
let stock: FakeShopStock;
vi.mock("next/server", () => ({ after: (work: () => Promise<void>) => { scheduled.push(work); } }));
vi.mock("../lib/db", () => ({ getDatabase: () => database }));
vi.mock("../lib/orders/stock", async importOriginal => ({ ...await importOriginal<typeof import("../lib/orders/stock")>(), gatewayShopStock: () => stock }));
vi.mock("../lib/orders/live-events", () => ({ publishCustomerOrderEvent: signals.customer }));
vi.mock("../lib/orders/staff-signal", () => ({ scheduleOrdersChanged: signals.staff }));
vi.mock("../lib/notifications/outbox", () => ({ sendPendingCustomerNotifications: async () => 0 }));
vi.mock("../lib/notifications/gateway", () => ({ sendAppEmail: async () => {} }));
vi.mock("../lib/audit/gateway", () => ({ writeAuditEvent: async () => {} }));
import { GET } from "../app/api/cron/stock-reservations/route";

let client: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
afterEach(async () => {
  await client?.close(); client = undefined;
  scheduled.length = 0; vi.unstubAllEnvs(); vi.clearAllMocks();
});

test.each([undefined, "Bearer wrong"])("the scheduled job refuses missing or invalid credentials (%s)", async authorization => {
  vi.stubEnv("CUSTOMER_NOTIFICATION_CRON_SECRET", "job-secret");
  const response = await GET(new Request("https://shop.example.com/api/cron/stock-reservations", { headers: authorization ? { authorization } : {} }));
  expect(response.status).toBe(401);
  expect(scheduled).toEqual([]);
});

test("the authorized job expires an unpaid Order and publishes live invalidation after commit", async () => {
  client = await createTestDatabase(); database = drizzle(client); stock = new FakeShopStock();
  vi.stubEnv("CUSTOMER_NOTIFICATION_CRON_SECRET", "job-secret");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");
  await database.insert(customers).values({ id: "jane", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
  const [order] = await database.insert(orders).values({ customerId: "jane", fulfillmentMethod: "pickup", paymentMethod: "gcash", status: "confirmed", subtotalInCentavos: 10000, createdAt: new Date("2026-01-01T00:00:00Z"), confirmedAt: new Date("2026-01-01T00:00:00Z") }).returning();
  const response = await GET(new Request("https://shop.example.com/api/cron/stock-reservations", { headers: { authorization: "Bearer job-secret" } }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ cancelled: 1 });
  expect(signals.customer).toHaveBeenCalledWith("jane", { type: "order.updated", orderId: String(order.id) });
  expect(signals.staff).toHaveBeenCalledTimes(1);
  for (const work of scheduled) await work();
});
