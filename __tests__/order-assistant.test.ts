import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { answerOrderQuestion, type AssistantDependencies } from "../lib/assistant/answer";
import { factCheck } from "../lib/assistant/fact-check";
import { createChatStore } from "../lib/assistant/chat-store";
import { cleanModelText, createCompleter, ModelUnavailableError, type Completer } from "../lib/assistant/model";
import { chatRetentionDays, dailyMessageCap, maxMessageLength } from "../lib/assistant/policy";
import { createOrderReader, createProductReader } from "../lib/assistant/readers";
import { assistantChats, assistantMessages, customers, orders, products, tickets } from "../lib/db/schema";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
let db: ReturnType<typeof drizzle>;

const person = (id: string, first: string) => ({
  id, firstName: first, lastName: "Cruz", fullName: `${first} Cruz`, email: `${id}@example.com`, contactNumber: "09171234567", marketingOptIn: false,
});

async function order(customerId: string, values: Partial<typeof orders.$inferInsert> = {}) {
  const [row] = await db.insert(orders).values({
    customerId, fulfillmentMethod: "delivery", paymentMethod: "cash-on-delivery", status: "confirmed", subtotalInCentavos: 123_400, deliveryFeeInCentavos: 15_000, ...values,
  }).returning({ id: orders.id });
  return row.id;
}

