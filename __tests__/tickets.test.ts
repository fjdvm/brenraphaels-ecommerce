import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, orders, tickets } from "../lib/db/schema";
import { autoCompleteResolvedTicketsAndNotify, completeTicketAndNotify, createTicketStore, openTicketAndNotify } from "../lib/support/tickets";

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

  test("persists the file-storage id on the opening Message, storing the image once the Ticket exists", async () => {
    const store = createTicketStore(drizzle(client));
    const upload = vi.fn(async () => "file-1");

    const ticket = await store.open(
      "customer-1",
      { subject: "Damaged item", category: "Order Issue", body: "See the photo." },
      upload,
    );

    expect(upload).toHaveBeenCalledWith(ticket.id);
    expect(ticket.messages[0].fileId).toBe("file-1");
    const reread = await store.get(ticket.id, "customer-1");
    expect(reread?.messages[0].fileId).toBe("file-1");
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

  test("persists the file-storage id on a reply and leaves other Messages without one", async () => {
    const store = createTicketStore(drizzle(client));
    const ticket = await store.open("customer-1", { subject: "Damaged item", category: "Order Issue", body: "Hello." });

    const updated = await store.addMessage(
      ticket.id,
      "customer-1",
      { body: "Here is the photo." },
      "file-2",
    );

    expect(updated.messages.map(({ fileId }) => fileId)).toEqual([null, "file-2"]);
  });

  test("only reveals where an image lives to the owning Customer", async () => {
    const store = createTicketStore(drizzle(client));
    const ticket = await store.open("customer-1", { subject: "Damaged item", category: "Order Issue", body: "Hello." });
    const updated = await store.addMessage(ticket.id, "customer-1", { body: "Photo." }, "file-3");
    const messageId = updated.messages[1].id;

    await expect(store.getAttachment(messageId, "customer-1")).resolves.toEqual({ fileId: "file-3" });
    await expect(store.getAttachment(messageId, "customer-2")).resolves.toBeUndefined();
    await expect(store.getAttachment(updated.messages[0].id, "customer-1")).resolves.toBeUndefined();
  });

  test("still finds an older image stored in Vercel Blob", async () => {
    const store = createTicketStore(drizzle(client));
    const ticket = await store.open("customer-1", { subject: "Damaged item", category: "Order Issue", body: "Hello." });
    const [old] = await client.query<{ id: number }>(
      `insert into ticket_messages (ticket_id, sender, body, attachment_pathname) values ($1, 'customer', 'Old', 'ticket-attachments/1/p.png') returning id`,
      [ticket.id],
    ).then((r) => r.rows);

    await expect(store.getAttachment(old.id, "customer-1")).resolves.toEqual({ pathname: "ticket-attachments/1/p.png" });
  });

  describe("Customer status transitions", () => {
    async function openTicket(store: ReturnType<typeof createTicketStore>) {
      return store.open("customer-1", { subject: "My delivery issue", category: "Delivery Issue", body: "Where is it?" });
    }
    const markResolved = (ticketId: number) =>
      drizzle(client).update(tickets).set({ status: "resolved", resolvedAt: new Date() }).where(eq(tickets.id, ticketId));

    test("confirming a Resolved Ticket completes it", async () => {
      const store = createTicketStore(drizzle(client));
      const ticket = await openTicket(store);
      await markResolved(ticket.id);

      await expect(store.complete(ticket.id, "customer-1")).resolves.toMatchObject({ status: "completed" });
      await expect(store.get(ticket.id, "customer-1")).resolves.toMatchObject({ status: "completed" });
    });

    test("a Customer can complete an Open Ticket directly", async () => {
      const store = createTicketStore(drizzle(client));
      const ticket = await openTicket(store);

      await expect(store.complete(ticket.id, "customer-1")).resolves.toMatchObject({ status: "completed" });
    });

    test("Not fixed returns a Resolved Ticket to Open", async () => {
      const store = createTicketStore(drizzle(client));
      const ticket = await openTicket(store);
      await markResolved(ticket.id);

      await expect(store.reportNotFixed(ticket.id, "customer-1")).resolves.toMatchObject({ status: "open" });
    });

    test("Not fixed only applies to a Resolved Ticket", async () => {
      const store = createTicketStore(drizzle(client));
      const ticket = await openTicket(store);

      await expect(store.reportNotFixed(ticket.id, "customer-1")).rejects.toThrow("Ticket is not resolved.");
    });

    test("a Customer Message on a Resolved Ticket reopens it", async () => {
      const store = createTicketStore(drizzle(client));
      const ticket = await openTicket(store);
      await markResolved(ticket.id);

      const updated = await store.addMessage(ticket.id, "customer-1", { body: "It broke again." });

      expect(updated.status).toBe("open");
      expect(updated.messages).toHaveLength(2);
    });

    test("a Completed Ticket cannot be reopened, messaged or completed again", async () => {
      const store = createTicketStore(drizzle(client));
      const ticket = await openTicket(store);
      await store.complete(ticket.id, "customer-1");

      await expect(store.reportNotFixed(ticket.id, "customer-1")).rejects.toThrow("Ticket is completed.");
      await expect(store.addMessage(ticket.id, "customer-1", { body: "Hello?" })).rejects.toThrow("Ticket is completed.");
      await expect(store.complete(ticket.id, "customer-1")).rejects.toThrow("Ticket is completed.");
      await expect(store.get(ticket.id, "customer-1")).resolves.toMatchObject({ status: "completed", messages: [expect.anything()] });
    });

    test("another Customer's Ticket cannot be changed", async () => {
      const store = createTicketStore(drizzle(client));
      const ticket = await openTicket(store);
      await markResolved(ticket.id);

      await expect(store.complete(ticket.id, "customer-2")).rejects.toThrow("Ticket was not found.");
      await expect(store.reportNotFixed(ticket.id, "customer-2")).rejects.toThrow("Ticket was not found.");
    });
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

describe("Ticket store live relay", () => {
  test("hands back the id of the Message it saved, for the live relay to echo", async () => {
    const store = createTicketStore(drizzle(client));
    const opened = await store.open("customer-1", { subject: "Two tabs", category: "Other", body: "Opening." });

    const [one, two] = await Promise.all([
      store.addMessage(opened.id, "customer-1", { body: "From tab one" }),
      store.addMessage(opened.id, "customer-1", { body: "From tab two" }),
    ]);

    const bodyOf = (sent: typeof one) => sent.messages.find((m) => m.id === sent.messageId)?.body;
    expect([bodyOf(one), bodyOf(two)]).toEqual(["From tab one", "From tab two"]);
  });
});

describe("completeTicketAndNotify", () => {
  async function openTicket(database: ReturnType<typeof drizzle>) {
    return createTicketStore(database).open("customer-1", { subject: "Where is my Order", category: "Order Issue", body: "Please help." });
  }

  test("completes the Ticket and sends the thank-you email once", async () => {
    const database = drizzle(client);
    const ticket = await openTicket(database);
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };
    const dependencies = { ticketStore: createTicketStore(database), mailer };

    const completed = await completeTicketAndNotify(ticket.id, "customer-1", "jane@example.com", dependencies);

    expect(completed.status).toBe("completed");
    expect(mailer.send).toHaveBeenCalledOnce();
    expect(mailer.send).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ id: ticket.id }));

    await expect(completeTicketAndNotify(ticket.id, "customer-1", "jane@example.com", dependencies)).rejects.toThrow("Ticket is completed.");
    expect(mailer.send).toHaveBeenCalledOnce();
  });

  test("still completes the Ticket when the email cannot be sent", async () => {
    const database = drizzle(client);
    const ticket = await openTicket(database);
    const mailer = { send: vi.fn().mockRejectedValue(new Error("Brevo down")) };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const completed = await completeTicketAndNotify(ticket.id, "customer-1", "jane@example.com", {
      ticketStore: createTicketStore(database),
      mailer,
    });

    expect(completed.status).toBe("completed");
    consoleError.mockRestore();
  });
});

