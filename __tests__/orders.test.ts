import { cancelThroughRequest } from "@/__tests__/helpers/cancel-through-request";
import { FakeShopStock } from "./helpers/fake-shop-stock";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { eq } from "drizzle-orm";
import { customers, orderLines, orders, productImages, products, sizes } from "../lib/db/schema";
import { createOrderStore, placeOrderAndNotify } from "../lib/orders/orders";
import { sendOrderPlacedEmail } from "../lib/email/order-placed-email";
import { createCartStore } from "../lib/orders/cart";
import { createTestDatabase } from "./helpers/test-database";

const sendMail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: "shop@example.com" }),
  requiredEnvironment: () => "https://shop.example.com",
}));
const booking = { name: "Lalamove", trackingUrl: "https://share.lalamove.test/abc" } as const;
let client: PGlite;

beforeEach(async () => {
  client = await createTestDatabase();
  const database = drizzle(client);
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
  vi.clearAllMocks();
});

async function firstSizeId() {
  const result = await client.query<{ id: number }>("select id from sizes");
  return result.rows[0].id;
}

describe("Order", () => {
  test.each([1000, 250000, 250001, 900000])("a Delivery Order of %i centavos is never confirmed automatically", async (subtotal) => {
    const database = drizzle(client);
    await database.update(sizes).set({ priceInCentavos: subtotal });
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    await client.exec("insert into addresses (customer_id, label, street, barangay, city, province, postal_code, country, is_default) values ('customer-1', 'Home', '1 Main St', 'San Jose', 'Pasig', 'Metro Manila', '1600', 'Philippines', true)");
    const address = await client.query<{id: number}>("select id from addresses limit 1");
    const store = createOrderStore(database);
    const placed = await placeOrderAndNotify("customer-1", "jane@example.com", { fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", addressId: address.rows[0].id }, { orderStore: store, mailer: { send: sendOrderPlacedEmail } });
    expect(placed).toMatchObject({ subtotalInCentavos: subtotal, status: "placed", deliveryFeeInCentavos: null });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("Delivery fee: To be confirmed") }));
    expect(sendMail).not.toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("free delivery") }));
    const [row] = await database.select().from(orders).where(eq(orders.id, placed.id));
    expect(row).toMatchObject({ status: "placed", deliveryFeeInCentavos: null });
    const notices = await client.query("select 1 from customer_notifications where type = 'order.free-delivery'");
    expect(notices.rows).toHaveLength(0);
    // Staff may enter any fee, including ₱0, whatever the subtotal.
    await expect(store.advance(placed.id, { status: "confirmed", deliveryFeeInCentavos: 0 })).resolves.toMatchObject({ status: "confirmed", deliveryFeeInCentavos: 0 });
  });

  test("a Delivery fee above ₱0 is accepted on a large Delivery Order, and a missing fee is refused", async () => {
    const database = drizzle(client);
    await database.update(sizes).set({ priceInCentavos: 900000 });
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    await client.exec("insert into addresses (customer_id, label, street, barangay, city, province, postal_code, country, is_default) values ('customer-1', 'Home', '1 Main St', 'San Jose', 'Pasig', 'Metro Manila', '1600', 'Philippines', true)");
    const address = await client.query<{id: number}>("select id from addresses limit 1");
    const store = createOrderStore(database);
    const placed = await store.place("customer-1", { fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", addressId: address.rows[0].id });
    await expect(store.advance(placed.id, { status: "confirmed" })).rejects.toThrow("must include its Delivery fee");
    await expect(store.advance(placed.id, { status: "confirmed", deliveryFeeInCentavos: 19000 })).resolves.toMatchObject({ status: "confirmed", deliveryFeeInCentavos: 19000 });
  });

  test("a Pickup Order still has no Delivery fee", async () => {
    const database = drizzle(client);
    await database.update(sizes).set({ priceInCentavos: 900000 });
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const placed = await store.place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
    expect(placed).toMatchObject({ status: "confirmed", deliveryFeeInCentavos: null });
  });

  test("an Order confirmed under the old free-delivery rule keeps its fee and status", async () => {
    const database = drizzle(client);
    await client.exec(`insert into orders (customer_id, fulfillment_method, payment_method, status, subtotal_in_centavos, delivery_fee_in_centavos)
      values ('customer-1', 'delivery', 'cash-on-delivery', 'confirmed', 300000, 0)`);
    const store = createOrderStore(database);
    await expect(store.listForCustomer("customer-1")).resolves.toMatchObject([{ status: "confirmed", deliveryFeeInCentavos: 0, subtotalInCentavos: 300000 }]);
  });

  test.each(["confirmed", "awaiting payment", "paid", "preparing"])("GCash partial cancellation keeps the quoted fee and %s", async phase => {
    const database = drizzle(client);
    await database.update(sizes).set({ priceInCentavos: 250000 });
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    const [extra] = await database.insert(sizes).values({ productSlug: "ube-jam", label: "Extra", priceInCentavos: 1, available: true }).returning();
    await createCartStore(database).addSize("customer-1", extra.id, 1);
    await client.exec("insert into addresses (customer_id, label, street, barangay, city, province, postal_code, country, is_default) values ('customer-1', 'Home', '1 Main St', 'San Jose', 'Pasig', 'Metro Manila', '1600', 'Philippines', true)");
    const address = await client.query<{id: number}>("select id from addresses limit 1");
    const store = createOrderStore(database);
    const order = await store.place("customer-1", { fulfillmentMethod: "delivery", paymentMethod: "gcash", addressId: address.rows[0].id });
    expect(order).toMatchObject({ status: "placed", deliveryFeeInCentavos: null });
    await store.advance(order.id, { status: "confirmed", deliveryFeeInCentavos: 19000 });
    if (phase !== "confirmed") await store.submitPaymentProof("customer-1", order.id, { gcashReferenceNumber: "1234567890" });
    if (["paid", "preparing"].includes(phase)) await store.advance(order.id, { status: "paid", staffId: "ana", staffName: "Ana" });
    if (phase === "preparing") await store.advance(order.id, { status: "preparing", staffId: "ana", staffName: "Ana" });
    const [line] = await database.select().from(orderLines).where(eq(orderLines.sizeLabel, "Extra"));
    await expect(store.cancelItems(order.id, [line.id], { staffId: "ana", staffName: "Ana" }, "placed")).rejects.toThrow("already changed");
    await store.cancelItems(order.id, [line.id], { staffId: "ana", staffName: "Ana" }, phase);
    await expect(store.listForCustomer("customer-1")).resolves.toMatchObject([{ status: phase, deliveryFeeInCentavos: 19000, subtotalInCentavos: 250000 }]);
  });

  test("shows a File-backed Product image in Order history instead of the retained Blob address", async () => {
    const database = drizzle(client);
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    const stock = new FakeShopStock();
    const placed = await createOrderStore(database, undefined, stock).place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
    await database.insert(productImages).values({ productSlug: "ube-jam", fileId: "jam-file", url: "https://blob.example/old.jpg", alt: "Jam", position: 0 });
    const files = { publicUrl: async () => "https://images.example/jam-file/original" };
    const store = createOrderStore(database, files);
    expect((await store.listForCustomer("customer-1"))[0]).toMatchObject({ id: placed.id, lines: [{ imageUrl: "https://images.example/jam-file/original" }] });
  });

  test("an image gateway outage shows no photo and never turns a committed Order change into a failure", async () => {
    const database = drizzle(client);
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    const stock = new FakeShopStock();
    const placed = await createOrderStore(database, undefined, stock).place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
    await database.insert(productImages).values({ productSlug: "ube-jam", fileId: "jam-file", url: "https://blob.example/old.jpg", alt: "Jam", position: 0 });
    const files = { publicUrl: async (): Promise<string> => { throw new Error("gateway unavailable"); } };
    await expect(createOrderStore(database, files, stock).advance(placed.id, { status: "preparing", staffId: "ana", staffName: "Ana" })).resolves.toMatchObject({
      status: "preparing", lines: [{ imageUrl: null }],
    });
  });

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
    await expect(store.advance(order.id, { status: "preparing", staffId: "ana", staffName: "Ana" })).resolves.toMatchObject({
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
    await expect(store.advance(result.rows[0].id, { status: "preparing", staffId: "ana", staffName: "Ana" })).resolves.toMatchObject({
      status: "preparing", paidById: null, paidByName: null, paidAt: null,
    });
  });

  async function preparingOrder(fulfillmentMethod: "delivery" | "pickup") {
    const result = await client.query<{ id: number }>(`
      insert into orders (customer_id, fulfillment_method, payment_method, status, subtotal_in_centavos, delivery_fee_in_centavos)
      values ('customer-1', '${fulfillmentMethod}', 'cash-on-delivery', 'preparing', 21900, ${fulfillmentMethod === "delivery" ? 8000 : "null"}) returning id
    `);
    return result.rows[0].id;
  }

  test.each([
    ["no courier", undefined],
    ["a link with a password", { name: "Grab", trackingUrl: "https://user:pw@grab.test/x" }],
    ["an overlong link", { name: "Grab", trackingUrl: `https://grab.test/${"x".repeat(2100)}` }],
    ["an http link", { name: "Grab", trackingUrl: "http://grab.test/x" }],
    ["a non-link", { name: "Grab", trackingUrl: "not a link" }],
    ["an unknown courier", { name: "Other", trackingUrl: "https://x.test/a" }],
  ])("refuses to dispatch a Delivery Order with %s", async (_label, courier) => {
    const id = await preparingOrder("delivery");
    const store = createOrderStore(drizzle(client));
    await expect(store.advance(id, { status: "dispatched", courier: courier as never })).rejects.toThrow();
    await expect(client.query("select status, courier from orders where id = $1", [id])).resolves.toMatchObject({ rows: [{ status: "preparing", courier: null }] });
  });

  const riderRow = async (id: number) => (await client.query("select courier, courier_tracking_url, rider_name, rider_plate, rider_phone from orders where id = $1", [id])).rows[0];

  test("keeps the courier and optional rider details on a dispatched Delivery Order, but hands the Customer only courier and link", async () => {
    const id = await preparingOrder("delivery");
    const store = createOrderStore(drizzle(client));
    const order = await store.advance(id, { status: "dispatched", courier: { ...booking, riderName: "Juan Dela Cruz", riderPlate: "ABC 1234", riderPhone: "0917 123 4567" } });
    expect(order.courier).toEqual({ name: "Lalamove", trackingUrl: booking.trackingUrl });
    expect(await riderRow(id)).toMatchObject({ rider_name: "Juan Dela Cruz", rider_plate: "ABC 1234", rider_phone: "09171234567" });
    await store.advance(id, { status: "delivered", deliveryPhotoFileId: "photo-1" });
    const [listed] = await store.listForCustomer("customer-1");
    expect(listed.courier).toEqual({ name: "Lalamove", trackingUrl: booking.trackingUrl });
    expect(JSON.stringify(listed)).not.toMatch(/Juan|ABC 1234|09171234567/);
  });

  test("dispatches with the courier alone: the link is optional", async () => {
    const id = await preparingOrder("delivery");
    const order = await createOrderStore(drizzle(client)).advance(id, { status: "dispatched", courier: { name: "Grab" } });
    expect(order.courier).toEqual({ name: "Grab", trackingUrl: null });
    expect(await riderRow(id)).toMatchObject({ courier: "Grab", courier_tracking_url: null, rider_name: null });
  });

  describe("changing the booking while dispatched", () => {
    test("adds the link and fixes the rider, replacing the whole booking without another dispatch", async () => {
      const id = await preparingOrder("delivery");
      const store = createOrderStore(drizzle(client));
      await store.advance(id, { status: "dispatched", courier: { name: "Grab", riderName: "Juan" } });
      const order = await store.updateCourier(id, { name: "Lalamove", trackingUrl: booking.trackingUrl, riderPhone: "0917 123 4567" });
      expect(order).toMatchObject({ status: "dispatched", courier: { name: "Lalamove", trackingUrl: booking.trackingUrl } });
      expect(await riderRow(id)).toEqual({ courier: "Lalamove", courier_tracking_url: booking.trackingUrl, rider_name: null, rider_plate: null, rider_phone: "09171234567" });
      const cleared = await store.updateCourier(id, { name: "Lalamove" });
      expect(cleared.courier).toEqual({ name: "Lalamove", trackingUrl: null });
    });
    test.each([["http link", { name: "Grab", trackingUrl: "http://g.test/1" }], ["unknown courier", { name: "Other" }]])("refuses a %s and keeps the booking", async (_l, bad) => {
      const id = await preparingOrder("delivery");
      const store = createOrderStore(drizzle(client));
      await store.advance(id, { status: "dispatched", courier: booking });
      await expect(store.updateCourier(id, bad as never)).rejects.toThrow();
      expect(await riderRow(id)).toMatchObject({ courier: "Lalamove", courier_tracking_url: booking.trackingUrl });
    });
    test("refuses a Pickup Order, an Order that is not dispatched or any more, and a missing Order", async () => {
      const store = createOrderStore(drizzle(client));
      await expect(store.updateCourier(await preparingOrder("pickup"), booking)).rejects.toThrow("no courier");
      await expect(store.updateCourier(await preparingOrder("delivery"), booking)).rejects.toThrow("only be changed while the Order is dispatched");
      const id = await preparingOrder("delivery");
      await store.advance(id, { status: "dispatched", courier: booking });
      await store.advance(id, { status: "delivered", deliveryPhotoFileId: "photo-1" });
      await expect(store.updateCourier(id, { name: "Grab" })).rejects.toThrow("only be changed while the Order is dispatched");
      await expect(store.updateCourier(999999, booking)).rejects.toThrow("not found");
    });
  });

  test("Pickup refuses a courier and the Delivery step dispatched", async () => {
    const store = createOrderStore(drizzle(client));
    const id = await preparingOrder("pickup");
    await expect(store.advance(id, { status: "dispatched", courier: booking })).rejects.toThrow();
    await expect(store.advance(id, { status: "dispatched" })).rejects.toThrow("not a legal transition");
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
        ...(status === "delivered" ? { deliveryPhotoFileId: "photo-1" } : {}),
        ...(status === "dispatched" ? { courier: booking } : {}),
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

  test("copies a picked Address's Region onto the Order, and an older Address leaves it empty", async () => {
    const database = drizzle(client);
    await client.query(`
      insert into addresses (customer_id, label, street, barangay, city, province, region, postal_code, country, is_default)
      values ('customer-1', 'Home', '1 First Street', 'Barangay One', 'Quezon City', '', 'NCR', '1100', 'Philippines', true),
             ('customer-1', 'Work', '2 Old Street', 'Barangay Two', 'Cebu City', 'Cebu', null, '6000', 'Philippines', false)
    `);
    const { rows } = await client.query<{ id: number; label: string }>("select id, label from addresses where customer_id = 'customer-1' order by id");
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const picked = await createOrderStore(database).place("customer-1", { fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", addressId: rows[0].id });
    expect(picked.deliveryAddress).toMatchObject({ region: "NCR", province: "" });

    await cart.addSize("customer-1", await firstSizeId(), 1);
    const older = await createOrderStore(database).place("customer-1", { fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", addressId: rows[1].id });
    expect(older.deliveryAddress).toMatchObject({ region: null, street: "2 Old Street" });
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
    await expect(store.advance(placed.id, { status: "preparing", staffId: "ana", staffName: "Ana" })).resolves.toMatchObject({ status: "preparing" });
    await expect(store.advance(placed.id, { status: "dispatched", courier: booking })).resolves.toMatchObject({ status: "dispatched" });
    await expect(store.advance(placed.id, { status: "delivered", deliveryPhotoFileId: "photo-1" })).resolves.toMatchObject({ status: "delivered", deliveryPhotoFileId: "photo-1" });
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
    await store.advance(dispatched.id, { status: "preparing", staffId: "ana", staffName: "Ana" });
    await store.advance(dispatched.id, { status: "ready for pickup" });

    await expect(store.advance(dispatched.id, { status: "cancelled" })).rejects.toThrow("not a legal transition");
    await expect(store.listForCustomer("customer-1")).resolves.toMatchObject([{ id: dispatched.id, status: "ready for pickup" }, { id: placed.id, status: "cancelled" }]);
  });

  test("records when an Order became Delivered, and only then", async () => {
    const database = drizzle(client);
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const order = await store.place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
    const deliveredAt = async () =>
      (await client.query<{ delivered_at: Date | null }>("select delivered_at from orders where id = $1", [order.id])).rows[0].delivered_at;

    await store.advance(order.id, { status: "preparing", staffId: "ana", staffName: "Ana" });
    // A legacy Pickup Order that was already dispatched before the Pickup statuses existed.
    await client.query("update orders set status = 'dispatched' where id = $1", [order.id]);
    expect(await deliveredAt()).toBeNull();

    const before = Date.now();
    await store.advance(order.id, { status: "delivered", deliveryPhotoFileId: "photo-1" });
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

    await expect(cancelThroughRequest(store, "customer-1", order.id, "Changed my mind")).resolves.toMatchObject({
      id: order.id,
      status: "cancelled",
    });
    await expect(cancelThroughRequest(store, "another-customer", order.id, "Changed my mind")).rejects.toThrow("Order was not found.");

    await cart.addSize("customer-1", await firstSizeId(), 1);
    const dispatched = await store.place("customer-1", {
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
    });
    await store.advance(dispatched.id, { status: "preparing", staffId: "ana", staffName: "Ana" });
    await store.advance(dispatched.id, { status: "ready for pickup" });

    await expect(cancelThroughRequest(store, "customer-1", dispatched.id, "Changed my mind")).rejects.toThrow("not a legal transition");
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
      { productSlug: "ube-jam", fileId: "second", alt: "Second", position: 2 },
      { productSlug: "ube-jam", fileId: "first", alt: "First", position: 1 },
    ]);
    await createCartStore(database).addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database, { publicUrl: async (_slug, id) => `https://images.example/${id}` });
    await store.place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });

    await expect(store.listForCustomer("customer-1")).resolves.toMatchObject([
      { lines: [{ productName: "Ube Jam", imageUrl: "https://images.example/first" }] },
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
      screenshotFileId: "file-1",
    });

    expect(updated).toMatchObject({
      status: "awaiting payment",
      paymentProof: {
        gcashReferenceNumber: "1234567890",
        screenshotFileId: "file-1",
      },
    });
    await expect(store.advance(placed.id, { status: "paid", staffId: "staff-17", staffName: "Ana Cruz" })).resolves.toMatchObject({ status: "paid" });
  });

  test("a payment proof records the file-storage File id, and the screenshot reader finds it or the legacy pathname", async () => {
    const database = drizzle(client);
    const cart = createCartStore(database);
    await cart.addSize("customer-1", await firstSizeId(), 1);
    const store = createOrderStore(database);
    const placed = await store.place("customer-1", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });

    const updated = await store.submitPaymentProof("customer-1", placed.id, {
      gcashReferenceNumber: "1234567890",
      screenshotFileId: "file-9",
    });

    expect(updated.paymentProof).toMatchObject({ screenshotFileId: "file-9", screenshotPathname: null });
    await expect(store.getPaymentProofScreenshot("customer-1", placed.id)).resolves.toEqual({ fileId: "file-9" });
    await expect(store.getPaymentProofScreenshot("customer-2", placed.id)).resolves.toBeUndefined();

    await database.update(orders).set({ paymentProofFileId: null, paymentProofScreenshotPathname: "payment-proofs/1/old.png" }).where(eq(orders.id, placed.id));
    await expect(store.getPaymentProofScreenshot("customer-1", placed.id)).resolves.toEqual({ pathname: "payment-proofs/1/old.png" });
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
    })).rejects.toThrow("can only be submitted for a GCash, Maya or bank transfer Order");

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
    })).rejects.toThrow("is being checked");
  });
});

vi.mock("../lib/orders/stock", async (importOriginal) => ({ ...await importOriginal<typeof import("../lib/orders/stock")>(), gatewayShopStock: () => new FakeShopStock() }));
