// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { PsgcAddressFields, type LoadOptions } from "@/components/features/address/psgc-address-fields";

afterEach(cleanup);

const lists: Record<string, { code: string; name: string }[]> = {
  region: [{ code: "R1", name: "Region One" }, { code: "NCR", name: "National Capital Region" }],
  "province:R1": [{ code: "P1", name: "Province One" }, { code: "P2", name: "Province Two" }],
  "province:NCR": [{ code: "none", name: "No province (independent cities)" }],
  "city:R1:P1": [{ code: "C1", name: "City One" }],
  "city:NCR:none": [{ code: "C9", name: "Quezon City" }],
  "barangay:R1:C1": [{ code: "B1", name: "Barangay One" }],
  "barangay:NCR:C9": [{ code: "B9", name: "Loyola Heights" }],
};
const loader = (): LoadOptions => vi.fn(async (q) => lists[[q.level, q.region, q.province ?? q.city].filter(Boolean).join(":")] ?? []);

const select = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLSelectElement;
const choose = (label: string, value: string) => fireEvent.change(select(label), { target: { value } });

describe("the checkout address picker", () => {
  test("Country is Philippines and Region loads; the lower levels wait", async () => {
    render(<PsgcAddressFields loadOptions={loader()} />);
    expect(select("Country").value).toBe("Philippines");
    await waitFor(() => expect(screen.getByRole("option", { name: "Region One" })).toBeTruthy());
    expect(select("Province").disabled).toBe(true);
    expect(select("City").disabled).toBe(true);
    expect(select("Barangay").disabled).toBe(true);
  });

  test("each choice fills the next list, and changing one clears those below it", async () => {
    render(<PsgcAddressFields loadOptions={loader()} />);
    await screen.findByRole("option", { name: "Region One" });
    choose("Region", "R1");
    await screen.findByRole("option", { name: "Province Two" });
    choose("Province", "P1");
    await screen.findByRole("option", { name: "City One" });
    choose("City", "C1");
    await screen.findByRole("option", { name: "Barangay One" });
    choose("Barangay", "B1");
    expect(select("Barangay").value).toBe("B1");

    choose("Region", "NCR");
    await screen.findByRole("option", { name: "Quezon City" });
    expect(select("City").value).toBe("");
    expect(select("Barangay").value).toBe("");
  });

  test("a Region with no Province skips straight to its cities", async () => {
    render(<PsgcAddressFields loadOptions={loader()} />);
    await screen.findByRole("option", { name: "National Capital Region" });
    choose("Region", "NCR");
    await screen.findByRole("option", { name: "Quezon City" });
    expect(select("Province").value).toBe("none");
  });

  test("posts the chosen codes under the names the server reads", async () => {
    render(<PsgcAddressFields loadOptions={loader()} />);
    await screen.findByRole("option", { name: "Region One" });
    expect([select("Region"), select("Province"), select("City"), select("Barangay")].map((s) => s.name))
      .toEqual(["regionCode", "provinceCode", "cityCode", "barangayCode"]);
    expect(select("Country").name).toBe("country");
  });

  test("says so when a list cannot be loaded", async () => {
    render(<PsgcAddressFields loadOptions={async () => { throw new Error("offline"); }} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn.t load the address list/);
  });
});
