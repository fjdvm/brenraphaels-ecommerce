// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestHeaders: new Headers(),
  idNumberInUse: vi.fn(async (..._args: unknown[]) => false),
  visitor: vi.fn(async () => ({ state: "signed-out" }) as unknown),
  showErrorToast: vi.fn(),
  sendSeniorPwdId: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => mocks.requestHeaders }));
vi.mock("@/lib/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/senior-pwd/store", () => ({ idNumberInUse: mocks.idNumberInUse }));
vi.mock("@/lib/customer/current-visitor", () => ({ currentVisitor: mocks.visitor }));
vi.mock("@/components/shared/storefront-toast", () => ({ showErrorToast: mocks.showErrorToast }));
vi.mock("@/app/(site)/(protected)/profile/senior-pwd-actions", () => ({ sendSeniorPwdId: mocks.sendSeniorPwdId }));

import { checkSeniorPwdIdNumber } from "@/lib/senior-pwd/check-id-action";
import { SeniorPwdIdForm } from "@/components/features/customer/senior-pwd-id-form";

let address = 0;
beforeEach(() => {
  mocks.requestHeaders.set("x-forwarded-for", `198.51.100.${++address}`);
  mocks.idNumberInUse.mockReset().mockResolvedValue(false);
  mocks.visitor.mockReset().mockResolvedValue({ state: "signed-out" });
  mocks.showErrorToast.mockReset();
});
afterEach(cleanup);

describe("checking an ID number before it is sent", () => {
  test("refuses a number used by another account with the toast wording", async () => {
    mocks.idNumberInUse.mockResolvedValueOnce(true);
    expect(await checkSeniorPwdIdNumber("ANT-SC-0458721")).toEqual({
      ok: false, field: "idNumber", message: "This ID is already used by another account.",
    });
  });

  test("lets a free number through and never counts the signed-in Customer's own ID", async () => {
    mocks.visitor.mockResolvedValueOnce({ state: "customer", customer: { userId: "c1" } });
    expect(await checkSeniorPwdIdNumber("ANT-SC-0458721")).toEqual({ ok: true });
    expect(mocks.idNumberInUse).toHaveBeenCalledWith({}, "ANT-SC-0458721", "c1");
  });

  test("checks the number's shape before asking the database", async () => {
    expect(await checkSeniorPwdIdNumber("#")).toMatchObject({ ok: false, field: "idNumber" });
    expect(mocks.idNumberInUse).not.toHaveBeenCalled();
  });

  test("is rate-limited per address so numbers cannot be tested in bulk", async () => {
    for (let i = 0; i < 5; i++) expect(await checkSeniorPwdIdNumber("ANT-SC-0458721")).toEqual({ ok: true });
    expect(await checkSeniorPwdIdNumber("ANT-SC-0458721")).toEqual({ ok: false, message: "Too many attempts. Please try again in 10 minutes." });
  });

  test("a failed check never stops the Customer; the number is checked again when sent", async () => {
    mocks.idNumberInUse.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await checkSeniorPwdIdNumber("ANT-SC-0458721")).toEqual({ ok: true });
  });
});

describe("Account settings ID form", () => {
  test("shows the in-use refusal as a toast and beside the number", async () => {
    mocks.sendSeniorPwdId.mockResolvedValue({
      fieldErrors: { idNumber: ["This ID is already used by another account."] },
      toastError: "This ID is already used by another account.", attempt: 1,
    });
    render(<SeniorPwdIdForm />);
    fireEvent.submit(screen.getByRole("button", { name: "Send my ID" }).closest("form")!);
    await waitFor(() => expect(mocks.showErrorToast).toHaveBeenCalledWith("This ID is already used by another account."));
    expect(screen.getByRole("alert").textContent).toContain("already used by another account");
  });
});
