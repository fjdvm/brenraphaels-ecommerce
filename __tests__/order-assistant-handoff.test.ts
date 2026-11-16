import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { answerOrderQuestion } from "../lib/assistant/answer";
import { factCheck } from "../lib/assistant/fact-check";
import { createChatStore } from "../lib/assistant/chat-store";
import { createHandoffStore, HandoffError, prepareHandoff, sendHandoff } from "../lib/assistant-handoff/handoff";
import { type Completer } from "../lib/assistant/model";
import { createOrderReader, createProductReader } from "../lib/assistant/readers";
import { assistantChats, assistantHandoffs, customers, orders, ticketMessages, tickets } from "../lib/db/schema";
import { createTicketStore } from "../lib/support/tickets";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
const now = new Date("2026-11-17T06:00:00Z");

const person = (id: string, first: string) => ({
  id, firstName: first, lastName: "Cruz", fullName: `${first} Cruz`, email: `${id}@example.com`, contactNumber: "09171234567", marketingOptIn: false,
});

async function order(customerId: string, values: Partial<typeof orders.$inferInsert> = {}) {
  const [row] = await db.insert(orders).values({
    customerId, fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", status: "dispatched", subtotalInCentavos: 123_400, deliveryFeeInCentavos: 15_000, ...values,
  }).returning({ id: orders.id });
  return row.id;
}

function model(reply: string | Error) {
  return vi.fn<Completer>(async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  });
}

/** A chat in which the Customer asked for a refund on an Order and was handed off. */
async function handedOffChat(orderId: number, message = "I want a refund for my order") {
  const reply = await answerOrderQuestion(
    { customerId: "jane", message, pageOrderId: orderId },
    { orders: createOrderReader(db), products: createProductReader(db), chats: createChatStore(db), complete: model("unused"), now },
  );
  return reply.chatId!;
}

const handoffDeps = (complete: Completer) => ({ orders: createOrderReader(db), chats: createChatStore(db), handoffs: createHandoffStore(db), complete, now });
const sendDeps = () => ({ handoffs: createHandoffStore(db), tickets: createTicketStore(db) });

beforeEach(async () => {
  client = await createTestDatabase();
  db = drizzle(client);
  await db.insert(customers).values([person("jane", "Jane"), person("john", "John")]);
});

afterEach(async () => {
  await client.close();
});

describe("Handoff summary", () => {
  test("is written and shown, and nothing reaches the team until the Customer approves it", async () => {
    const id = await order("jane", { courier: "Lalamove", courierTrackingUrl: "https://track.example/abc" });
    const chatId = await handedOffChat(id);
    const complete = model("The customer asked about a refund for order #" + id + ". The order is dispatched with Lalamove.");

    const draft = await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(complete));

    expect(draft).toMatchObject({ status: "drafted", orderId: id, reason: "refund" });
    expect(draft.summary).toContain("refund");
    expect(await db.select().from(tickets)).toHaveLength(0);
    expect(await db.select().from(ticketMessages)).toHaveLength(0);
  });

  test("the model sees only the masked chat and the Order's status words, and what it saw is stored", async () => {
    const id = await order("jane", { courier: "Lalamove", courierTrackingUrl: "https://track.example/abc" });
    const chatId = await handedOffChat(id, "Refund please, call me at 0917 123 4567 or jane@example.com");
    const complete = model("The customer asked for a refund.");

    await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(complete));

    const sent = JSON.stringify(complete.mock.calls[0][0]);
    expect(sent).not.toMatch(/0917|jane@example|Cruz|123,?400|150/);
    expect(sent).toContain("dispatched");
    const [row] = await db.select().from(assistantHandoffs);
    expect(row.sentToModel).toBe(sent);
  });

  test("a summary that contradicts the records is dropped, and the Customer can write their own", async () => {
    const id = await order("jane", { status: "confirmed" });
    const chatId = await handedOffChat(id);

    const draft = await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("The order is delivered and a refund will be issued by Nov 20, 2026.")));
    expect(draft).toMatchObject({ status: "dropped", summary: null });

    const sent = await sendHandoff({ customerId: "jane", chatId, summary: "My jar arrived cracked, I would like a person to look." }, sendDeps());
    const [row] = await db.select().from(assistantHandoffs);
    expect(row).toMatchObject({ status: "sent", sentSource: "customer", sentSummary: "My jar arrived cracked, I would like a person to look.", ticketId: sent.ticketId });
  });

  test("a promise or an unavailable model also drops the summary; nothing is sent to the team either way", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    const promised = await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("We will refund you in full.")));
    expect(promised.status).toBe("dropped");

    const otherId = await handedOffChat(id, "I want a refund, this is a second chat");
    const down = await prepareHandoff({ customerId: "jane", chatId: otherId }, handoffDeps(model(new Error("down"))));
    expect(down.status).toBe("dropped");
    expect(await db.select().from(tickets)).toHaveLength(0);
  });

  test("a dropped summary cannot be sent without the Customer's own words", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model(new Error("down"))));

    await expect(sendHandoff({ customerId: "jane", chatId }, sendDeps())).rejects.toThrow(HandoffError);
    expect(await db.select().from(tickets)).toHaveLength(0);
  });

  test("another Customer's chat is not found, and a chat about another Customer's Order never links it", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    await expect(prepareHandoff({ customerId: "john", chatId }, handoffDeps(model("x")))).rejects.toThrow("Chat was not found.");
    await expect(sendHandoff({ customerId: "john", chatId }, sendDeps())).rejects.toThrow(HandoffError);
  });

  test("asking again with no new message reuses the summary and makes no new model call", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    const complete = model("The customer asked for a refund.");
    const first = await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(complete));
    const second = await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(complete));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(second.handoffId).toBe(first.handoffId);
  });
});

