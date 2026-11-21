import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { customers, orderLines, orders } from "../lib/db/schema";
import { createDeliveryReader, embeddableTrackingUrl } from "../lib/orders/deliveries";
import type { OrderStatus } from "../lib/orders/orders";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
const link = "https://share.lalamove.com/?PH123";

beforeAll(async () => {
  client = await createTestDatabase();
  db = drizzle(client);
  for (const id of ["customer-1", "customer-2"]) {
    await db.insert(customers).values({ id, firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
      email: `${id}@example.com`, contactNumber: "09171234567", marketingOptIn: false });
  }
});
afterAll(async () => { await client.close(); });

async function order(status: OrderStatus, values: Partial<typeof orders.$inferInsert> = {}) {
  const [created] = await db.insert(orders).values({ customerId: "customer-1", status, fulfillmentMethod: "delivery", paymentMethod: "gcash",
    subtotalInCentavos: 21900, courier: "Lalamove", courierTrackingUrl: link, riderName: "Jomar", ...values }).returning();
  await db.insert(orderLines).values({ orderId: created.id, productName: "Ube Jam", sizeLabel: "250g", priceInCentavos: 21900, quantity: 2 });
  return created;
}

describe("the Delivery tab's Orders", () => {
  test("lists only the Customer's own dispatched, delivered and received Orders that have a share link, newest first", async () => {
    const dispatched = await order("dispatched", { createdAt: new Date("2026-11-01T00:00:00Z") });
    const delivered = await order("delivered", { createdAt: new Date("2026-11-02T00:00:00Z"), deliveredAt: new Date("2026-11-03T00:00:00Z") });
    const received = await order("received", { createdAt: new Date("2026-10-30T00:00:00Z") });
    await order("preparing", { courier: null, courierTrackingUrl: null });
    await order("dispatched", { courierTrackingUrl: null });
    await order("cancelled");
    const someoneElse = await order("dispatched", { customerId: "customer-2" });

    const reader = createDeliveryReader(db);
    const list = await reader.listForCustomer("customer-1");
    expect(list.map((d) => [d.id, d.status])).toEqual([[delivered.id, "delivered"], [dispatched.id, "dispatched"], [received.id, "received"]]);
    expect(list[0]).toEqual({ id: delivered.id, status: "delivered", courier: "Lalamove", trackingUrl: link,
      deliveredAt: new Date("2026-11-03T00:00:00Z"), summary: "Ube Jam · 250g × 2" });
    expect(JSON.stringify(list)).not.toContain("Jomar");

    expect(await reader.getForCustomer("customer-1", dispatched.id)).toMatchObject({ id: dispatched.id, status: "dispatched" });
    expect(await reader.getForCustomer("customer-1", someoneElse.id)).toBeNull();
    expect(await reader.getForCustomer("customer-2", dispatched.id)).toBeNull();
    expect(await reader.getForCustomer("customer-1", 999999)).toBeNull();
  });
});

describe("which share links are shown inside the shop", () => {
  test.each([
    ["https://share.lalamove.com/?PH123", true],
    ["https://www.lalamove.com/track/abc", true],
    ["https://express.grab.com/track/abc", true],
    ["https://grab.com/x", true],
    ["https://www.google.com/maps/embed?pb=!1m18!1m12", true],
    ["https://www.google.com/maps/place/Manila", false],
    ["https://maps.app.goo.gl/abc", false],
    ["https://www.google.com/search?q=maps/embed", false],
    ["https://evil-lalamove.com/x", false],
    ["https://lalamove.com.evil.test/x", false],
    ["http://share.lalamove.com/x", false],
    ["https://user:pw@share.lalamove.com/x", false],
    ["javascript:alert(1)", false],
    ["not a link", false],
  ])("%s → embedded: %s", (url, embedded) => {
    expect(embeddableTrackingUrl(url) !== null).toBe(embedded);
  });
});
