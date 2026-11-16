import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, products, sizes } from "../lib/db/schema";
import { createCartStore } from "../lib/orders/cart";
import { createOrderStore, OrderStatusUpdateError } from "../lib/orders/orders";
import { FakeShopStock } from "./helpers/fake-shop-stock";
import { createTestDatabase } from "./helpers/test-database";

vi.mock("next/server", () => ({ after: (work: () => Promise<void>) => work() }));
let client: PGlite;
const ana = { staffId: "s1", staffName: "Ana" };

beforeEach(async () => {
  client = await createTestDatabase();
  const database = drizzle(client);
  await database.insert(customers).values({ id: "c1", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
  await database.insert(products).values({ slug: "ube-jam", name: "Ube Jam", description: "Ube jam." });
  await database.insert(sizes).values({ productSlug: "ube-jam", label: "250g", priceInCentavos: 21900, available: true });
});
afterEach(async () => { await client.close(); });

async function confirmedOrder(paymentMethod: "gcash" | "maya" | "bank-transfer" = "gcash") {
  const database = drizzle(client);
  const { rows } = await client.query<{ id: number }>("select id from sizes");
  await createCartStore(database).addSize("c1", rows[0].id, 1);
  const store = createOrderStore(database, undefined, new FakeShopStock());
  const order = await store.place("c1", { fulfillmentMethod: "pickup", paymentMethod });
  return { store, order };
}

describe("payment proof rejection and resubmission", () => {
  test.each(["maya", "bank-transfer"] as const)("accepts a %s Order's proof", async (method) => {
    const { store, order } = await confirmedOrder(method);
    await expect(store.submitPaymentProof("c1", order.id, { gcashReferenceNumber: method === "bank-transfer" ? "BDO12345AB" : "1234567890" })).resolves.toMatchObject({ status: "awaiting payment" });
  });

  test("a wallet reference must be digits, a bank reference may carry letters", async () => {
    const { store, order } = await confirmedOrder("maya");
    await expect(store.submitPaymentProof("c1", order.id, { gcashReferenceNumber: "ABC12345" })).rejects.toThrow("digits");
  });

  test("a rejection keeps the proof with its reason, and the Customer can upload again", async () => {
    const { store, order } = await confirmedOrder();
    await store.submitPaymentProof("c1", order.id, { gcashReferenceNumber: "1111111111" });
    const rejected = await store.rejectPaymentProof(order.id, { reason: "Blurry", ...ana });
    expect(rejected.rejections).toBe(1);
    expect(rejected.order).toMatchObject({ status: "awaiting payment", paymentProofRejection: { reason: "Blurry" } });
    // A rejected proof cannot be rejected twice or marked paid.
    await expect(store.rejectPaymentProof(order.id, { reason: "x", ...ana })).rejects.toThrow(OrderStatusUpdateError);
    await expect(store.advance(order.id, { status: "paid", ...ana })).rejects.toThrow("was rejected");

    const again = await store.submitPaymentProof("c1", order.id, { gcashReferenceNumber: "2222222222" });
    expect(again.paymentProofRejection).toBeNull();
    const { rows } = await client.query<{ reference: string; rejection_reason: string | null; rejected_by_name: string | null }>("select reference, rejection_reason, rejected_by_name from order_payment_proofs order by id");
    expect(rows).toEqual([{ reference: "1111111111", rejection_reason: "Blurry", rejected_by_name: "Ana" }, { reference: "2222222222", rejection_reason: null, rejected_by_name: null }]);
    await expect(store.advance(order.id, { status: "paid", ...ana })).resolves.toMatchObject({ status: "paid" });
  });

  test("a rejection needs a reason, and a first proof cannot be uploaded twice while it is checked", async () => {
    const { store, order } = await confirmedOrder();
    await store.submitPaymentProof("c1", order.id, { gcashReferenceNumber: "1111111111" });
    await expect(store.rejectPaymentProof(order.id, { reason: "  ", ...ana })).rejects.toThrow("reason");
    await expect(store.submitPaymentProof("c1", order.id, { gcashReferenceNumber: "3333333333" })).rejects.toThrow("being checked");
  });

  test("after 3 rejections paying needs approve anyway with a reason", async () => {
    const { store, order } = await confirmedOrder();
    for (const n of [1, 2, 3]) {
      await store.submitPaymentProof("c1", order.id, { gcashReferenceNumber: `${n}${n}${n}${n}${n}${n}${n}` });
      await store.rejectPaymentProof(order.id, { reason: `No ${n}`, ...ana });
    }
    await expect(store.advance(order.id, { status: "paid", ...ana })).rejects.toThrow("Manager must approve");
    await expect(store.advance(order.id, { status: "paid", ...ana, approvedAnyway: { reason: " " } })).rejects.toThrow("Manager must approve");
    await expect(store.advance(order.id, { status: "paid", ...ana, approvedAnyway: { reason: "Seen in bank app" } })).resolves.toMatchObject({ status: "paid" });
  });
});

test("keeps Customer-confirmed values on each proof without accepting or rejecting it", async () => {
  const { store, order } = await confirmedOrder();
  const result = await store.submitPaymentProof("c1", order.id, {
    gcashReferenceNumber: "1234567890", confirmedAmountInCentavos: 100,
    confirmedPaidAt: new Date("2020-01-01T00:00:00Z"), confirmedRecipient: "wrong account",
    expectedRecipient: "09171234567",
  });
  expect(result.status).toBe("awaiting payment");
  const { rows } = await client.query("select confirmed_amount_in_centavos, confirmed_paid_at, confirmed_recipient, expected_recipient, rejected_at from order_payment_proofs");
  expect(rows).toEqual([expect.objectContaining({ confirmed_amount_in_centavos: 100, confirmed_paid_at: new Date("2020-01-01T00:00:00Z"), confirmed_recipient: "wrong account", expected_recipient: "09171234567", rejected_at: null })]);
});
