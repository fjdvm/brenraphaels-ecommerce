import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile/addresses",
  useRouter: () => ({ replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
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
    recipient={{ name: "Jane Doe", contactNumber: "09171234567" }}
    initialEditing={1}
  />,
);

function attributeValues(attribute: string, tag: string) {
  return [...markup.matchAll(new RegExp(`<${tag}\\b[^>]*?\\s${attribute}="([^"]*)"`, "g"))].map(
    (match) => match[1],
  );
}

describe("Address book", () => {
  test("lists every saved Address and marks the default", () => {
    expect(markup).toContain("1 First Street, Loyola Heights, Quezon City, Metro Manila 1108");
    expect(markup).toContain("2 Second Street, Lahug, Cebu City, Cebu 6000");
    expect(markup.match(/>Default</g)).toHaveLength(1);
  });

  test("shows the recipient on each card", () => {
    expect(markup.match(/Jane Doe · 09171234567/g)).toHaveLength(2);
  });

  test("offers to make only a non-default Address the default", () => {
    expect(markup.match(/Set as default</g)).toHaveLength(1);
  });
});

describe("Address editor Province, City, and Barangay fields", () => {
  test("uses cascading dropdowns in the one open form", () => {
    for (const name of ["province", "city", "barangay"]) {
      expect(markup.match(new RegExp(`<select[^>]*name="${name}"`, "g"))).toHaveLength(1);
      expect(markup).not.toMatch(new RegExp(`<input[^>]*name="${name}"`));
    }
  });

  test("preselects the edited Address's Province", () => {
    expect(markup).toMatch(/<option value="Metro Manila" selected="">Metro Manila<\/option>/);
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
