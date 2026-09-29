import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, orders } from "../lib/db/schema";
import { createTicketStore, openTicketAndNotify } from "../lib/support/tickets";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  const database = drizzle(client);
  await migrate(database, { migrationsFolder: "drizzle" });
  await database.insert(customers).values([
    {
      id: "customer-1",
      firstName: "Jane",
      lastName: "Doe",
      fullName: "Jane Doe",
      email: "jane@example.com",
      contactNumber: "09171234567",
      marketingOptIn: false,
    },
    {
      id: "customer-2",
      firstName: "John",
      lastName: "Doe",
      fullName: "John Doe",
      email: "john@example.com",
      contactNumber: "09181234567",
      marketingOptIn: false,
    },
  ]);
});

afterEach(async () => {
  await client.close();
});

describe("Ticket store", () => {
  test("opens a Ticket with its opening Message, with or without an owned Order link", async () => {
    const database = drizzle(client);
    const [order] = await database.insert(orders).values({
      customerId: "customer-1",
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
      status: "confirmed",
      subtotalInCentavos: 21900,
    }).returning();
    const store = createTicketStore(database);

    const linked = await store.open("customer-1", {
      subject: "My Order arrived damaged",
      category: "Order Issue",
      orderId: order.id,
      body: "The jar lid was cracked when it arrived.",
    });
    const unlinked = await store.open("customer-1", {
      subject: "I have a product question",
      category: "Product Question",
      body: "Is the Ube Halaya dairy free?",
    });

    expect(linked).toMatchObject({
      subject: "My Order arrived damaged",
      category: "Order Issue",
      status: "open",
      orderId: order.id,
      messages: [{ body: "The jar lid was cracked when it arrived.", sender: "customer" }],
    });
    expect(unlinked).toMatchObject({ orderId: null, status: "open" });
  });

  test("lists and retrieves only Tickets owned by the Customer", async () => {
    const store = createTicketStore(drizzle(client));
    const ticket = await store.open("customer-1", {
      subject: "Where is my Order?",
      category: "Delivery Issue",
      body: "It has not arrived yet.",
    });

    await expect(store.listForCustomer("customer-1")).resolves.toMatchObject([{ id: ticket.id }]);
    await expect(store.listForCustomer("customer-2")).resolves.toEqual([]);
    await expect(store.get(ticket.id, "customer-1")).resolves.toMatchObject({ id: ticket.id });
    await expect(store.get(ticket.id, "customer-2")).resolves.toBeUndefined();
  });

  test("adds Customer Messages in chronological order only to an owned Ticket", async () => {
    const store = createTicketStore(drizzle(client));
    const ticket = await store.open("customer-1", {
      subject: "Where is my Order?",
      category: "Delivery Issue",
      body: "It has not arrived yet.",
    });

    const updated = await store.addMessage(ticket.id, "customer-1", {
      body: "Please let me know when it will arrive.",
    });

    expect(updated.messages.map(({ body }) => body)).toEqual([
      "It has not arrived yet.",
      "Please let me know when it will arrive.",
    ]);
    await expect(store.addMessage(ticket.id, "customer-2", {
      body: "This must not be added.",
    })).rejects.toThrow("Ticket was not found.");
  });

  test("persists an attachment pathname on the opening Message, uploading under the new Ticket", async () => {
    const store = createTicketStore(drizzle(client));
    const upload = vi.fn(async (ticketId: number) => `ticket-attachments/${ticketId}/photo-abc.png`);

    const ticket = await store.open(
      "customer-1",
      { subject: "Damaged item", category: "Order Issue", body: "See the photo." },
      upload,
    );

    expect(upload).toHaveBeenCalledWith(ticket.id);
    expect(ticket.messages[0].attachmentPathname).toBe(`ticket-attachments/${ticket.id}/photo-abc.png`);
    const reread = await store.get(ticket.id, "customer-1");
    expect(reread?.messages[0].attachmentPathname).toBe(`ticket-attachments/${ticket.id}/photo-abc.png`);
  });

  test("removes the Ticket when the opening attachment upload fails", async () => {
    const store = createTicketStore(drizzle(client));

    await expect(
      store.open(
        "customer-1",
        { subject: "Damaged item", category: "Order Issue", body: "See the photo." },
        async () => {
          throw new Error("upload failed");
        },
      ),
    ).rejects.toThrow("upload failed");
    await expect(store.listForCustomer("customer-1")).resolves.toEqual([]);
  });

  test("persists an attachment pathname on a reply and leaves other Messages without one", async () => {
    const store = createTicketStore(drizzle(client));
    const ticket = await store.open("customer-1", { subject: "Damaged item", category: "Order Issue", body: "Hello." });

    const updated = await store.addMessage(
      ticket.id,
      "customer-1",
      { body: "Here is the photo." },
      `ticket-attachments/${ticket.id}/photo-abc.jpg`,
    );

    expect(updated.messages.map(({ attachmentPathname }) => attachmentPathname)).toEqual([
      null,
      `ticket-attachments/${ticket.id}/photo-abc.jpg`,
    ]);
  });

  test("only reveals an attachment pathname to the owning Customer", async () => {
    const store = createTicketStore(drizzle(client));
    const ticket = await store.open("customer-1", { subject: "Damaged item", category: "Order Issue", body: "Hello." });
    const updated = await store.addMessage(ticket.id, "customer-1", { body: "Photo." }, "ticket-attachments/1/p.png");
    const messageId = updated.messages[1].id;

    await expect(store.getAttachmentPathname(messageId, "customer-1")).resolves.toBe("ticket-attachments/1/p.png");
    await expect(store.getAttachmentPathname(messageId, "customer-2")).resolves.toBeUndefined();
    await expect(store.getAttachmentPathname(updated.messages[0].id, "customer-1")).resolves.toBeUndefined();
  });

  test("lets a Customer close and reopen their Ticket", async () => {
    const store = createTicketStore(drizzle(client));
    const ticket = await store.open("customer-1", {
      subject: "My delivery issue is resolved",
      category: "Delivery Issue",
      body: "It arrived today.",
    });

    await expect(store.close(ticket.id, "customer-1")).resolves.toMatchObject({ status: "closed" });
    await expect(store.get(ticket.id, "customer-1")).resolves.toMatchObject({ status: "closed" });
    await expect(store.reopen(ticket.id, "customer-1")).resolves.toMatchObject({ status: "open" });
    await expect(store.close(ticket.id, "customer-2")).rejects.toThrow("Ticket was not found.");
    await expect(store.reopen(ticket.id, "customer-2")).rejects.toThrow("Ticket was not found.");
  });

  test("rejects an unowned Order link and invalid Category, Subject, or opening Message", async () => {
    const database = drizzle(client);
    const [otherOrder] = await database.insert(orders).values({
      customerId: "customer-2",
      fulfillmentMethod: "pickup",
      paymentMethod: "cash-on-delivery",
      status: "confirmed",
      subtotalInCentavos: 21900,
    }).returning();
    const store = createTicketStore(database);

    await expect(store.open("customer-1", {
      subject: "Order ownership",
      category: "Order Issue",
      orderId: otherOrder.id,
      body: "This should not be linked.",
    })).rejects.toThrow("Order was not found.");
    await expect(store.open("customer-1", {
      subject: "Valid subject",
      category: "Not a category" as "Other",
      body: "Valid opening message.",
    })).rejects.toThrow("Choose a valid category");
    await expect(store.open("customer-1", {
      subject: "",
      category: "Other",
      body: "Valid opening message.",
    })).rejects.toThrow("Subject is required");
    await expect(store.open("customer-1", {
      subject: "Valid\u000bsubject",
      category: "Other",
      body: "Valid opening message.",
    })).rejects.toThrow("Enter text without invisible characters");
    await expect(store.open("customer-1", {
      subject: "Valid subject",
      category: "Other",
      body: "",
    })).rejects.toThrow("Message is required");
  });
});

