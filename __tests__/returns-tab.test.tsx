// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ submitOrderFeedback: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { OrdersBrowser } from "@/components/features/orders/orders-browser";
import type { Order } from "@/lib/orders/orders";
import type { CustomerReturn } from "@/lib/returns/customer-reads";

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
  deliveryPhotoRemovedAt: null, deliveryPhotoFileId: null, courier: null,
});

const aReturn = (id: number, orderId: number, overrides: Partial<CustomerReturn> = {}): CustomerReturn => ({
  id,
  number: `RMA-${id}`,
  orderId,
  status: "requested",
  reason: "damaged",
  note: "",
  amountInCentavos: 20_900,
  preferredResolution: "refund",
  finalResolution: null,
  goodsRequired: null,
  declineReason: null,
  photoFileIds: [],
  videoFileId: null,
  refundProofFileId: null, refund: null,
  items: [{ productName: "Ube Halaya", sizeLabel: "250g", quantity: 2, priceInCentavos: 10_450 }],
  requestedAt: new Date("2026-10-11T06:00:00Z"),
  refundedAt: null,
  replacedAt: null,
  ...overrides,
} as CustomerReturn);

const orders = [2, 1].map((id) => ({ order: order(id), feedback: null, returnInProgress: false }));
const openReturnsTab = () => fireEvent.click(screen.getByRole("button", { name: /^Returns/ }));

describe("Returns tab", () => {
  test("sits after Cancelled and counts Returns the Customer did not cancel", () => {
    const returns = [aReturn(3, 2), aReturn(2, 1, { status: "cancelled" }), aReturn(1, 1, { status: "declined" })];
    render(<OrdersBrowser orders={orders} returns={returns} />);

    const labels = screen.getAllByRole("button", { pressed: false }).map((button) => button.textContent);
    expect(labels.findIndex((label) => label?.startsWith("Returns"))).toBe(labels.findIndex((label) => label?.startsWith("Cancelled")) + 1);
    expect(screen.getByRole("button", { name: /^Returns\s*2$/ })).toBeTruthy();
  });

  test("lists Return cards with number, Order, items and both Resolutions", () => {
    render(<OrdersBrowser orders={orders} returns={[aReturn(3, 2, { status: "approved", finalResolution: "replacement" })]} />);
    openReturnsTab();

    const card = screen.getByRole("article", { name: /RMA-3/ });
    expect(within(card).getByText("Order #2")).toBeTruthy();
    expect(within(card).getByText(/Ube Halaya/)).toBeTruthy();
    expect(within(card).getByText("Approved")).toBeTruthy();
    expect(within(card).getByText(/Preferred.*Refund/)).toBeTruthy();
    expect(within(card).getByText(/Final.*Replacement/)).toBeTruthy();
  });

  test("lists newest first as given and shows the decline reason on a Declined Return", () => {
    const returns = [aReturn(2, 2, { status: "declined", declineReason: "Photos show normal wear." }), aReturn(1, 1)];
    render(<OrdersBrowser orders={orders} returns={returns} />);
    openReturnsTab();

    expect(screen.getAllByRole("article").map((card) => card.getAttribute("aria-label"))).toEqual([
      expect.stringContaining("RMA-2"), expect.stringContaining("RMA-1"),
    ]);
    expect(screen.getByText("Photos show normal wear.")).toBeTruthy();
  });

  test("links the refund proof on a Refunded Return", () => {
    render(<OrdersBrowser orders={orders} returns={[aReturn(4, 1, { status: "refunded", finalResolution: "refund", refundProofFileId: "file-1" })]} />);
    openReturnsTab();

    expect(screen.getByRole("link", { name: "View refund proof" }).getAttribute("href")).toBe("/api/returns/4/refund-proof");
  });

  test("shows the refund's Delivery fee, amount, method, date and reference beside the proof link", () => {
    const refund = { amountInCentavos: 25_900, deliveryFeeInCentavos: 5_000, method: "gcash" as const, paidOn: "2026-11-18", reference: "GC-2026-0001" };
    render(<OrdersBrowser orders={orders} returns={[aReturn(4, 1, { status: "refunded", finalResolution: "refund", refundProofFileId: "file-1", refund })]} />);
    openReturnsTab();

    const record = within(screen.getByTestId("refund-record-4"));
    expect(record.getByText("Delivery fee").nextSibling?.textContent).toBe("₱50");
    expect(record.getByText("Refund amount").nextSibling?.textContent).toBe("₱259");
    expect(record.getByText("GCash")).toBeTruthy();
    expect(record.getByText("Nov 18, 2026")).toBeTruthy();
    expect(record.getByText("GC-2026-0001")).toBeTruthy();
  });

  test("shows no refund record before the Return is Refunded", () => {
    render(<OrdersBrowser orders={orders} returns={[aReturn(4, 1, { status: "approved", finalResolution: "refund" })]} />);
    openReturnsTab();

    expect(screen.queryByTestId("refund-record-4")).toBeNull();
  });

  test("shows the Customer their own Refund destination in full", () => {
    render(<OrdersBrowser orders={orders} returns={[aReturn(4, 1, { refundDestination: { method: "bank-transfer", accountName: "Maria Santos",
      accountNumber: "1234567890", bankName: "BDO" } })]} />);
    openReturnsTab();

    expect(screen.getByTestId("refund-destination-4").textContent).toBe("Refund to: Bank transfer · BDO · Maria Santos · 1234567890");
  });

  test("dims a Cancelled Return", () => {
    render(<OrdersBrowser orders={orders} returns={[aReturn(5, 1, { status: "cancelled" })]} />);
    openReturnsTab();

    const card = screen.getByRole("article", { name: /RMA-5/ });
    expect(card.className).toContain("opacity-");
    expect(within(card).getByText("Cancelled")).toBeTruthy();
  });

  test("explains how to request a Return and links the policy when empty", () => {
    render(<OrdersBrowser orders={orders} returns={[]} />);
    openReturnsTab();

    expect(screen.getByText(/within 24 hours of delivery/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Return & Refund Policy/ }).getAttribute("href")).toBe("/returns");
  });
});

describe("Order Return badge", () => {
  test("links an Order card to its Return and opens the Returns tab", () => {
    render(<OrdersBrowser orders={orders} returns={[aReturn(3, 2)]} />);

    const badge = screen.getByRole("link", { name: /RMA-3/ });
    expect(badge.getAttribute("href")).toBe("#return-3");
    fireEvent.click(badge);

    expect(screen.getByRole("article", { name: /RMA-3/ })).toBeTruthy();
  });

  test("shows no badge on an Order without a Return", () => {
    render(<OrdersBrowser orders={orders} returns={[aReturn(3, 2)]} />);

    expect(screen.getAllByRole("link", { name: /RMA-/ })).toHaveLength(1);
  });
});
