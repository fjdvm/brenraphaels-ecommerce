import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, products, sizes } from "../lib/db/schema";
import { createOrderStore, placeOrderAndNotify } from "../lib/orders/orders";
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
  test("places a Delivery Order with an immutable copy of its chosen Address", async () => {
    const database = drizzle(client);
    await client.query(`
      insert into addresses (customer_id, label, street, barangay, city, province, postal_code, country, is_default)
      values ('customer-1', 'Home', '1 First Street', 'Barangay One', 'Quezon City', 'Metro Manila', '1100', 'Philippines', true)
    `);
    const address = await client.query<{ id: number }>("select id from addresses where customer_id = 'customer-1'");
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);

    const order = await createOrderStore(database).place("customer-1", {
      fulfillmentMethod: "delivery",
      paymentMethod: "cash-on-delivery",
      addressId: address.rows[0].id,
    });

    expect(order).toMatchObject({
      status: "placed",
      deliveryAddress: {
        label: "Home",
        street: "1 First Street",
        barangay: "Barangay One",
        city: "Quezon City",
        province: "Metro Manila",
        postalCode: "1100",
        country: "Philippines",
      },
    });

    await client.query("update addresses set street = '99 Changed Street' where id = $1", [address.rows[0].id]);
    await client.query("delete from addresses where id = $1", [address.rows[0].id]);

    await expect(createOrderStore(database).listForCustomer("customer-1")).resolves.toMatchObject([
      { id: order.id, deliveryAddress: { street: "1 First Street" } },
    ]);
  });

  test("advances an Order one legal status at a time", async () => {
    const database = drizzle(client);
    await client.query(`
      insert into addresses (customer_id, label, street, barangay, city, province, postal_code, country, is_default)
      values ('customer-1', 'Home', '1 First Street', 'Barangay One', 'Quezon City', 'Metro Manila', '1100', 'Philippines', true)
    `);
    const address = await client.query<{ id: number }>("select id from addresses where customer_id = 'customer-1'");
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const placed = await store.place("customer-1", {
      fulfillmentMethod: "delivery",
      paymentMethod: "gcash",
      addressId: address.rows[0].id,
    });
    expect(placed.status).toBe("placed");

    await expect(store.advance(placed.id, { status: "confirmed" })).rejects.toThrow(
      "A confirmed Delivery Order must include its Delivery fee.",
    );
    await expect(store.advance(placed.id, { status: "confirmed", deliveryFeeInCentavos: 8000 })).resolves.toMatchObject({
      status: "confirmed",
      deliveryFeeInCentavos: 8000,
    });
    await expect(store.advance(placed.id, { status: "awaiting payment" })).resolves.toMatchObject({
      status: "awaiting payment",
    });
    await expect(store.advance(placed.id, { status: "paid" })).resolves.toMatchObject({ status: "paid" });
    await expect(store.advance(placed.id, { status: "preparing" })).resolves.toMatchObject({ status: "preparing" });
    await expect(store.advance(placed.id, { status: "dispatched" })).resolves.toMatchObject({ status: "dispatched" });
    await expect(store.advance(placed.id, { status: "delivered" })).resolves.toMatchObject({ status: "delivered" });
  });

  test("does not add a Delivery fee to a Pickup Order", async () => {
    const database = drizzle(client);
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const placed = await createOrderStore(database).place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
    });

    await expect(createOrderStore(database).advance(placed.id, {
      status: "preparing",
      deliveryFeeInCentavos: 8000,
    })).rejects.toThrow("confirming a Delivery Order");
  });

  test("only accepts the next status or cancellation before dispatch", async () => {
    const database = drizzle(client);
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const placed = await store.place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
    });

    await expect(store.advance(placed.id, { status: "awaiting payment" })).rejects.toThrow("not a legal transition");
    await expect(store.listForCustomer("customer-1")).resolves.toMatchObject([{ id: placed.id, status: "confirmed" }]);
    await expect(store.advance(placed.id, { status: "cancelled" })).resolves.toMatchObject({ status: "cancelled" });
    await expect(store.advance(placed.id, { status: "confirmed" })).rejects.toThrow("not a legal transition");

    await cart.addSize("customer-1", await firstSizeId(), 1);
    const dispatched = await store.place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
    });
    await store.advance(dispatched.id, { status: "preparing" });
    await store.advance(dispatched.id, { status: "dispatched" });

    await expect(store.advance(dispatched.id, { status: "cancelled" })).rejects.toThrow("not a legal transition");
    await expect(store.listForCustomer("customer-1")).resolves.toMatchObject([{ id: dispatched.id, status: "dispatched" }, { id: placed.id, status: "cancelled" }]);
  });

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

  test("places the Order and empties the Cart even when the confirmation email fails", async () => {
    const database = drizzle(client);
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const mailer = { send: vi.fn().mockRejectedValue(new Error("Brevo down")) };

    const order = await placeOrderAndNotify(
      "customer-1",
      "jane@example.com",
      { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" },
      { orderStore: createOrderStore(database), mailer },
    );

    expect(order).toMatchObject({ status: "confirmed" });
    expect(mailer.send).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ id: order.id }));
    await expect(cart.get("customer-1")).resolves.toMatchObject({ lines: [], subtotalInCentavos: 0 });
    await expect(createOrderStore(database).listForCustomer("customer-1")).resolves.toMatchObject([
      { id: order.id, status: "confirmed" },
    ]);
  });
});
