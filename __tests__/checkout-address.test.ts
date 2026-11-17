import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { formatAddressLine } from "../lib/address/format";
import { addPickedAddress, createAddressStore } from "../lib/customer/addresses";
import { listBarangays, listCities, listProvinces, listRegions, resolveAddress } from "../lib/psgc";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
beforeEach(async () => {
  client = await createTestDatabase();
  await client.query(`insert into customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in)
    values ('customer-1', 'Jane', 'Doe', 'Jane Doe', 'jane@example.com', '09171234567', true)`);
});
afterEach(() => client.close());

async function firstPick() {
  const region = listRegions().find((r) => r.name === "Central Visayas")!;
  const province = listProvinces(region.code).find((p) => p.name === "Cebu")!;
  const city = listCities(region.code, province.code)[0];
  const barangay = (await listBarangays(region.code, city.code))[0];
  return { regionCode: region.code, provinceCode: province.code, cityCode: city.code, barangayCode: barangay.code };
}

describe("a checkout Address picked from the PSGC lists", () => {
  test("is saved with its Region and names, and Country Philippines", async () => {
    const resolved = await resolveAddress(await firstPick());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const id = await addPickedAddress({ label: "Home", street: "12 Mango Ave", postalCode: "6000", ...resolved.address }, { userId: "customer-1", addressStore: createAddressStore(drizzle(client)) });
    const { rows } = await client.query<Record<string, string>>("select region, province, city, barangay, street, country from addresses where id = $1", [id]);
    expect(rows[0]).toMatchObject({ region: "Central Visayas", province: "Cebu", street: "12 Mango Ave", country: "Philippines" });
    expect(rows[0].city).toBe(resolved.address.city);
  });

  test("a Metro Manila Address has no Province and still reads cleanly", async () => {
    const region = listRegions().find((r) => r.name === "NCR")!;
    const [only] = listProvinces(region.code);
    const city = listCities(region.code, only.code)[0];
    const barangay = (await listBarangays(region.code, city.code))[0];
    const resolved = await resolveAddress({ regionCode: region.code, provinceCode: only.code, cityCode: city.code, barangayCode: barangay.code });
    if (!resolved.ok) throw new Error(resolved.message);
    expect(resolved.address.province).toBe("");
    expect(formatAddressLine({ street: "1 A St", barangay: "B", city: "C", province: "", postalCode: "1100" })).toBe("1 A St, B, C 1100");
  });

  test("refuses a Barangay that does not belong to the City", async () => {
    const pick = await firstPick();
    const other = listRegions().find((r) => r.code !== pick.regionCode)!;
    const stranger = (await listBarangays(other.code, Object.keys((await import(`../lib/psgc/data/barangays-${other.code}.json`)).default)[0]))[0];
    const resolved = await resolveAddress({ ...pick, barangayCode: stranger.code });
    expect(resolved).toMatchObject({ ok: false });
  });

  test("an older free-text Address, with no Region, still reads as before", () => {
    expect(formatAddressLine({ street: "1 First Street", barangay: "Loyola Heights", city: "Quezon City", province: "Metro Manila", postalCode: "1108" })).toBe("1 First Street, Loyola Heights, Quezon City, Metro Manila 1108");
  });
});