/** A fake model that records every call and says what it is told to. */
function fakeModel(reply: string | Error = "Your order is confirmed.") {
  const complete = vi.fn<Completer>(async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return complete;
}

function deps(complete: Completer, now = new Date("2026-11-17T06:00:00Z")): AssistantDependencies {
  return { orders: createOrderReader(db), products: createProductReader(db), chats: createChatStore(db), complete, now };
}

beforeEach(async () => {
  client = await createTestDatabase();
  db = drizzle(client);
  await db.insert(customers).values([person("jane", "Jane"), person("john", "John")]);
});

afterEach(async () => {
  await client.close();
});

describe("Order choice", () => {
  test("another Customer's Order never reaches the model and looks like a missing one", async () => {
    const theirs = await order("john", { courier: "Lalamove", courierTrackingUrl: "https://track.example/secret" });
    const complete = fakeModel();

    const foreign = await answerOrderQuestion({ customerId: "jane", message: `Where is order #${theirs}?` }, deps(complete));
    const missing = await answerOrderQuestion({ customerId: "jane", message: "Where is order #999999?" }, deps(complete));

    expect(complete).not.toHaveBeenCalled();
    expect(foreign).toMatchObject({ outcome: "handoff", reason: "no_matching_order", ticketButton: true });
    expect({ ...foreign, chatId: 0 }).toEqual({ ...missing, chatId: 0 });
    expect(JSON.stringify(foreign)).not.toContain("secret");
  });

  test("a page or picker id that is not theirs also looks missing, and is never stored as looked up", async () => {
    const theirs = await order("john");
    const reply = await answerOrderQuestion({ customerId: "jane", message: "Where is my order?", pageOrderId: theirs }, deps(fakeModel()));
    expect(reply).toMatchObject({ outcome: "handoff", reason: "no_matching_order" });
    const stored = await db.select().from(assistantMessages);
    expect(stored.every((row) => row.orderId === null)).toBe(true);
  });

  test("with several Orders and no choice, it offers a picker of the Customer's own and never guesses", async () => {
    const first = await order("jane");
    const second = await order("jane");
    await order("john");
    const complete = fakeModel();
    const reply = await answerOrderQuestion({ customerId: "jane", message: "Where is my order?" }, deps(complete));
    expect(reply.outcome).toBe("pick_order");
    expect(reply.choices?.map((choice) => choice.id).sort()).toEqual([first, second].sort());
    expect(complete).not.toHaveBeenCalled();
  });

  test("the Order page, the picker and a typed number each choose the Order", async () => {
    const first = await order("jane");
    const second = await order("jane", { status: "paid" });
    const complete = fakeModel("Your order is confirmed.");
    await answerOrderQuestion({ customerId: "jane", message: "Where is my order?", pageOrderId: first }, deps(complete));
    expect(complete.mock.calls[0][0].at(-1)?.content).toContain(`Order: #${first}`);
    await answerOrderQuestion({ customerId: "jane", message: "Where is my order?", pickedOrderId: second }, deps(complete));
    expect(complete.mock.calls[1][0].at(-1)?.content).toContain(`Order: #${second}`);
    await answerOrderQuestion({ customerId: "jane", message: `status of order ${first}?`, pageOrderId: second }, deps(complete));
    expect(complete.mock.calls[2][0].at(-1)?.content).toContain(`Order: #${first}`);
  });

  test("a Customer with no Orders gets the no matching Order handoff", async () => {
    const reply = await answerOrderQuestion({ customerId: "jane", message: "Where is my order?" }, deps(fakeModel()));
    expect(reply).toMatchObject({ outcome: "handoff", reason: "no_matching_order" });
  });
});

describe("what the model sees", () => {
  test("only status words, dates and the courier link: no name, address, phone, email or amounts", async () => {
    const id = await order("jane", { status: "dispatched", courier: "Lalamove", courierTrackingUrl: "https://track.example/abc", riderName: "Rider Santos", riderPhone: "09998887777" });
    const complete = fakeModel("Your order is dispatched. Track it at https://track.example/abc");
    await answerOrderQuestion({ customerId: "jane", message: "Where is my order? my number is 09171234567 or jane@example.com", pageOrderId: id }, deps(complete));
    const sent = JSON.stringify(complete.mock.calls[0][0]);
    expect(sent).toContain("https://track.example/abc");
    for (const secret of ["Jane", "Cruz", "09171234567", "jane@example.com", "Rider Santos", "09998887777", "1234", "150", "123,400"]) {
      expect(sent).not.toContain(secret);
    }
    const [stored] = await db.select().from(assistantMessages).where(eq(assistantMessages.sender, "assistant"));
    expect(stored.sentToModel).toBe(sent);
    expect(stored.orderId).toBe(id);
  });

  test("earlier turns of the chat go along, masked", async () => {
    const id = await order("jane");
    const complete = fakeModel("Your order is confirmed.");
    const first = await answerOrderQuestion({ customerId: "jane", message: "Where is my order? call 09171234567", pageOrderId: id }, deps(complete));
    await answerOrderQuestion({ customerId: "jane", chatId: first.chatId, message: "and the payment?", pageOrderId: id }, deps(complete));
    const sent = JSON.stringify(complete.mock.calls[1][0]);
    expect(sent).toContain("Where is my order?");
    expect(sent).toContain("[phone]");
    expect(sent).not.toContain("09171234567");
  });
});

describe("always hand off", () => {
  test.each([
    ["damaged_or_spoiled", "The jar I received is damaged"],
    ["damaged_or_spoiled", "Sira yung halaya, panis na"],
    ["wrong_item", "You sent the wrong item"],
    ["refund", "I want a refund for order 1"],
    ["discount", "Do you have a discount code?"],
    ["replacement", "Please send a replacement"],
    ["food_safety", "I think I got food poisoning, nagka-diarrhea ako"],
    ["food_safety", "Is it safe to eat if I have an allergy?"],
    ["person_requested", "I want to talk to a person"],
    ["person_requested", "Gusto ko makausap ang tao"],
    ["upset", "This is unacceptable, I'm so angry"],
  ] as const)("%s: %s", async (reason, message) => {
    const id = await order("jane");
    const complete = fakeModel();
    const reply = await answerOrderQuestion({ customerId: "jane", message, pageOrderId: id }, deps(complete));
    expect(reply).toMatchObject({ outcome: "handoff", reason, ticketButton: true });
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("small talk and off-topic messages", () => {
  test("a greeting or off-topic message goes to the model with no records, and its reply is shown without a card", async () => {
    const complete = fakeModel("Hi! I can only help with Bren Raphael's orders and shop questions.");
    const reply = await answerOrderQuestion({ customerId: "jane", message: "What is the capital of France?" }, deps(complete));
    expect(reply).toMatchObject({ outcome: "answered", ticketButton: false, text: "Hi! I can only help with Bren Raphael's orders and shop questions." });
    expect(reply.card).toBeUndefined();
    expect(complete).toHaveBeenCalledOnce();
    expect(JSON.stringify(complete.mock.calls[0][0])).toContain("No order or shop records are attached");
  });

  test("small talk cannot state an order, date, amount or promise", async () => {
    const reply = await answerOrderQuestion({ customerId: "jane", message: "hello!" }, deps(fakeModel("Your order #5 arrives Dec 25, 2026.")));
    expect(reply).toMatchObject({ outcome: "fallback", reason: "fact_check_failed", ticketButton: true });
  });
});

describe("how to pay", () => {
  test.each(["how do i pay with gcash?", "Paano magbayad?", "what payment methods do you accept?", "do you accept GCash?"])("%s is a shop question, not an Order picker", async (message) => {
    await order("jane");
    await order("jane");
    const reply = await answerOrderQuestion({ customerId: "jane", message }, deps(fakeModel("You can pay with GCash or cash on delivery.")));
    expect(reply).toMatchObject({ outcome: "answered", ticketButton: false });
    expect(reply.choices).toBeUndefined();
    expect(reply.card?.title).toBe("Shop information");
  });

  test("with an Order number it is still that Order's payment", async () => {
    const id = await order("jane");
    const reply = await answerOrderQuestion({ customerId: "jane", message: `how do i pay for order #${id}?` }, deps(fakeModel("Your order is confirmed.")));
    expect(reply.card?.title).toBe(`Order #${id}`);
  });
});

describe("cleanModelText", () => {
  test("turns no-break spaces into plain spaces and drops zero-width characters", () => {
    expect(cleanModelText("10:19\u202fAM\u00a0today\u200b!")).toBe("10:19 AM today!");
  });
  test("the completer returns cleaned text", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "At 3:45\u202fPM" } }] }));
    const complete = createCompleter({ ASSISTANT_GROQ_API_KEY: "g" }, fetcher as unknown as typeof fetch);
    await expect(complete([{ role: "user", content: "hi" }])).resolves.toBe("At 3:45 PM");
  });
});

