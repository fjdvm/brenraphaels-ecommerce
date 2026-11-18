// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ cancelOrder: vi.fn(), markOrderReceived: vi.fn(), submitOrderFeedback: vi.fn(), submitPaymentProof: vi.fn() }));

import { PaymentAccountsCard } from "@/components/features/orders/payment-accounts-card";
import { OrderPlacedView } from "@/components/features/orders/order-placed";
import { loadPaymentAccounts, loadPaymentAccountSnapshot, signedQrUrl } from "@/lib/orders/payment-accounts";
import { paymentOffer, type PaymentAccountOption } from "@/lib/orders/payment-offer";
import type { Order } from "@/lib/orders/orders";

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const account = (o: Partial<PaymentAccountOption>): PaymentAccountOption => ({ id: "a", method: "gcash", label: "Main", accountName: "Bren", accountNumber: "0917 000 0000", bankName: null, qrUrl: null, ...o });
const order = (o: Partial<Order>): Order => ({
  id: 9, fulfillmentMethod: "pickup", paymentMethod: "gcash", status: "confirmed", subtotalInCentavos: 50_000, deliveryFeeInCentavos: null,
  createdAt: new Date("2026-10-10T06:00:00Z"), confirmedAt: new Date("2026-10-10T07:00:00Z"), paymentDeadlineAt: new Date("2026-10-11T07:00:00Z"),
  lines: [], deliveryAddress: null, paymentProof: null, paidById: null, paidByName: null, paidAt: null, deliveryPhotoRemovedAt: null, deliveryPhotoFileId: null, courier: null, ...o,
} as Order);

describe("paymentOffer", () => {
  test("offers the accounts of the Order's own method", () => {
    const offer = paymentOffer("gcash", [account({ id: "g" }), account({ id: "m", method: "maya" })]);
    expect(offer).toMatchObject({ kind: "accounts", switched: false });
    expect(offer.kind === "accounts" && offer.accounts.map((a) => a.id)).toEqual(["g"]);
  });
  test("offers another enabled method when the Order's own is off", () => {
    const offer = paymentOffer("gcash", [account({ id: "m", method: "maya" })]);
    expect(offer).toMatchObject({ kind: "accounts", switched: true });
  });
  test("offers nothing, not Cash on Delivery, when no online account is left", () => {
    expect(paymentOffer("gcash", [])).toEqual({ kind: "none" });
  });
});

describe("Payment accounts card", () => {
  test("shows the amount, the deadline, each account's number and its QR", () => {
    render(<PaymentAccountsCard accounts={[account({ qrUrl: "https://files.example/qr" })]} amountInCentavos={55_000} deadline="Oct 11, 2026 · 3:00 PM" method="gcash" />);
    expect(screen.getByText(/Send ₱\s?550 by Oct 11, 2026/)).toBeTruthy();
    expect(screen.getByText("0917 000 0000")).toBeTruthy();
    expect(screen.getByAltText("QR for Main").getAttribute("src")).toBe("https://files.example/qr");
  });
  test("a missing QR never hides the account", () => {
    render(<PaymentAccountsCard accounts={[account({})]} amountInCentavos={1} deadline="x" method="gcash" />);
    expect(screen.getByText("0917 000 0000")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
  test("a switched-off method says so and keeps the deadline and total", () => {
    render(<PaymentAccountsCard accounts={[account({ method: "maya", label: "Shop Maya" })]} amountInCentavos={55_000} deadline="Oct 11" method="gcash" />);
    expect(screen.getByTestId("method-switched").textContent).toMatch(/GCash is no longer available/);
    expect(screen.getByText(/Send ₱\s?550 by Oct 11/)).toBeTruthy();
  });
  test("with no online method it shows a notice and the shop contact", () => {
    render(<PaymentAccountsCard accounts={[]} amountInCentavos={1} deadline="x" method="gcash" />);
    expect(screen.getByTestId("no-online-method").textContent).toMatch(/hello@brenraphaels\.com/);
  });
});

describe("Order page", () => {
  test("a confirmed Order shows the accounts; a Pending Confirmation Order shows none", () => {
    const { unmount } = render(<OrderPlacedView accounts={[account({})]} order={order({})} />);
    expect(screen.getByTestId("payment-accounts")).toBeTruthy();
    unmount();
    render(<OrderPlacedView accounts={[account({})]} order={order({ status: "placed" })} />);
    expect(screen.queryByTestId("payment-accounts")).toBeNull();
    expect(screen.queryByText("0917 000 0000")).toBeNull();
  });
});

describe("loadPaymentAccounts", () => {
  const reader = (rows: object[]) => ({ execute: async () => rows });
  const row = (o: object) => ({ id: "1", method: "gcash", label: "Main", account_name: "Bren", account_number: "0917", bank_name: null, qr_file_id: null, ...o });

  test("maps the rows and signs only the QRs that exist", async () => {
    const sign = vi.fn(async (id: string) => `https://files.example/${id}`);
    const accounts = await loadPaymentAccounts(reader([row({ qr_file_id: "f1" }), row({ id: "2", method: "bank_transfer", bank_name: "BDO" })]), sign);
    expect(accounts.map((a) => [a.method, a.qrUrl])).toEqual([["gcash", "https://files.example/f1"], ["bank-transfer", null]]);
    expect(sign).toHaveBeenCalledTimes(1);
  });
  test("a failing QR link leaves the account in place", async () => {
    const accounts = await loadPaymentAccounts(reader([row({ qr_file_id: "f1" })]), async () => { throw new Error("down"); });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].qrUrl).toBeNull();
  });
  test("an unreadable database gives no accounts", async () => {
    expect(await loadPaymentAccounts({ execute: async () => { throw new Error("down"); } })).toEqual([]);
  });
  test("signedQrUrl accepts only an https address for the same file", async () => {
    vi.stubEnv("API_GATEWAY_URL", "https://gw.example"); vi.stubEnv("API_GATEWAY_CALLER_KEY", "k");
    const ok = (body: object) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
    expect(await signedQrUrl("f1", ok({ id: "f1", url: "https://s.example/f1?sig=1" }))).toBe("https://s.example/f1?sig=1");
    expect(await signedQrUrl("f1", ok({ id: "f1", url: "http://s.example/f1" }))).toBeNull();
    expect(await signedQrUrl("f1", ok({ id: "other", url: "https://s.example/x" }))).toBeNull();
  });
});

describe("loadPaymentAccountSnapshot", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const row = { id, method: "bank_transfer", label: "BDO", account_name: "Bren", account_number: "0012", bank_name: "BDO", qr_file_id: null };

  test("finds an account whether or not it is still active, with its details copied whole", async () => {
    const snapshot = await loadPaymentAccountSnapshot(id, { execute: async () => [row] });
    expect(snapshot).toEqual({ id, method: "bank-transfer", label: "BDO", accountName: "Bren", accountNumber: "0012", bankName: "BDO" });
  });
  test("does not filter on active, so a transfer made before deactivation is accepted", async () => {
    let text = "";
    await loadPaymentAccountSnapshot(id, { execute: async (query) => { text = JSON.stringify(query); return [row]; } });
    expect(text).not.toMatch(/active/);
  });
  test("refuses an unknown id, a malformed id and an unreadable database", async () => {
    expect(await loadPaymentAccountSnapshot(id, { execute: async () => [] })).toBeUndefined();
    expect(await loadPaymentAccountSnapshot("1; drop table x", { execute: async () => [row] })).toBeUndefined();
    expect(await loadPaymentAccountSnapshot(id, { execute: async () => { throw new Error("down"); } })).toBeUndefined();
  });
});
