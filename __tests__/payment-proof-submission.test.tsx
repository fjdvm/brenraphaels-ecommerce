// @vitest-environment jsdom
import { PGlite } from "@electric-sql/pglite";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, products, sizes } from "../lib/db/schema";
import { createCartStore } from "../lib/orders/cart";
import { createOrderStore } from "../lib/orders/orders";
import { FakeShopStock } from "./helpers/fake-shop-stock";
import { createTestDatabase } from "./helpers/test-database";

const submit = vi.hoisted(() => vi.fn());
vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ submitPaymentProof: submit }));
vi.mock("../lib/orders/payment-details", async (original) => ({ ...(await original<typeof import("../lib/orders/payment-details")>()), paymentRecipient: async () => "09171234567" }));
vi.mock("@/lib/orders/screenshot-reading", async (original) => ({ ...(await original<typeof import("@/lib/orders/screenshot-reading")>()), readScreenshotText: async () => "" }));
vi.mock("next/server", () => ({ after: (work: () => Promise<void>) => work() }));

import { PaymentProofForm } from "@/components/features/orders/payment-proof-form";

const account = (o: object = {}) => ({ id: "a1", method: "gcash" as const, label: "Main", accountName: "Bren", accountNumber: "0917 000 0000", bankName: null, qrUrl: null, ...o });
const accounts = [account(), account({ id: "a2", label: "Backup", accountNumber: "0918 111 1111" })];
const renderForm = () => render(<PaymentProofForm accounts={accounts} showAccounts={false} amountInCentavos={125_000} deadline="Nov 20, 9:00 AM" orderId={8} />);
const shot = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "gcash-receipt.png", { type: "image/png" });

beforeEach(() => submit.mockReset().mockResolvedValue({}));
// jsdom does not count a picked file towards `required`; the browser does, and "required" is asserted on the input itself.
const browserAcceptsRequiredFile = () => {
  vi.spyOn(HTMLFormElement.prototype, "reportValidity").mockReturnValue(true);
  vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(function (this: HTMLFormElement) { fireEvent.submit(this); });
};
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("the proof form", () => {
  test("asks which account was paid and marks the reference and the screenshot required", () => {
    renderForm();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getAllByRole("radio").every((radio) => (radio as HTMLInputElement).required)).toBe(true);
    expect((screen.getByLabelText(/Add screenshot/) as HTMLInputElement).required).toBe(true);
    expect((screen.getByLabelText(/reference number/) as HTMLInputElement).required).toBe(true);
    expect(screen.queryByText(/optional/i)).toBeNull();
  });

  test("a missing QR never blocks choosing an account", () => {
    renderForm();
    fireEvent.click(screen.getAllByRole("radio")[0]);
    expect((screen.getAllByRole("radio")[0] as HTMLInputElement).checked).toBe(true);
  });

  test("Submit payment opens the confirm dialog first and sends nothing until the Customer confirms", async () => {
    browserAcceptsRequiredFile();
    renderForm();
    fireEvent.click(screen.getAllByRole("radio")[1]);
    fireEvent.change(screen.getByLabelText(/reference number/), { target: { value: "1012345678" } });
    await userEvent.upload(screen.getByLabelText(/Add screenshot/), shot());
    fireEvent.click(screen.getByRole("button", { name: "Submit payment" }));

    expect(await screen.findByText("Submit this payment?")).toBeTruthy();
    const summary = screen.getByTestId("submit-summary").textContent;
    expect(summary).toContain("Backup · 0918 111 1111");
    expect(summary).toContain("1012345678");
    expect(summary).toContain("gcash-receipt.png");
    expect(submit).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Submit payment" }).at(-1)!);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const data = submit.mock.calls[0][2] as FormData;
    expect(data.get("accountId")).toBe("a2");
    expect(data.get("gcashReferenceNumber")).toBe("1012345678");
    expect(data.get("submissionKey")).toMatch(/.{8,}/);
  });

  test("Go back leaves everything unsent", async () => {
    browserAcceptsRequiredFile();
    renderForm();
    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.change(screen.getByLabelText(/reference number/), { target: { value: "1012345678" } });
    await userEvent.upload(screen.getByLabelText(/Add screenshot/), shot());
    fireEvent.click(screen.getByRole("button", { name: "Submit payment" }));
    fireEvent.click(await screen.findByRole("button", { name: "Go back" }));
    expect(submit).not.toHaveBeenCalled();
  });

  test("the dialog is not opened while a required field is empty", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit payment" }));
    expect(screen.queryByText("Submit this payment?")).toBeNull();
  });

  test("shows the server's reason for a bad screenshot or account", async () => {
    browserAcceptsRequiredFile();
    submit.mockResolvedValue({ fieldErrors: { screenshot: ["That file isn't a real JPEG or PNG image."], accountId: ["Choose the account you paid."] } });
    renderForm();
    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.change(screen.getByLabelText(/reference number/), { target: { value: "1012345678" } });
    await userEvent.upload(screen.getByLabelText(/Add screenshot/), shot());
    fireEvent.click(screen.getByRole("button", { name: "Submit payment" }));
    fireEvent.click((await screen.findAllByRole("button", { name: "Submit payment" })).at(-1)!);
    expect(await screen.findByText("That file isn't a real JPEG or PNG image.")).toBeTruthy();
    expect(screen.getByText("Choose the account you paid.")).toBeTruthy();
  });
});

