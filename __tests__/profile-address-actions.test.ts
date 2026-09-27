import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/customer/current-visitor", () => ({
  requireCustomer: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));

import { addAddress, updateAddress } from "@/app/(site)/(protected)/profile/actions";

function addressFormData() {
  const formData = new FormData();
  formData.set("label", "Home");
  formData.set("street", "1 First Street");
  formData.set("barangay", "Lahug");
  formData.set("city", "Cebu City");
  formData.set("province", "Metro Manila");
  formData.set("postalCode", "1108");
  return formData;
}

describe("Address management Province, City, and Barangay validation", () => {
  test("rejects an added Address whose City is outside its Province", async () => {
    await expect(addAddress({}, addressFormData())).resolves.toEqual({
      fieldErrors: { city: ["Choose a city or municipality from the list"] },
    });
  });

  test("rejects an edited Address whose City is outside its Province", async () => {
    const formData = addressFormData();
    formData.set("addressId", "1");

    await expect(updateAddress({}, formData)).resolves.toEqual({
      fieldErrors: { city: ["Choose a city or municipality from the list"] },
    });
  });
});
