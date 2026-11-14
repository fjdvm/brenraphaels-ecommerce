// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({
  markOrderReceived: vi.fn(),
  submitOrderFeedback: vi.fn(),
  ordersLiveUrl: vi.fn(),
  cancelOrder: vi.fn(),
}));

let serverOrders: OrderWithFeedback[] = [];
let serverReturns: CustomerReturn[] = [];
let rerender: (() => void) | undefined;
// router.refresh() re-runs the server page: the browser then receives whatever the database holds now.
const refresh = vi.fn(() => rerender?.());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { LiveOrders } from "@/components/features/orders/live-orders";
import { OrdersBrowser, type OrderWithFeedback } from "@/components/features/orders/orders-browser";
import type { ConnectOrdersLive } from "@/lib/orders/live";
import type { Order, OrderStatus } from "@/lib/orders/orders";
import type { CustomerReturn } from "@/lib/returns/customer-reads";

afterEach(cleanup);

const order = (status: OrderStatus, deliveryPhotoFileId: string | null): OrderWithFeedback => ({
  order: {
    id: 7, fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", status,
    subtotalInCentavos: 20_900, deliveryFeeInCentavos: 5_000, createdAt: new Date("2026-10-10T06:00:00Z"),
    lines: [], deliveryAddress: null, paymentProof: null, paidById: null, paidByName: null, paidAt: null,
    deliveryPhotoRemovedAt: null, deliveryPhotoFileId, courier: null,
  } as Order,
  feedback: null,
  returnInProgress: false,
});

const returnWith = (status: CustomerReturn["status"]): CustomerReturn => ({
  id: 3, number: "RET-0003", orderId: 7, status, reason: "damaged", note: "", amountInCentavos: 20_900,
  preferredResolution: "refund", finalResolution: null, goodsRequired: false, declineReason: null,
  photoFileIds: [], videoFileId: null, refundProofFileId: null, items: [],
  requestedAt: new Date("2026-10-11T06:00:00Z"), refundedAt: null, replacedAt: null,
});

function openPage() {
  let deliver!: Parameters<ConnectOrdersLive>[0];
  const connect: ConnectOrdersLive = (handlers) => {
    deliver = handlers;
    return { close: vi.fn() };
  };
  function Page() {
    const [, setTick] = useState(0);
    rerender = () => setTick((tick) => tick + 1);
    return (
      <>
        <LiveOrders connect={connect} />
        <OrdersBrowser orders={serverOrders} returns={serverReturns} />
      </>
    );
  }
  render(<Page />);
  act(() => deliver.onOpen());
  return (event: Parameters<typeof deliver.onEvent>[0]) => act(() => deliver.onEvent(event));
}

describe("Customer's open Orders page, from event to card", () => {
  test("a status event moves the Order card with no reload", () => {
    serverOrders = [order("dispatched", null)];
    serverReturns = [];
    const send = openPage();
    expect(screen.getByText("Dispatched")).toBeTruthy();

    serverOrders = [order("preparing", null)];
    send({ type: "order.updated", orderId: "7" });

    expect(screen.queryByText("Dispatched")).toBeNull();
    expect(screen.getAllByText("Preparing").length).toBeGreaterThan(0);
  });

  test("a delivered event shows the Delivery photo", () => {
    serverOrders = [order("dispatched", null)];
    serverReturns = [];
    const send = openPage();
    expect(screen.queryByRole("img", { name: "Delivery photo for Order #7" })).toBeNull();

    serverOrders = [order("delivered", "file-1")];
    send({ type: "order.updated", orderId: "7" });

    expect(screen.getByRole("img", { name: "Delivery photo for Order #7" })).toBeTruthy();
  });

  test("a Return decision event updates the Return", () => {
    serverOrders = [order("delivered", "file-1")];
    serverReturns = [returnWith("requested")];
    const send = openPage();
    expect(screen.getAllByText(/Requested/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Approved/)).toHaveLength(0);

    serverReturns = [returnWith("approved")];
    send({ type: "return.updated", orderId: "7", returnId: "3" });

    expect(screen.getAllByText(/Approved/).length).toBeGreaterThan(0);
  });
});
