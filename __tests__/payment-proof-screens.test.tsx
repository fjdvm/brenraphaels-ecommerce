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

  test("a rejected proof says why and offers Upload again", () => {
    const rejected = order({
      status: "awaiting payment",
      paymentProof: { gcashReferenceNumber: "111111", screenshotPathname: null, screenshotFileId: null, submittedAt: new Date() },
      paymentProofRejection: { reason: "The amount does not match", at: new Date() },
      paymentProofRejections: 1,
    });
    expect(needsNewProof(rejected)).toBe(true);
    open(rejected);
    expect(screen.getByText(/Reason: The amount does not match/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload again" })).toBeTruthy();
  });

  test("a bank transfer Order with no details yet tells the Customer to ask", () => {
    open(order({ paymentMethod: "bank-transfer" }));
    expect(screen.getByText(/Message us for the Bank transfer details/)).toBeTruthy();
  });

  test("Cash on Delivery needs no payment proof", () => {
    expect(needsPayment(order({ paymentMethod: "cash-on-delivery" }))).toBe(false);
  });
});
