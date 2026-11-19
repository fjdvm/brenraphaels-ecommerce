// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const actions = vi.hoisted(() => ({ addCheckoutAddress: vi.fn(), placeOrder: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(site)/(protected)/checkout/actions", () => actions);

import { CheckoutView } from "@/components/features/orders/checkout";
import type { Cart } from "@/lib/orders/cart";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const cart = {
  lines: [{ id: 7, productName: "Ube Halaya", sizeLabel: "250g jar", quantity: 2, priceInCentavos: 21_900, available: true, imageUrl: null }],
  subtotalInCentavos: 43_800,
} as unknown as Cart;

const view = (seniorPwdDiscount?: { label: string; discountInCentavos: number } | null) =>
  render(<CheckoutView cart={cart} addresses={[]} seniorPwdDiscount={seniorPwdDiscount} />);
const placeButton = () => screen.getByRole("button", { name: /Place order/ }) as HTMLButtonElement;

describe("checkout and the Senior Citizen / PWD discount", () => {
  test("never asks for an ID or a discount choice: that happens at sign-up", () => {
    view();
    expect(screen.queryByText(/Senior Citizen \/ PWD discount/)).toBeNull();
    expect(screen.queryByLabelText(/I.m a Senior Citizen or PWD/)).toBeNull();
    expect(screen.queryByLabelText(/ID number/)).toBeNull();
    expect(screen.queryByText(/Senior\/PWD/)).toBeNull();
    expect(placeButton().disabled).toBe(false);
  });

  test("shows the discount the CREOMS rule gives a verified Customer and takes it off the total", () => {
    view({ label: "5% off", discountInCentavos: 1_095 });
    expect(screen.getAllByText(/Senior\/PWD 5% off · 1 item/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/−₱10\.95/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("₱427.05").length).toBeGreaterThan(0);
  });

  test("places the Order with only how it is fulfilled and paid; the server applies the discount", async () => {
    actions.placeOrder.mockResolvedValue({ orderId: 5 });
    view({ label: "5% off", discountInCentavos: 1_095 });
    fireEvent.click(placeButton());
    fireEvent.click(await screen.findByRole("button", { name: "Confirm order" }));
    await waitFor(() => expect(actions.placeOrder).toHaveBeenCalledTimes(1));
    expect(actions.placeOrder.mock.calls[0][0]).not.toHaveProperty("seniorPwd");
  });
});