describe("fact check spacing", () => {
  const facts = "Order #5\nStatus: confirmed\nPlaced: Nov 10, 2026, 3:45 PM";
  test.each([
    ["a narrow no-break space in the answer", "It was placed on Nov 10, 2026, 3:45\u202fPM."],
    ["a no-break space in the answer", "It was placed on Nov 10, 2026, 3:45\u00a0PM."],
  ])("accepts %s", (_name, answer) => {
    expect(factCheck(answer, { text: facts, orderId: 5, status: "confirmed" })).toBeUndefined();
  });
  test("accepts a narrow no-break space in the records", () => {
    expect(factCheck("It was placed on Nov 10, 2026, 3:45 PM.", { text: facts.replace("3:45 PM", "3:45\u202fPM"), orderId: 5, status: "confirmed" })).toBeUndefined();
  });
  test("'was placed on <date>' says when it was placed, not that its status is placed", () => {
    expect(factCheck("It was placed on Nov 10, 2026, 3:45 PM.", { text: facts, orderId: 5, status: "confirmed" })).toBeUndefined();
    expect(factCheck("It was paid by GCash.", { text: facts, orderId: 5, status: "confirmed" })).toBeUndefined();
  });
  test("still rejects a different status", () => {
    expect(factCheck("Your order is delivered.", { text: facts, orderId: 5, status: "confirmed" })).toMatch(/wrong status/);
  });
  test("still rejects a time that is not in the records", () => {
    expect(factCheck("It was placed at 4:10 PM.", { text: facts, orderId: 5, status: "confirmed" })).toMatch(/not in the records/);
  });
});

describe("fact check", () => {
  const wrongAnswers = [
    "Your order was delivered yesterday.",
    "It is on its way, track at https://evil.example/phish",
    "Your order will arrive on Dec 25, 2026.",
    "We will refund you right away.",
    "Order #999 is confirmed.",
    "Your order is confirmed and costs ₱5,000.",
  ];
  test.each(wrongAnswers)("falls back to the Order card and the Ticket button: %s", async (answer) => {
    const id = await order("jane");
    const reply = await answerOrderQuestion({ customerId: "jane", message: "Where is my order?", pageOrderId: id }, deps(fakeModel(answer)));
    expect(reply).toMatchObject({ outcome: "fallback", reason: "fact_check_failed", ticketButton: true });
    expect(reply.text).not.toContain("evil.example");
    expect(reply.card?.lines).toContainEqual({ label: "Status", value: "confirmed" });
  });

  test("an answer that matches the records goes through, with the card beside it", async () => {
    const id = await order("jane", { status: "dispatched", courier: "Grab", courierTrackingUrl: "https://track.example/x" });
    const reply = await answerOrderQuestion({ customerId: "jane", message: "Where is my order?", pageOrderId: id }, deps(fakeModel("Po, it's dispatched with Grab: https://track.example/x")));
    expect(reply).toMatchObject({ outcome: "answered", ticketButton: false });
    expect(reply.card?.lines).toContainEqual({ label: "Tracking link", value: "https://track.example/x" });
  });
});

