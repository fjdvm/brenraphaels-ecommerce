import { beforeEach, describe, expect, test, vi } from "vitest";

const { addMessage, createTicketStore, getDatabase, open, revalidatePath, requireCustomer } = vi.hoisted(() => ({
  addMessage: vi.fn(),
  createTicketStore: vi.fn(() => ({ addMessage, open })),
  getDatabase: vi.fn(),
  open: vi.fn(),
  revalidatePath: vi.fn(),
  requireCustomer: vi.fn(),
}));

vi.mock("@/lib/customer/current-visitor", () => ({ requireCustomer }));
vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/support/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/support/tickets")>()),
  createTicketStore,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createTicket, sendMessage } from "@/app/(site)/(protected)/support/actions";

function ticketFormData() {
  const formData = new FormData();
  formData.set("subject", "My Delivery has not arrived");
  formData.set("category", "Delivery Issue");
  formData.set("orderId", "12");
  formData.set("body", "It was expected yesterday.");
  return formData;
}

describe("Ticket actions", () => {
  beforeEach(() => {
    createTicketStore.mockReset().mockReturnValue({ addMessage, open });
    addMessage.mockReset().mockResolvedValue({ id: 12 });
    getDatabase.mockReset();
    open.mockReset().mockResolvedValue({ id: 1 });
    revalidatePath.mockReset();
    requireCustomer.mockReset().mockResolvedValue({ userId: "customer-1" });
  });

  test("opens a Customer Ticket and refreshes Support", async () => {
    await expect(createTicket({}, ticketFormData())).resolves.toEqual({ created: true });

    expect(open).toHaveBeenCalledWith("customer-1", {
      subject: "My Delivery has not arrived",
      category: "Delivery Issue",
      orderId: 12,
      body: "It was expected yesterday.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/support");
  });

  test("returns validation errors before authenticating or opening a Ticket", async () => {
    const formData = ticketFormData();
    formData.set("category", "Unknown");
    formData.set("orderId", "12.5");

    await expect(createTicket({}, formData)).resolves.toEqual({
      fieldErrors: {
        category: ["Choose a valid category"],
        orderId: ["Enter a valid order id"],
      },
    });
    expect(requireCustomer).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  test("adds a Customer Message and refreshes the Ticket detail", async () => {
    const formData = new FormData();
    formData.set("body", "Could you please share an update?");

    await expect(sendMessage(12, {}, formData)).resolves.toEqual({ sent: true });

    expect(addMessage).toHaveBeenCalledWith(12, "customer-1", {
      body: "Could you please share an update?",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/support/12");
  });

  test("rejects a malformed Ticket id before authenticating or adding a Message", async () => {
    const formData = new FormData();
    formData.set("body", "Could you please share an update?");

    await expect(sendMessage(12.5, {}, formData)).resolves.toEqual({
      message: "We couldn't send your Message. Please try again.",
    });

    expect(requireCustomer).not.toHaveBeenCalled();
    expect(addMessage).not.toHaveBeenCalled();
  });
});
