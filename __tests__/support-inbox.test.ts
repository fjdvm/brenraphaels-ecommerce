import { describe, expect, test } from "vitest";

import { awaitingReply, categoryLabel, filterTickets, ticketPreview, type InboxTicket } from "../lib/support/inbox";

const ticket = (overrides: Partial<InboxTicket>): InboxTicket => ({
  id: 1,
  subject: "Payment not reflecting",
  category: "Payment Issue",
  orderId: 7,
  status: "open",
  createdAt: new Date("2026-10-19T10:00:00Z"),
  messages: [],
  ...overrides,
});

describe("ticketPreview", () => {
  test("prefixes the last Message with who sent it", () => {
    const messages = [
      { sender: "customer" as const, body: "Done!", createdAt: new Date("2026-10-19T10:30:00Z") },
      { sender: "staff" as const, body: "Got it!", createdAt: new Date("2026-10-19T11:00:00Z") },
    ];
    expect(ticketPreview(ticket({ messages }))).toEqual({ text: "Staff: Got it!", at: new Date("2026-10-19T11:00:00Z") });
    expect(ticketPreview(ticket({ messages: messages.slice(0, 1) })).text).toBe("You: Done!");
  });

  test("falls back to the Ticket's creation time when there are no Messages", () => {
    expect(ticketPreview(ticket({}))).toEqual({ text: "", at: new Date("2026-10-19T10:00:00Z") });
  });

  test("collapses line breaks so the preview stays on one line", () => {
    const messages = [{ sender: "customer" as const, body: "Hi\n\nthere", createdAt: new Date() }];
    expect(ticketPreview(ticket({ messages })).text).toBe("You: Hi there");
  });
});

describe("filterTickets", () => {
  const tickets = [
    ticket({ id: 1, subject: "Payment not reflecting" }),
    ticket({ id: 2, subject: "Lid was loose", category: "Order Issue", orderId: 2, status: "closed" }),
    ticket({ id: 3, subject: "Delivery fee", category: "Delivery Issue", orderId: 4 }),
  ];

  test("splits Open from Resolved", () => {
    expect(filterTickets(tickets, "open", "").map((t) => t.id)).toEqual([1, 3]);
    expect(filterTickets(tickets, "resolved", "").map((t) => t.id)).toEqual([2]);
  });

  test("searches the subject, category and order number without caring about case", () => {
    expect(filterTickets(tickets, "open", "PAYMENT").map((t) => t.id)).toEqual([1]);
    expect(filterTickets(tickets, "open", "delivery").map((t) => t.id)).toEqual([3]);
    expect(filterTickets(tickets, "open", "#4").map((t) => t.id)).toEqual([3]);
  });

  test("ignores surrounding whitespace in the query", () => {
    expect(filterTickets(tickets, "open", "  fee ").map((t) => t.id)).toEqual([3]);
  });
});

describe("categoryLabel", () => {
  test("uses sentence case", () => {
    expect(categoryLabel("Payment Issue")).toBe("Payment issue");
    expect(categoryLabel("Other")).toBe("Other");
  });
});

describe("awaitingReply", () => {
  const staff = [{ sender: "staff" as const, body: "Hi", createdAt: new Date() }];
  test("is true only for an open Ticket that staff answered last", () => {
    expect(awaitingReply(ticket({ messages: staff }))).toBe(true);
    expect(awaitingReply(ticket({ messages: staff, status: "closed" }))).toBe(false);
    expect(awaitingReply(ticket({ messages: [{ sender: "customer", body: "Hi", createdAt: new Date() }] }))).toBe(false);
    expect(awaitingReply(ticket({}))).toBe(false);
  });
});
