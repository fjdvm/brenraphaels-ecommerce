// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ submitPaymentProof: vi.fn() }));
const reader = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/orders/screenshot-reading", async (original) => ({ ...(await original<typeof import("@/lib/orders/screenshot-reading")>()), readScreenshotText: reader.read }));

import { PaymentProofForm } from "@/components/features/orders/payment-proof-form";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const placedAt = new Date("2026-10-16T06:00:00Z");
const pick = () => fireEvent.change(screen.getByLabelText(/Add screenshot/), { target: { files: [new File(["x"], "gcash.jpg", { type: "image/jpeg" })] } });
const accounts = [{ id: "a1", method: "gcash" as const, label: "Main", accountName: "Bren", accountNumber: "0917 000 0000", bankName: null, qrUrl: null }];
const renderForm = () => render(<PaymentProofForm accounts={accounts} showAccounts={false} amountInCentavos={20900} orderId={7} placedAt={placedAt} />);
const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

test("picking a screenshot pre-fills the fields with checks and 'Read from your screenshot'", async () => {
  reader.read.mockResolvedValue("Total Amount Sent ₱209.00\nRef No. 5012 334 812\nOct 16, 2026 2:30 PM");
  renderForm(); pick();
  await waitFor(() => expect(field(/reference number/).value).toBe("5012334812"));
  expect(field(/Amount paid/).value).toBe("209.00");
  expect(field(/Payment date/).value).toBe("2026-10-16T14:30");
  expect(screen.getByTestId("read-note-amount").textContent).toBe("Read from your screenshot · Matches your order total");
  expect(screen.getByTestId("read-note-paidAt").textContent).toContain("After you placed the order");
});

test("typing over a read value is kept and drops its label", async () => {
  reader.read.mockResolvedValue("Amount 209.00\nRef No. 5012334812");
  renderForm(); pick();
  await waitFor(() => expect(field(/Amount paid/).value).toBe("209.00"));
  fireEvent.change(field(/Amount paid/), { target: { value: "250.00" } });
  expect(field(/Amount paid/).value).toBe("250.00");
  expect(screen.queryByTestId("read-note-amount")).toBeNull();
  expect(screen.getByTestId("read-note-reference")).toBeTruthy();
});

test("a failed reading leaves the form working by hand", async () => {
  reader.read.mockRejectedValue(new Error("wasm failed"));
  renderForm(); pick();
  expect(await screen.findByText(/couldn't read this screenshot/)).toBeTruthy();
  fireEvent.change(field(/reference number/), { target: { value: "123456" } });
  expect(field(/reference number/).value).toBe("123456");
  expect((screen.getByRole("button", { name: "Submit payment" }) as HTMLButtonElement).disabled).toBe(false);
});

test("the confirmed values are what the form submits", async () => {
  reader.read.mockResolvedValue("Amount 209.00\nRef No. 5012334812\nOct 16, 2026 2:30 PM");
  const { container } = renderForm(); pick();
  await waitFor(() => expect(field(/reference number/).value).toBe("5012334812"));
  fireEvent.change(field(/Amount paid/), { target: { value: "209.50" } });
  const data = new FormData(container.querySelector("form")!);
  expect(data.get("gcashReferenceNumber")).toBe("5012334812");
  expect(data.get("confirmedAmount")).toBe("209.50");
  expect(data.get("confirmedPaidAt")).toBe("2026-10-16T14:30");
});
