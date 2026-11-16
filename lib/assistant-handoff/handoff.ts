import { and, asc, eq, ne } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { assistantChats, assistantHandoffs, assistantMessages } from "../db/schema";
import { ticketMessageInput } from "../support/ticket-message";
import type { TicketCategory, TicketStore } from "../support/tickets";
import { startOfShopDay, type ChatStore } from "../assistant/chat-store";
import { factCheck } from "../assistant/fact-check";
import { orderFactsText } from "../assistant/facts";
import { dailyModelBudget, maskContact, type HandoffReason } from "../assistant/policy";
import type { Completer, ModelMessage } from "../assistant/model";
import type { OrderReader } from "../assistant/readers";

export class HandoffError extends Error {}

/** How many of the latest chat turns the Handoff summary reads. */
const unwritten = "We could not write a summary just now. Write a few words for our team instead.";
const summaryTurns = 20;
/** The longest summary the Customer may send, in characters. */
export const maxSummaryLength = 1_000;

export type HandoffDraft = {
  handoffId: number;
  /** `drafted`: shown, waiting for the Customer. `dropped`: no summary could be trusted, the Customer writes their own. `sent`: a Ticket exists. */
  status: "drafted" | "dropped" | "sent";
  summary: string | null;
  reason: string;
  orderId: number | null;
  ticketId: number | null;
  /** A plain note for the Customer when the summary was dropped. */
  note?: string;
};

type HandoffRow = typeof assistantHandoffs.$inferSelect;

export type HandoffStore = {
  /** The Customer's own chat and its turns; undefined when the chat is not theirs. */
  chatTurns(customerId: string, chatId: number): Promise<{ id: number; sender: string; body: string; outcome: string | null; reason: string | null; orderId: number | null }[] | undefined>;
  forChat(chatId: number): Promise<HandoffRow | undefined>;
  /** One summary per chat: replaces an unsent one. */
  save(values: Omit<typeof assistantHandoffs.$inferInsert, "id" | "createdAt">): Promise<HandoffRow>;
  /** Marks it sent only if it was not already; undefined when another press got there first. */
  claim(handoffId: number, sentSummary: string, sentSource: "assistant" | "customer", sentAt: Date): Promise<HandoffRow | undefined>;
  release(handoffId: number, status: "drafted" | "dropped"): Promise<void>;
  attach(handoffId: number, chatId: number, ticketId: number): Promise<void>;
};

export function createHandoffStore<R extends PgQueryResultHKT, S extends Record<string, unknown>>(db: PgDatabase<R, S>): HandoffStore {
  return {
    async chatTurns(customerId, chatId) {
      const [chat] = await db.select({ id: assistantChats.id }).from(assistantChats)
        .where(and(eq(assistantChats.id, chatId), eq(assistantChats.customerId, customerId)));
      if (!chat) return undefined;
      return db.select({
        id: assistantMessages.id, sender: assistantMessages.sender, body: assistantMessages.body,
        outcome: assistantMessages.outcome, reason: assistantMessages.reason, orderId: assistantMessages.orderId,
      }).from(assistantMessages).where(eq(assistantMessages.chatId, chatId)).orderBy(asc(assistantMessages.id));
    },
    async forChat(chatId) {
      const [row] = await db.select().from(assistantHandoffs).where(eq(assistantHandoffs.chatId, chatId));
      return row;
    },
    async save(values) {
      const [row] = await db.insert(assistantHandoffs).values(values).onConflictDoUpdate({
        target: assistantHandoffs.chatId,
        set: {
          orderId: values.orderId, reason: values.reason, status: values.status, summary: values.summary,
          sentToModel: values.sentToModel, throughMessageId: values.throughMessageId,
        },
        setWhere: ne(assistantHandoffs.status, "sent"),
      }).returning();
      // A conflict on a sent summary updates nothing and returns no row: hand back the sent one.
      if (row) return row;
      const [sent] = await db.select().from(assistantHandoffs).where(eq(assistantHandoffs.chatId, values.chatId));
      return sent;
    },
    async claim(handoffId, sentSummary, sentSource, sentAt) {
      const [row] = await db.update(assistantHandoffs).set({ status: "sent", sentSummary, sentSource, sentAt })
        .where(and(eq(assistantHandoffs.id, handoffId), ne(assistantHandoffs.status, "sent"))).returning();
      return row;
    },
    async release(handoffId, status) {
      await db.update(assistantHandoffs).set({ status, sentSummary: null, sentSource: null, sentAt: null }).where(eq(assistantHandoffs.id, handoffId));
    },
    async attach(handoffId, chatId, ticketId) {
      await db.transaction(async (tx) => {
        await tx.update(assistantHandoffs).set({ ticketId }).where(eq(assistantHandoffs.id, handoffId));
        await tx.update(assistantChats).set({ ticketId }).where(eq(assistantChats.id, chatId));
      });
    },
  };
}

