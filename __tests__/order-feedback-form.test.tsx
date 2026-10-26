// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { submitOrderFeedback } = vi.hoisted(() => ({ submitOrderFeedback: vi.fn() }));

vi.mock("@/app/(site)/(protected)/profile/orders/actions", () => ({ submitOrderFeedback }));

import { OrderFeedbackForm } from "@/components/features/orders/order-feedback-form";

beforeEach(() => {
  submitOrderFeedback.mockReset().mockResolvedValue({ submitted: true });
});
afterEach(cleanup);

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("2 out of 5 stars"));
  await user.type(screen.getByLabelText("Your Order feedback"), "Arrived late.");
}

describe("Order Feedback form", () => {
  test("asks for confirmation, saying it cannot be changed, before submitting anything", async () => {
    const user = userEvent.setup();
    render(<OrderFeedbackForm orderId={12} />);
    await fillIn(user);

    await user.click(screen.getByRole("button", { name: "Submit Feedback" }));

    expect(await screen.findByText("Submit your Feedback?")).toBeTruthy();
    expect(screen.getByText("Once submitted, your Feedback cannot be changed.")).toBeTruthy();
    expect(submitOrderFeedback).not.toHaveBeenCalled();
  });

  test("submits nothing when the Customer goes back from the confirmation", async () => {
    const user = userEvent.setup();
    render(<OrderFeedbackForm orderId={12} />);
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Submit Feedback" }));

    await user.click(await screen.findByRole("button", { name: "Go back" }));

    await waitFor(() => expect(screen.queryByText("Submit your Feedback?")).toBeNull());
    expect(submitOrderFeedback).not.toHaveBeenCalled();
  });

  test("does not ask for confirmation while the form is incomplete", async () => {
    const user = userEvent.setup();
    render(<OrderFeedbackForm orderId={12} />);

    await user.click(screen.getByRole("button", { name: "Submit Feedback" }));

    expect(screen.queryByText("Submit your Feedback?")).toBeNull();
    expect(submitOrderFeedback).not.toHaveBeenCalled();
  });

  test("submits once confirmed and thanks the Customer", async () => {
    const user = userEvent.setup();
    render(<OrderFeedbackForm orderId={12} />);
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Submit Feedback" }));

    await user.click(await screen.findByRole("button", { name: "Confirm and submit" }));

    expect((await screen.findByRole("status")).textContent).toBe("Thank you for your Feedback.");
    expect(submitOrderFeedback).toHaveBeenCalledTimes(1);
    const formData = submitOrderFeedback.mock.calls[0][1] as FormData;
    expect([formData.get("orderId"), formData.get("rating"), formData.get("comment")]).toEqual(["12", "2", "Arrived late."]);
  });

  test("shows the stars, comment and date, and no form, once Feedback is given", () => {
    render(<OrderFeedbackForm feedback={{ rating: 4, comment: "Lovely jam.", createdAt: new Date("2026-10-05T04:00:00Z") }} orderId={12} />);

    expect(screen.getByLabelText("4 out of 5 stars").textContent).toContain("★★★★☆");
    expect(screen.getByText("Lovely jam.")).toBeTruthy();
    expect(screen.getByText("Oct 5, 2026")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit Feedback" })).toBeNull();
  });
});
