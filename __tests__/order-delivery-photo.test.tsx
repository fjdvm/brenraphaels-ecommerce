// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ markOrderReceived: vi.fn(), submitOrderFeedback: vi.fn() }));

import { OrdersBrowser } from "@/components/features/orders/orders-browser";
import type { Order, OrderStatus } from "@/lib/orders/orders";

afterEach(cleanup);

const order = (status: OrderStatus, deliveryPhotoFileId: string | null): Order => ({
  id: 7,
  fulfillmentMethod: "delivery",
  paymentMethod: "cash-on-delivery",
  status,
  subtotalInCentavos: 20_900,
  deliveryFeeInCentavos: 5_000,
  createdAt: new Date("2026-10-10T06:00:00Z"),
  lines: [],
  deliveryAddress: null,
  paymentProof: null,
  paidById: null,
  paidByName: null,
  paidAt: null,
  deliveryPhotoRemovedAt: null,
  deliveryPhotoFileId,
  courier: null,
});

function openOrder(status: OrderStatus, deliveryPhotoFileId: string | null) {
  render(<OrdersBrowser orders={[{ order: order(status, deliveryPhotoFileId), feedback: null, returnInProgress: false }]} />);
}

describe("Delivery photo on the Order card", () => {
  test.each<OrderStatus>(["delivered", "received"])("shows the photo on a %s Order that has one", (status) => {
    openOrder(status, "file-1");
    const photo = screen.getByRole("img", { name: "Delivery photo for Order #7" });
    expect(photo.getAttribute("src")).toBe("/api/orders/7/delivery-photo");
    expect(screen.queryByText("No photo")).toBeNull();
  });

  test.each<OrderStatus>(["delivered", "received"])("shows No photo on a %s Order that never had one", (status) => {
    openOrder(status, null);
    expect(screen.getByText("No photo")).toBeTruthy();
    expect(screen.queryByText("The Delivery photo was removed.")).toBeNull();
    expect(screen.queryByRole("img", { name: /Delivery photo/ })).toBeNull();
  });

  test.each<OrderStatus>(["delivered", "received"])("says the Delivery photo was removed on a %s Order after retention", (status) => {
    render(<OrdersBrowser orders={[{
      order: { ...order(status, null), deliveryPhotoRemovedAt: new Date("2026-10-25T06:00:00Z") },
      feedback: null,
      returnInProgress: false,
    }]} />);
    expect(screen.getByText("The Delivery photo was removed.")).toBeTruthy();
    expect(screen.queryByText("No photo")).toBeNull();
    expect(screen.queryByRole("img", { name: /Delivery photo/ })).toBeNull();
  });

  test.each<OrderStatus>(["dispatched", "cancelled"])("shows nothing on a %s Order", (status) => {
    openOrder(status, null);
    expect(screen.queryByText("No photo")).toBeNull();
    expect(screen.queryByRole("img", { name: /Delivery photo/ })).toBeNull();
  });

  test("replaces the image with a notice when the photo cannot be loaded", () => {
    openOrder("delivered", "file-1");
    fireEvent.error(screen.getByRole("img", { name: "Delivery photo for Order #7" }));
    expect(screen.queryByRole("img", { name: /Delivery photo/ })).toBeNull();
    expect(screen.getByText("Photo unavailable")).toBeTruthy();
  });
});