describe("Send to our team", () => {
  test("opens a Ticket with the Linked order, why it was handed off and the chat attached", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("The customer asked for a refund on a dispatched order.")));

    const sent = await sendHandoff({ customerId: "jane", chatId }, sendDeps());

    const [ticket] = await db.select().from(tickets);
    expect(ticket).toMatchObject({ id: sent.ticketId, customerId: "jane", orderId: id, status: "open" });
    const [message] = await db.select().from(ticketMessages).where(eq(ticketMessages.ticketId, ticket.id));
    expect(message.body).toContain("refund");
    expect(message.body).toContain("The customer asked for a refund on a dispatched order.");
    const [chat] = await db.select().from(assistantChats).where(eq(assistantChats.id, chatId));
    expect(chat.ticketId).toBe(ticket.id);
    const [handoff] = await db.select().from(assistantHandoffs);
    expect(handoff).toMatchObject({ status: "sent", sentSource: "assistant", reason: "refund", ticketId: ticket.id });
  });

  test("the Handoff summary stays on its own row, apart from the Ticket", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("The customer asked for a refund.")));
    await sendHandoff({ customerId: "jane", chatId }, sendDeps());

    const [ticket] = await db.select().from(tickets);
    expect(Object.keys(ticket)).not.toContain("summary");
    const [handoff] = await db.select().from(assistantHandoffs);
    expect(handoff.sentSummary).toBe("The customer asked for a refund.");
  });

  test("the Customer may edit the summary, and the edit is what is sent", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("The customer asked for a refund.")));

    await sendHandoff({ customerId: "jane", chatId, summary: "Please call about my refund." }, sendDeps());

    const [handoff] = await db.select().from(assistantHandoffs);
    expect(handoff).toMatchObject({ sentSource: "customer", sentSummary: "Please call about my refund." });
    const [message] = await db.select().from(ticketMessages);
    expect(message.body).toContain("Please call about my refund.");
  });

  test("a summary written before the chat moved on cannot be sent", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("The customer asked for a refund.")));
    await answerOrderQuestion({ customerId: "jane", message: "Where is my order?", chatId, pageOrderId: id },
      { orders: createOrderReader(db), products: createProductReader(db), chats: createChatStore(db), complete: model("It is dispatched."), now });

    await expect(sendHandoff({ customerId: "jane", chatId }, sendDeps())).rejects.toThrow("changed");
    expect(await db.select().from(tickets)).toHaveLength(0);
  });

  test("a link the Customer typed is not a record: a summary repeating it is dropped", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id, "Refund please, see https://evil.example/x");
    const draft = await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("The customer shared https://evil.example/x.")));
    expect(draft.status).toBe("dropped");
  });

  test("pressing it twice opens one Ticket", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("The customer asked for a refund.")));

    const results = await Promise.all([sendHandoff({ customerId: "jane", chatId }, sendDeps()), sendHandoff({ customerId: "jane", chatId }, sendDeps())]);

    expect(results[0].ticketId).toBe(results[1].ticketId);
    expect(await db.select().from(tickets)).toHaveLength(1);
  });

  test("a failed Ticket leaves the summary unsent so the Customer can try again", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("The customer asked for a refund.")));
    const failing = { handoffs: createHandoffStore(db), tickets: { ...createTicketStore(db), open: vi.fn().mockRejectedValue(new Error("db down")) } };

    await expect(sendHandoff({ customerId: "jane", chatId }, failing)).rejects.toThrow("db down");
    const [handoff] = await db.select().from(assistantHandoffs);
    expect(handoff.status).toBe("drafted");

    await expect(sendHandoff({ customerId: "jane", chatId }, sendDeps())).resolves.toMatchObject({ ticketId: expect.any(Number) });
  });

  test("a chat with no Order still opens a Ticket without a Linked order", async () => {
    const chatId = await answerOrderQuestion(
      { customerId: "jane", message: "Can I talk to a real person?" },
      { orders: createOrderReader(db), products: createProductReader(db), chats: createChatStore(db), complete: model("unused"), now },
    ).then((reply) => reply.chatId!);
    await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("The customer asked to talk to a person.")));

    await sendHandoff({ customerId: "jane", chatId }, sendDeps());

    const [ticket] = await db.select().from(tickets);
    expect(ticket.orderId).toBeNull();
  });
});

describe("the fact check for a Handoff summary", () => {
  const facts = { text: "Status: dispatched", orderId: 7, status: "dispatched", kind: "handoff" as const };

  test("lets it say what the Customer asked for, and drops anything that promises an outcome", () => {
    expect(factCheck("The customer asked for a refund on order #7, which is dispatched.", facts)).toBeUndefined();
    for (const promised of ["The shop will refund the order.", "It will be refunded in 3 days.", "We can replace the jar.", "The customer is entitled to a discount.", "A teammate will issue a full refund within 3 days."]) {
      expect(factCheck(promised, facts), promised).toBeDefined();
    }
  });

  test("still rejects a wrong status, another Order and a made-up date", () => {
    expect(factCheck("The order is delivered.", facts)).toContain("wrong status");
    expect(factCheck("The customer asked about order #9.", facts)).toContain("another order");
    expect(factCheck("It was dispatched on Nov 3, 2026.", facts)).toContain("not in the records");
  });

  test("a summary uses the shared daily model budget", async () => {
    const id = await order("jane");
    const chatId = await handedOffChat(id);
    await prepareHandoff({ customerId: "jane", chatId }, handoffDeps(model("The customer asked for a refund.")));
    expect(await createChatStore(db).modelCallsSince(new Date("2026-11-16T00:00:00Z"))).toBe(1);
  });
});
