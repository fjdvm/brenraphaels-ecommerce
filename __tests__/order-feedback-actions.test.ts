import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { createOrderFeedbackStore, getDatabase, revalidatePath, requireCustomer, submit } = vi.hoisted(() => ({
  createOrderFeedbackStore: vi.fn(),
  getDatabase: vi.fn(),
  revalidatePath: vi.fn(),
  requireCustomer: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("@/lib/customer/current-visitor", () => ({ requireCustomer }));
vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/orders/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/feedback")>()),
  createOrderFeedbackStore,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { submitOrderFeedback } from "@/app/(site)/(protected)/profile/orders/actions";

function feedbackFormData() {
  const formData = new FormData();
  formData.set("orderId", "12");
  formData.set("rating", "5");
  formData.set("comment", "The ube halaya arrived fresh and delicious.");
  return formData;
}

describe("Order Feedback action", () => {
  beforeEach(() => {
    createOrderFeedbackStore.mockReset().mockReturnValue({ submit });
    getDatabase.mockReset();
    revalidatePath.mockReset();
    requireCustomer.mockReset().mockResolvedValue({ userId: "customer-1" });
    submit.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
