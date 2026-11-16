import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { assistantChats, assistantHandoffs } from "../db/schema";

/** What the Ticket page shows under "Summary from the order assistant". */
export type TicketAssistantSummary = {
  lines: string[];
  /** `assistant`: the assistant's words, approved by the Customer. `customer`: the Customer's own words. */
  source: "assistant" | "customer";
};

/** Splits a summary into short lines: its own lines first, else its sentences. */
export function summaryLines(summary: string): string[] {
  const own = summary.split(/\r?\n/).map((line) => line.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  const lines = own.length > 1 ? own : (own[0] ?? "").split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  return lines.slice(0, 8);
}

/** The text the Customer sent with their own Ticket, or undefined when the Ticket did not come from the assistant. */
export async function ticketAssistantSummary<R extends PgQueryResultHKT, S extends Record<string, unknown>>(
  db: PgDatabase<R, S>,
  customerId: string,
  ticketId: number,
): Promise<TicketAssistantSummary | undefined> {
  const [row] = await db.select({ sentSummary: assistantHandoffs.sentSummary, sentSource: assistantHandoffs.sentSource })
    .from(assistantHandoffs)
    .innerJoin(assistantChats, eq(assistantChats.id, assistantHandoffs.chatId))
    .where(and(eq(assistantHandoffs.ticketId, ticketId), eq(assistantChats.customerId, customerId)));
  if (!row?.sentSummary) return undefined;
  const lines = summaryLines(row.sentSummary);
  if (lines.length === 0) return undefined;
  return { lines, source: row.sentSource === "customer" ? "customer" : "assistant" };
}