describe("shop questions", () => {
  test("the Delivery fee is a range with 'a teammate confirms', and the model cannot state another amount", async () => {
    const complete = fakeModel("It is usually between ₱100 and ₱300. A teammate confirms the fee.");
    const reply = await answerOrderQuestion({ customerId: "jane", message: "How much is the delivery fee?" }, deps(complete));
    expect(reply.outcome).toBe("answered");
    expect(reply.card?.lines[0].value).toMatch(/between ₱100 and ₱300.*teammate confirms/i);

    const wrong = await answerOrderQuestion({ customerId: "jane", message: "How much is the delivery fee?" }, deps(fakeModel("It is ₱80.")));
    expect(wrong).toMatchObject({ outcome: "fallback", reason: "fact_check_failed" });
  });

  test("product answers come only from listed fields, otherwise 'I don't know'", async () => {
    await db.insert(products).values({
      slug: "ube-halaya", name: "Ube Halaya",
      description: "Smooth ube.\n\nIngredients\n\n• Purple yam\n• Milk\n\nStorage & Shelf Life\n\n• Keep refrigerated\n\nShelf Life:\n\n• 14 days",
    });
    const complete = fakeModel();
    const listed = await answerOrderQuestion({ customerId: "jane", message: "What are the ingredients of Ube Halaya?" }, deps(complete));
    expect(listed.text).toContain("Purple yam");
    const shelf = await answerOrderQuestion({ customerId: "jane", message: "How long does Ube Halaya keep?" }, deps(complete));
    expect(shelf.text).toContain("14 days");
    const unlisted = await answerOrderQuestion({ customerId: "jane", message: "What is the calorie content of the ingredients of Mystery Jam?" }, deps(complete));
    expect(unlisted).toMatchObject({ outcome: "answered", reason: "unknown_detail", ticketButton: true });
    expect(unlisted.text).toMatch(/don't know/i);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("limits and outages", () => {
  test("a message over the maximum length is rejected without a model call or a stored chat", async () => {
    const complete = fakeModel();
    const reply = await answerOrderQuestion({ customerId: "jane", message: "x".repeat(maxMessageLength + 1) }, deps(complete));
    expect(reply.outcome).toBe("rejected");
    expect(complete).not.toHaveBeenCalled();
    expect(await db.select().from(assistantChats)).toHaveLength(0);
  });

  test("at the daily cap the Customer gets the card and the Ticket button, and the model is not called", async () => {
    const id = await order("jane");
    const complete = fakeModel();
    const [chat] = await db.insert(assistantChats).values({ customerId: "jane", createdAt: new Date("2026-11-17T01:00:00Z") }).returning();
    await db.insert(assistantMessages).values(Array.from({ length: dailyMessageCap }, () => ({
      chatId: chat.id, sender: "customer", body: "hi", createdAt: new Date("2026-11-17T01:00:00Z"),
    })));
    const reply = await answerOrderQuestion({ customerId: "jane", message: "Where is my order?", pageOrderId: id }, deps(complete));
    expect(reply).toMatchObject({ outcome: "fallback", reason: "daily_cap", ticketButton: true });
    expect(reply.card?.title).toBe(`Order #${id}`);
    expect(complete).not.toHaveBeenCalled();
    // The cap is per Customer: another Customer is unaffected.
    const other = await order("john");
    expect((await answerOrderQuestion({ customerId: "john", message: "Where is my order?", pageOrderId: other }, deps(complete))).outcome).toBe("answered");
  });

  test("yesterday's messages do not count toward today's cap", async () => {
    const id = await order("jane");
    const [chat] = await db.insert(assistantChats).values({ customerId: "jane" }).returning();
    await db.insert(assistantMessages).values(Array.from({ length: dailyMessageCap }, () => ({
      chatId: chat.id, sender: "customer", body: "hi", createdAt: new Date("2026-11-15T01:00:00Z"),
    })));
    const reply = await answerOrderQuestion({ customerId: "jane", message: "Where is my order?", pageOrderId: id }, deps(fakeModel()));
    expect(reply.outcome).toBe("answered");
  });

  test("when the models are down the Customer gets the card and the Ticket button, and nothing is recorded as sent", async () => {
    const id = await order("jane");
    const reply = await answerOrderQuestion({ customerId: "jane", message: "Where is my order?", pageOrderId: id }, deps(fakeModel(new ModelUnavailableError("down"))));
    expect(reply).toMatchObject({ outcome: "fallback", reason: "model_unavailable", ticketButton: true });
    expect(reply.card?.title).toBe(`Order #${id}`);
    const stored = await db.select().from(assistantMessages).where(eq(assistantMessages.sender, "assistant"));
    expect(stored[0].sentToModel).toBeNull();
  });

  test("the model has its own keys: Staff keys do nothing, and with none it is unavailable", async () => {
    const fetcher = vi.fn();
    const complete = createCompleter({ GROQ_API_KEY: "staff-key", GEMINI_API_KEY: "staff-key" }, fetcher as unknown as typeof fetch);
    await expect(complete([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(ModelUnavailableError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("Groq answers first, Gemini is the fallback", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("no", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ candidates: [{ content: { parts: [{ text: "From Gemini" }] } }] }));
    const complete = createCompleter({ ASSISTANT_GROQ_API_KEY: "g", ASSISTANT_GEMINI_API_KEY: "m" }, fetcher as unknown as typeof fetch);
    await expect(complete([{ role: "system", content: "s" }, { role: "user", content: "hi" }])).resolves.toBe("From Gemini");
    expect(String(fetcher.mock.calls[0][0])).toContain("groq.com");
    expect(String(fetcher.mock.calls[1][0])).toContain("generativelanguage.googleapis.com");
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("?key=");
  });
});

describe("stored chats and retention", () => {
  test("every chat keeps the Customer, the Order looked up and what was sent", async () => {
    const id = await order("jane");
    const reply = await answerOrderQuestion({ customerId: "jane", message: "Where is my order?", pageOrderId: id }, deps(fakeModel()));
    const [chat] = await db.select().from(assistantChats);
    expect(chat).toMatchObject({ id: reply.chatId, customerId: "jane" });
    const turns = await db.select().from(assistantMessages).orderBy(assistantMessages.id);
    expect(turns.map((turn) => turn.sender)).toEqual(["customer", "assistant"]);
    expect(turns[1]).toMatchObject({ orderId: id, outcome: "answered" });
    expect(turns[1].sentToModel).toContain("FACTS:");
  });

  test("a chat id that is another Customer's starts a new chat", async () => {
    const [theirs] = await db.insert(assistantChats).values({ customerId: "john" }).returning();
    const reply = await answerOrderQuestion({ customerId: "jane", chatId: theirs.id, message: "Where is my order?" }, deps(fakeModel()));
    expect(reply.chatId).not.toBe(theirs.id);
    expect(await db.select().from(assistantMessages).where(eq(assistantMessages.chatId, theirs.id))).toHaveLength(0);
  });

  test("chats past the retention are deleted, unless attached to a Ticket", async () => {
    const now = new Date("2026-11-17T06:00:00Z");
    const old = new Date(now.getTime() - (chatRetentionDays + 1) * 86_400_000);
    const recent = new Date(now.getTime() - (chatRetentionDays - 1) * 86_400_000);
    const [ticket] = await db.insert(tickets).values({ customerId: "jane", subject: "Help", category: "Other" }).returning();
    const [expired, kept, attached, fresh] = await db.insert(assistantChats).values([
      { customerId: "jane", createdAt: old }, { customerId: "jane", createdAt: old, ticketId: ticket.id }, { customerId: "john", createdAt: old, ticketId: ticket.id }, { customerId: "jane", createdAt: recent },
    ]).returning();
    await db.insert(assistantMessages).values([{ chatId: expired.id, sender: "customer", body: "hi" }, { chatId: kept.id, sender: "customer", body: "hi" }]);

    expect(await createChatStore(db).deleteExpired(now)).toBe(1);
    const left = (await db.select().from(assistantChats)).map((chat) => chat.id).sort();
    expect(left).toEqual([kept.id, attached.id, fresh.id].sort());
    expect(await db.select().from(assistantMessages).where(eq(assistantMessages.chatId, expired.id))).toHaveLength(0);
  });
});

describe("it cannot change anything", () => {
  test("the assistant's code never touches an Order, Ticket or payment write path", () => {
    const directory = join(__dirname, "../lib/assistant");
    for (const file of readdirSync(directory)) {
      const source = readFileSync(join(directory, file), "utf8");
      expect(source, file).not.toMatch(/from "\.\.\/orders\/|from "\.\.\/support\/|from "\.\.\/returns\//);
      expect(source, file).not.toMatch(/\.(update|delete)\(\s*(orders|tickets|ticketMessages|orderPaymentProofs|orderReturns)\b/);
      expect(source, file).not.toMatch(/\.insert\(\s*(orders|tickets|ticketMessages|orderPaymentProofs|orderReturns)\b/);
    }
  });

  test("answering leaves every Order exactly as it was", async () => {
    const id = await order("jane");
    const before = await db.select().from(orders).where(eq(orders.id, id));
    for (const message of ["Where is my order?", "Cancel my order", "I want a refund", "Mark it as paid"]) {
      await answerOrderQuestion({ customerId: "jane", message, pageOrderId: id }, deps(fakeModel()));
    }
    expect(await db.select().from(orders).where(eq(orders.id, id))).toEqual(before);
  });
});