describe("Daily auto-complete of Resolved Tickets", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  async function ticketWith(store: ReturnType<typeof createTicketStore>, status: string, resolvedAt: Date | null, customerId = "customer-1") {
    const ticket = await store.open(customerId, { subject: "My delivery issue", category: "Delivery Issue", body: "Where is it?" });
    await drizzle(client).update(tickets).set({ status, resolvedAt }).where(eq(tickets.id, ticket.id));
    return ticket;
  }

  test("completes a Ticket Resolved 3 days ago and thanks the Customer once", async () => {
    const store = createTicketStore(drizzle(client));
    const ticket = await ticketWith(store, "resolved", daysAgo(3));
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };

    await expect(autoCompleteResolvedTicketsAndNotify(now, { ticketStore: store, mailer })).resolves.toBe(1);

    await expect(store.get(ticket.id, "customer-1")).resolves.toMatchObject({ status: "completed" });
    expect(mailer.send).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ id: ticket.id, status: "completed" }));
  });

  test("leaves a Ticket Resolved less than 3 days ago alone", async () => {
    const store = createTicketStore(drizzle(client));
    const ticket = await ticketWith(store, "resolved", daysAgo(2.9));
    const mailer = { send: vi.fn() };

    await expect(autoCompleteResolvedTicketsAndNotify(now, { ticketStore: store, mailer })).resolves.toBe(0);

    await expect(store.get(ticket.id, "customer-1")).resolves.toMatchObject({ status: "resolved" });
    expect(mailer.send).not.toHaveBeenCalled();
  });

  test("does not complete a Ticket the Customer reopened, or one that is Open or already Completed", async () => {
    const store = createTicketStore(drizzle(client));
    const reopened = await ticketWith(store, "resolved", daysAgo(5));
    await store.addMessage(reopened.id, "customer-1", { body: "Still broken." });
    const open = await ticketWith(store, "open", daysAgo(5));
    const completed = await ticketWith(store, "completed", daysAgo(5));
    const mailer = { send: vi.fn() };

    await expect(autoCompleteResolvedTicketsAndNotify(now, { ticketStore: store, mailer })).resolves.toBe(0);

    await expect(store.get(reopened.id, "customer-1")).resolves.toMatchObject({ status: "open" });
    await expect(store.get(open.id, "customer-1")).resolves.toMatchObject({ status: "open" });
    await expect(store.get(completed.id, "customer-1")).resolves.toMatchObject({ status: "completed" });
    expect(mailer.send).not.toHaveBeenCalled();
  });

  test("running twice sends one email per Ticket", async () => {
    const store = createTicketStore(drizzle(client));
    await ticketWith(store, "resolved", daysAgo(4));
    await ticketWith(store, "resolved", daysAgo(10), "customer-2");
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };

    await expect(autoCompleteResolvedTicketsAndNotify(now, { ticketStore: store, mailer })).resolves.toBe(2);
    await expect(autoCompleteResolvedTicketsAndNotify(now, { ticketStore: store, mailer })).resolves.toBe(0);

    expect(mailer.send).toHaveBeenCalledTimes(2);
  });

  test("a failed email does not undo the completion or stop the other Tickets", async () => {
    const store = createTicketStore(drizzle(client));
    const first = await ticketWith(store, "resolved", daysAgo(4));
    const second = await ticketWith(store, "resolved", daysAgo(4), "customer-2");
    const mailer = { send: vi.fn().mockRejectedValueOnce(new Error("smtp down")).mockResolvedValue(undefined) };
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(autoCompleteResolvedTicketsAndNotify(now, { ticketStore: store, mailer })).resolves.toBe(2);

    await expect(store.get(first.id, "customer-1")).resolves.toMatchObject({ status: "completed" });
    await expect(store.get(second.id, "customer-2")).resolves.toMatchObject({ status: "completed" });
    expect(mailer.send).toHaveBeenCalledTimes(2);
  });
});
