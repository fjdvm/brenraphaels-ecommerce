import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), customer: vi.fn(), account: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/orders/payment-accounts", () => ({ loadPaymentAccountSnapshot: mocks.account }));
vi.mock("@/lib/support/ticket-files", () => ({ gatewayTicketFiles: () => ({ upload: mocks.upload }) }));
vi.mock("@/lib/customer/current-visitor", () => ({ requireCustomer: mocks.customer }));
vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@/lib/orders/orders", () => ({ createOrderStore: () => ({ submitPaymentProof: mocks.submit }) }));
vi.mock("@/lib/orders/staff-signal", () => ({ scheduleOrdersChanged: vi.fn(), scheduleStaffSignal: vi.fn() }));
vi.mock("@/lib/notifications/staff-signal", () => ({ scheduleStaffSignal: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { submitPaymentProof } from "@/app/(site)/(protected)/profile/orders/actions";

beforeEach(() => {
  vi.clearAllMocks(); mocks.customer.mockResolvedValue({ userId: "c1" });
  mocks.submit.mockResolvedValue({});
  mocks.account.mockResolvedValue(snapshot); mocks.upload.mockResolvedValue("file-1");
});
const snapshot = { id: "11111111-1111-1111-1111-111111111111", method: "gcash", bankName: null, label: "Main", accountName: "Bren", accountNumber: "0917 000 0000" };
const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], "receipt.png", { type: "image/png" });
const fields = () => {
  const form = new FormData();
  form.set("gcashReferenceNumber", "1234567890"); form.set("confirmedAmount", "120.05");
  form.set("confirmedPaidAt", "2026-01-02T10:30"); form.set("confirmedRecipient", "0917 123 4567");
  form.set("expectedRecipient", "attacker-controlled");
  form.set("accountId", snapshot.id); form.set("screenshot", png()); form.set("submissionKey", "key-1"); return form;
};
test("submits exactly the Customer's confirmed values", async () => {
  expect(await submitPaymentProof(7, {}, fields())).toMatchObject({ message: expect.stringContaining("submitted") });
  expect(mocks.submit).toHaveBeenCalledWith("c1", 7, expect.objectContaining({
    gcashReferenceNumber: "1234567890", confirmedAmountInCentavos: 12005,
    confirmedPaidAt: new Date("2026-01-02T02:30:00Z"), confirmedRecipient: "0917 123 4567",
  }));
});
test("rejects invalid amounts and dates before submitting a proof", async () => {
  const form = fields(); form.set("confirmedAmount", "120.555"); form.set("confirmedPaidAt", "bad date");
  expect(await submitPaymentProof(7, {}, form)).toMatchObject({ fieldErrors: { confirmedAmount: expect.any(Array), confirmedPaidAt: expect.any(Array) } });
  expect(mocks.submit).not.toHaveBeenCalled();
});
test("rejects an impossible calendar date instead of normalizing it", async () => {
  const form = fields(); form.set("confirmedPaidAt", "2026-02-30T12:00");
  expect(await submitPaymentProof(7, {}, form)).toMatchObject({ fieldErrors: { confirmedPaidAt: expect.any(Array) } });
  expect(mocks.submit).not.toHaveBeenCalled();
});

test("saves the chosen account's details, the screenshot and the submission key with the proof", async () => {
  await submitPaymentProof(7, {}, fields());
  expect(mocks.submit).toHaveBeenCalledWith("c1", 7, expect.objectContaining({ account: snapshot, screenshotFileId: "file-1", submissionKey: "key-1" }));
});
test("refuses a submit with no screenshot, naming the field and saving nothing", async () => {
  const form = fields(); form.delete("screenshot");
  expect(await submitPaymentProof(7, {}, form)).toMatchObject({ fieldErrors: { screenshot: [expect.stringContaining("screenshot")] } });
  expect(mocks.submit).not.toHaveBeenCalled();
});
test("refuses a file whose content is not a JPEG or PNG, even with an image name and type", async () => {
  const form = fields(); form.set("screenshot", new File(["<html>not an image</html>"], "receipt.png", { type: "image/png" }));
  mocks.upload.mockImplementation(async () => "file-x");
  expect(await submitPaymentProof(7, {}, form)).toMatchObject({ fieldErrors: { screenshot: [expect.stringContaining("real JPEG or PNG")] } });
  expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.submit).not.toHaveBeenCalled();
});
test("refuses a missing or unknown account", async () => {
  mocks.account.mockResolvedValue(undefined);
  expect(await submitPaymentProof(7, {}, fields())).toMatchObject({ fieldErrors: { accountId: [expect.stringContaining("Choose the account")] } });
  const form = fields(); form.delete("accountId");
  expect(await submitPaymentProof(7, {}, form)).toMatchObject({ fieldErrors: { accountId: expect.any(Array) } });
  expect(mocks.submit).not.toHaveBeenCalled();
});
test("an account deactivated since the transfer is still accepted, for Staff review", async () => {
  // loadPaymentAccountSnapshot answers for inactive accounts too; the action never checks `active`.
  expect(await submitPaymentProof(7, {}, fields())).toMatchObject({ submitted: true });
});
