// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

const { saveOfferDetailsAction } = vi.hoisted(() => ({ saveOfferDetailsAction: vi.fn() }));
vi.mock("@/app/(careers)/careers/(portal)/applications/actions", () => ({ saveOfferDetailsAction }));

import { OfferDetailsForm } from "../app/(careers)/careers/_components/offer-details-form";
import { emptyOfferDetails } from "../lib/careers/offer-details";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Your details form", () => {
  test("says it is optional and shows saved answers on return", () => {
    render(<OfferDetailsForm referenceNumber="REF-1" initial={{ ...emptyOfferDetails, sex: "Female", sss: "3412345678", emergencyName: "Maria Santos" }} />);
    expect(screen.getByText(/Optional, and you can still be hired without them/)).toBeTruthy();
    expect((screen.getByLabelText("Sex") as HTMLSelectElement).value).toBe("Female");
    expect((screen.getByLabelText("SSS number") as HTMLInputElement).value).toBe("3412345678");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Maria Santos");
  });

  test("submits what was typed, with the reference number, through the save action", async () => {
    saveOfferDetailsAction.mockResolvedValue({ ok: true });
    render(<OfferDetailsForm referenceNumber="REF-1" initial={emptyOfferDetails} />);
    await userEvent.type(screen.getByLabelText("PhilHealth number"), "123456789012");
    await userEvent.type(screen.getByLabelText("Mobile number"), "09171234567");
    await userEvent.selectOptions(screen.getByLabelText("Civil status"), "Married");
    await userEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(saveOfferDetailsAction).toHaveBeenCalledTimes(1));
    const sent = Object.fromEntries(saveOfferDetailsAction.mock.calls[0][0] as FormData);
    expect(sent).toMatchObject({ referenceNumber: "REF-1", philhealth: "123456789012", emergencyMobile: "09171234567", civilStatus: "Married", sss: "" });
    expect(await screen.findByText(/Your details are saved/)).toBeTruthy();
  });

  test("shows field errors and the refusal message, keeping what was typed", async () => {
    saveOfferDetailsAction.mockResolvedValue({ ok: false, message: "Check the highlighted answers and try again.", errors: { sss: "Enter a valid SSS number (10 digits)" } });
    render(<OfferDetailsForm referenceNumber="REF-1" initial={emptyOfferDetails} />);
    await userEvent.type(screen.getByLabelText("SSS number"), "12");
    await userEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByText("Enter a valid SSS number (10 digits)")).toBeTruthy();
    expect(screen.getByText("Check the highlighted answers and try again.")).toBeTruthy();
    expect((screen.getByLabelText("SSS number") as HTMLInputElement).value).toBe("12");
    expect(screen.getByLabelText("SSS number").getAttribute("aria-invalid")).toBe("true");
  });

  test("an unexpected failure says to try again", async () => {
    saveOfferDetailsAction.mockRejectedValue(new Error("network"));
    render(<OfferDetailsForm referenceNumber="REF-1" initial={emptyOfferDetails} />);
    await userEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByText("We couldn't save your details. Try again.")).toBeTruthy();
  });
});
