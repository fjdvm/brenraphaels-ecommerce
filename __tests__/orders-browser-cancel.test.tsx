// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ submitOrderFeedback: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { OrdersBrowser } from "@/components/features/orders/orders-browser";
import type { Order } from "@/lib/orders/orders";

afterEach(cleanup);

const order = (status: Order["status"]): Order => ({
  id: 1,
  fulfillmentMethod: "delivery",
  paymentMethod: "cash-on-delivery",
  status,
  subtotalInCentavos: 20_900,
  deliveryFeeInCentavos: 100,
  createdAt: new Date("2026-10-10T06:00:00Z"),
  lines: [],
  deliveryAddress: null,
  paymentProof: null,
  paidById: null,
  paidByName: null,
  paidAt: null,
  deliveryPhotoRemovedAt: null, deliveryPhotoFileId: null, courier: null,
});

describe("cancelling from My orders", () => {
  test.each(["preparing", "dispatched"] as const)("a %s Order offers no way to cancel", (status) => {
    render(<OrdersBrowser orders={[{ order: order(status), feedback: null, returnInProgress: false }]} />);
    expect(screen.queryByRole("button", { name: /cancel order|request cancellation/i })).toBeNull();
    expect(screen.queryByText(/rider already has your order/i)).toBeNull();
  });

  test("a dispatched Order with a waiting request still shows its status", () => {
    render(<OrdersBrowser orders={[{ order: order("dispatched"), feedback: null, returnInProgress: false, cancellation: { status: "waiting-manager", declineReason: null } } as never]} />);
    expect(screen.getByText(/Cancellation requested/)).toBeTruthy();
  });
});
