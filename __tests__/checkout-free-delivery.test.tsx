// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(site)/(protected)/checkout/actions", () => ({ addCheckoutAddress: vi.fn(), placeOrder: vi.fn() }));

import { CheckoutView } from "@/components/features/orders/checkout";
import { amountToFreeDelivery, freeDeliveryProgressPercent, qualifiesForFreeDelivery } from "@/lib/orders/free-delivery";
import type { Cart } from "@/lib/orders/cart";

afterEach(cleanup);

const cart = (subtotalInCentavos: number): Cart =>
  ({
    lines: [{ id: 1, productName: "Ube Halaya", sizeLabel: "250g jar", quantity: 1, priceInCentavos: subtotalInCentavos, available: true, imageUrl: null }],
    subtotalInCentavos,
  }) as unknown as Cart;

const address = { id: 1, label: "Home", street: "1 Rizal", barangay: "B", city: "C", province: "P", postalCode: "1870", country: "Philippines" };

function renderDelivery(subtotal: number) {
  render(<CheckoutView cart={cart(subtotal)} addresses={[address] as never} provinces={[]} />);
  fireEvent.click(screen.getByLabelText(/^Delivery/));
}

describe("Free delivery rule", () => {
  test.each([
    [250_000, false, 1],
    [250_001, true, 0],
  ])("subtotal %i", (subtotal, free, toGo) => {
    expect(qualifiesForFreeDelivery(subtotal)).toBe(free);
    expect(amountToFreeDelivery(subtotal)).toBe(toGo === 0 ? 0 : toGo);
  });

  test("progress is capped at 100%", () => {
    expect(freeDeliveryProgressPercent(64_600)).toBe(25);
    expect(freeDeliveryProgressPercent(900_000)).toBe(100);
  });
});

describe("Checkout Free delivery", () => {
  test("shows Free, no pending note and the confirmed-at-placement message over ₱2,500", () => {
    renderDelivery(283_700);

    expect(screen.getAllByText("Free").length).toBeGreaterThan(0);
    expect(screen.queryByText("To be confirmed")).toBeNull();
    expect(screen.queryByText(/message you the delivery fee/)).toBeNull();
    expect(screen.getByText(/Free delivery — your items are over ₱2,500/)).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  test("shows progress toward ₱2,500 and a pending total under it", () => {
    renderDelivery(64_600);

    expect(screen.getByText("Add ₱1,854 more for free delivery")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    expect(screen.getByText("To be confirmed")).toBeTruthy();
  });

  test("says the total is not final, when the quote comes, and that cancelling is free", () => {
    renderDelivery(64_600);

    expect(screen.getAllByText(/total is not final yet.*quote your delivery fee before we pack.*cancel for free before we pack/).length).toBeGreaterThan(0);
  });

  test("shows no Free delivery content for Store pickup", () => {
    render(<CheckoutView cart={cart(283_700)} addresses={[]} provinces={[]} />);
    expect(screen.queryByText(/Free delivery — your items/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
