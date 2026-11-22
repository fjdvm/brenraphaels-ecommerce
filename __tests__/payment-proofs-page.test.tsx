// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/orders/screenshot-reading", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/screenshot-reading")>()),
  readScreenshotText: vi.fn(),
}));

import { PaymentProofCards } from "@/components/features/orders/payment-proof-cards";
import Loading from "@/app/(site)/(protected)/profile/orders/[id]/payment-proofs/loading";
import type { CustomerPaymentProof } from "@/lib/orders/orders";
import { readScreenshotText } from "@/lib/orders/screenshot-reading";

afterEach(cleanup);

const order = { totalInCentavos: 6_500, placedAt: new Date("2026-11-22T06:00:00Z") };

const proof = (overrides: Partial<CustomerPaymentProof>): CustomerPaymentProof => ({
  id: 1, reference: "123456789012", submittedAt: new Date("2026-11-22T06:44:00Z"),
  confirmedAmountInCentavos: 6_500, confirmedPaidAt: new Date("2026-11-22T06:40:00Z"),
  confirmedRecipient: "Bren Raphael", expectedRecipient: "bren  raphael",
  account: { method: "gcash", bankName: null, label: "Main GCash", name: "Bren Raphael", numberEnding: "0000" },
  hasScreenshot: true, rejection: null, ...overrides,
});

function show(proofs: CustomerPaymentProof[], awaitingCheck = false) {
  render(<PaymentProofCards awaitingCheck={awaitingCheck} order={order} orderId={37} proofs={proofs} />);
}

describe("payment proofs page", () => {
  test("shows a card per proof with its image, status, the Staff's reason and a masked account", () => {
    show([
      proof({ id: 1, rejection: { reason: "Reference also used on Order #37.", at: new Date("2026-11-22T07:00:00Z") } }),
      proof({ id: 2, rejection: { reason: "ulit", at: new Date("2026-11-22T07:05:00Z") } }),
    ]);
    const cards = screen.getAllByTestId("payment-proof-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("Not accepted");
    expect(cards[0].textContent).toContain("Reference also used on Order #37.");
    expect(cards[1].textContent).toContain("ulit");
    expect(cards[0].textContent).toContain("••••0000");
    expect(cards[0].querySelector("img")?.getAttribute("src")).toBe("/api/orders/37/payment-proofs/1");
    expect(cards[1].querySelector("img")?.getAttribute("src")).toBe("/api/orders/37/payment-proofs/2");
  });

  test("the latest proof of an Order awaiting payment is Being checked", () => {
    show([proof({ id: 1 })], true);
    expect(screen.getByText("Being checked")).toBeTruthy();
  });

  test("checks pass for a matching amount, time and recipient, and fail for a wrong amount", () => {
    show([proof({ id: 1 }), proof({ id: 2, confirmedAmountInCentavos: 5_000 })]);
    const [good, bad] = screen.getAllByTestId("payment-proof-card");
    expect(good.textContent).toContain("Matches your order total");
    expect(good.textContent).toContain("Sent to the shop's account name");
    expect(bad.textContent).toContain("Doesn't match your order total");
  });

  test("Read screenshot shows what the screenshot says and flags a mismatch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["x"]), { status: 200 })));
    vi.mocked(readScreenshotText).mockResolvedValue("Ref No. 9999 9999 9999\nPHP 65.00\nNov 22, 2026 2:40 PM");
    show([proof({ id: 1 })]);
    fireEvent.click(screen.getByRole("button", { name: "Read screenshot" }));
    await waitFor(() => expect(screen.getByLabelText("What the screenshot says")).toBeTruthy());
    const list = screen.getByLabelText("What the screenshot says").textContent ?? "";
    expect(list).toContain("differs from what you entered");
    expect(list).toContain("Amount ₱65 matches what you entered");
    vi.unstubAllGlobals();
  });

  test("a screenshot that cannot be read says so and keeps the card", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    show([proof({ id: 1 })]);
    fireEvent.click(screen.getByRole("button", { name: "Read screenshot" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("couldn't read"));
    expect(screen.getByRole("button", { name: "Read again" })).toBeTruthy();
    vi.unstubAllGlobals();
  });

  test("the page shows its skeleton at once", () => {
    render(<Loading />);
    expect(screen.getByText("Payment proofs")).toBeTruthy();
  });
});
