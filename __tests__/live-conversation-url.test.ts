import { describe, expect, test, vi } from "vitest";

import { liveConversationUrl } from "@/lib/support/live";

const gateway = (fetch: typeof globalThis.fetch) => ({ baseUrl: "https://gateway.test/", callerKey: "key-1", fetch });

describe("Live ticket for a Customer's Ticket conversation", () => {
  test("asks the gateway for a Customer-role ticket and returns the WebSocket address", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ticket: "a.b", expiresIn: 60 }));

    const url = await liveConversationUrl(12, "customer-1", gateway(fetch));

    expect(url).toBe("wss://gateway.test/notifications/conversations/12/live?ticket=a.b");
    expect(fetch).toHaveBeenCalledWith("https://gateway.test/live-tickets", {
      method: "POST",
      headers: { Authorization: "Bearer key-1", "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "customer-1", ticketId: "12", role: "Customer" }),
    });
  });

  test("fails when the gateway refuses", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));

    await expect(liveConversationUrl(12, "customer-1", gateway(fetch))).rejects.toThrow("401");
  });

  test("fails when the gateway is not configured", async () => {
    await expect(liveConversationUrl(12, "customer-1", { baseUrl: "", callerKey: "" })).rejects.toThrow("API_GATEWAY_URL");
  });
});
