// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const placeOrder = vi.fn();
vi.mock("@/app/(site)/(protected)/checkout/actions", () => ({ addCheckoutAddress: vi.fn(), placeOrder: (...a: unknown[]) => placeOrder(...a) }));

import { CheckoutView } from "@/components/features/orders/checkout";
import type { Cart } from "@/lib/orders/cart";
import { ALL_PAYMENT_METHODS_AVAILABLE } from "@/lib/orders/payment-methods";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const cart = { lines: [{ id: 1, productName: "Ube Halaya", sizeLabel: "250g jar", quantity: 1, priceInCentavos: 10_000, available: true, imageUrl: null }], subtotalInCentavos: 10_000 } as unknown as Cart;
const view = (availability = ALL_PAYMENT_METHODS_AVAILABLE) => <CheckoutView availability={availability} cart={cart} addresses={[]} provinces={[]} />;

describe("Checkout payment method availability", () => {
  test("disables the methods the shop has off and keeps the rest choosable", () => {
    render(view({ ...ALL_PAYMENT_METHODS_AVAILABLE, gcash: false, "bank-transfer": false }));
    expect((screen.getByLabelText(/^GCash/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/^Bank transfer/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/^Maya/) as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByLabelText(/^Cash on Delivery/) as HTMLInputElement).disabled).toBe(false);
    expect(screen.getAllByText(/Unavailable right now/)).toHaveLength(2);
  });

  test("with nothing prepaid on, Cash on Delivery stays selected and is what gets placed", async () => {
    placeOrder.mockResolvedValue({ orderId: 7 });
    render(view({ "cash-on-delivery": true, gcash: false, maya: false, "bank-transfer": false }));
    expect((screen.getByLabelText(/^Cash on Delivery/) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm order" }));
    await waitFor(() => expect(placeOrder).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: "cash-on-delivery" })));
  });

  test("shows the server's refusal when the shop switched the method off after the page opened", async () => {
    placeOrder.mockRejectedValue(new Error("GCash isn't available right now. Choose another payment method."));
    render(view());
    fireEvent.click(screen.getByLabelText(/^GCash/));
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm order" }));
    expect(await screen.findByText(/GCash isn't available right now/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
