// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { OrderAssistant } from "@/components/features/assistant/order-assistant";
import { cardOrderId, chipsFor, needsPaymentProof, ticketHref } from "@/lib/assistant/panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const card = (payment: string) => ({ title: "Order #7", lines: [{ label: "Payment", value: payment }] });

function stubFetch(...replies: unknown[]) {
  const fetchMock = vi.fn(async () => {
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return { ok: true, json: async () => next } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openPanel(pageOrderId?: number) {
  render(<OrderAssistant pageOrderId={pageOrderId} />);
  fireEvent.click(screen.getByRole("button", { name: "Ask the Order assistant" }));
  expect(screen.getByRole("dialog", { name: "Order assistant" })).toBeTruthy();
  return screen.findByRole("textbox", { name: "Ask about an order" });
}

describe("chips", () => {
  test("Submit payment only offers when a payment proof is due, and opens the normal Orders screen", () => {
    expect(needsPaymentProof(card("waiting for your payment proof"))).toBe(true);
    expect(needsPaymentProof(card("paid"))).toBe(false);
    const due = chipsFor(7, card("waiting for your payment proof"));
    expect(due[0]).toEqual({ kind: "link", label: "Submit payment", href: "/profile/orders?order=7" });
    expect(chipsFor(7, card("paid")).some((chip) => chip.kind === "link" && chip.label === "Submit payment")).toBe(false);
  });

  test("never offers a change-to-pickup chip, and every chip only navigates or asks", () => {
    const chips = chipsFor(7, card("waiting for your payment proof"));
    expect(JSON.stringify(chips)).not.toMatch(/pickup/i);
    expect(chips.map((chip) => chip.kind).every((kind) => ["link", "ask", "local", "pick"].includes(kind))).toBe(true);
    expect(ticketHref(7)).toBe("/support/new?order=7");
    expect(cardOrderId(card("paid"))).toBe(7);
  });
});

describe("the panel", () => {
  test("opens at once with a skeleton before the chat shows", async () => {
    render(<OrderAssistant />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the Order assistant" }));
    expect(screen.getByRole("status", { name: "Loading the assistant" })).toBeTruthy();
    expect(screen.getByText("AI assistant · Our team takes over anytime")).toBeTruthy();
    await screen.findByRole("textbox", { name: "Ask about an order" });
  });

  test("shows 'sending...' until answered, then the labelled answer and the system-rendered Order card", async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((done) => (resolve = done))));
    const input = await openPanel();
    fireEvent.change(input, { target: { value: "where is my order?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("sending...")).toBeTruthy();
    resolve({ ok: true, json: async () => ({ chatId: 1, outcome: "answered", text: "It is on the way.", card: card("paid"), ticketButton: false }) });
    expect(await screen.findByText("It is on the way.")).toBeTruthy();
    expect(screen.queryByText("sending...")).toBeNull();
    expect(screen.getByRole("group", { name: "Order #7" })).toBeTruthy();
    expect(screen.getAllByText("AI").length).toBeGreaterThan(0);
  });

  test("shows the Order picker when more than one Order could be meant, and sends the pick", async () => {
    const fetchMock = stubFetch(
      { chatId: 1, outcome: "pick_order", text: "Which order do you mean?", choices: [{ id: 7, label: "Order #7 · confirmed" }, { id: 5, label: "Order #5 · delivered" }], ticketButton: false },
      { chatId: 1, outcome: "answered", text: "Order 5 is delivered.", card: { title: "Order #5", lines: [] }, ticketButton: false },
    );
    const input = await openPanel();
    fireEvent.change(input, { target: { value: "where is my order" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const pick = await screen.findByRole("button", { name: "Order #5 · delivered" });
    expect(screen.getAllByRole("button", { name: /^Order #\d/ })).toHaveLength(2);
    fireEvent.click(pick);
    await screen.findByText("Order 5 is delivered.");
    const body = JSON.parse((fetchMock.mock.calls[1] as unknown as [string, { body: string }])[1].body);
    expect(body.pickedOrderId).toBe(5);
  });

  test("at the cap or on a model failure the Order card and the Ticket button show, not an error", async () => {
    stubFetch({ chatId: 1, outcome: "fallback", reason: "daily_cap", text: "You've reached today's limit.", card: card("paid"), ticketButton: true });
    const input = await openPanel();
    fireEvent.change(input, { target: { value: "where is my order" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("You've reached today's limit.");
    expect(screen.getByRole("group", { name: "Order #7" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Talk to a teammate" }).getAttribute("href")).toBe("/support/new?order=7");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a failed request falls back to the Ticket button instead of an error", async () => {
    stubFetch(new Error("offline"));
    const input = await openPanel();
    fireEvent.change(input, { target: { value: "hello order" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Talk to a teammate" })).toBeTruthy());
    expect(screen.queryByText("sending...")).toBeNull();
  });

  test("chips: Talk to a person links to a Ticket; 'How do I find the reference?' answers without a request", async () => {
    const fetchMock = stubFetch();
    await openPanel(9);
    expect(screen.getByRole("link", { name: "Talk to a person" }).getAttribute("href")).toBe("/support/new?order=9");
    fireEvent.click(screen.getByRole("button", { name: "How do I find the reference?" }));
    expect(await screen.findByText(/Ref No\./)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("Check another order stops the page Order from deciding which Order is meant", async () => {
    const fetchMock = stubFetch({ chatId: 1, outcome: "pick_order", text: "Which order do you mean?", choices: [], ticketButton: false });
    await openPanel(9);
    fireEvent.click(screen.getByRole("button", { name: "Check another order" }));
    await screen.findByText("Which order do you mean?");
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.pageOrderId).toBeUndefined();
  });

  test("mobile: the panel is a full-screen sheet below the sm breakpoint and a corner panel above it", async () => {
    await openPanel();
    const panel = screen.getByRole("dialog", { name: "Order assistant" });
    expect(panel.className).toMatch(/\binset-0\b/);
    expect(panel.className).toMatch(/sm:w-\[400px\]/);
    fireEvent.click(screen.getByRole("button", { name: "Close the assistant" }));
    expect(screen.getByRole("button", { name: "Ask the Order assistant" })).toBeTruthy();
  });
});
