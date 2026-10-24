import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, expect, test } from "vitest";

import { customers, orderLines, orderReturnItems, orderReturns, orders } from "../lib/db/schema";
import { createOrderStore } from "../lib/orders/orders";
import { createReturnOfferStore } from "../lib/returns/return-offers";

const client = new PGlite();
const db = drizzle(client);
const deliveredAt = new Date("2026-10-24T08:00:00Z");

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(customers).values({ id: "c1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
    email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
});
afterAll(async () => { await client.close(); });

test("reports each delivered Order's lines, delivery time, locked lines and Requested Return", async () => {
  const [order] = await db.insert(orders).values({ customerId: "c1", status: "delivered", fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 15000, deliveredAt }).returning();
  const [kept, finished] = await db.insert(orderLines).values([
    { orderId: order.id, productName: "Halaya", sizeLabel: "Small", quantity: 1, priceInCentavos: 10000 },
    { orderId: order.id, productName: "Jam", sizeLabel: "Small", quantity: 1, priceInCentavos: 5000 },
  ]).returning();
  const [refunded] = await db.insert(orderReturns).values({ orderId: order.id, status: "refunded", reason: "damaged", amountInCentavos: 5000 }).returning();
  await db.insert(orderReturnItems).values({ returnId: refunded.id, orderLineId: finished.id, productName: "Jam", sizeLabel: "Small", quantity: 1, priceInCentavos: 5000 });
  const [declined] = await db.insert(orderReturns).values({ orderId: order.id, status: "declined", reason: "other", amountInCentavos: 10000 }).returning();
  await db.insert(orderReturnItems).values({ returnId: declined.id, orderLineId: kept.id, productName: "Halaya", sizeLabel: "Small", quantity: 1, priceInCentavos: 10000 });
  const [pending] = await db.insert(orderReturns).values({ orderId: order.id, status: "requested", reason: "other", amountInCentavos: 0 }).returning();
  const [other] = await db.insert(orders).values({ customerId: "c1", status: "preparing", fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 100 }).returning();

  const all = await createOrderStore(db).listForCustomer("c1");
  const offers = await createReturnOfferStore(db).forCustomer("c1", all);

  expect(offers.has(other.id)).toBe(false);
  expect(offers.get(order.id)).toMatchObject({
    deliveredAtMs: deliveredAt.getTime(),
    requested: { id: pending.id, number: `RMA-${pending.id}` },
    lines: [{ id: kept.id, returnable: true }, { id: finished.id, returnable: false }],
  });
});
