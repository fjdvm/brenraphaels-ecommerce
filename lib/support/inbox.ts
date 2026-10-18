import type { Ticket } from "./tickets";

/** What the inbox needs of a Ticket; each Message's id and attachment stay on the server. */
export type InboxTicket = Pick<Ticket, "id" | "subject" | "category" | "orderId" | "status" | "createdAt"> & {
  messages: { sender: "customer" | "staff"; body: string; createdAt: Date }[];
};

export type TicketTab = "open" | "resolved";

export function categoryLabel(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

/** The inbox row's second line: who spoke last and what they said, and when. */
export function ticketPreview(ticket: InboxTicket): { text: string; at: Date } {
  const last = ticket.messages.at(-1);
  if (!last) return { text: "", at: ticket.createdAt };
  const who = last.sender === "customer" ? "You" : "Staff";
  return { text: `${who}: ${last.body.replace(/\s+/g, " ").trim()}`, at: last.createdAt };
}

/** A closed Ticket counts as resolved. */
export function filterTickets(tickets: InboxTicket[], tab: TicketTab, query: string) {
  const needle = query.trim().toLowerCase();
  return tickets.filter((ticket) => {
    if ((ticket.status === "open") !== (tab === "open")) return false;
    if (!needle) return true;
    const haystack = [ticket.subject, ticket.category, ticket.orderId === null ? "" : `order #${ticket.orderId}`]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}
