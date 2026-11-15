import { describe, expect, test } from "vitest";

import { productMetadata } from "../lib/catalog/product-metadata";

const product = {
  slug: "ube-jam-smooth",
  name: "Ube Jam Smooth",
  description: "Rich and creamy ube jam.\n\nMade from real purple yam.",
  images: [{ url: "https://cdn.example/jam.jpg", alt: "A jar of jam" }],
  sizes: [],
};

describe("Product metadata", () => {
  test("gives each product its own title, description and Open Graph tags", () => {
    const meta = productMetadata(product);
    expect(meta.title).toBe("Ube Jam Smooth");
    expect(meta.description).toContain("Rich and creamy ube jam.");
    expect(meta.openGraph).toMatchObject({
      title: "Ube Jam Smooth",
      description: meta.description,
      images: [{ url: "https://cdn.example/jam.jpg", alt: "A jar of jam" }],
    });
  });

  test("falls back when a product has no description or image", () => {
    const meta = productMetadata({ ...product, description: "", images: [] });
    expect(meta.description).toBe("Buy Ube Jam Smooth from Bren Raphael's.");
    expect(meta.openGraph).toMatchObject({ images: [] });
  });

  test("keeps the description short", () => {
    expect(String(productMetadata({ ...product, description: "word ".repeat(100) }).description).length).toBeLessThanOrEqual(160);
  });
});
