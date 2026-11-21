import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { requestCancel, createOrderFeedbackStore, createOrderStore, getDatabase, revalidatePath, requireCustomer, sendOrderCancelledEmail, submit } = vi.hoisted(() => ({
  requestCancel: vi.fn(),
  createOrderFeedbackStore: vi.fn(),
  createOrderStore: vi.fn(() => ({ requestCancel })),
  getDatabase: vi.fn(),
  revalidatePath: vi.fn(),
  requireCustomer: vi.fn(),
  sendOrderCancelledEmail: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("@/lib/customer/current-visitor", () => ({ requireCustomer }));
vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/email/order-cancelled-email", () => ({ sendOrderCancelledEmail }));
vi.mock("@/lib/orders/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/feedback")>()),
  createOrderFeedbackStore,
}));
vi.mock("@/lib/orders/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/orders")>()),
  createOrderStore,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { cancelOrder, submitOrderFeedback } from "@/app/(site)/(protected)/profile/orders/actions";
import { OrderTransitionError } from "@/lib/orders/orders";

function feedbackFormData() {
  const formData = new FormData();
  formData.set("orderId", "12");
  formData.set("rating", "5");
  formData.set("comment", "The ube halaya arrived fresh and delicious.");
  return formData;
}

function cancellationFormData(orderId = "12") {
  const formData = new FormData();
  formData.set("orderId", orderId);
  formData.set("reason", "I ordered by mistake");
  return formData;
}

describe("Order actions", () => {
  beforeEach(() => {
    createOrderFeedbackStore.mockReset().mockReturnValue({ submit });
    createOrderStore.mockReset().mockReturnValue({ requestCancel });
    requestCancel.mockReset().mockResolvedValue({ requestId: "r1", replayed: false });
    getDatabase.mockReset();
    revalidatePath.mockReset();
    requireCustomer.mockReset().mockResolvedValue({ userId: "customer-1", email: "jane@example.com" });
    sendOrderCancelledEmail.mockReset().mockResolvedValue(undefined);
    submit.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("saves the Feedback for the signed-in Customer and has the thank-you sent to their email", async () => {
    submit.mockResolvedValueOnce({ orderId: 12, rating: 5 });

    await expect(submitOrderFeedback({}, feedbackFormData())).resolves.toEqual({ submitted: true });

    expect(submit).toHaveBeenCalledWith(
      "customer-1",
      { orderId: 12, rating: 5, comment: "The ube halaya arrived fresh and delicious." },
      "jane@example.com",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/profile/orders");
  });

  test("returns a form error when Feedback cannot be saved", async () => {
    submit.mockRejectedValueOnce(new Error("database unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(submitOrderFeedback({}, feedbackFormData())).resolves.toEqual({
      message: "We couldn't save your Feedback. Please try again.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("returns validation errors for malformed numeric form values", async () => {
    const formData = feedbackFormData();
    formData.set("orderId", "12.5");
    formData.set("rating", "6");

    await expect(submitOrderFeedback({}, formData)).resolves.toEqual({
      fieldErrors: {
        orderId: ["Enter a valid order id"],
        rating: ["Choose a rating from 1 to 5"],
      },
    });
    expect(requireCustomer).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  test("rejects invisible control characters in Order feedback", async () => {
    const formData = feedbackFormData();
    formData.set("comment", "Fresh ube\u000bhalaya");

    await expect(submitOrderFeedback({}, formData)).resolves.toEqual({
      fieldErrors: { comment: ["Enter text without invisible characters"] },
    });
    expect(requireCustomer).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  test("asks to cancel the Customer's Order, changes nothing on it, and refreshes the order history", async () => {
    requestCancel.mockResolvedValueOnce({ requestId: "r1", replayed: false });
    await expect(cancelOrder({}, cancellationFormData())).resolves.toEqual({ requested: true });

    expect(requestCancel).toHaveBeenCalledWith("customer-1", 12, "I ordered by mistake");
    expect(sendOrderCancelledEmail).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/profile/orders");
  });

  test("returns a message when the Order can no longer be cancelled", async () => {
    requestCancel.mockRejectedValueOnce(new OrderTransitionError("cancelled", "dispatched"));

    await expect(cancelOrder({}, cancellationFormData())).resolves.toEqual({
      message: "This Order can no longer be cancelled here.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("returns a message instead of failing when the request cannot be saved", async () => {
    requestCancel.mockRejectedValueOnce(new Error("database unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(cancelOrder({}, cancellationFormData())).resolves.toEqual({
      message: "We couldn't send your request. Please try again.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("needs a reason to cancel and does not attempt it without one", async () => {
    const formData = cancellationFormData();
    formData.set("reason", "  ");
    await expect(cancelOrder({}, formData)).resolves.toEqual({ message: "Tell us why you are cancelling." });
    expect(requestCancel).not.toHaveBeenCalled();
  });

  test("rejects a malformed Order id without attempting cancellation", async () => {
    await expect(cancelOrder({}, cancellationFormData("12.5"))).resolves.toEqual({
      message: "We couldn't send your request. Please try again.",
    });
    expect(requireCustomer).not.toHaveBeenCalled();
    expect(requestCancel).not.toHaveBeenCalled();
  });
});
