import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), list: vi.fn(), customer: vi.fn() }));
vi.mock("@/lib/customer/current-visitor", () => ({ requireCustomer: mocks.customer }));
vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@/lib/orders/orders", () => ({ createOrderStore: () => ({ submitPaymentProof: mocks.submit, listForCustomer: mocks.list }) }));
vi.mock("@/lib/orders/payment-details", () => ({ paymentDetails: async () => [{ method: "maya", lines: [{ label: "Maya number", value: "09171234567" }] }] }));
vi.mock("@/lib/orders/staff-signal", () => ({ scheduleOrdersChanged: vi.fn(), scheduleStaffSignal: vi.fn() }));
vi.mock("@/lib/notifications/staff-signal", () => ({ scheduleStaffSignal: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { submitPaymentProof } from "@/app/(site)/(protected)/profile/orders/actions";

beforeEach(() => {
  vi.clearAllMocks(); mocks.customer.mockResolvedValue({ userId: "c1" });
  mocks.list.mockResolvedValue([{ id: 7, paymentMethod: "maya" }]); mocks.submit.mockResolvedValue({});
});
const fields = () => {
  const form = new FormData();
  form.set("gcashReferenceNumber", "1234567890"); form.set("confirmedAmount", "120.05");
  form.set("confirmedPaidAt", "2026-01-02T10:30"); form.set("confirmedRecipient", "0917 123 4567");
  form.set("expectedRecipient", "attacker-controlled"); return form;
};
test("submits exactly the Customer's confirmed values with the shop account from server settings", async () => {
  expect(await submitPaymentProof(7, {}, fields())).toMatchObject({ message: expect.stringContaining("submitted") });
  expect(mocks.submit).toHaveBeenCalledWith("c1", 7, expect.objectContaining({
    gcashReferenceNumber: "1234567890", confirmedAmountInCentavos: 12005,
    confirmedPaidAt: new Date("2026-01-02T02:30:00Z"), confirmedRecipient: "0917 123 4567", expectedRecipient: "09171234567",
  }));
});
test("rejects invalid amounts and dates before submitting a proof", async () => {
  const form = fields(); form.set("confirmedAmount", "120.555"); form.set("confirmedPaidAt", "bad date");
  expect(await submitPaymentProof(7, {}, form)).toMatchObject({ fieldErrors: { confirmedAmount: expect.any(Array), confirmedPaidAt: expect.any(Array) } });
  expect(mocks.submit).not.toHaveBeenCalled();
});
test("does not submit another Customer's Order", async () => {
  mocks.list.mockResolvedValue([]);
  expect(await submitPaymentProof(8, {}, fields())).toEqual({ message: "Order was not found." });
  expect(mocks.submit).not.toHaveBeenCalled();
});
