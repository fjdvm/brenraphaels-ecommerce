// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ cancelOrder: vi.fn(), markOrderReceived: vi.fn(), submitOrderFeedback: vi.fn(), submitPaymentProof: vi.fn() }));

import { OrdersBrowser } from "@/components/features/orders/orders-browser";
import { needsNewProof, needsPayment } from "@/lib/orders/order-view";
import type { Order } from "@/lib/orders/orders";
import type { PaymentDetail } from "@/lib/orders/payment-details";

afterEach(cleanup);

const details: PaymentDetail[] = [
  { method: "gcash", label: "GCash", lines: [{ label: "GCash number", value: "0917 000 0000" }] },
  { method: "maya", label: "Maya", lines: [{ label: "Maya number", value: "0918 111 1111" }] },
  { method: "bank-transfer", label: "Bank transfer", lines: [] },
];

const order = (overrides: Partial<Order>): Order => ({
  id: 7, fulfillmentMethod: "pickup", paymentMethod: "maya", status: "confirmed", subtotalInCentavos: 20_900, deliveryFeeInCentavos: null,
  createdAt: new Date("2026-10-10T06:00:00Z"), lines: [], deliveryAddress: null, paymentProof: null, paidById: null, paidByName: null, paidAt: null,
  deliveryPhotoRemovedAt: null, deliveryPhotoFileId: null, courier: null, ...overrides,
});

function open(o: Order) {
  render(<OrdersBrowser orders={[{ order: o, feedback: null, returnInProgress: false }]} paymentDetails={details} />);
}

describe("payment screens", () => {
  test("a confirmed Maya Order shows where to pay and asks for the Maya reference", () => {
    open(order({}));
    expect(screen.getByText("0918 111 1111")).toBeTruthy();
    expect(screen.getByLabelText(/Maya reference number/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit payment" })).toBeTruthy();
  });

  test("a rejected proof says why and offers Send new proof", () => {
    const rejected = order({
      status: "awaiting payment",
      paymentProof: { gcashReferenceNumber: "111111", screenshotPathname: null, screenshotFileId: null, submittedAt: new Date() },
      paymentProofRejection: { reason: "The amount does not match", at: new Date() },
      paymentProofRejections: 1,
    });
    expect(needsNewProof(rejected)).toBe(true);
    open(rejected);
    expect(screen.getByText(/Reason: The amount does not match/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send new proof" })).toBeTruthy();
  });

  test("a bank transfer Order with no details yet tells the Customer to ask", () => {
    open(order({ paymentMethod: "bank-transfer" }));
    expect(screen.getByText(/Message us for the Bank transfer details/)).toBeTruthy();
  });

  test("Cash on Delivery needs no payment proof", () => {
    expect(needsPayment(order({ paymentMethod: "cash-on-delivery" }))).toBe(false);
  });
});

import { OrderPlacedView } from "@/components/features/orders/order-placed";

describe("order placed screen", () => {
  test("a GCash Order shows where to pay and the proof form once confirmed", () => {
    render(<OrderPlacedView details={details} firstName="Jude" order={order({ paymentMethod: "gcash", status: "confirmed" })} />);
    expect(screen.getByText("Thank you, Jude!")).toBeTruthy();
    expect(screen.getByText("0917 000 0000")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit payment" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Pay later in My orders" })).toBeTruthy();
  });

  test("an Order not yet confirmed shows Pending Confirmation, no numbers and no proof form; Cash on Delivery shows no details", () => {
    const { unmount } = render(<OrderPlacedView details={details} order={order({ paymentMethod: "maya", status: "placed" })} />);
    expect(screen.getByTestId("pending-confirmation")).toBeTruthy();
    expect(screen.queryByText("0918 111 1111")).toBeNull();
    expect(screen.queryByTestId("payment-details")).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit payment" })).toBeNull();
    unmount();
    render(<OrderPlacedView details={details} order={order({ paymentMethod: "cash-on-delivery" })} />);
    expect(screen.queryByTestId("payment-details")).toBeNull();
  });
});

describe("payment history and deadline", () => {
  test("lists every proof with why a rejected one was not accepted, and shows the 24-hour deadline", () => {
    const rejected = order({
      status: "awaiting payment",
      createdAt: new Date("2026-10-16T06:00:00Z"),
      paymentProof: { gcashReferenceNumber: "111111", screenshotPathname: null, screenshotFileId: null, submittedAt: new Date("2026-10-16T06:21:00Z") },
      paymentProofRejection: { reason: "Used on another order", at: new Date("2026-10-16T07:00:00Z") },
      paymentProofHistory: [{ reference: "111111", submittedAt: new Date("2026-10-16T06:21:00Z"), rejection: { reason: "Used on another order", at: new Date("2026-10-16T07:00:00Z") } }],
    });
    render(<OrdersBrowser orders={[{ order: rejected, feedback: null, returnInProgress: false }]} paymentDetails={details} />);
    expect(screen.getByTestId("payment-history").textContent).toContain("Not accepted · Used on another order");
    expect(screen.getByText(/Send it by Oct 17, 2026/)).toBeTruthy();
  });
});
