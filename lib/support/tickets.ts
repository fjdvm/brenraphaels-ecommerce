import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { customers, orders, ticketMessages, tickets } from "../db/schema";
import { optionalPositiveIntegerField, textField } from "../validators/fields";
import { ticketMessageInput } from "./ticket-message";

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
  body: ticketMessageInput.shape.body,
});

export type OpenTicketInput = z.input<typeof ticketInput>;
export type TicketMessage = {
  id: number;
  sender: "customer" | "staff";
  body: string;
  attachmentPathname: string | null;
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
export const completedTicketError = "Ticket is completed.";
export type TicketStore = {
  /** `attach` uploads the opening Message's image once the Ticket id exists and returns its Blob pathname. */
  open(customerId: string, input: OpenTicketInput, attach?: (ticketId: number) => Promise<string>): Promise<Ticket>;
  listForCustomer(customerId: string): Promise<Ticket[]>;
  get(ticketId: number, customerId: string): Promise<Ticket | undefined>;
  addMessage(
    ticketId: number,
    customerId: string,
    input: { body: unknown },
    attachmentPathname?: string,
  ): Promise<Ticket>;
  getAttachmentPathname(messageId: number, customerId: string): Promise<string | undefined>;
  /** Completes an Open or Resolved Ticket; Completed is final. */
  complete(ticketId: number, customerId: string): Promise<Ticket>;
  /** Returns a Resolved Ticket to Open because the Customer says it is not fixed. */
  reportNotFixed(ticketId: number, customerId: string): Promise<Ticket>;
  /** Completes every Ticket Resolved at or before `resolvedBefore` and returns each with its Customer's email. */
  autoCompleteResolved(resolvedBefore: Date): Promise<{ ticket: Ticket; recipientEmail: string }[]>;
};

/** How long a Ticket stays Resolved, with no reply from the Customer, before it completes by itself. */
export const autoCompleteAfterDays = 3;

/** What the store announces after persisting; subscribers of the Ticket's channel receive it. */
export type TicketEvent = {
  type: "ticket-opened" | "message-added";
  ticket: Ticket;
  message: TicketMessage;
};
const publishTimeoutMilliseconds = 3_000;
export type TicketPublisher = (event: TicketEvent) => Promise<void>;

export type TicketMailer = {
  send(recipientEmail: string, ticket: Ticket): Promise<void>;
};

/**
 * Opens the Ticket and then notifies the Customer. The Ticket is already
 * persisted by the time the email is sent, so a failed confirmation email must
 * not be reported as a failed Ticket.
 */
export async function openTicketAndNotify(
  customerId: string,
  recipientEmail: string,
  input: OpenTicketInput,
  dependencies: { ticketStore: TicketStore; mailer: TicketMailer },
  attach?: (ticketId: number) => Promise<string>,
): Promise<Ticket> {
  const ticket = await dependencies.ticketStore.open(customerId, input, attach);
  try {
    await dependencies.mailer.send(recipientEmail, ticket);
  } catch (error) {
    console.error("Ticket-created email could not be sent", error);
  }
  return ticket;
}

export type TicketCompletedMailer = {
  send(recipientEmail: string, ticket: Ticket): Promise<void>;
};

/**
 * Completes the Ticket and then thanks the Customer. The thank-you is only sent
 * when this call made the change, and a failed email must not undo the completion.
 */
export async function completeTicketAndNotify(
  ticketId: number,
  customerId: string,
  recipientEmail: string,
  dependencies: { ticketStore: TicketStore; mailer: TicketCompletedMailer },
): Promise<Ticket> {
  const ticket = await dependencies.ticketStore.complete(ticketId, customerId);
  try {
    await dependencies.mailer.send(recipientEmail, ticket);
  } catch (error) {
    console.error("Ticket-completed email could not be sent", error);
  }
  return ticket;
}

/**
 * Completes Tickets left Resolved for 3 days and thanks each Customer. Only a Ticket this run completed is
 * mailed, so a second run sends nothing, and one failed email neither undoes a completion nor skips the rest.
 * Returns how many Tickets were completed.
 */
export async function autoCompleteResolvedTicketsAndNotify(
  now: Date,
  dependencies: { ticketStore: TicketStore; mailer: TicketCompletedMailer },
): Promise<number> {
  const cutoff = new Date(now.getTime() - autoCompleteAfterDays * 24 * 60 * 60 * 1000);
  const completed = await dependencies.ticketStore.autoCompleteResolved(cutoff);
  for (const { ticket, recipientEmail } of completed) {
    try {
      await dependencies.mailer.send(recipientEmail, ticket);
    } catch (error) {
      console.error("Ticket auto-completed email could not be sent", error);
    }
  }
  return completed.length;
}

/** Stores and retrieves Tickets only through their owning Customer. */
export function createTicketStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<TQueryResult, TSchema>,
  dependencies: { publish?: TicketPublisher } = {},
): TicketStore {
  /** The Ticket is already persisted, so a failed publish must not fail the write; other tabs catch up on reload. */
  async function publish(event: TicketEvent) {
    if (!dependencies.publish) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // An unreachable provider must not hold the Customer's request open.
      await Promise.race([
        dependencies.publish(event),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Publishing timed out")), publishTimeoutMilliseconds);
        }),
      ]);
    } catch (error) {
      console.error("Ticket event could not be published", error);
    } finally {
      clearTimeout(timer);
    }
  }

  async function messagesForTicket(ticketId: number): Promise<TicketMessage[]> {
    const messages = await db
      .select({
        id: ticketMessages.id,
        sender: ticketMessages.sender,
        body: ticketMessages.body,
        attachmentPathname: ticketMessages.attachmentPathname,
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

  async function open(
    customerId: string,
    input: OpenTicketInput,
    attach?: (ticketId: number) => Promise<string>,
  ): Promise<Ticket> {
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
    let attachmentPathname: string | undefined;
    try {
      attachmentPathname = await attach?.(ticket.id);
    } catch (error) {
      await db.delete(tickets).where(eq(tickets.id, ticket.id));
      throw error;
    }
    const [inserted] = await db
      .insert(ticketMessages)
      .values({ ticketId: ticket.id, sender: "customer", body: parsed.body, attachmentPathname })
      .returning({ id: ticketMessages.id });
    const opened = (await get(ticket.id, customerId))!;
    await publish({ type: "ticket-opened", ticket: opened, message: opened.messages.find((m) => m.id === inserted.id)! });
    return opened;
  }

  async function addMessage(
    ticketId: number,
    customerId: string,
    input: { body: unknown },
    attachmentPathname?: string,
  ): Promise<Ticket> {
    const parsed = ticketMessageInput.parse(input).body;
    const ticket = await get(ticketId, customerId);
    if (!ticket) throw new Error("Ticket was not found.");
    if (ticket.status === "completed") throw new Error(completedTicketError);
    // A Customer Message on a Resolved Ticket says it is not settled, so it reopens. This runs before the
    // insert so a failure here never leaves a Message on a Ticket that stayed Resolved.
    if (ticket.status === "resolved") {
      await db.update(tickets).set({ status: "open" }).where(and(eq(tickets.id, ticketId), eq(tickets.status, "resolved")));
    }
    const [inserted] = await db
      .insert(ticketMessages)
      .values({ ticketId, sender: "customer", body: parsed, attachmentPathname })
      .returning({ id: ticketMessages.id });
    const updated = (await get(ticketId, customerId))!;
    await publish({ type: "message-added", ticket: updated, message: updated.messages.find((m) => m.id === inserted.id)! });
    return updated;
  }

  /** Moves the Customer's Ticket from one of `from` to `to`, only if it is still in that status. */
  async function transition(ticketId: number, customerId: string, from: string[], to: string): Promise<Ticket> {
    const ticket = await get(ticketId, customerId);
    if (!ticket) throw new Error("Ticket was not found.");
    if (ticket.status === "completed") throw new Error(completedTicketError);
    if (!from.includes(ticket.status)) throw new Error("Ticket is not resolved.");
    const changed = await db
      .update(tickets)
      .set({ status: to })
      .where(and(eq(tickets.id, ticketId), eq(tickets.customerId, customerId), inArray(tickets.status, from)))
      .returning({ id: tickets.id });
    // A concurrent change (for example, a double submit) means this call did not make the transition.
    if (changed.length === 0) throw new Error((await get(ticketId, customerId))?.status === "completed" ? completedTicketError : "Ticket is not resolved.");
    return (await get(ticketId, customerId))!;
  }

  const complete = (ticketId: number, customerId: string) => transition(ticketId, customerId, ["open", "resolved"], "completed");
  const reportNotFixed = (ticketId: number, customerId: string) => transition(ticketId, customerId, ["resolved"], "open");

  async function autoCompleteResolved(resolvedBefore: Date) {
    // One conditional UPDATE: a Ticket the Customer reopened, or another run already completed, no longer matches.
    const changed = await db
      .update(tickets)
      .set({ status: "completed" })
      .where(and(eq(tickets.status, "resolved"), lte(tickets.resolvedAt, resolvedBefore)))
      .returning();
    return Promise.all(
      changed.map(async (row) => {
        const [customer] = await db.select({ email: customers.email }).from(customers).where(eq(customers.id, row.customerId));
        return { ticket: await toTicket(row), recipientEmail: customer.email };
      }),
    );
  }

  async function getAttachmentPathname(messageId: number, customerId: string): Promise<string | undefined> {
    const [row] = await db
      .select({ attachmentPathname: ticketMessages.attachmentPathname })
      .from(ticketMessages)
      .innerJoin(tickets, eq(tickets.id, ticketMessages.ticketId))
      .where(and(eq(ticketMessages.id, messageId), eq(tickets.customerId, customerId)));
    return row?.attachmentPathname ?? undefined;
  }

  return { open, listForCustomer, get, addMessage, getAttachmentPathname, complete, reportNotFixed, autoCompleteResolved };
}
