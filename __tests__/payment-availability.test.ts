import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";


import { COD_ONLY, fetchPaymentAvailability } from "@/lib/orders/payment-availability";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CREOMS_URL", "https://creoms.test");
  vi.stubEnv("CREOMS_SERVICE_SECRET", "s".repeat(40));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); fetchMock.mockReset(); });

const reply = (body: unknown, status = 200) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("fetchPaymentAvailability", () => {
  test("maps CREOMS's answer and always keeps Cash on Delivery", async () => {
    reply({ ok: true, methods: { gcash: true, maya: false, bank_transfer: true } });
    expect(await fetchPaymentAvailability()).toEqual({ "cash-on-delivery": true, gcash: true, maya: false, "bank-transfer": true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://creoms.test/api/payment-methods");
    expect(init.headers.Authorization).toBe(`Bearer ${"s".repeat(40)}`);
  });

  test("treats a method CREOMS does not confirm as off", async () => {
    reply({ ok: true, methods: { gcash: "yes" } });
    expect(await fetchPaymentAvailability()).toEqual(COD_ONLY);
  });

  test.each([["a refusal", () => reply({ error: "no" }, 401)], ["an outage", () => fetchMock.mockRejectedValue(new Error("down"))]])("offers only Cash on Delivery on %s", async (_n, arrange) => {
    arrange();
    expect(await fetchPaymentAvailability()).toEqual(COD_ONLY);
  });

  test("offers only Cash on Delivery when CREOMS is not configured, without calling it", async () => {
    vi.stubEnv("CREOMS_URL", "");
    expect(await fetchPaymentAvailability()).toEqual(COD_ONLY);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
