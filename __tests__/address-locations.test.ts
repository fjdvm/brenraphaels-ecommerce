import { describe, expect, test } from "vitest";

import {
  listBarangays,
  listCities,
  listProvinces,
  locationErrors,
} from "../lib/address/locations";

describe("The Province → City → Barangay choices", () => {
  test("offers Metro Manila and the provinces, in alphabetical order", () => {
    const provinces = listProvinces();

    expect(provinces).toContain("Metro Manila");
    expect(provinces).toContain("Cebu");
    expect(provinces).toEqual([...provinces].sort((a, b) => a.localeCompare(b, "en")));
  });

  test("lists independent cities under the province they sit in", () => {
    expect(listCities("Cebu")).toEqual(
      expect.arrayContaining(["Cebu City", "Mandaue City", "Lapu-Lapu City", "Talisay City"]),
    );
    expect(listCities("Davao del Sur")).toContain("Davao City");
    expect(listCities("Quezon")).toContain("Lucena City");
  });

  test("lists the cities of Metro Manila, with Manila split into its districts", () => {
    const cities = listCities("Metro Manila");

    expect(cities).toEqual(expect.arrayContaining(["Quezon City", "Makati City", "Pateros"]));
    expect(cities).toContain("Binondo, Manila");
    expect(cities).not.toContain("Manila City");
  });

  test("gives every city a province, a name that is unique in it, and barangays", () => {
    for (const province of listProvinces()) {
      const cities = listCities(province);
      expect(new Set(cities).size).toBe(cities.length);
      for (const city of cities) {
        const barangays = listBarangays(province, city);
        expect(barangays.length, `${city}, ${province}`).toBeGreaterThan(0);
        expect(new Set(barangays).size, `${city}, ${province}`).toBe(barangays.length);
      }
    }
  });

  test("lists every city once, so none is lost between provinces", () => {
    const total = listProvinces().reduce((sum, province) => sum + listCities(province).length, 0);

    expect(total).toBeGreaterThan(1600);
  });

  test("lists nothing for a place that does not exist", () => {
    expect(listCities("Atlantis")).toEqual([]);
    expect(listBarangays("Cebu", "Quezon City")).toEqual([]);
  });
});

describe("Checking that a Province, City and Barangay go together", () => {
  const valid = { province: "Metro Manila", city: "Quezon City", barangay: "Loyola Heights" };

  test("accepts a real combination", () => {
    expect(locationErrors(valid)).toEqual({});
  });

  test("rejects free text that is not in the list", () => {
    expect(locationErrors({ ...valid, province: "Narnia" })).toEqual({
      province: ["Choose a province from the list"],
    });
  });

  test("rejects a city that is not in the chosen province", () => {
    expect(locationErrors({ ...valid, province: "Cebu" })).toEqual({
      city: ["Choose a city or municipality from the list"],
    });
  });

  test("rejects a barangay that is not in the chosen city", () => {
    expect(locationErrors({ ...valid, barangay: "Nowhere" })).toEqual({
      barangay: ["Choose a barangay from the list"],
    });
  });
});
