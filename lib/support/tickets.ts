import { and, asc, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { orders, ticketMessages, tickets } from "../db/schema";
import { multilineTextField, optionalPositiveIntegerField, textField } from "../validators/fields";

export const ticketCategories = [
  "Order Issue",
  "Payment Issue",
  "Delivery Issue",
  "Product Question",
  "Account",
  "Other",
] as const;
export type TicketCategory = (typeof ticketCategories)[number];

const ticketTextPattern = /^[\p{L}\p{M}\p{N}\p{P}\p{S} \t\r\n]+$/u;

/** Validates the Customer-controlled fields accepted when opening a Ticket. */
export const ticketInput = z.object({
  subject: textField("Subject", {
    min: 1,
    max: 160,
    pattern: ticketTextPattern,
    patternMessage: "Enter a subject without invisible characters",
    rejectInvisible: true,
  }),
  category: z.enum(ticketCategories, { error: "Choose a valid category" }),
  orderId: optionalPositiveIntegerField("Order ID"),
  body: multilineTextField("Message", {
    max: 2_000,
    pattern: ticketTextPattern,
    patternMessage: "Enter a message without invisible characters",
  }),
});

export type OpenTicketInput = z.input<typeof ticketInput>;
export type TicketMessage = {
  id: number;
  sender: "customer" | "staff";
  body: string;
  createdAt: Date;
};
export type Ticket = {
  id: number;
  subject: string;
  category: TicketCategory;
  orderId: number | null;
  status: string;
  createdAt: Date;
  messages: TicketMessage[];
};
export type TicketStore = {
  open(customerId: string, input: OpenTicketInput): Promise<Ticket>;
  listForCustomer(customerId: string): Promise<Ticket[]>;
  get(ticketId: number, customerId: string): Promise<Ticket | undefined>;
};

/** Stores and retrieves Tickets only through their owning Customer. */
export function createTicketStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): TicketStore {
  async function messagesForTicket(ticketId: number): Promise<TicketMessage[]> {
    const messages = await db
      .select({
        id: ticketMessages.id,
        sender: ticketMessages.sender,
        body: ticketMessages.body,
        createdAt: ticketMessages.createdAt,
      })
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(asc(ticketMessages.id));
    return messages.map((message) => ({ ...message, sender: message.sender as TicketMessage["sender"] }));
  }

  async function toTicket(row: typeof tickets.$inferSelect): Promise<Ticket> {
    return {
      id: row.id,
      subject: row.subject,
      category: row.category as TicketCategory,
      orderId: row.orderId,
      status: row.status,
      createdAt: row.createdAt,
      messages: await messagesForTicket(row.id),
    };
  }

  async function get(ticketId: number, customerId: string): Promise<Ticket | undefined> {
    const [persistedTicket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.customerId, customerId)));
    return persistedTicket ? toTicket(persistedTicket) : undefined;
  }

  async function listForCustomer(customerId: string): Promise<Ticket[]> {
    const persistedTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.customerId, customerId))
      .orderBy(desc(tickets.createdAt), desc(tickets.id));
    return Promise.all(persistedTickets.map(toTicket));
  }

  async function open(customerId: string, input: OpenTicketInput): Promise<Ticket> {
    const parsed = ticketInput.parse(input);
    if (parsed.orderId !== undefined) {
      const [order] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.id, parsed.orderId), eq(orders.customerId, customerId)));
      if (!order) throw new Error("Order was not found.");
    }
    const [ticket] = await db
      .insert(tickets)
      .values({
        customerId,
        subject: parsed.subject,
        category: parsed.category,
        orderId: parsed.orderId,
        status: "open",
      })
      .returning();
    await db.insert(ticketMessages).values({ ticketId: ticket.id, sender: "customer", body: parsed.body });
    return (await get(ticket.id, customerId))!;
  }

  return { open, listForCustomer, get };
}
