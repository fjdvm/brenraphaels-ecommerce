import { beforeEach, describe, expect, test, vi } from "vitest";

const { put, get, sendTicketCreatedEmail, addMessage, complete, createTicketStore, getDatabase, open, reportNotFixed, sendTicketCompletedEmail, revalidatePath, requireCustomer } = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  sendTicketCreatedEmail: vi.fn(),
  addMessage: vi.fn(),
  complete: vi.fn(),
  createTicketStore: vi.fn(() => ({ addMessage, complete, get, open, reportNotFixed })),
  getDatabase: vi.fn(),
  open: vi.fn(),
  reportNotFixed: vi.fn(),
  sendTicketCompletedEmail: vi.fn(),
  revalidatePath: vi.fn(),
  requireCustomer: vi.fn(),
}));

vi.mock("@/lib/customer/current-visitor", () => ({ requireCustomer }));
vi.mock("@/lib/email/ticket-completed-email", () => ({ sendTicketCompletedEmail }));
vi.mock("@/lib/email/ticket-created-email", () => ({ sendTicketCreatedEmail }));
vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/support/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/support/tickets")>()),
  createTicketStore,
}));
vi.mock("@vercel/blob", () => ({ put }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { completeTicket, createTicket, reportTicketNotFixed, sendMessage } from "@/app/(site)/(protected)/support/actions";

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
    createTicketStore.mockReset().mockReturnValue({ addMessage, complete, get, open, reportNotFixed });
    get.mockReset().mockResolvedValue({ id: 12 });
    put.mockReset().mockResolvedValue({ pathname: "ticket-attachments/12/photo-abc.png" });
    process.env.ORDERS_BLOB_READ_WRITE_TOKEN = "test-token";
    addMessage.mockReset().mockResolvedValue({ id: 12 });
    complete.mockReset().mockResolvedValue({ id: 12, status: "completed" });
    sendTicketCompletedEmail.mockReset().mockResolvedValue(undefined);
    getDatabase.mockReset();
    open.mockReset().mockResolvedValue({ id: 1 });
    reportNotFixed.mockReset().mockResolvedValue({ id: 12, status: "open" });
    revalidatePath.mockReset();
    sendTicketCreatedEmail.mockReset().mockResolvedValue(undefined);
    requireCustomer.mockReset().mockResolvedValue({ userId: "customer-1", email: "jane@example.com" });
  });

  test("opens a Customer Ticket and refreshes Support", async () => {
    await expect(createTicket({}, ticketFormData())).resolves.toEqual({ created: true, ticketId: expect.any(Number) });

    expect(open).toHaveBeenCalledWith("customer-1", {
      subject: "My Delivery has not arrived",
      category: "Delivery Issue",
      orderId: 12,
      body: "It was expected yesterday.",
    }, undefined);
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
    }, undefined);
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

  test("completes a Customer-owned Ticket, thanks them by email and refreshes its detail and Support list", async () => {
    await expect(completeTicket(12)).resolves.toEqual({ completed: true });

    expect(complete).toHaveBeenCalledWith(12, "customer-1");
    expect(sendTicketCompletedEmail).toHaveBeenCalledWith("jane@example.com", { id: 12, status: "completed" });
    expect(revalidatePath).toHaveBeenCalledWith("/support/12");
    expect(revalidatePath).toHaveBeenCalledWith("/support");
  });

  test("does not send the thank-you email when the Ticket was already completed", async () => {
    complete.mockRejectedValue(new Error("Ticket is completed."));

    await expect(completeTicket(12)).resolves.toEqual({
      message: "This Ticket is completed. Open a new Ticket if you need more help.",
    });
    expect(sendTicketCompletedEmail).not.toHaveBeenCalled();
  });

  test("sends a Resolved Ticket back to Open when the Customer says it is not fixed", async () => {
    await expect(reportTicketNotFixed(12)).resolves.toEqual({ reopened: true });

    expect(reportNotFixed).toHaveBeenCalledWith(12, "customer-1");
    expect(revalidatePath).toHaveBeenCalledWith("/support/12");
    expect(revalidatePath).toHaveBeenCalledWith("/support");
  });

  test("refuses a Message on a Completed Ticket", async () => {
    get.mockResolvedValue({ id: 12, status: "completed" });
    const formData = new FormData();
    formData.set("body", "Hello again.");

    await expect(sendMessage(12, {}, formData)).resolves.toEqual({
      message: "This Ticket is completed. Open a new Ticket if you need more help.",
    });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test("rejects an invalid image on the create form without opening a Ticket", async () => {
    const formData = ticketFormData();
    formData.set("attachment", new File([new Uint8Array(4)], "notes.pdf", { type: "application/pdf" }));

    await expect(createTicket({}, formData)).resolves.toEqual({
      fieldErrors: { attachment: ["Attach a JPEG or PNG image."] },
    });
    expect(open).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  test("uploads the create-form image under the new Ticket via the store", async () => {
    open.mockImplementation(async (_customerId, _input, attach) => {
      await expect(attach(33)).resolves.toBe("ticket-attachments/12/photo-abc.png");
      return { id: 33 };
    });
    const formData = ticketFormData();
    formData.set("attachment", new File([new Uint8Array(4)], "photo.png", { type: "image/png" }));

    await expect(createTicket({}, formData)).resolves.toEqual({ created: true, ticketId: expect.any(Number) });
    expect(put).toHaveBeenCalledWith("ticket-attachments/33/photo.png", expect.any(File), {
      access: "private",
      addRandomSuffix: true,
      token: "test-token",
    });
  });

  test("ignores an empty file input on the create form", async () => {
    const formData = ticketFormData();
    formData.set("attachment", new File([], "", { type: "application/octet-stream" }));

    await expect(createTicket({}, formData)).resolves.toEqual({ created: true, ticketId: expect.any(Number) });
    expect(put).not.toHaveBeenCalled();
  });

  test("ignores an empty file input that arrives with a filename", async () => {
    const formData = ticketFormData();
    formData.set("attachment", new File([], "undefined", { type: "" }));

    await expect(createTicket({}, formData)).resolves.toEqual({ created: true, ticketId: expect.any(Number) });
    expect(put).not.toHaveBeenCalled();
  });

  test("rejects an oversized reply image and stores nothing", async () => {
    const formData = new FormData();
    formData.set("body", "See attached.");
    formData.set("attachment", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }));

    await expect(sendMessage(12, {}, formData)).resolves.toEqual({
      fieldErrors: { attachment: ["Images must be 5 MB or smaller."] },
    });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test("sends a reply with the uploaded image pathname", async () => {
    const formData = new FormData();
    formData.set("body", "See attached.");
    formData.set("attachment", new File([new Uint8Array(4)], "photo.png", { type: "image/png" }));

    await expect(sendMessage(12, {}, formData)).resolves.toEqual({ sent: true });
    expect(addMessage).toHaveBeenCalledWith(12, "customer-1", { body: "See attached." }, "ticket-attachments/12/photo-abc.png");
  });
});
