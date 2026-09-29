import { beforeEach, describe, expect, test, vi } from "vitest";

const { sendTicketCreatedEmail, addMessage, close, createTicketStore, getDatabase, open, reopen, revalidatePath, requireCustomer } = vi.hoisted(() => ({
  sendTicketCreatedEmail: vi.fn(),
  addMessage: vi.fn(),
  close: vi.fn(),
  createTicketStore: vi.fn(() => ({ addMessage, close, open, reopen })),
  getDatabase: vi.fn(),
  open: vi.fn(),
  reopen: vi.fn(),
  revalidatePath: vi.fn(),
  requireCustomer: vi.fn(),
}));

vi.mock("@/lib/customer/current-visitor", () => ({ requireCustomer }));
vi.mock("@/lib/email/ticket-created-email", () => ({ sendTicketCreatedEmail }));
vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/support/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/support/tickets")>()),
  createTicketStore,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { closeTicket, createTicket, reopenTicket, sendMessage } from "@/app/(site)/(protected)/support/actions";

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
    createTicketStore.mockReset().mockReturnValue({ addMessage, close, open, reopen });
    addMessage.mockReset().mockResolvedValue({ id: 12 });
    close.mockReset().mockResolvedValue({ id: 12, status: "closed" });
    getDatabase.mockReset();
    open.mockReset().mockResolvedValue({ id: 1 });
    reopen.mockReset().mockResolvedValue({ id: 12, status: "open" });
    revalidatePath.mockReset();
    sendTicketCreatedEmail.mockReset().mockResolvedValue(undefined);
    requireCustomer.mockReset().mockResolvedValue({ userId: "customer-1", email: "jane@example.com" });
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

  test("sends the Ticket-created email to the Customer's account address", async () => {
    await createTicket({}, ticketFormData());

    expect(sendTicketCreatedEmail).toHaveBeenCalledWith("jane@example.com", { id: 1 });
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

  test("closes a Customer-owned Ticket and refreshes its detail and Support list", async () => {
    await expect(closeTicket(12)).resolves.toEqual({ closed: true });

    expect(close).toHaveBeenCalledWith(12, "customer-1");
    expect(revalidatePath).toHaveBeenCalledWith("/support/12");
    expect(revalidatePath).toHaveBeenCalledWith("/support");
  });

  test("reopens a Customer-owned Ticket and refreshes its detail and Support list", async () => {
    await expect(reopenTicket(12)).resolves.toEqual({ reopened: true });

    expect(reopen).toHaveBeenCalledWith(12, "customer-1");
    expect(revalidatePath).toHaveBeenCalledWith("/support/12");
    expect(revalidatePath).toHaveBeenCalledWith("/support");
  });
});
