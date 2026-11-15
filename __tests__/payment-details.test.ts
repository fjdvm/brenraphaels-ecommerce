import { afterEach, describe, expect, it, vi } from "vitest";

import { paymentDetails } from "@/lib/orders/payment-details";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("paymentDetails", () => {
  it("reads the Portal's settings with the Ecommerce System secret", async () => {
    vi.stubEnv("PORTAL_URL", "https://portal.example"); vi.stubEnv("PORTAL_ECOMMERCE_SECRET", "s3cret");
    const fetchMock = vi.fn(async () => Response.json({ settings: { gcashNumber: "09171234567", gcashName: "Bren", bankName: "BDO", bankAccountName: "", bankAccountNumber: "123456" } }));
    vi.stubGlobal("fetch", fetchMock);
    const [gcash, maya, bank] = await paymentDetails();
    expect(gcash.lines).toEqual([{ label: "GCash number", value: "09171234567" }, { label: "Account name", value: "Bren" }]);
    expect(maya.lines).toEqual([]);
    expect(bank.lines.map((line) => line.value)).toEqual(["BDO", "123456"]);
    expect(fetchMock.mock.calls[0]).toBeDefined();
  });
  it("falls back to the environment when the Portal is down", async () => {
    vi.stubEnv("PORTAL_URL", "https://portal.example"); vi.stubEnv("PORTAL_ECOMMERCE_SECRET", "s3cret"); vi.stubEnv("PAYMENT_MAYA_NUMBER", "09181112222");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect((await paymentDetails())[1].lines[0].value).toBe("09181112222");
  });
});
