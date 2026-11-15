import { describe, expect, test } from "vitest";

import { browseProducts, parseBrowseParams, productCategory } from "../lib/catalog/browse";

const product = (name: string, lowest: number, highest = lowest) => ({
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  image: "/x.jpg",
  lowestPriceInCentavos: lowest,
  highestPriceInCentavos: highest,
  sizes: [],
});

const catalog = [
  product("120 Mesh Ube Powder", 21900),
  product("Ube Halaya Smooth", 21900, 39900),
  product("Ube Jam Smooth", 24900, 46900),
  product("Ube Jam With Tidbits", 21900, 46900),
  product("Mystery Spread", 10000),
];

describe("Shop browsing", () => {
  test.each([
    ["120 Mesh Ube Powder", "powder"],
    ["Ube Halaya Tidbits", "halaya"],
    ["Ube Jam With Tidbits", "jam"],
    ["Mystery Spread", undefined],
  ])("categorises %s as %s", (name, category) => {
    expect(productCategory(name)).toBe(category);
  });

  test("keeps the catalog order when featured and uncategorised", () => {
    expect(browseProducts(catalog, {}).map(({ name }) => name)).toEqual(catalog.map(({ name }) => name));
  });

  test("filters by category", () => {
    expect(browseProducts(catalog, { category: "jam" }).map(({ name }) => name)).toEqual([
      "Ube Jam Smooth",
      "Ube Jam With Tidbits",
    ]);
  });

  test("sorts by lowest price, keeping catalog order for ties", () => {
    expect(browseProducts(catalog, { sort: "price-asc" }).map(({ name }) => name)).toEqual([
      "Mystery Spread",
      "120 Mesh Ube Powder",
      "Ube Halaya Smooth",
      "Ube Jam With Tidbits",
      "Ube Jam Smooth",
    ]);
    expect(browseProducts(catalog, { sort: "price-desc" })[0].name).toBe("Ube Jam Smooth");
  });

  test("reads params, ignoring unknown values and taking the first of repeats", () => {
    expect(parseBrowseParams({ category: "jam", sort: "price-desc" })).toEqual({ category: "jam", sort: "price-desc" });
    expect(parseBrowseParams({ category: "soap", sort: "random" })).toEqual({});
    expect(parseBrowseParams({ category: ["halaya", "jam"] })).toEqual({ category: "halaya" });
  });

  test("searches product names, ignoring case and word order", () => {
    expect(browseProducts(catalog, { q: "JAM smooth" }).map(({ name }) => name)).toEqual(["Ube Jam Smooth"]);
    expect(browseProducts(catalog, { q: "tidbits ube" }).map(({ name }) => name)).toEqual(["Ube Jam With Tidbits"]);
    expect(browseProducts(catalog, { q: "nothing" })).toEqual([]);
  });

  test("search combines with category and reads a trimmed q param", () => {
    expect(browseProducts(catalog, { category: "halaya", q: "ube" })).toHaveLength(1);
    expect(parseBrowseParams({ q: "  ube   jam " })).toEqual({ q: "ube jam" });
    expect(parseBrowseParams({ q: " " })).toEqual({});
  });
});
