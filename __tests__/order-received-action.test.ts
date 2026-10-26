import { beforeEach, describe, expect, test, vi } from "vitest";

const { markReceived, getDatabase, revalidatePath, requireCustomer } = vi.hoisted(() => ({
  markReceived: vi.fn(),
  getDatabase: vi.fn(),
  revalidatePath: vi.fn(),
  requireCustomer: vi.fn(),
}));

vi.mock("@/lib/customer/current-visitor", () => ({ requireCustomer }));
vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/orders/receipt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/receipt")>()),
  createOrderReceiptStore: () => ({ markReceived }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { markOrderReceived } from "@/app/(site)/(protected)/profile/orders/actions";

describe("markOrderReceived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCustomer.mockResolvedValue({ userId: "customer-1" });
    markReceived.mockResolvedValue({ id: 11, status: "received" });
  });

  test("marks the Order received for the signed-in Customer", async () => {
    await expect(markOrderReceived(11)).resolves.toEqual({ received: true });
    expect(markReceived).toHaveBeenCalledWith("customer-1", 11);
    expect(revalidatePath).toHaveBeenCalledWith("/profile/orders");
  });

  test("rejects an invalid Order id without touching the database", async () => {
    await expect(markOrderReceived(0)).resolves.toEqual({ message: "We couldn't mark this Order received. Please try again." });
    expect(markReceived).not.toHaveBeenCalled();
  });
});
