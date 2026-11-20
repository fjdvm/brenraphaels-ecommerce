import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, products, seniorPwdVerifications, sizes } from "../lib/db/schema";
import { createCartStore } from "../lib/orders/cart";
import { createOrderStore } from "../lib/orders/orders";
import { createTestDatabase } from "./helpers/test-database";

vi.mock("../lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail: vi.fn(async () => {}) }, sender: "shop@example.com" }),
  requiredEnvironment: () => "https://shop.example.com",
}));

let client: PGlite;

beforeEach(async () => {
  client = await createTestDatabase();
  const db = drizzle(client);
  await db.insert(customers).values({ id: "customer-1", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
  await db.insert(products).values({ slug: "ube-jam", name: "Ube Jam", description: "Ube jam." });
  await db.insert(sizes).values({ productSlug: "ube-jam", label: "250g", priceInCentavos: 21900, available: true });
});
afterEach(async () => { await client.close(); });

async function placeDelivery() {
  const db = drizzle(client);
  const sizeId = (await client.query<{ id: number }>("select id from sizes")).rows[0].id;
  await createCartStore(db).addSize("customer-1", sizeId, 1);
  const store = createOrderStore(db);
  // A Delivery Order needs a saved Address; insert the order directly to keep this test about confirmation.
  const row = await client.query<{ id: number }>(
    "insert into orders (customer_id, fulfillment_method, payment_method, status, subtotal_in_centavos) values ('customer-1','delivery','cash-on-delivery','placed',21900) returning id",
  );
  return { store, id: row.rows[0].id };
}
const amounts = { subtotalInCentavos: 21900, approvedDiscountInCentavos: 0, deliveryFeeInCentavos: 8000, totalInCentavos: 29900 };
const saved = async (id: number) => (await client.query<Record<string, unknown>>("select status, approved_discount_in_centavos a, total_in_centavos t, delivery_fee_in_centavos f, confirmed_at c from orders where id=$1", [id])).rows[0];

describe("confirming an Order", () => {
  test("saves the final amounts and marks the Order confirmed", async () => {
    const { store, id } = await placeDelivery();
    const order = await store.confirm(id, amounts);
    expect(order.order).toMatchObject({ status: "confirmed", deliveryFeeInCentavos: 8000, totalInCentavos: 29900, approvedDiscountInCentavos: 0 });
    expect(order.replayed).toBe(false);
    expect(await saved(id)).toMatchObject({ status: "confirmed", a: 0, t: 29900, f: 8000, c: expect.any(Date) });
  });

  test("refuses a mismatched total and saves nothing", async () => {
    const { store, id } = await placeDelivery();
    await expect(store.confirm(id, { ...amounts, totalInCentavos: 21900 })).rejects.toThrow(/total/i);
    await expect(store.confirm(id, { ...amounts, subtotalInCentavos: 20000, totalInCentavos: 28000 })).rejects.toThrow(/subtotal/i);
    await expect(store.confirm(id, { ...amounts, approvedDiscountInCentavos: 500, totalInCentavos: 29400 })).rejects.toThrow(/discount/i);
    expect(await saved(id)).toMatchObject({ status: "placed", a: null, t: null, f: null, c: null });
  });

  test("a Delivery Order needs a fee (₱0 allowed) and a Pickup Order has none", async () => {
    const { store, id } = await placeDelivery();
    await expect(store.confirm(id, { ...amounts, deliveryFeeInCentavos: null, totalInCentavos: 21900 })).rejects.toThrow(/Delivery fee/);
    await expect(store.confirm(id, { ...amounts, deliveryFeeInCentavos: 0, totalInCentavos: 21900 })).resolves.toMatchObject({ order: { totalInCentavos: 21900, deliveryFeeInCentavos: 0 } });
    const pickup = (await client.query<{ id: number }>("insert into orders (customer_id, fulfillment_method, payment_method, status, subtotal_in_centavos) values ('customer-1','pickup','cash-on-delivery','placed',21900) returning id")).rows[0].id;
    await expect(store.confirm(pickup, { ...amounts, totalInCentavos: 29900 })).rejects.toThrow(/Pickup/);
    await expect(store.confirm(pickup, { ...amounts, deliveryFeeInCentavos: null, totalInCentavos: 21900 })).resolves.toMatchObject({ order: { status: "confirmed", totalInCentavos: 21900 } });
  });

  test("uses the Senior/PWD discount only while its ID is approved", async () => {
    const { store, id } = await placeDelivery();
    const [verification] = await drizzle(client).insert(seniorPwdVerifications).values({ customerId: "customer-1", idType: "pwd", idHash: "h", status: "pending" }).returning();
    await client.query("update orders set senior_pwd_verification_id=$1, senior_pwd_discount_in_centavos=1095 where id=$2", [verification.id, id]);
    await expect(store.confirm(id, { ...amounts, approvedDiscountInCentavos: 1095, totalInCentavos: 28805 })).rejects.toThrow(/discount/i);
    await client.query("update senior_pwd_verifications set status='approved', expires_on='2099-01-01' where id=$1", [verification.id]);
    await expect(store.confirm(id, { ...amounts, approvedDiscountInCentavos: 1095, totalInCentavos: 28805 })).resolves.toMatchObject({ order: { approvedDiscountInCentavos: 1095, totalInCentavos: 28805 } });
  });

  test("repeating the same confirm is safe, and different amounts are refused", async () => {
    const { store, id } = await placeDelivery();
    await store.confirm(id, amounts);
    const before = await saved(id);
    await expect(store.confirm(id, amounts)).resolves.toMatchObject({ replayed: true, order: { status: "confirmed", totalInCentavos: 29900 } });
    expect(await saved(id)).toEqual(before);
    await expect(store.confirm(id, { ...amounts, deliveryFeeInCentavos: 0, totalInCentavos: 21900 })).rejects.toThrow(/already confirmed/i);
  });

  test("a Customer can cancel with a reason until paid; the reason is required and saved", async () => {
    const { store, id } = await placeDelivery();
    await store.confirm(id, amounts);
    await expect(store.cancel("customer-1", id, "  ")).rejects.toThrow(/why you are cancelling/);
    await expect(store.cancel("customer-1", id, "Wrong address")).resolves.toMatchObject({ status: "cancelled", cancelReason: "Wrong address" });
    const { id: second } = await placeDelivery();
    await expect(store.cancel("customer-1", second, "Changed my mind")).resolves.toMatchObject({ status: "cancelled" });
  });

  test("a Customer cannot cancel once the shop is preparing it; Staff reject with a reason", async () => {
    const { store, id } = await placeDelivery();
    await store.confirm(id, amounts);
    await store.advance(id, { status: "preparing", staffId: "ana", staffName: "Ana" });
    await expect(store.cancel("customer-1", id, "Changed my mind")).rejects.toThrow(/not a legal transition/);
    const { id: placed } = await placeDelivery();
    await expect(store.advance(placed, { status: "cancelled", cancelReason: "Out of stock" })).resolves.toMatchObject({ status: "cancelled", cancelReason: "Out of stock" });
  });
});
