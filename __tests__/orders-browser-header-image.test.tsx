// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ submitOrderFeedback: vi.fn() }));
vi.mock("next/image", () => ({ default: ({ src }: { src: string }) => <img alt="" data-testid="thumb" src={src} /> }));

import { OrdersBrowser } from "@/components/features/orders/orders-browser";
import type { Order } from "@/lib/orders/orders";

afterEach(cleanup);

const order = {
  id: 35, fulfillmentMethod: "pickup", paymentMethod: "gcash", status: "dispatched", subtotalInCentavos: 518_700, deliveryFeeInCentavos: null,
  createdAt: new Date("2026-11-16T05:50:00Z"),
  lines: [{ productName: "Ube Halaya Smooth", imageUrl: "/smooth.jpg", sizeLabel: "500g", priceInCentavos: 39_900, quantity: 10 }],
  deliveryAddress: null, paymentProof: null, paidById: null, paidByName: null, paidAt: null, deliveryPhotoRemovedAt: null, deliveryPhotoFileId: null, courier: null,
} as unknown as Order;

/** The header is the card's first block: image, title, status chip, then the chevron. */
const headerImages = () => document.querySelectorAll("article > div:first-child [data-testid=thumb]").length;

describe("My orders card header image", () => {
  test("stays at the left of the header when the card is collapsed and when it is expanded", () => {
    render(<OrdersBrowser orders={[{ order, feedback: null, returnInProgress: false }]} />);
    expect(screen.getByRole("button", { name: "Hide details for Order #35" })).toBeTruthy();
    expect(headerImages()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Hide details for Order #35" }));
    expect(screen.getByRole("button", { name: "Show details for Order #35" })).toBeTruthy();
    expect(headerImages()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Show details for Order #35" }));
    expect(headerImages()).toBe(1);
  });
});
