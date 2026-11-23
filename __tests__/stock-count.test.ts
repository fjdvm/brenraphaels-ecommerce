import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";

import { createCatalogStore } from "../lib/catalog/catalog";
import { databaseStockCount } from "../lib/catalog/stock-count";
import { productImages, products, sizes } from "../lib/db/schema";
import { createTestDatabase } from "./helpers/test-database";

const clients: Awaited<ReturnType<typeof createTestDatabase>>[] = [];
afterEach(async () => { for (const client of clients.splice(0)) await client.close(); vi.restoreAllMocks(); });
const files = { publicUrl: async () => "https://images.example/x" };

async function fixture() {
  const client = await createTestDatabase(); clients.push(client);
  const db = drizzle(client);
  await db.insert(products).values([{ slug: "halaya", name: "Ube Halaya Smooth", description: "" }, { slug: "jam", name: "Ube Jam", description: "" }]);
  await db.insert(productImages).values([{ productSlug: "halaya", fileId: "h", alt: "Halaya", position: 0 }, { productSlug: "jam", fileId: "j", alt: "Jam", position: 0 }]);
  const [small, large, jar, unmapped] = await db.insert(sizes).values([
    { productSlug: "halaya", label: "250g", priceInCentavos: 21900, available: true, imsProductId: 21 },
    { productSlug: "halaya", label: "500g", priceInCentavos: 39900, available: true, imsProductId: 22 },
    { productSlug: "jam", label: "200g", priceInCentavos: 21900, available: true, imsProductId: 13 },
    { productSlug: "jam", label: "300g", priceInCentavos: 31900, available: true },
  ]).returning();
  await db.execute(sql`create schema crms`);
  await db.execute(sql`create table crms.stock_count (ims_product_id integer primary key, quantity integer, reserved integer, available integer)`);
  // CREOMS's In store tab: 250g sold out, 500g has 10, the 200g jar has no count yet.
  await db.execute(sql`insert into crms.stock_count values (21, 0, 0, 0), (22, 10, 0, 10)`);
  return { db, small, large, jar, unmapped };
}

test("reads CREOMS's available count per Size in one query, and unknown for a Size it has no count for", async () => {
  const { db, small, large, jar, unmapped } = await fixture();
  const left = await databaseStockCount(db).left([small.id, large.id, jar.id, unmapped.id]);
  expect(Object.fromEntries(left)).toEqual({ [small.id]: 0, [large.id]: 10, [jar.id]: null, [unmapped.id]: null });
});

test("the shop lists exactly the Sizes CREOMS counts above zero", async () => {
  const { db, large } = await fixture();
  const store = createCatalogStore(db, files, databaseStockCount(db));
  const listed = await store.listProducts();
  expect(listed.map((product) => ({ slug: product.slug, sizes: product.sizes.map(({ id, left }) => ({ id, left })) })))
    .toEqual([{ slug: "halaya", sizes: [{ id: large.id, left: 10 }] }]);
  expect(await store.findProduct("jam")).toBeUndefined();
  expect((await store.findProduct("halaya"))?.sizes.map(({ label }) => label)).toEqual(["500g"]);
});

test("lists nothing, rather than guessing, when the count cannot be read", async () => {
  const { db } = await fixture();
  await db.execute(sql`drop table crms.stock_count`);
  vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(createCatalogStore(db, files, databaseStockCount(db)).listProducts()).resolves.toEqual([]);
});
