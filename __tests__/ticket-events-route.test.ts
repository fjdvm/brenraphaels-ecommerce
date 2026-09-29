import { beforeEach, describe, expect, test, vi } from "vitest";

const { currentVisitor, get, subscribeToTicket, unsubscribe } = vi.hoisted(() => ({
  currentVisitor: vi.fn(),
  get: vi.fn(),
  subscribeToTicket: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/customer/current-visitor", () => ({ currentVisitor }));
vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@/lib/support/tickets", () => ({ createTicketStore: () => ({ get }) }));
vi.mock("@/lib/support/ticket-events", () => ({ subscribeToTicket }));

import { GET } from "@/app/api/support/tickets/[ticketId]/events/route";

const context = (ticketId: string) => ({ params: Promise.resolve({ ticketId }) }) as never;

describe("Ticket events route", () => {
  beforeEach(() => {
    currentVisitor.mockReset().mockResolvedValue({ state: "customer", customer: { userId: "customer-1" } });
    get.mockReset().mockResolvedValue({ id: 5 });
    unsubscribe.mockReset().mockResolvedValue(undefined);
    subscribeToTicket.mockReset().mockResolvedValue(unsubscribe);
  });

  test("streams events published for the Customer's own Ticket and unsubscribes on disconnect", async () => {
    const abort = new AbortController();
    const response = await GET(new Request("http://localhost/x", { signal: abort.signal }), context("5"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, no-transform");
    expect(get).toHaveBeenCalledWith(5, "customer-1");
    expect(subscribeToTicket).toHaveBeenCalledWith(5, expect.any(Function));

    const payload = { type: "message-added", ticketId: 5, status: "open", message: { id: 9, body: "hi" } };
    subscribeToTicket.mock.calls[0][1](payload);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes("message-added")) text += decoder.decode((await reader.read()).value);
    expect(text).toContain(`data: ${JSON.stringify(payload)}\n\n`);

    abort.abort();
    await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(1));
  });

  test("hides Tickets that belong to someone else, do not exist, or are requested while signed out", async () => {
    get.mockResolvedValue(undefined);
    expect((await GET(new Request("http://localhost/x"), context("5"))).status).toBe(404);
    expect((await GET(new Request("http://localhost/x"), context("abc"))).status).toBe(404);
    currentVisitor.mockResolvedValue({ state: "signed-out" });
    expect((await GET(new Request("http://localhost/x"), context("5"))).status).toBe(404);
    expect(subscribeToTicket).not.toHaveBeenCalled();
  });
});