const reasonWords: Record<string, string> = {
  damaged_or_spoiled: "a damaged or spoiled item",
  wrong_item: "a wrong or missing item",
  refund: "a refund request",
  discount: "a discount request",
  replacement: "a replacement request",
  food_safety: "a food safety worry",
  person_requested: "the Customer asked for a person",
  upset: "the Customer is upset",
  outside_scope: "a question the assistant does not answer",
  no_matching_order: "no matching Order was found",
  fact_check_failed: "the assistant could not check its answer",
  daily_cap: "the Customer reached the daily message limit",
  model_unavailable: "the assistant was unavailable",
  model_budget: "the assistant was unavailable",
  unknown_detail: "a product detail that is not listed",
};

export function reasonLabel(reason: string): string {
  return reasonWords[reason] ?? "the Customer asked for a person";
}

const categoryFor: Partial<Record<HandoffReason | string, TicketCategory>> = {
  damaged_or_spoiled: "Order Issue", wrong_item: "Order Issue", refund: "Order Issue", replacement: "Order Issue", food_safety: "Order Issue",
  unknown_detail: "Product Question", discount: "Other", no_matching_order: "Other",
};

const handoffPrompt = [
  "You write a short handoff note for the shop team from a customer's chat with the order assistant.",
  "Use third person (\"The customer ...\"), at most four sentences, facts only, in English.",
  "Use ONLY the chat and the FACTS block. Copy dates and links exactly as written there.",
  "Never mention amounts of money, never promise or suggest refunds, discounts, replacements or delivery times, never guess.",
].join(" ");

/** The reason the chat was handed off: the latest assistant turn that handed off or fell back, else the Customer asked for a person. */
function handoffReasonOf(turns: { sender: string; outcome: string | null; reason: string | null }[]): string {
  for (const turn of [...turns].reverse()) {
    if (turn.sender === "assistant" && turn.reason && (turn.outcome === "handoff" || turn.outcome === "fallback" || turn.reason === "unknown_detail")) return turn.reason;
  }
  return "person_requested";
}

type PrepareDependencies = {
  orders: OrderReader;
  chats: ChatStore;
  handoffs: HandoffStore;
  complete: Completer;
  now?: Date;
};

/**
 * Writes the Handoff summary for the Customer's own chat and stores it. Nothing is sent to the team: a Ticket is opened only by
 * `sendHandoff`, after the Customer approves. A summary the model cannot write, or that fails the same fact check as the
 * assistant's answers, is dropped and the Customer writes their own.
 */
export async function prepareHandoff(input: { customerId: string; chatId: number }, deps: PrepareDependencies): Promise<HandoffDraft> {
  const now = deps.now ?? new Date();
  const turns = await deps.handoffs.chatTurns(input.customerId, input.chatId);
  if (!turns) throw new HandoffError("Chat was not found.");
  if (turns.length === 0) throw new HandoffError("Ask a question first.");
  const throughMessageId = turns[turns.length - 1].id;

  const existing = await deps.handoffs.forChat(input.chatId);
  if (existing && (existing.status === "sent" || existing.throughMessageId === throughMessageId)) return toDraft(existing);

  const reason = handoffReasonOf(turns);
  const looked = [...turns].reverse().find((turn) => turn.orderId !== null)?.orderId ?? undefined;
  // The Linked order must be the Customer's own, whatever the chat records.
  const order = looked === undefined ? undefined : await deps.orders.findOwn(input.customerId, looked);

  const recent = turns.slice(-summaryTurns);
  const transcript = recent.map((turn) => `${turn.sender === "customer" ? "Customer" : "Assistant"}: ${maskContact(turn.body)}`).join("\n");
  // Only what the assistant already said (and our code checked) counts as known; a date or link the Customer typed does not.
  const assistantLines = recent.filter((turn) => turn.sender === "assistant").map((turn) => turn.body).join("\n");
  const facts = [`Handed off because: ${reasonLabel(reason)}.`, order ? orderFactsText(order, now) : "No Order is linked."].join("\n");

  let summary: string | null = null;
  let sentToModel: string | null = null;
  let note: string | undefined;
  if ((await deps.chats.modelCallsSince(startOfShopDay(now))) >= dailyModelBudget) {
    note = unwritten;
  } else {
    const messages: ModelMessage[] = [
      { role: "system", content: handoffPrompt },
      { role: "user", content: `FACTS:\n${facts}\n\nCHAT:\n${transcript}\n\nWrite the handoff note.` },
    ];
    sentToModel = JSON.stringify(messages);
    try {
      const answer = (await deps.complete(messages)).trim();
            const problem = factCheck(answer, { text: `${facts}\n${assistantLines}`, orderId: order?.id, status: order?.status, kind: "handoff" });
      if (problem) note = "The summary did not match your order records, so we dropped it. Write a few words for our team instead.";
      else summary = answer;
    } catch {
      sentToModel = null;
      note = unwritten;
    }
  }

  const row = await deps.handoffs.save({
    chatId: input.chatId, orderId: order?.id ?? null, reason, status: summary ? "drafted" : "dropped", summary, sentToModel, throughMessageId,
  });
  return toDraft(row, note);
}

