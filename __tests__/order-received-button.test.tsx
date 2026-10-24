// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { markOrderReceived } = vi.hoisted(() => ({ markOrderReceived: vi.fn() }));

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ markOrderReceived, submitOrderFeedback: vi.fn() }));

import { OrdersBrowser } from "@/components/features/orders/orders-browser";
import type { Order, OrderStatus } from "@/lib/orders/orders";

beforeEach(() => {
  markOrderReceived.mockReset().mockResolvedValue({ received: true });
});
afterEach(cleanup);

const order = (status: OrderStatus): Order => ({
  id: 7,
  fulfillmentMethod: "pickup",
  paymentMethod: "cash-on-delivery",
  status,
  subtotalInCentavos: 20_900,
  deliveryFeeInCentavos: null,
  createdAt: new Date("2026-10-10T06:00:00Z"),
  lines: [],
  deliveryAddress: null,
  paymentProof: null,
  paidById: null,
  paidByName: null,
  paidAt: null,
});

const renderOrder = (status: OrderStatus, returnInProgress = false) =>
  render(<OrdersBrowser orders={[{ order: order(status), feedback: null, returnInProgress }]} />);

const receivedButton = () => screen.queryByRole("button", { name: "I received my order" });

describe("I received my order button", () => {
  test("shows on a delivered Order with no Return in progress", () => {
    renderOrder("delivered");
    expect(receivedButton()).toBeTruthy();
  });

  test("is hidden while a Return is in progress", () => {
    renderOrder("delivered", true);
    expect(receivedButton()).toBeNull();
  });

  test.each<OrderStatus>(["received", "dispatched", "cancelled"])("is hidden on a %s Order", (status) => {
    renderOrder(status);
    expect(receivedButton()).toBeNull();
  });

  test("warns that the right to a Return ends and marks nothing until confirmed", async () => {
    const user = userEvent.setup();
    renderOrder("delivered");

    await user.click(receivedButton()!);

    expect(await screen.findByText(/no longer be able to return/i)).toBeTruthy();
    expect(screen.getByText(/ask for a refund/i)).toBeTruthy();
    expect(markOrderReceived).not.toHaveBeenCalled();
  });

  test("marks the Order received on confirm and the button goes away", async () => {
    const user = userEvent.setup();
    renderOrder("delivered");
    await user.click(receivedButton()!);

    await user.click(await screen.findByRole("button", { name: "Yes, I received it" }));

    await waitFor(() => expect(markOrderReceived).toHaveBeenCalledWith(7));
    await waitFor(() => expect(receivedButton()).toBeNull());
  });

  test("keeps the Order unreceived and shows the reason when marking fails", async () => {
    markOrderReceived.mockResolvedValue({ message: "An Order with a Return in progress cannot be marked received." });
    const user = userEvent.setup();
    renderOrder("delivered");
    await user.click(receivedButton()!);

    await user.click(await screen.findByRole("button", { name: "Yes, I received it" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/Return in progress/);
    expect(receivedButton()).toBeTruthy();
  });

  test("going back from the warning marks nothing", async () => {
    const user = userEvent.setup();
    renderOrder("delivered");
    await user.click(receivedButton()!);

    await user.click(await screen.findByRole("button", { name: "Go back" }));

    expect(markOrderReceived).not.toHaveBeenCalled();
    expect(receivedButton()).toBeTruthy();
  });
});
