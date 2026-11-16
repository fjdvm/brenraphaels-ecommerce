import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { assistantChats, assistantMessages } from "../db/schema";
import { chatRetentionDays } from "./policy";

export type StoredTurn = {
  sender: "customer" | "assistant";
  body: string;
  outcome?: "answered" | "handoff" | "fallback" | "pick_order" | null;
  reason?: string | null;
  orderId?: number | null;
  sentToModel?: string | null;
};

export type ChatStore = {
  /** The chat if it is this Customer's; otherwise a new one. A chat that is not theirs is never revealed. */
  chatFor(customerId: string, chatId?: number): Promise<number>;
  recentTurns(chatId: number, limit: number): Promise<{ sender: "customer" | "assistant"; body: string }[]>;
  messagesSentSince(customerId: string, since: Date): Promise<number>;
  modelCallsSince(since: Date): Promise<number>;
  save(chatId: number, turns: StoredTurn[]): Promise<void>;
  /** Deletes chats older than the retention that are not attached to a Ticket; returns how many. */
  deleteExpired(now: Date): Promise<number>;
};

/** Start of the shop's day (Manila, UTC+8, no daylight saving) that contains `now`. */
export function startOfShopDay(now: Date): Date {
  const offset = 8 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

export function createChatStore<R extends PgQueryResultHKT, S extends Record<string, unknown>>(db: PgDatabase<R, S>): ChatStore {
  return {
    async chatFor(customerId, chatId) {
      if (chatId !== undefined) {
        const [existing] = await db.select({ id: assistantChats.id }).from(assistantChats)
          .where(and(eq(assistantChats.id, chatId), eq(assistantChats.customerId, customerId)));
        if (existing) return existing.id;
      }
      const [created] = await db.insert(assistantChats).values({ customerId }).returning({ id: assistantChats.id });
      return created.id;
    },
    async recentTurns(chatId, limit) {
      const rows = await db.select({ sender: assistantMessages.sender, body: assistantMessages.body, id: assistantMessages.id })
        .from(assistantMessages).where(eq(assistantMessages.chatId, chatId)).orderBy(desc(assistantMessages.id)).limit(limit);
      return rows.reverse().map((row) => ({ sender: row.sender === "customer" ? "customer" : "assistant", body: row.body }));
    },
    async messagesSentSince(customerId, since) {
      const [row] = await db.select({ total: count() }).from(assistantMessages)
        .innerJoin(assistantChats, eq(assistantChats.id, assistantMessages.chatId))
        .where(and(eq(assistantChats.customerId, customerId), eq(assistantMessages.sender, "customer"), gte(assistantMessages.createdAt, since)));
      return row.total;
    },
    async modelCallsSince(since) {
      const [row] = await db.select({ total: count() }).from(assistantMessages)
        .where(and(isNotNull(assistantMessages.sentToModel), gte(assistantMessages.createdAt, since)));
      return row.total;
    },
    async save(chatId, turns) {
      if (turns.length === 0) return;
      // One insert per turn keeps the customer's message ahead of the reply in id order.
      for (const turn of turns) {
        await db.insert(assistantMessages).values({
          chatId, sender: turn.sender, body: turn.body, outcome: turn.outcome ?? null, reason: turn.reason ?? null,
          orderId: turn.orderId ?? null, sentToModel: turn.sentToModel ?? null,
        });
      }
    },
    async deleteExpired(now) {
      const cutoff = new Date(now.getTime() - chatRetentionDays * 24 * 60 * 60 * 1000);
      const expired = await db.select({ id: assistantChats.id }).from(assistantChats)
        .where(and(isNull(assistantChats.ticketId), lt(assistantChats.createdAt, cutoff)));
      if (expired.length === 0) return 0;
      await db.delete(assistantChats).where(inArray(assistantChats.id, expired.map((chat) => chat.id)));
      return expired.length;
    },
  };
}