describe("saving the proof", () => {
  let client: PGlite;
  beforeEach(async () => {
    client = await createTestDatabase();
    const database = drizzle(client);
    await database.insert(customers).values({ id: "c1", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false });
    await database.insert(products).values({ slug: "ube-jam", name: "Ube Jam", description: "Ube jam." });
    await database.insert(sizes).values({ productSlug: "ube-jam", label: "250g", priceInCentavos: 21900, available: true });
  });
  afterEach(async () => { await client.close(); });

  async function confirmed() {
    const database = drizzle(client);
    const { rows } = await client.query<{ id: number }>("select id from sizes");
    await createCartStore(database).addSize("c1", rows[0].id, 1);
    const store = createOrderStore(database, undefined, new FakeShopStock());
    const order = await store.place("c1", { fulfillmentMethod: "pickup", paymentMethod: "gcash" });
    return { store, order };
  }
  const saved = { id: "a1", method: "gcash", bankName: null, label: "Main", accountName: "Bren", accountNumber: "0917 000 0000" };

  test("keeps the chosen account's details with the proof, and the Order shows Pending Verification", async () => {
    const { store, order } = await confirmed();
    const result = await store.submitPaymentProof("c1", order.id, { gcashReferenceNumber: "1234567890", screenshotFileId: "f1", account: saved, submissionKey: "k1" });
    expect(result.status).toBe("awaiting payment");
    const { rows } = await client.query("select account_id, account_method, account_bank_name, account_label, account_name, account_number, screenshot_file_id from order_payment_proofs");
    expect(rows).toEqual([{ account_id: "a1", account_method: "gcash", account_bank_name: null, account_label: "Main", account_name: "Bren", account_number: "0917 000 0000", screenshot_file_id: "f1" }]);
  });

  test("a retried submit with the same key makes no second proof", async () => {
    const { store, order } = await confirmed();
    const input = { gcashReferenceNumber: "1234567890", screenshotFileId: "f1", account: saved, submissionKey: "k1" };
    await store.submitPaymentProof("c1", order.id, input);
    await expect(store.submitPaymentProof("c1", order.id, input)).resolves.toMatchObject({ status: "awaiting payment" });
    const { rows } = await client.query("select id from order_payment_proofs");
    expect(rows).toHaveLength(1);
  });

  test("a proof submitted before this change, with no account or image, is still valid", async () => {
    const { store, order } = await confirmed();
    await expect(store.submitPaymentProof("c1", order.id, { gcashReferenceNumber: "1234567890" })).resolves.toMatchObject({ status: "awaiting payment" });
    await expect(store.advance(order.id, { status: "paid", staffId: "s1", staffName: "Ana" })).resolves.toMatchObject({ status: "paid" });
  });
});