function toDraft(row: HandoffRow, note?: string): HandoffDraft {
  const dropped = row.status === "dropped";
  return {
    handoffId: row.id, status: row.status as HandoffDraft["status"], summary: row.status === "sent" ? row.sentSummary : row.summary,
    reason: row.reason, orderId: row.orderId, ticketId: row.ticketId,
    note: note ?? (dropped ? "Write a few words for our team." : undefined),
  };
}

/**
 * The Customer pressed "Send to our team". Opens one Ticket with the Order as its Linked order, why it was handed off and
 * the Customer's approved (or own) words, and attaches the chat. Pressing twice opens one Ticket.
 */
export async function sendHandoff(
  input: { customerId: string; chatId: number; summary?: string },
  deps: { handoffs: HandoffStore; tickets: TicketStore; now?: Date },
): Promise<{ ticketId: number }> {
  const turns = await deps.handoffs.chatTurns(input.customerId, input.chatId);
  if (!turns) throw new HandoffError("Chat was not found.");
  const handoff = await deps.handoffs.forChat(input.chatId);
  if (!handoff) throw new HandoffError("Ask for a summary first.");
  if (handoff.status === "sent") return { ticketId: await waitForTicketOf(handoff.id) };

  const written = input.summary?.trim();
  let text: string;
  let source: "assistant" | "customer";
  if (written) {
    const parsed = ticketMessageInput.shape.body.safeParse(written);
    if (!parsed.success || parsed.data.length > maxSummaryLength) throw new HandoffError(`Keep your note under ${maxSummaryLength} characters, without special characters.`);
    text = parsed.data;
    source = text === handoff.summary ? "assistant" : "customer";
  } else if (handoff.status === "drafted" && handoff.summary) {
    if (handoff.throughMessageId !== turns[turns.length - 1].id) throw new HandoffError("Your chat has changed since this summary was written. Ask for a new one.");
    text = handoff.summary;
    source = "assistant";
  } else {
    throw new HandoffError("Write a few words for our team first.");
  }

  const claimed = await deps.handoffs.claim(handoff.id, text, source, deps.now ?? new Date());
  if (!claimed) return { ticketId: await waitForTicketOf(handoff.id) };
  try {
    const ticket = await deps.tickets.open(input.customerId, {
      subject: `From the order assistant: ${reasonLabel(handoff.reason)}`.slice(0, 160),
      category: categoryFor[handoff.reason] ?? (handoff.orderId ? "Order Issue" : "Other"),
      orderId: handoff.orderId ?? undefined,
      body: `Handed off from the order assistant because of ${reasonLabel(handoff.reason)}.\n\n${text}`,
    });
    await deps.handoffs.attach(handoff.id, input.chatId, ticket.id);
    return { ticketId: ticket.id };
  } catch (error) {
    await deps.handoffs.release(handoff.id, handoff.status as "drafted" | "dropped");
    throw error;
  }

  /** The Ticket another press opened; waits briefly for it to be attached. */
  async function waitForTicketOf(handoffId: number): Promise<number> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const row = await deps.handoffs.forChat(input.chatId);
      if (row?.id === handoffId && row.ticketId) return row.ticketId;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new HandoffError("Your note is being sent. Check your support tickets in a moment.");
  }
}
