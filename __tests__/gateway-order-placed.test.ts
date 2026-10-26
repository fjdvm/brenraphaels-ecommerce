import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { addresses, customers, products, sizes } from "../lib/db/schema";
import { createCartStore } from "../lib/orders/cart";
import { createOrderStore } from "../lib/orders/orders";

const { getDatabase, requireCustomer, sendOrderPlacedEmail, after } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  requireCustomer: vi.fn(),
  sendOrderPlacedEmail: vi.fn(),
  after: vi.fn<(callback: () => Promise<void>) => void>(),
}));
vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/customer/current-visitor", () => ({ requireCustomer }));
vi.mock("@/lib/email/order-placed-email", () => ({ sendOrderPlacedEmail }));
vi.mock("next/server", () => ({ after }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { placeOrder } from "../app/(site)/(protected)/checkout/actions";

let client: PGlite;
let addressId: number;
const fetcher = vi.fn<typeof fetch>();

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("API_GATEWAY_URL", "https://gateway.example/");
  vi.stubEnv("API_GATEWAY_CALLER_KEY", "storefront-key");
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  requireCustomer.mockResolvedValue({ userId: "customer-1", email: "jane@example.com" });
  sendOrderPlacedEmail.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
  client = new PGlite();
  const database = drizzle(client);
  getDatabase.mockReturnValue(database);
  await migrate(database, { migrationsFolder: "drizzle" });
  await database.insert(customers).values({
    id: "customer-1", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe",
    email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false,
  });
  const [address] = await database.insert(addresses).values({
    customerId: "customer-1", label: "Home", street: "1 Main St", barangay: "One",
    city: "Manila", province: "Metro Manila", postalCode: "1000", country: "Philippines", isDefault: true,
  }).returning();
  addressId = address.id;
  await database.insert(products).values({ slug: "jam", name: "Jam", description: "Ube" });
  const [size] = await database.insert(sizes).values({
    productSlug: "jam", label: "250g", priceInCentavos: 21900, available: true,
  }).returning();
  await createCartStore(database).addSize("customer-1", size.id, 1);
});

afterEach(async () => {
  await client.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each([
  ["pickup", "cash-on-delivery"], ["pickup", "gcash"],
  ["delivery", "cash-on-delivery"], ["delivery", "gcash"],
] as const)("%s / %s sends one kind-only signal after checkout responds", async (fulfillmentMethod, paymentMethod) => {
  const response = await placeOrder({ fulfillmentMethod, paymentMethod, addressId });
  expect(response).toEqual({ orderId: expect.any(Number) });
  expect(fetcher).not.toHaveBeenCalled();
  expect(after).toHaveBeenCalledTimes(1);
  await after.mock.calls[0][0]();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("https://gateway.example/creoms/notifications/signal");
  expect(init).toMatchObject({
    method: "POST", headers: { Authorization: "Bearer storefront-key", "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "Order" }), signal: expect.any(AbortSignal),
  });
  expect(sendOrderPlacedEmail).toHaveBeenCalledTimes(1);
});

test.each(["gateway", "CREOMS", "network", "configuration"])("%s outage leaves checkout, Cart and the persisted Order unchanged", async (outage) => {
  if (outage === "configuration") vi.stubEnv("API_GATEWAY_CALLER_KEY", "");
  else if (outage === "network") fetcher.mockRejectedValue(new TypeError("fetch failed"));
  else fetcher.mockResolvedValue(new Response(null, { status: outage === "gateway" ? 502 : 503 }));
  const response = await placeOrder({ fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
  expect(response).toEqual({ orderId: expect.any(Number) });
  expect(after).toHaveBeenCalledTimes(1);
  await expect(after.mock.calls[0][0]()).resolves.toBeUndefined();
  const database = drizzle(client);
  await expect(createOrderStore(database).listForCustomer("customer-1")).resolves.toMatchObject([
    { id: response.orderId, status: "confirmed", subtotalInCentavos: 21900 },
  ]);
  await expect(createCartStore(database).get("customer-1")).resolves.toMatchObject({ lines: [] });
  expect(sendOrderPlacedEmail).toHaveBeenCalledTimes(1);
});

test("a failed Order sends no signal", async () => {
  await createCartStore(drizzle(client)).clear("customer-1");
  await expect(placeOrder({ fulfillmentMethod: "pickup", paymentMethod: "gcash" })).rejects.toThrow("empty");
  expect(after).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

test("a failed confirmation email still schedules the Staff signal", async () => {
  sendOrderPlacedEmail.mockRejectedValue(new Error("email unavailable"));
  await expect(placeOrder({ fulfillmentMethod: "pickup", paymentMethod: "gcash" })).resolves.toEqual({ orderId: expect.any(Number) });
  expect(after).toHaveBeenCalledTimes(1);
  await after.mock.calls[0][0]();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
