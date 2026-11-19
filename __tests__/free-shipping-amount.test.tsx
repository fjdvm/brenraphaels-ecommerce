import { describe, expect, test, vi } from "vitest";

const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/orders/free-delivery-threshold", () => ({ loadFreeDeliveryThreshold: load }));

import { formatFreeShippingAmount, FreeShippingAmount } from "@/components/shared/free-shipping-amount";

describe("the banner's free shipping amount", () => {
  test.each([[250000, "₱2,500"], [400000, "₱4,000"], [250050, "₱2,500.50"]])("%i centavos reads %s", (centavos, text) => {
    expect(formatFreeShippingAmount(centavos)).toBe(text);
  });

  test("shows what a Manager saved in CREOMS", async () => {
    load.mockResolvedValue(400000);
    expect(await FreeShippingAmount()).toBe("₱4,000");
  });

  test("keeps the old amount rather than a blank banner when the setting cannot be read", async () => {
    load.mockResolvedValue(null);
    expect(await FreeShippingAmount()).toBe("₱2,500");
  });
});
