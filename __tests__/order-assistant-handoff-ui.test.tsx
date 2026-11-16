// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { OrderAssistant } from "@/components/features/assistant/order-assistant";
import { AssistantSummaryCard } from "@/components/features/support/assistant-summary-card";
import { summaryLines } from "@/lib/assistant-handoff/ticket-summary";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const handoffReply = { chatId: 1, outcome: "handoff", text: "A damaged item needs our team.", ticketButton: true };

type Route = (body: Record<string, unknown>) => Promise<{ ok: boolean; body: unknown }> | { ok: boolean; body: unknown };
function stubRoutes(routes: Record<string, Route>) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, body });
    const result = await routes[url](body);
    return { ok: result.ok, json: async () => result.body } as Response;
  }));
  return calls;
}

async function reachHandoff() {
  render(<OrderAssistant />);
  fireEvent.click(screen.getByRole("button", { name: "Ask the Order assistant" }));
  const input = await screen.findByRole("textbox", { name: "Ask about an order" });
  fireEvent.change(input, { target: { value: "my halaya leaked" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.click(await screen.findByRole("button", { name: "Talk to a teammate" }));
}

describe("handoff step in the panel", () => {
  test("shows the summary with Send, Edit and Cancel first, and sends nothing until Send", async () => {
    const calls = stubRoutes({
      "/api/assistant/messages": () => ({ ok: true, body: handoffReply }),
      "/api/assistant/handoff": () => ({ ok: true, body: { status: "drafted", summary: "The customer reports a leaking jar.", reason: "damaged_or_spoiled", orderId: 5, ticketId: null } }),
      "/api/assistant/handoff/send": () => ({ ok: true, body: { ticketId: 6 } }),
    });
    await reachHandoff();
    expect(await screen.findByText("The customer reports a leaking jar.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(calls.some((call) => call.url.endsWith("/send"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Send to our team" }));
    expect(await screen.findByText("Ticket #6 opened")).toBeTruthy();
    const send = calls.find((call) => call.url.endsWith("/send"))!;
    expect(send.body).toEqual({ chatId: 1 });
    expect(screen.getByRole("link", { name: "Open ticket" }).getAttribute("href")).toBe("/support/6");
  });

  test("shows a loading state at once while the summary is written", async () => {
    stubRoutes({
      "/api/assistant/messages": () => ({ ok: true, body: handoffReply }),
      "/api/assistant/handoff": () => new Promise(() => {}),
    });
    await reachHandoff();
    expect(screen.getByRole("status", { name: "Preparing your note for our team" })).toBeTruthy();
  });

  test("edited words are sent as the Customer's own, and Cancel closes without sending", async () => {
    const calls = stubRoutes({
      "/api/assistant/messages": () => ({ ok: true, body: handoffReply }),
      "/api/assistant/handoff": () => ({ ok: true, body: { status: "drafted", summary: "Leaking jar.", reason: "damaged_or_spoiled", orderId: 5, ticketId: null } }),
      "/api/assistant/handoff/send": () => ({ ok: true, body: { ticketId: 7 } }),
    });
    await reachHandoff();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your note for our team" }), { target: { value: "Jar leaked, please replace." } });
    fireEvent.click(screen.getByRole("button", { name: "Send to our team" }));
    await screen.findByText("Ticket #7 opened");
    expect(calls.find((call) => call.url.endsWith("/send"))!.body).toEqual({ chatId: 1, summary: "Jar leaked, please replace." });
  });

  test("Cancel sends nothing", async () => {
    const calls = stubRoutes({
      "/api/assistant/messages": () => ({ ok: true, body: handoffReply }),
      "/api/assistant/handoff": () => ({ ok: true, body: { status: "drafted", summary: "Leaking jar.", reason: "x", orderId: null, ticketId: null } }),
    });
    await reachHandoff();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("group", { name: "Hand off to our team" })).toBeNull();
    expect(calls.some((call) => call.url.endsWith("/send"))).toBe(false);
  });

  test("a dropped summary asks the Customer to write their own", async () => {
    stubRoutes({
      "/api/assistant/messages": () => ({ ok: true, body: handoffReply }),
      "/api/assistant/handoff": () => ({ ok: true, body: { status: "dropped", summary: null, reason: "x", orderId: null, ticketId: null, note: "Write a few words for our team." } }),
    });
    await reachHandoff();
    expect(await screen.findByText("Write a few words for our team.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Send to our team" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("a refused send rolls back to the card with the plain reason, and nothing is marked sent", async () => {
    stubRoutes({
      "/api/assistant/messages": () => ({ ok: true, body: handoffReply }),
      "/api/assistant/handoff": () => ({ ok: true, body: { status: "drafted", summary: "Leaking jar.", reason: "x", orderId: null, ticketId: null } }),
      "/api/assistant/handoff/send": () => ({ ok: false, body: { error: "Your chat has changed since this summary was written. Ask for a new one." } }),
    });
    await reachHandoff();
    fireEvent.click(await screen.findByRole("button", { name: "Send to our team" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Your chat has changed");
    expect(screen.queryByText(/Ticket #\d+ opened/)).toBeNull();
    await waitFor(() => expect((screen.getByRole("button", { name: "Send to our team" }) as HTMLButtonElement).disabled).toBe(false));
  });

  test("a failed summary shows a plain reason and keeps the chat usable", async () => {
    stubRoutes({
      "/api/assistant/messages": () => ({ ok: true, body: handoffReply }),
      "/api/assistant/handoff": () => ({ ok: false, body: { error: "x" } }),
    });
    await reachHandoff();
    expect((await screen.findByRole("alert")).textContent).toContain("We couldn't prepare your note");
    expect(screen.getByRole("textbox", { name: "Ask about an order" })).toBeTruthy();
  });
});

describe("Ticket from the assistant", () => {
  test("splits a summary into lines", () => {
    expect(summaryLines("The customer reported a leak. They prefer a replacement.")).toEqual(["The customer reported a leak.", "They prefer a replacement."]);
    expect(summaryLines("- one\n- two")).toEqual(["one", "two"]);
  });

  test("shows 'Summary from the order assistant' with its lines", () => {
    render(<AssistantSummaryCard summary={{ source: "assistant", lines: ["One jar leaked", "Prefers a replacement"] }} />);
    expect(screen.getByRole("region", { name: "Summary from the order assistant" })).toBeTruthy();
    expect(screen.getByText("Prefers a replacement")).toBeTruthy();
  });
});
