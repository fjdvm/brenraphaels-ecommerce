import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ availability: vi.fn(), place: vi.fn() }));
vi.mock("@/lib/orders/payment-availability", () => ({ fetchPaymentAvailability: mocks.availability }));
vi.mock("@/lib/customer/current-visitor", () => ({ requireCustomer: async () => ({ userId: "u1", email: "c@example.com", addresses: [] }) }));
vi.mock("@/lib/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/audit/gateway", () => ({ writeAuditEvent: vi.fn() }));
vi.mock("@/lib/email/order-placed-email", () => ({ sendOrderPlacedEmail: vi.fn() }));
vi.mock("@/lib/orders/staff-signal", () => ({ scheduleOrdersChanged: vi.fn() }));
vi.mock("@/lib/notifications/gateway", () => ({ sendOrderPlacedSignal: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/orders/orders", async (original) => ({
  ...(await original<typeof import("@/lib/orders/orders")>()),
  createOrderStore: () => ({}),
  placeOrderAndNotify: mocks.place,
}));

import { placeOrder } from "@/app/(site)/(protected)/checkout/actions";

beforeEach(() => { vi.clearAllMocks(); mocks.place.mockResolvedValue({ id: 5 }); });

describe("placeOrder and payment method availability", () => {
  test("refuses a prepaid method the shop has switched off, without placing the Order", async () => {
    mocks.availability.mockResolvedValue({ "cash-on-delivery": true, gcash: false, maya: true, "bank-transfer": true });
    await expect(placeOrder({ fulfillmentMethod: "pickup", paymentMethod: "gcash" })).rejects.toThrow("GCash isn't available right now. Choose another payment method.");
    expect(mocks.place).not.toHaveBeenCalled();
  });

  test("places an Order with a method that is on", async () => {
    mocks.availability.mockResolvedValue({ "cash-on-delivery": true, gcash: true, maya: true, "bank-transfer": true });
    await expect(placeOrder({ fulfillmentMethod: "pickup", paymentMethod: "maya" })).resolves.toMatchObject({ orderId: 5 });
  });

  test("Cash on Delivery never asks CREOMS", async () => {
    await placeOrder({ fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
    expect(mocks.availability).not.toHaveBeenCalled();
    expect(mocks.place).toHaveBeenCalled();
  });
});
