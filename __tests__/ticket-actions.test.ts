import { beforeEach, describe, expect, test, vi } from "vitest";

import { FakeTicketFiles } from "./fake-ticket-files";

const files = new FakeTicketFiles();

const { liveConversationUrl, get, sendTicketCreatedEmail, addMessage, complete, createTicketStore, getDatabase, open, reportNotFixed, sendTicketCompletedEmail, revalidatePath, requireCustomer } = vi.hoisted(() => ({
  liveConversationUrl: vi.fn(),
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
vi.mock("@/lib/support/live", () => ({ liveConversationUrl }));
vi.mock("@/lib/support/ticket-files", () => ({ gatewayTicketFiles: () => files }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { completeTicket, createTicket, reportTicketNotFixed, sendMessage, ticketLiveUrl } from "@/app/(site)/(protected)/support/actions";

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
    liveConversationUrl.mockReset();
    files.reset();
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

    addMessage.mockResolvedValue({ id: 12, messageId: 77 });

    await expect(sendMessage(12, {}, formData)).resolves.toEqual({ sent: true, messageId: 77 });

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

    expect(complete).toHaveBeenCalledWith(12, "customer-1", undefined);
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
    expect(files.files.size).toBe(0);
  });

  test("stores the create-form image in file-storage and Links it to the opening Message", async () => {
    open.mockImplementation(async (_customerId, _input, attach) => {
      await expect(attach(33)).resolves.toBe("file-1");
      return { id: 33, messages: [{ id: 90 }] };
    });
    const formData = ticketFormData();
    formData.set("attachment", new File([new Uint8Array(4)], "photo.png", { type: "image/png" }));

    await expect(createTicket({}, formData)).resolves.toEqual({ created: true, ticketId: expect.any(Number) });
    expect(files.files.get("file-1")).toMatchObject({ filename: "photo.png", contentType: "image/png", messageId: 90 });
  });

  test("says uploads are unavailable when file-storage is down, and opens no Ticket", async () => {
    files.failUpload = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    open.mockImplementation(async (_customerId, _input, attach) => {
      await attach(33);
      return { id: 33 };
    });
    const formData = ticketFormData();
    formData.set("attachment", new File([new Uint8Array(4)], "photo.png", { type: "image/png" }));

    await expect(createTicket({}, formData)).resolves.toEqual({
      fieldErrors: { attachment: [expect.stringContaining("Image uploads aren't available")] },
    });
  });

  test("ignores an empty file input on the create form", async () => {
    const formData = ticketFormData();
    formData.set("attachment", new File([], "", { type: "application/octet-stream" }));

    await expect(createTicket({}, formData)).resolves.toEqual({ created: true, ticketId: expect.any(Number) });
    expect(files.files.size).toBe(0);
  });

  test("ignores an empty file input that arrives with a filename", async () => {
    const formData = ticketFormData();
    formData.set("attachment", new File([], "undefined", { type: "" }));

    await expect(createTicket({}, formData)).resolves.toEqual({ created: true, ticketId: expect.any(Number) });
    expect(files.files.size).toBe(0);
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

  test("sends a reply with the image stored in file-storage and Linked to the Message", async () => {
    addMessage.mockResolvedValue({ id: 12, messageId: 55 });
    const formData = new FormData();
    formData.set("body", "See attached.");
    formData.set("attachment", new File([new Uint8Array(4)], "photo.png", { type: "image/png" }));

    await expect(sendMessage(12, {}, formData)).resolves.toEqual({ sent: true, messageId: 55 });
    expect(addMessage).toHaveBeenCalledWith(12, "customer-1", { body: "See attached." }, "file-1");
    expect(files.files.get("file-1")?.messageId).toBe(55);
  });

  test("removes the stored image when the reply is not saved", async () => {
    addMessage.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const formData = new FormData();
    formData.set("body", "See attached.");
    formData.set("attachment", new File([new Uint8Array(4)], "photo.png", { type: "image/png" }));

    await sendMessage(12, {}, formData);

    expect(files.files.size).toBe(0);
  });

  test("keeps the reply when only the Link fails", async () => {
    files.failLink = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    addMessage.mockResolvedValue({ id: 12, messageId: 55 });
    const formData = new FormData();
    formData.set("body", "See attached.");
    formData.set("attachment", new File([new Uint8Array(4)], "photo.png", { type: "image/png" }));

    await expect(sendMessage(12, {}, formData)).resolves.toEqual({ sent: true, messageId: 55 });
  });

  test("gives the Customer's browser a Live ticket address for their own Ticket", async () => {
    liveConversationUrl.mockResolvedValue("wss://gateway.test/notifications/conversations/12/live?ticket=t");

    await expect(ticketLiveUrl(12)).resolves.toBe("wss://gateway.test/notifications/conversations/12/live?ticket=t");
    expect(liveConversationUrl).toHaveBeenCalledWith(12, "customer-1");
  });

  test("gives no Live ticket for a Ticket that is not the Customer's", async () => {
    get.mockResolvedValue(undefined);

    await expect(ticketLiveUrl(12)).resolves.toBeNull();
    expect(liveConversationUrl).not.toHaveBeenCalled();
  });

  test("is not live, but not broken, when the gateway is unreachable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    liveConversationUrl.mockRejectedValue(new Error("gateway down"));

    await expect(ticketLiveUrl(12)).resolves.toBeNull();
    error.mockRestore();
  });
});

describe("completeTicket rating", () => {
  test("passes a valid rating to the store and ignores an unusable one, so confirming is never blocked", async () => {
    await expect(completeTicket(12, { stars: 5, comment: "  Great  " })).resolves.toEqual({ completed: true });
    expect(complete).toHaveBeenLastCalledWith(12, "customer-1", { stars: 5, comment: "Great" });

    await expect(completeTicket(12, { stars: 9 })).resolves.toEqual({ completed: true });
    expect(complete).toHaveBeenLastCalledWith(12, "customer-1", undefined);
  });
});
