import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { products, productImages, sizes } from "../lib/db/schema";
import { createCatalogStore } from "../lib/catalog/catalog";
import { formatPeso } from "../lib/catalog/currency";

let client: PGlite;
const shopFiles = { publicUrl: async (slug: string, id: string) => `https://images.example/${slug}/${id}` };

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
});

afterEach(async () => {
  await client.close();
});

describe("Catalog", () => {
  test("resolves a Product's File id through the gateway instead of its old Blob address", async () => {
    const database = drizzle(client);
    await database.insert(products).values({ slug: "ube-jam", name: "Ube Jam", description: "Smooth." });
    await database.insert(productImages).values({
      productSlug: "ube-jam", fileId: "jam-file", url: "https://blob.example/old.jpg", alt: "Jam", position: 0,
    });
    const files = { publicUrl: async () => "https://images.example/jam-file/original" };
    const product = await createCatalogStore(database, files).findProduct("ube-jam");
    expect(product?.images).toEqual([{ url: "https://images.example/jam-file/original", alt: "Jam" }]);
  });

  test("formats a Size price in Philippine pesos", () => {
    expect(formatPeso(21900)).toBe("₱219");
  });

  test("lists every Product with its image and price range", async () => {
    const database = drizzle(client);
    await database.insert(products).values({
      slug: "ube-jam-smooth",
      name: "Ube Jam Smooth",
      description: "A silky ube spread.",
    });
    await database.insert(productImages).values({
      productSlug: "ube-jam-smooth",
      fileId: "jam-file",
      alt: "A jar of smooth ube jam",
      position: 0,
    });
    await database.insert(sizes).values([
      {
        productSlug: "ube-jam-smooth",
        label: "200g",
        priceInCentavos: 21900,
        available: true,
      },
      {
        productSlug: "ube-jam-smooth",
        label: "500g",
        priceInCentavos: 46900,
        available: false,
      },
    ]);

    await expect(createCatalogStore(database, shopFiles).listProducts()).resolves.toEqual([
      {
        slug: "ube-jam-smooth",
        name: "Ube Jam Smooth",
        image: "https://images.example/ube-jam-smooth/jam-file",
        lowestPriceInCentavos: 21900,
        highestPriceInCentavos: 46900,
        sizes: [
          { id: expect.any(Number), label: "200g", priceInCentavos: 21900, available: true },
          { id: expect.any(Number), label: "500g", priceInCentavos: 46900, available: false },
        ],
      },
    ]);
  });

  test("shows a Product's description, images, and unavailable Size", async () => {
    const database = drizzle(client);
    await database.insert(products).values({
      slug: "ube-powder-120-mesh",
      name: "120 Mesh Ube Powder",
      description: "Fine ube powder.",
    });
    await database.insert(productImages).values({
      productSlug: "ube-powder-120-mesh",
      fileId: "powder-file",
      alt: "A pouch of 120 mesh ube powder",
      position: 0,
    });
    await database.insert(sizes).values({
      productSlug: "ube-powder-120-mesh",
      label: "100g",
      priceInCentavos: 21900,
      available: false,
    });

    await expect(
      createCatalogStore(database, shopFiles).findProduct("ube-powder-120-mesh"),
    ).resolves.toEqual({
      slug: "ube-powder-120-mesh",
      name: "120 Mesh Ube Powder",
      description: "Fine ube powder.",
      images: [
        {
          url: "https://images.example/ube-powder-120-mesh/powder-file",
          alt: "A pouch of 120 mesh ube powder",
        },
      ],
      sizes: [
        {
          id: expect.any(Number),
          label: "100g",
          priceInCentavos: 21900,
          available: false,
        },
      ],
    });
  });
});
