import { describe, expect, test, vi } from "vitest";

import { liveOrdersUrl } from "@/lib/orders/live";

const gateway = (fetch: typeof globalThis.fetch) => ({ baseUrl: "https://gateway.test/", callerKey: "key-1", fetch });

describe("Live ticket for a Customer's Orders", () => {
  test("asks the gateway for an Orders pass for that Customer and returns the WebSocket address", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ticket: "a.b", expiresIn: 60 }));

    const url = await liveOrdersUrl("customer-1", gateway(fetch));

    expect(url).toBe("wss://gateway.test/notifications/orders/live?ticket=a.b");
    expect(fetch).toHaveBeenCalledWith("https://gateway.test/live-tickets", {
      method: "POST",
      headers: { Authorization: "Bearer key-1", "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "customer-1", channel: "orders" }),
    });
  });

  test("fails when the gateway refuses", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    await expect(liveOrdersUrl("customer-1", gateway(fetch))).rejects.toThrow("403");
  });

  test("fails when the gateway is not configured", async () => {
    await expect(liveOrdersUrl("customer-1", { baseUrl: "", callerKey: "" })).rejects.toThrow("API_GATEWAY_URL");
  });
});
