import { describe, expect, test } from "vitest";

import { addRecentSearch, matchResults, toSearchResult } from "../lib/catalog/search-results";

const size = (label: string, available: boolean, left: number | null) => ({ id: 1, label, priceInCentavos: 21900, available, left });
const product = (name: string, sizes: ReturnType<typeof size>[]) => ({
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  image: "/x.jpg",
  lowestPriceInCentavos: 21900,
  highestPriceInCentavos: 39900,
  sizes,
});

describe("search results", () => {
  test("says Sold out when no Size is available", () => {
    expect(toSearchResult(product("Ube Halaya Classic", [size("250g", false, 0)])).stock).toEqual({ kind: "sold-out", text: "Sold out" });
  });
  test("says Only N left for the tightest Size", () => {
    const result = toSearchResult(product("Ube Halaya Smooth", [size("250g", true, 7), size("500g", true, 3)]));
    expect(result.stock?.text).toBe("Only 3 left");
  });
  test("says nothing when there is plenty or stock is unknown", () => {
    expect(toSearchResult(product("A", [size("250g", true, 50)])).stock).toBeNull();
    expect(toSearchResult(product("A", [size("250g", true, null)])).stock).toBeNull();
  });
  test("shows size labels and the price range", () => {
    const result = toSearchResult(product("A", [size("250g", true, 50), size("500g", true, 50)]));
    expect(result.meta).toBe("250g · 500g");
    expect(result.price).toBe("₱219 – ₱399");
  });
  test("matches every word, keeps sold out Products, returns nothing for an empty query", () => {
    const all = [
      toSearchResult(product("Ube Halaya Smooth", [size("250g", true, 50)])),
      toSearchResult(product("Ube Halaya Classic", [size("250g", false, 0)])),
      toSearchResult(product("Ube Jam", [size("250g", true, 50)])),
    ];
    expect(matchResults(all, "halaya").map((r) => r.name)).toEqual(["Ube Halaya Smooth", "Ube Halaya Classic"]);
    expect(matchResults(all, "ube smooth")).toHaveLength(1);
    expect(matchResults(all, "  ")).toEqual([]);
  });
  test("recent searches: newest first, no repeats, capped at 5, blanks ignored", () => {
    expect(addRecentSearch(["a", "b"], "B ")).toEqual(["B", "a"]);
    expect(addRecentSearch(["1", "2", "3", "4", "5"], "6")).toEqual(["6", "1", "2", "3", "4"]);
    expect(addRecentSearch(["a"], "  ")).toEqual(["a"]);
  });
});
