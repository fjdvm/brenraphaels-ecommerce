import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createCatalogStore } from "../lib/catalog/catalog";
import { productCategory } from "../lib/catalog/browse";
import { createImsCatalog, databaseCreomsContent, withCreomsContent, type CreomsContent, type ImsProduct } from "../lib/catalog/ims-catalog";
import { imsPriceChanges, productImages, products, sizes } from "../lib/db/schema";
import { createTestDatabase } from "./helpers/test-database";
import { FakeShopStock } from "./helpers/fake-shop-stock";

let client: PGlite;
beforeEach(async () => { client = await createTestDatabase(); });
afterEach(async () => { await client.close(); });

const files = { publicUrl: async (slug: string, id: string) => `https://images.example/${slug}/${id}` };
const jam = (overrides: Partial<ImsProduct> = {}): ImsProduct => ({ productId: 11, name: "Ube Jam", variant: "250g", image: "jam-file", price: 120.5, active: true, ...overrides });
function shop(feed: { items: ImsProduct[] }) {
  const database = drizzle(client);
  const ims = createImsCatalog(database, { read: async () => feed.items });
  const catalog = createCatalogStore(database, files, new FakeShopStock(), ims);
  return { database, ims, catalog };
}

describe("Storefront catalog from the IMS", () => {
  test("a product with name, image and price goes live by itself, at the IMS price and Variant", async () => {
    const { catalog } = shop({ items: [jam()] });
    const [product] = await catalog.listProducts();
    expect(product).toMatchObject({ name: "Ube Jam", image: "https://images.example/ube-jam/jam-file" });
    expect(product.sizes[0]).toMatchObject({ label: "250g", priceInCentavos: 12050, available: true });
  });

  test("a product missing its image or price stays off the shop until the IMS has them", async () => {
    const feed = { items: [jam({ image: null }), jam({ productId: 12, variant: "500g", price: 0 })] };
    const { catalog } = shop(feed);
    expect(await catalog.listProducts()).toEqual([]);
    feed.items = [jam({ image: "jam-file" }), jam({ productId: 12, variant: "500g", price: 200 })];
    expect((await catalog.listProducts())[0].sizes.map((size) => size.label).sort()).toEqual(["250g", "500g"]);
  });

  test("a product with none of the category words is still sold, and listed under All", async () => {
    const { catalog } = shop({ items: [jam({ name: "Ube Cookies" })] });
    const [product] = await catalog.listProducts();
    expect(product.name).toBe("Ube Cookies");
    expect(productCategory(product.name)).toBeUndefined();
  });

  test("a blank Variant is one unlabelled default Size", async () => {
    const { catalog } = shop({ items: [jam({ variant: null })] });
    expect((await catalog.listProducts())[0].sizes.map((size) => size.label)).toEqual([""]);
  });

  test("the first sync lists changed prices for the owner and keeps the old price until approved", async () => {
    const { database, ims, catalog } = shop({ items: [jam({ price: 130 })] });
    await database.insert(products).values({ slug: "ube-jam", name: "Ube Jam", description: "Smooth." });
    await database.insert(productImages).values({ productSlug: "ube-jam", fileId: "jam-file", alt: "Jam", position: 0 });
    await database.insert(sizes).values({ productSlug: "ube-jam", label: "250g", priceInCentavos: 12000, available: true });

    expect((await catalog.listProducts())[0].sizes[0].priceInCentavos).toBe(12000);
    expect(await ims.pendingPriceChanges()).toMatchObject([{ productName: "Ube Jam", sizeLabel: "250g", oldPriceInCentavos: 12000, newPriceInCentavos: 13000 }]);

    expect(await ims.approvePriceChanges()).toBe(1);
    expect((await catalog.listProducts())[0].sizes[0].priceInCentavos).toBe(13000);
    expect(await ims.pendingPriceChanges()).toEqual([]);
  });

  test("a discontinued product cannot be ordered, and coming back in the IMS makes it live again", async () => {
    const feed = { items: [jam()] };
    const { catalog, database } = shop(feed);
    await catalog.listProducts();
    feed.items = [jam({ active: false })];
    expect(await catalog.listProducts()).toEqual([]);
    expect(await catalog.findProduct("ube-jam")).toBeUndefined();
    const [size] = await database.select().from(sizes).where(eq(sizes.productSlug, "ube-jam"));
    expect(size.discontinued).toBe(true);
    feed.items = [jam()];
    expect(await catalog.listProducts()).toHaveLength(1);
  });

  test("a Size the IMS stops listing is discontinued", async () => {
    const feed = { items: [jam(), jam({ productId: 12, variant: "500g", price: 200 })] };
    const { catalog } = shop(feed);
    await catalog.listProducts();
    feed.items = [jam()];
    expect((await catalog.listProducts())[0].sizes.map((size) => size.label)).toEqual(["250g"]);
  });

  test("a later price change in the IMS applies on its own", async () => {
    const feed = { items: [jam()] };
    const { catalog } = shop(feed);
    await catalog.listProducts();
    feed.items = [jam({ price: 150 })];
    expect((await catalog.listProducts())[0].sizes[0].priceInCentavos).toBe(15000);
  });

  test("when the IMS cannot be reached the shop keeps what it has", async () => {
    const database = drizzle(client);
    const failing = createImsCatalog(database, { read: async () => { throw new Error("offline"); } });
    const first = createCatalogStore(database, files, new FakeShopStock(), createImsCatalog(database, { read: async () => [jam()] }));
    await first.listProducts();
    const offline = createCatalogStore(database, files, new FakeShopStock(), failing);
    expect(await offline.listProducts()).toHaveLength(1);
  });
});

