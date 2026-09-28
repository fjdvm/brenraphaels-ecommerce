import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { customers, products, sizes } from "../lib/db/schema";
import { createOrderStore } from "../lib/orders/orders";
import { createCartStore } from "../lib/orders/cart";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  const database = drizzle(client);
  await migrate(database, { migrationsFolder: "drizzle" });
  await database.insert(customers).values({
    id: "customer-1",
    firstName: "Jane",
    lastName: "Doe",
    fullName: "Jane Doe",
    email: "jane@example.com",
    contactNumber: "09171234567",
    marketingOptIn: false,
  });
  await database.insert(products).values({
    slug: "ube-jam",
    name: "Ube Jam",
    description: "Ube jam.",
  });
  await database.insert(sizes).values({
    productSlug: "ube-jam",
    label: "250g",
    priceInCentavos: 21900,
    available: true,
  });
});

afterEach(async () => {
  await client.close();
});

async function firstSizeId() {
  const result = await client.query<{ id: number }>("select id from sizes");
  return result.rows[0].id;
}

describe("Order", () => {
  test("places a Pickup Cash on Delivery Order, snapshots its Cart, and empties the Cart", async () => {
    const database = drizzle(client);
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 2);

    const order = await createOrderStore(database).place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
    });

    expect(order).toMatchObject({
      id: expect.any(Number),
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
      status: "confirmed",
      subtotalInCentavos: 43800,
      deliveryFeeInCentavos: null,
      lines: [{ productName: "Ube Jam", sizeLabel: "250g", priceInCentavos: 21900, quantity: 2 }],
    });
    await expect(cart.get("customer-1")).resolves.toMatchObject({ lines: [], subtotalInCentavos: 0 });
  });

  test("does not place an Order when a Cart Size is no longer available", async () => {
    const database = drizzle(client);
    const cart = createCartStore(database);
    const sizeId = await firstSizeId();
    await cart.addSize("customer-1", sizeId, 1);
    await client.query("update sizes set available = false where id = $1", [sizeId]);

    await expect(createOrderStore(database).place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
    })).rejects.toThrow("This Size is unavailable.");
    await expect(cart.get("customer-1")).resolves.toMatchObject({ lines: [{ sizeId, quantity: 1 }] });
  });

  test("returns a Customer's orders with their snapshotted line items", async () => {
    const database = drizzle(client);
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const placed = await store.place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
    });

    await expect(store.listForCustomer("customer-1")).resolves.toEqual([
      expect.objectContaining({
        id: placed.id,
        status: "confirmed",
        lines: [expect.objectContaining({ productName: "Ube Jam", sizeLabel: "250g", quantity: 1 })],
      }),
    ]);
  });
});
