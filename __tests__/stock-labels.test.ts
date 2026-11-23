import { drizzle } from "drizzle-orm/pglite";
import { afterEach, expect, test } from "vitest";
import { createTestDatabase } from "./helpers/test-database";
import { FakeShopStock } from "./helpers/fake-shop-stock";
import { customers, products, productImages, sizes } from "../lib/db/schema";
import { createCatalogStore } from "../lib/catalog/catalog";
import { stockLabel } from "../lib/catalog/stock-label";
import { shopStockCount } from "../lib/catalog/stock-count";
import { createCartStore } from "../lib/orders/cart";

const clients: Awaited<ReturnType<typeof createTestDatabase>>[] = [];
afterEach(async () => { for (const client of clients.splice(0)) await client.close(); });
const files = { publicUrl: async () => "https://images.example/x" };

async function fixture() {
  const client = await createTestDatabase(); clients.push(client);
  const db = drizzle(client);
  await db.insert(customers).values({ id: "jane", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
  await db.insert(products).values({ slug: "ube", name: "Ube", description: "Jam" });
  await db.insert(productImages).values({ productSlug: "ube", fileId: "f", url: null, alt: "Ube", position: 0 });
  const [jar, tub] = await db.insert(sizes).values([
    { productSlug: "ube", label: "250g", priceInCentavos: 10000, available: true },
    { productSlug: "ube", label: "500g", priceInCentavos: 20000, available: true },
  ]).returning();
  const stock = new FakeShopStock();
  return { db, stock, jar, tub };
}

test("labels: plenty says nothing, under 10 says how many are left, none says sold out", () => {
  expect(stockLabel(10)).toBeNull();
  expect(stockLabel(9)).toEqual({ kind: "low", text: "Only 9 left" });
  expect(stockLabel(1)?.text).toBe("Only 1 left");
  expect(stockLabel(0)).toEqual({ kind: "sold-out", text: "Sold out" });
  expect(stockLabel(null)).toBeNull();
});

test("the shop and product page read what is left from the IMS and hide a Size with none left", async () => {
  const { db, stock, jar, tub } = await fixture();
  stock.available.set(stock.productForSize(jar.id), 7);
  stock.available.set(stock.productForSize(tub.id), 0);
  const store = createCatalogStore(db, files, shopStockCount(stock));
  const [listed] = await store.listProducts();
  expect(listed.sizes.map(({ label, available, left }) => ({ label, available, left }))).toEqual([
    { label: "250g", available: true, left: 7 },
  ]);
  // The price range drops the hidden Size's price.
  expect([listed.lowestPriceInCentavos, listed.highestPriceInCentavos]).toEqual([10000, 10000]);
  const detail = await store.findProduct("ube");
  expect(detail?.sizes.map(({ label, left }) => ({ label, left }))).toEqual([{ label: "250g", left: 7 }]);
});

test("a Product with every Size sold out leaves the shop and its page is not found", async () => {
  const { db, stock, jar, tub } = await fixture();
  stock.available.set(stock.productForSize(jar.id), 0);
  stock.available.set(stock.productForSize(tub.id), 0);
  const store = createCatalogStore(db, files, shopStockCount(stock));
  await expect(store.listProducts()).resolves.toEqual([]);
  await expect(store.findProduct("ube")).resolves.toBeUndefined();
});

test("when the stock count is unknown the shop does not list the Size", async () => {
  const { db, stock } = await fixture();
  stock.unavailable = true;
  const store = createCatalogStore(db, files, shopStockCount(stock));
  await expect(store.listProducts()).resolves.toEqual([]);
  await expect(store.findProduct("ube")).resolves.toBeUndefined();
});

test("the Cart blocks a line with none left, or more than is left, and says why", async () => {
  const { db, stock, jar, tub } = await fixture();
  const cart = createCartStore(db, files, stock);
  await cart.addSize("jane", jar.id, 3);
  await cart.addSize("jane", tub.id, 1);
  stock.available.set(stock.productForSize(jar.id), 2);
  stock.available.set(stock.productForSize(tub.id), 0);
  const { lines } = await cart.get("jane");
  expect(lines.map(({ available, blockedReason }) => ({ available, blockedReason }))).toEqual([
    { available: false, blockedReason: "Only 2 left. Lower the quantity to check out." },
    { available: false, blockedReason: "Sold out. Remove it to check out." },
  ]);
});
