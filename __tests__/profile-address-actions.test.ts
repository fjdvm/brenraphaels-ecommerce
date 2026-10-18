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

describe("The default-address switch on the address form", () => {
  async function actionsWith(store: Record<string, unknown>) {
    vi.resetModules();
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    vi.doMock("@/lib/customer/current-visitor", () => ({ requireCustomer: async () => ({ userId: "customer-1" }) }));
    vi.doMock("@/lib/customer/addresses", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/customer/addresses")>()),
      createAddressStore: () => store,
    }));
    return import("@/app/(site)/(protected)/profile/actions");
  }

  function validFormData(isDefault: boolean) {
    const formData = new FormData();
    formData.set("label", "Home");
    formData.set("street", "1 First Street");
    formData.set("barangay", "Lahug");
    formData.set("city", "Cebu City");
    formData.set("province", "Cebu");
    formData.set("postalCode", "6000");
    formData.set("addressId", "9");
    if (isDefault) formData.set("isDefault", "on");
    return formData;
  }

  test("makes a newly added Address the default when switched on", async () => {
    const setDefault = vi.fn(async () => true);
    const { addAddress } = await actionsWith({ add: async () => 12, setDefault });
    await addAddress({}, validFormData(true));
    expect(setDefault).toHaveBeenCalledWith("customer-1", 12);
  });

  test("leaves the default alone when switched off", async () => {
    const setDefault = vi.fn(async () => true);
    const { addAddress, updateAddress } = await actionsWith({ add: async () => 12, update: async () => true, setDefault });
    await addAddress({}, validFormData(false));
    await updateAddress({}, validFormData(false));
    expect(setDefault).not.toHaveBeenCalled();
  });

  test("makes an edited Address the default when switched on", async () => {
    const setDefault = vi.fn(async () => true);
    const { updateAddress } = await actionsWith({ update: async () => true, setDefault });
    await updateAddress({}, validFormData(true));
    expect(setDefault).toHaveBeenCalledWith("customer-1", 9);
  });
});
