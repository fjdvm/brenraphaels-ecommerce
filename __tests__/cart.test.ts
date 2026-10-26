import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  cartLineQuantityLimit,
  createCartStore,
} from "../lib/orders/cart";
import { customers, productImages, products, sizes } from "../lib/db/schema";

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
  await database.insert(customers).values({
    id: "customer-2",
    firstName: "John",
    lastName: "Doe",
    fullName: "John Doe",
    email: "john@example.com",
    contactNumber: "09181234567",
    marketingOptIn: false,
  });
  await database.insert(products).values({
    slug: "ube-jam",
    name: "Ube Jam",
    description: "Ube jam.",
  });
  await database.insert(sizes).values([
    { productSlug: "ube-jam", label: "250g", priceInCentavos: 21900, available: true },
    { productSlug: "ube-jam", label: "500g", priceInCentavos: 39900, available: true },
  ]);
});

afterEach(async () => {
  await client.close();
});

async function sizeId(label: string) {
  const result = await client.query<{ id: number }>(
    "select id from sizes where label = $1",
    [label],
  );
  return result.rows[0].id;
}

describe("Cart", () => {
  test("shows the File-backed Product image in a Customer's Cart", async () => {
    const database = drizzle(client);
    await database.insert(productImages).values({ productSlug: "ube-jam", fileId: "jam-file", alt: "Jam", position: 0 });
    const files = { publicUrl: async () => "https://images.example/jam-file/original" };
    const store = createCartStore(database, files);
    await store.addSize("customer-1", await sizeId("250g"), 1);
    expect((await store.get("customer-1")).lines[0].imageUrl).toBe("https://images.example/jam-file/original");
    files.publicUrl = async () => { throw new Error("gateway unavailable"); };
    await expect(store.addSize("customer-1", await sizeId("250g"), 1)).resolves.toMatchObject({ lines: [{ imageUrl: null, quantity: 2 }] });
  });

  test("adds a Size, combines repeat additions, and caps the line quantity", async () => {
    const store = createCartStore(drizzle(client));
    const small = await sizeId("250g");

    await store.addSize("customer-1", small, 8);
    await store.addSize("customer-1", small, 5);

    await expect(store.get("customer-1")).resolves.toEqual({
      lines: [
        {
          id: expect.any(Number),
          sizeId: small,
          productSlug: "ube-jam",
          productName: "Ube Jam",
          sizeLabel: "250g",
          imageUrl: null,
          priceInCentavos: 21900,
          quantity: cartLineQuantityLimit,
          available: true,
        },
      ],
      subtotalInCentavos: 21900 * cartLineQuantityLimit,
    });
  });

  test("shows each line with its Product's first photo", async () => {
    await drizzle(client).insert(productImages).values([
      { productSlug: "ube-jam", fileId: "second", alt: "Second", position: 1 },
      { productSlug: "ube-jam", fileId: "first", alt: "First", position: 0 },
    ]);
    const store = createCartStore(drizzle(client), { publicUrl: async (_slug, id) => `https://images.example/${id}` });
    await store.addSize("customer-1", await sizeId("250g"), 1);

    const cart = await store.get("customer-1");
    expect(cart.lines[0].imageUrl).toBe("https://images.example/first");
  });

  test("updates and removes only the Customer's own Cart line", async () => {
    const store = createCartStore(drizzle(client));
    await store.addSize("customer-1", await sizeId("250g"), 1);
    await store.addSize("customer-2", await sizeId("500g"), 2);
    const customerOneLine = (await store.get("customer-1")).lines[0];
    const customerTwoLine = (await store.get("customer-2")).lines[0];

    await store.updateLine("customer-1", customerOneLine.id, 3);
    await expect(store.get("customer-1")).resolves.toMatchObject({
      lines: [{ id: customerOneLine.id, quantity: 3 }],
      subtotalInCentavos: 65700,
    });

    await store.updateLine("customer-1", customerTwoLine.id, 1);
    await store.removeLine("customer-1", customerTwoLine.id);
    await expect(store.get("customer-2")).resolves.toMatchObject({
      lines: [{ id: customerTwoLine.id, quantity: 2 }],
      subtotalInCentavos: 79800,
    });

    await store.removeLine("customer-1", customerOneLine.id);
    await expect(store.get("customer-1")).resolves.toEqual({
      lines: [],
      subtotalInCentavos: 0,
    });
  });

  test("merges a Visitor Cart into the persisted Cart without replacing its lines", async () => {
    const store = createCartStore(drizzle(client));
    const small = await sizeId("250g");
    const large = await sizeId("500g");
    await store.addSize("customer-1", small, 2);

    await store.mergeVisitorCart("customer-1", "visitor-cart-1", [
      { sizeId: small, quantity: 3 },
      { sizeId: large, quantity: 4 },
    ]);

    const cart = await store.get("customer-1");
    expect(cart.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizeId: small, quantity: 5 }),
      expect.objectContaining({ sizeId: large, quantity: 4 }),
    ]));
    expect(cart.subtotalInCentavos).toBe(21900 * 5 + 39900 * 4);
  });

  test("merges each Visitor Cart only once when a request is retried", async () => {
    const store = createCartStore(drizzle(client));
    const small = await sizeId("250g");

    await store.mergeVisitorCart("customer-1", "visitor-cart-1", [{ sizeId: small, quantity: 3 }]);
    await store.mergeVisitorCart("customer-1", "visitor-cart-1", [{ sizeId: small, quantity: 3 }]);

    await expect(store.get("customer-1")).resolves.toMatchObject({
      lines: [{ sizeId: small, quantity: 3 }],
      subtotalInCentavos: 65700,
    });
  });
});
