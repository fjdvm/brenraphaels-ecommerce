import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/(protected)/profile/actions", () => ({
  addAddress: async () => ({}),
  makeDefaultAddress: async () => ({}),
  removeAddress: async () => ({}),
  updateAddress: async () => ({}),
}));

const { AddressForms } = await import("../components/features/customer/address-forms");

const markup = renderToStaticMarkup(
  <AddressForms
    addresses={[
      {
        id: 1,
        label: "Home",
        street: "1 First Street",
        barangay: "Loyola Heights",
        city: "Quezon City",
        province: "Metro Manila",
        postalCode: "1108",
        country: "Philippines",
        isDefault: true,
      },
      {
        id: 2,
        label: "Work",
        street: "2 Second Street",
        barangay: "Lahug",
        city: "Cebu City",
        province: "Cebu",
        postalCode: "6000",
        country: "Philippines",
        isDefault: false,
      },
    ]}
    provinces={["Cebu", "Metro Manila"]}
  />,
);

function attributeValues(attribute: string, tag: string) {
  return [...markup.matchAll(new RegExp(`<${tag}\\b[^>]*?\\s${attribute}="([^"]*)"`, "g"))].map(
    (match) => match[1],
  );
}

describe("Address management Province, City, and Barangay fields", () => {
  test("uses cascading dropdowns for every Address editor and the add form", () => {
    for (const name of ["province", "city", "barangay"]) {
      expect(markup.match(new RegExp(`<select[^>]*name="${name}"`, "g"))).toHaveLength(3);
      expect(markup).not.toMatch(new RegExp(`<input[^>]*name="${name}"`));
    }
  });

  test("preselects each existing Address's Province", () => {
    expect(markup).toMatch(/<option value="Metro Manila" selected="">Metro Manila<\/option>/);
    expect(markup).toMatch(/<option value="Cebu" selected="">Cebu<\/option>/);
  });

  test("gives each Province, City, and Barangay control a unique ID with a matching label", () => {
    const controlIds = attributeValues("id", "select").filter((id) =>
      /^(province|city|barangay)-/.test(id),
    );
    const labelTargets = attributeValues("for", "label").filter((target) =>
      /^(province|city|barangay)-/.test(target),
    );

    expect(new Set(controlIds).size).toBe(controlIds.length);
    expect(labelTargets.sort()).toEqual(controlIds.sort());
  });
});
