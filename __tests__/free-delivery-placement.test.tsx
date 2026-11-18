// @vitest-environment jsdom
import { PGlite } from "@electric-sql/pglite";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { FakeShopStock } from "./helpers/fake-shop-stock";
import { customers, orders, products, sizes } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { createCartStore } from "../lib/orders/cart";
import { qualifiesForFreeDelivery } from "../lib/orders/free-delivery";
import { loadFreeDeliveryThreshold } from "../lib/orders/free-delivery-threshold";
import { createOrderStore } from "../lib/orders/orders";
import { createTestDatabase } from "./helpers/test-database";

vi.mock("../lib/orders/stock", async (importOriginal) => ({ ...await importOriginal<typeof import("../lib/orders/stock")>(), gatewayShopStock: () => new FakeShopStock() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(site)/(protected)/checkout/actions", () => ({ addCheckoutAddress: vi.fn(), placeOrder: vi.fn(), uploadSeniorPwdPhoto: vi.fn() }));
vi.mock("../lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail: vi.fn(async () => {}) }, sender: "shop@example.com" }),
  requiredEnvironment: () => "https://shop.example.com",
}));

import { CheckoutView } from "@/components/features/orders/checkout";
import type { Cart } from "@/lib/orders/cart";

const THRESHOLD = 250_000;
let client: PGlite;

beforeEach(async () => {
  client = await createTestDatabase();
  const db = drizzle(client);
  await db.insert(customers).values({ id: "customer-1", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
  await db.insert(products).values({ slug: "ube-jam", name: "Ube Jam", description: "Ube jam." });
  await db.insert(sizes).values({ productSlug: "ube-jam", label: "250g", priceInCentavos: 21900, available: true });
  await client.exec("insert into addresses (customer_id, label, street, barangay, city, province, postal_code, country, is_default) values ('customer-1', 'Home', '1 Main St', 'San Jose', 'Pasig', 'Metro Manila', '1600', 'Philippines', true)");
});
afterEach(async () => { cleanup(); await client.close(); });

async function placeAt(subtotal: number, threshold: number | null) {
  const db = drizzle(client);
  await db.update(sizes).set({ priceInCentavos: subtotal });
  const sizeId = (await client.query<{ id: number }>("select id from sizes")).rows[0].id;
  await createCartStore(db).addSize("customer-1", sizeId, 1);
  const addressId = (await client.query<{ id: number }>("select id from addresses")).rows[0].id;
  const store = createOrderStore(db, undefined, undefined, () => {}, async () => threshold);
  const order = await store.place("customer-1", { fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", addressId });
  return { db, store, order };
}

describe("qualifiesForFreeDelivery", () => {
  test("is strictly over the threshold", () => {
    expect(qualifiesForFreeDelivery(THRESHOLD, THRESHOLD)).toBe(false);
    expect(qualifiesForFreeDelivery(THRESHOLD + 1, THRESHOLD)).toBe(true);
    expect(qualifiesForFreeDelivery(THRESHOLD - 1, THRESHOLD)).toBe(false);
    expect(qualifiesForFreeDelivery(900_000, null)).toBe(false);
  });
  test("an unreadable setting gives no threshold", async () => {
    await expect(loadFreeDeliveryThreshold({ execute: async () => { throw new Error("no crms schema"); } })).resolves.toBeNull();
    await expect(loadFreeDeliveryThreshold({ execute: async () => [{ amount: "300000" }] })).resolves.toBe(300_000);
  });
});

describe("placing a Delivery Order", () => {
  test.each([[THRESHOLD, false], [THRESHOLD + 1, true]])("a subtotal of %i saves free delivery = %s with the threshold", async (subtotal, free) => {
    const { db, order } = await placeAt(subtotal, THRESHOLD);
    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row).toMatchObject({ freeDelivery: free, freeDeliveryThresholdInCentavos: THRESHOLD, status: "placed", confirmedAt: null, deliveryFeeInCentavos: null });
    expect(order).toMatchObject({ freeDelivery: free, freeDeliveryThresholdInCentavos: THRESHOLD, status: "placed" });
  });

  test("a later threshold change never alters the saved Order", async () => {
    const { db, store, order } = await placeAt(300_000, THRESHOLD);
    const later = createOrderStore(db, undefined, undefined, undefined, async () => 900_000);
    const [listed] = await later.listForCustomer("customer-1");
    expect(listed).toMatchObject({ id: order.id, freeDelivery: true, freeDeliveryThresholdInCentavos: THRESHOLD });
    await expect(store.confirm(order.id, { subtotalInCentavos: 300_000, approvedDiscountInCentavos: 0, deliveryFeeInCentavos: 0, totalInCentavos: 300_000 })).resolves.toMatchObject({ order: { freeDelivery: true, freeDeliveryThresholdInCentavos: THRESHOLD } });
  });

  test("a free-delivery Order is not auto-confirmed and the Customer can cancel it until Staff confirm", async () => {
    const { store, order } = await placeAt(300_000, THRESHOLD);
    expect(order.status).toBe("placed");
    await expect(store.cancel("customer-1", order.id)).resolves.toMatchObject({ status: "cancelled" });
  });

  test("an unreadable threshold saves no rule", async () => {
    const { db, order } = await placeAt(900_000, null);
    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row).toMatchObject({ freeDelivery: false, freeDeliveryThresholdInCentavos: null });
  });
});

describe("confirming an Order placed before free delivery shipped", () => {
  async function legacy(subtotal: number, confirmedAt: string | null) {
    const row = await client.query<{ id: number }>(
      `insert into orders (customer_id, fulfillment_method, payment_method, status, subtotal_in_centavos, confirmed_at) values ('customer-1','delivery','cash-on-delivery','${confirmedAt ? "confirmed" : "placed"}',${subtotal}, ${confirmedAt ? `'${confirmedAt}'` : "null"}) returning id`,
    );
    return row.rows[0].id;
  }
  const confirmation = (subtotal: number) => ({ subtotalInCentavos: subtotal, approvedDiscountInCentavos: 0, deliveryFeeInCentavos: 0, totalInCentavos: subtotal });

  test("gets the rule when Staff confirm it", async () => {
    const id = await legacy(300_000, null);
    const store = createOrderStore(drizzle(client), undefined, undefined, undefined, async () => THRESHOLD);
    await expect(store.confirm(id, confirmation(300_000))).resolves.toMatchObject({ order: { freeDelivery: true, freeDeliveryThresholdInCentavos: THRESHOLD } });
  });

  test("an Order already confirmed is untouched", async () => {
    const id = await legacy(300_000, "2026-01-01T00:00:00Z");
    const store = createOrderStore(drizzle(client), undefined, undefined, undefined, async () => THRESHOLD);
    const order = await store.getById(id);
    expect(order).toMatchObject({ freeDelivery: false, freeDeliveryThresholdInCentavos: null });
  });
});

describe("checkout", () => {
  const cart = { lines: [{ id: 7, productName: "Ube Halaya", sizeLabel: "250g jar", quantity: 1, priceInCentavos: THRESHOLD + 1, available: true, imageUrl: null }], subtotalInCentavos: THRESHOLD + 1 } as unknown as Cart;
  const addresses = [{ id: 1, label: "Home", street: "1 Main St", barangay: "San Jose", city: "Pasig", province: "Metro Manila", postalCode: "1600", country: "Philippines", isDefault: true }] as never;

  test("shows Delivery: Free and the confirmation notice for a Delivery Order over the threshold", () => {
    render(<CheckoutView cart={cart} addresses={addresses} freeDeliveryThresholdInCentavos={THRESHOLD} />);
    fireEvent.click(screen.getByLabelText(/Delivery/, { selector: "input[value=delivery]" }));
    expect(screen.getByText("Delivery: Free")).toBeTruthy();
    expect(screen.getAllByText("Your order is subject to shop confirmation").length).toBeGreaterThan(0);
  });

  test("an Online payment choice shows Pending Confirmation, never payment numbers or QR codes", () => {
    render(<CheckoutView cart={cart} addresses={addresses} />);
    fireEvent.click(screen.getByLabelText(/GCash/, { selector: "input[value=gcash]" }));
    expect(screen.getByTestId("pending-confirmation-note").textContent).toContain("Pending Confirmation");
    expect(screen.queryByTestId("payment-details")).toBeNull();
    expect(screen.queryByRole("img", { name: /QR/i })).toBeNull();
  });

  test("keeps the fee to follow at exactly the threshold or when the threshold is unknown", () => {
    const equal = { ...cart, subtotalInCentavos: THRESHOLD } as Cart;
    render(<CheckoutView cart={equal} addresses={addresses} freeDeliveryThresholdInCentavos={THRESHOLD} />);
    fireEvent.click(screen.getByLabelText(/Delivery/, { selector: "input[value=delivery]" }));
    expect(screen.queryByText("Delivery: Free")).toBeNull();
    cleanup();
    render(<CheckoutView cart={cart} addresses={addresses} freeDeliveryThresholdInCentavos={null} />);
    fireEvent.click(screen.getByLabelText(/Delivery/, { selector: "input[value=delivery]" }));
    expect(screen.queryByText("Delivery: Free")).toBeNull();
  });
});
