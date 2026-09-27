import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, test } from "vitest";

import { products, productImages, sizes } from "../lib/db/schema";
import { createCatalogStore } from "../lib/catalog/catalog";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
});

describe("Catalog", () => {
  test("lists every Product with its image and price range", async () => {
    const database = drizzle(client);
    await database.insert(products).values({
      slug: "ube-jam-smooth",
      name: "Ube Jam Smooth",
      description: "A silky ube spread.",
    });
    await database.insert(productImages).values({
      productSlug: "ube-jam-smooth",
      url: "https://blob.example/ube-jam.jpg",
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

    await expect(createCatalogStore(database).listProducts()).resolves.toEqual([
      {
        slug: "ube-jam-smooth",
        name: "Ube Jam Smooth",
        image: "https://blob.example/ube-jam.jpg",
        lowestPriceInCentavos: 21900,
        highestPriceInCentavos: 46900,
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
      url: "https://blob.example/ube-powder.jpg",
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
      createCatalogStore(database).findProduct("ube-powder-120-mesh"),
    ).resolves.toEqual({
      slug: "ube-powder-120-mesh",
      name: "120 Mesh Ube Powder",
      description: "Fine ube powder.",
      images: [
        {
          url: "https://blob.example/ube-powder.jpg",
          alt: "A pouch of 120 mesh ube powder",
        },
      ],
      sizes: [
        {
          label: "100g",
          priceInCentavos: 21900,
          available: false,
        },
      ],
    });
  });
});
