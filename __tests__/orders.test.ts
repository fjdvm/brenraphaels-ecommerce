import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, productImages, products, sizes } from "../lib/db/schema";
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
  test("records who marked an Order paid and retains the attribution on reads", async () => {
    const database = drizzle(client);
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const order = await store.place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
    await store.advance(order.id, { status: "awaiting payment" });
    const before = Date.now();
    const paid = await store.advance(order.id, { status: "paid", staffId: "staff-17", staffName: "Ana de la Cruz" });
    expect(paid).toMatchObject({ status: "paid", paidById: "staff-17", paidByName: "Ana de la Cruz", paidAt: expect.any(Date) });
    expect(paid.paidAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(paid.paidAt!.getTime()).toBeLessThanOrEqual(Date.now());
    await expect(store.listForCustomer("customer-1")).resolves.toMatchObject([paid]);
    await expect(store.advance(order.id, { status: "preparing" })).resolves.toMatchObject({
      paidById: "staff-17", paidByName: "Ana de la Cruz", paidAt: paid.paidAt,
    });
  });

  test.each([
    {}, { staffId: "staff-17" }, { staffName: "Ana Cruz" },
    { staffId: " ", staffName: "Ana Cruz" }, { staffId: "staff-17", staffName: " " },
  ])("refuses paid without Staff attribution and changes nothing: %j", async (staff) => {
    const database = drizzle(client);
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const order = await store.place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
    const awaiting = await store.advance(order.id, { status: "awaiting payment" });
    await expect(store.advance(order.id, { status: "paid", ...staff })).rejects.toThrow();
    await expect(store.listForCustomer("customer-1")).resolves.toEqual([awaiting]);
  });

  test("legacy paid Orders have no attribution and can still advance", async () => {
    const result = await client.query<{ id: number }>(`
      insert into orders (customer_id, fulfillment_method, payment_method, status, subtotal_in_centavos)
      values ('customer-1', 'pickup', 'gcash', 'paid', 21900) returning id
    `);
    const store = createOrderStore(drizzle(client));
    await expect(store.listForCustomer("customer-1")).resolves.toMatchObject([
      { status: "paid", paidById: null, paidByName: null, paidAt: null },
    ]);
    await expect(store.advance(result.rows[0].id, { status: "preparing" })).resolves.toMatchObject({
      status: "preparing", paidById: null, paidByName: null, paidAt: null,
    });
  });

  test("other status changes do not store supplied Staff attribution", async () => {
    const result = await client.query<{ id: number }>(`
      insert into orders (customer_id, fulfillment_method, payment_method, status, subtotal_in_centavos)
      values ('customer-1', 'delivery', 'cash-on-delivery', 'placed', 21900) returning id
    `);
    const store = createOrderStore(drizzle(client));
    for (const status of ["confirmed", "preparing", "dispatched", "delivered"] as const) {
      await expect(store.advance(result.rows[0].id, {
        status, staffId: "staff-17", staffName: "Ana Cruz",
        ...(status === "confirmed" ? { deliveryFeeInCentavos: 8000 } : {}),
      })).resolves.toMatchObject({ status, paidById: null, paidByName: null, paidAt: null });
    }
    const cart = createCartStore(drizzle(client));
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const order = await store.place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
    expect(order).toMatchObject({ paidById: null, paidByName: null, paidAt: null });
    await expect(store.advance(order.id, { status: "cancelled", staffId: "staff-17", staffName: "Ana Cruz" }))
      .resolves.toMatchObject({ status: "cancelled", paidById: null, paidByName: null, paidAt: null });
  });

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
    await expect(store.advance(placed.id, { status: "paid", staffId: "staff-17", staffName: "Ana Cruz" })).resolves.toMatchObject({ status: "paid" });
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

  test("records when an Order became Delivered, and only then", async () => {
    const database = drizzle(client);
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const order = await store.place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
    const deliveredAt = async () =>
      (await client.query<{ delivered_at: Date | null }>("select delivered_at from orders where id = $1", [order.id])).rows[0].delivered_at;

    await store.advance(order.id, { status: "preparing" });
    await store.advance(order.id, { status: "dispatched" });
    expect(await deliveredAt()).toBeNull();

    const before = Date.now();
    await store.advance(order.id, { status: "delivered" });
    expect((await deliveredAt())!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  test("allows a Customer to cancel only their own Order before dispatch", async () => {
    const database = drizzle(client);
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const order = await store.place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
    });

    await expect(store.cancel("customer-1", order.id)).resolves.toMatchObject({
      id: order.id,
      status: "cancelled",
    });
    await expect(store.cancel("another-customer", order.id)).rejects.toThrow("Order was not found.");

    await cart.addSize("customer-1", await firstSizeId(), 1);
    const dispatched = await store.place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
    });
    await store.advance(dispatched.id, { status: "preparing" });
    await store.advance(dispatched.id, { status: "dispatched" });

    await expect(store.cancel("customer-1", dispatched.id)).rejects.toThrow("not a legal transition");
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

  test("lists each Order line with its Product's first photo", async () => {
    const database = drizzle(client);
    await database.insert(productImages).values([
      { productSlug: "ube-jam", url: "https://example.com/second.jpg", alt: "Second", position: 2 },
      { productSlug: "ube-jam", url: "https://example.com/first.jpg", alt: "First", position: 1 },
    ]);
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    await store.place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });

    await expect(store.listForCustomer("customer-1")).resolves.toMatchObject([
      { lines: [{ productName: "Ube Jam", imageUrl: "https://example.com/first.jpg" }] },
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

  test("submits payment proof for a confirmed GCash Order and moves it to awaiting payment", async () => {
    const database = drizzle(client);
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const placed = await store.place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "gcash",
    });
    expect(placed.status).toBe("confirmed");

    const updated = await store.submitPaymentProof("customer-1", placed.id, {
      gcashReferenceNumber: "1234567890",
      screenshotPathname: "payment-proofs/1/receipt.png",
    });

    expect(updated).toMatchObject({
      status: "awaiting payment",
      paymentProof: {
        gcashReferenceNumber: "1234567890",
        screenshotPathname: "payment-proofs/1/receipt.png",
      },
    });
    await expect(store.advance(placed.id, { status: "paid", staffId: "staff-17", staffName: "Ana Cruz" })).resolves.toMatchObject({ status: "paid" });
  });

  test("only accepts payment proof for a confirmed GCash Order belonging to the Customer", async () => {
    const database = drizzle(client);
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const codOrder = await store.place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
    });
    await expect(store.submitPaymentProof("customer-1", codOrder.id, {
      gcashReferenceNumber: "1234567890",
    })).rejects.toThrow("can only be submitted for a GCash Order");

    await cart.addSize("customer-1", await firstSizeId(), 1);
    const gcashOrder = await store.place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "gcash",
    });
    await expect(store.submitPaymentProof("someone-else", gcashOrder.id, {
      gcashReferenceNumber: "1234567890",
    })).rejects.toThrow("was not found");

    await store.submitPaymentProof("customer-1", gcashOrder.id, { gcashReferenceNumber: "1234567890" });
    await expect(store.submitPaymentProof("customer-1", gcashOrder.id, {
      gcashReferenceNumber: "0987654321",
    })).rejects.toThrow("can only be submitted once");
  });
});