describe("Storefront catalog with CREOMS's name, price and image", () => {
  const set = (overrides: Partial<CreomsContent> = {}): CreomsContent => ({ productId: 11, name: null, price: 150, imageFileId: "creoms-file", ...overrides });
  function creomsShop(feed: { items: ImsProduct[] }, content: { rows: CreomsContent[] }) {
    const database = drizzle(client);
    const ims = createImsCatalog(database, withCreomsContent({ read: async () => feed.items }, { read: async () => content.rows }), { pricesDecided: true });
    const catalog = createCatalogStore(database, files, new FakeShopStock(), ims);
    return { database, ims, catalog };
  }

  test("sells at CREOMS's price, name and image, never the IMS ones", async () => {
    const { catalog } = creomsShop({ items: [jam({ price: 999, image: "ims-file" })] }, { rows: [set({ name: "Ube Jam Extreme" })] });
    const [product] = await catalog.listProducts();
    expect(product).toMatchObject({ name: "Ube Jam Extreme", image: "https://images.example/ube-jam-extreme/creoms-file" });
    expect(product.sizes[0].priceInCentavos).toBe(15000);
  });

  test("a new product stays off the shop until CREOMS gives it a price and an image, whatever the IMS has", async () => {
    const content = { rows: [set({ price: null }), set({ productId: 12, imageFileId: null })] };
    const { catalog } = creomsShop({ items: [jam(), jam({ productId: 12, variant: "500g" })] }, content);
    expect(await catalog.listProducts()).toEqual([]);
    content.rows = [set(), set({ productId: 12 })];
    expect((await catalog.listProducts())[0].sizes.map((size) => size.label).sort()).toEqual(["250g", "500g"]);
  });

  test("uses the IMS name when CREOMS has none", async () => {
    const { catalog } = creomsShop({ items: [jam()] }, { rows: [set({ name: "  " })] });
    expect((await catalog.listProducts())[0].name).toBe("Ube Jam");
  });

  test("a CREOMS price change goes live at once and clears any old IMS price waiting for approval", async () => {
    const content = { rows: [set()] };
    const { database, ims, catalog } = creomsShop({ items: [jam()] }, content);
    await catalog.listProducts();
    const [size] = await database.select().from(sizes);
    await database.insert(imsPriceChanges).values({ sizeId: size.id, oldPriceInCentavos: 15000, newPriceInCentavos: 99900 });
    content.rows = [set({ price: 175.5 })];
    expect((await catalog.listProducts())[0].sizes[0].priceInCentavos).toBe(17550);
    expect(await ims.pendingPriceChanges()).toEqual([]);
  });

  test("a Size already on sale keeps its price and image while CREOMS has none, and takes CREOMS's new image", async () => {
    const content = { rows: [] as CreomsContent[] };
    const { database, catalog } = creomsShop({ items: [jam()] }, content);
    await database.insert(products).values({ slug: "ube-jam", name: "Ube Jam", description: "Smooth." });
    await database.insert(productImages).values({ productSlug: "ube-jam", fileId: "old-file", alt: "Jam", position: 0 });
    await database.insert(sizes).values({ productSlug: "ube-jam", label: "250g", priceInCentavos: 12000, available: true, imsProductId: 11 });
    const [kept] = await catalog.listProducts();
    expect(kept).toMatchObject({ image: "https://images.example/ube-jam/old-file" });
    expect(kept.sizes[0].priceInCentavos).toBe(12000);
    content.rows = [set({ imageFileId: "new-file" })];
    const [changed] = await catalog.listProducts();
    expect(changed).toMatchObject({ image: "https://images.example/ube-jam/new-file" });
    expect(changed.sizes[0].priceInCentavos).toBe(15000);
  });

  test("keeps what the shop has when CREOMS cannot be read", async () => {
    const database = drizzle(client);
    const ims = createImsCatalog(database, withCreomsContent({ read: async () => [jam()] }, { read: async () => { throw new Error("crms down"); } }), { pricesDecided: true });
    expect(await ims.sync()).toBe(false);
    expect(await database.select().from(sizes)).toEqual([]);
  });
});

test("reads CREOMS's name, price and image from crms.product_content", async () => {
  await client.exec(`create schema if not exists crms; create table crms.product_content (ims_product_id integer primary key, description text not null default '',
    name text, price numeric(12,2), image_file_id text, image_url text)`);
  await client.exec(`insert into crms.product_content (ims_product_id, name, price, image_file_id) values (11, 'Ube Jam Extreme', 150.50, 'f1'), (12, null, null, null)`);
  expect(await databaseCreomsContent(drizzle(client)).read()).toEqual([
    { productId: 11, name: "Ube Jam Extreme", price: 150.5, imageFileId: "f1" },
    { productId: 12, name: null, price: null, imageFileId: null },
  ]);
});
