// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ submitOrderFeedback: vi.fn() }));

import { OrdersBrowser } from "@/components/features/orders/orders-browser";
import type { Order } from "@/lib/orders/orders";

afterEach(cleanup);

const order = (id: number): Order => ({
  id,
  fulfillmentMethod: "pickup",
  paymentMethod: "cash-on-delivery",
  status: "delivered",
  subtotalInCentavos: 20_900,
  deliveryFeeInCentavos: null,
  createdAt: new Date("2026-10-10T06:00:00Z"),
  lines: [],
  deliveryAddress: null,
  paymentProof: null,
  paidById: null,
  paidByName: null,
  paidAt: null,
  deliveryPhotoRemovedAt: null, deliveryPhotoFileId: null,
});

const orders = [3, 2, 1].map((id) => ({ order: order(id), feedback: null, returnInProgress: false }));

describe("Orders page deep link to the Feedback form", () => {
  test("opens only the newest Order's card by default", () => {
    render(<OrdersBrowser orders={orders} />);

    expect(screen.getAllByRole("button", { name: /^Hide details/ })).toHaveLength(1);
  });

  test("opens the linked Order's card, with its Feedback form scrolled into view", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<OrdersBrowser focusOrderId={1} orders={orders} />);

    expect(screen.getByRole("button", { name: "Hide details for Order #1" })).toBeTruthy();
    expect(document.getElementById("order-1-feedback")).toBeTruthy();
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  test("ignores a link to an Order that is not the Customer's", () => {
    render(<OrdersBrowser focusOrderId={99} orders={orders} />);

    expect(screen.getAllByRole("button", { name: /^Hide details/ })).toHaveLength(1);
  });
});