describe("openTicketAndNotify", () => {
  const input = { subject: "Where is my Order", category: "Order Issue", body: "Please help." } as const;

  test("emails the Customer the opened Ticket", async () => {
    const database = drizzle(client);
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };

    const ticket = await openTicketAndNotify("customer-1", "jane@example.com", input, {
      ticketStore: createTicketStore(database),
      mailer,
    });

    expect(mailer.send).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ id: ticket.id, subject: "Where is my Order" }));
  });

  test("still opens the Ticket when the email cannot be sent", async () => {
    const database = drizzle(client);
    const mailer = { send: vi.fn().mockRejectedValue(new Error("Brevo down")) };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const ticket = await openTicketAndNotify("customer-1", "jane@example.com", input, {
      ticketStore: createTicketStore(database),
      mailer,
    });

    expect(mailer.send).toHaveBeenCalled();
    consoleError.mockRestore();
    await expect(createTicketStore(database).listForCustomer("customer-1")).resolves.toMatchObject([{ id: ticket.id }]);
  });
});

describe("Ticket store realtime publishing", () => {
  test("publishes the new Ticket and its opening Message when a Ticket is opened", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const store = createTicketStore(drizzle(client), { publish });

    const ticket = await store.open("customer-1", {
      subject: "Where is my Order?",
      category: "Order Issue",
      body: "It has been a week.",
    });

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({ type: "ticket-opened", ticket, message: ticket.messages[0] });
  });

  test("publishes the added Message and updated Ticket", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const store = createTicketStore(drizzle(client), { publish });
    const opened = await store.open("customer-1", {
      subject: "Where is my Order?",
      category: "Order Issue",
      body: "It has been a week.",
    });
    publish.mockClear();

    const updated = await store.addMessage(opened.id, "customer-1", { body: "Any update?" });

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      type: "message-added",
      ticket: updated,
      message: updated.messages[1],
    });
  });

  test("does not publish when the Message is rejected", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const store = createTicketStore(drizzle(client), { publish });
    const opened = await store.open("customer-1", {
      subject: "Where is my Order?",
      category: "Order Issue",
      body: "It has been a week.",
    });
    publish.mockClear();

    await expect(store.addMessage(opened.id, "customer-2", { body: "Not mine" })).rejects.toThrow();
    await expect(store.addMessage(opened.id, "customer-1", { body: "" })).rejects.toThrow();

    expect(publish).not.toHaveBeenCalled();
  });

  test("still saves the Message when publishing fails", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("redis down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = createTicketStore(drizzle(client), { publish });
    const opened = await store.open("customer-1", {
      subject: "Where is my Order?",
      category: "Order Issue",
      body: "It has been a week.",
    });

    const updated = await store.addMessage(opened.id, "customer-1", { body: "Any update?" });

    expect(updated.messages.map((message) => message.body)).toEqual(["It has been a week.", "Any update?"]);
    error.mockRestore();
  });
});
