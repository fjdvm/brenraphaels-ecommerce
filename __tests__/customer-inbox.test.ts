import { describe, expect, test, vi } from "vitest";

import { listInbox, liveInboxUrl, markAllInboxRead, markInboxRead, unreadInboxCount } from "@/lib/notifications/inbox";

const gateway = (fetch: typeof globalThis.fetch) => ({ baseUrl: "https://gateway.test/", callerKey: "key-1", fetch });
const auth = { Authorization: "Bearer key-1" };

const stored = {
  id: "5b4f0a52-6d1c-4f55-9b7d-2c4f0e3a9a10",
  type: "order.delivered",
  title: "Order #7 delivered",
  body: "Your Refund window is open for 24 hours.",
  link: "https://shop.test/profile/orders?order=7",
  sendingApp: "ecommerce",
  targetApp: "ecommerce",
  userId: "customer-1",
  createdAt: "2026-10-26T06:00:00.000Z",
  readAt: null,
};

describe("Customer inbox through the gateway", () => {
  test("lists only the Customer's storefront Notifications, newest as the service returns them", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ notifications: [stored], nextCursor: null }));

    const items = await listInbox("customer-1", gateway(fetch));

    expect(String(fetch.mock.calls[0][0])).toBe("https://gateway.test/notifications/notifications?userId=customer-1&app=ecommerce&limit=50");
    expect(fetch.mock.calls[0][1].headers).toMatchObject(auth);
    expect(items).toEqual([
      {
        id: stored.id,
        type: "order.delivered",
        title: "Order #7 delivered",
        body: "Your Refund window is open for 24 hours.",
        link: "https://shop.test/profile/orders?order=7",
        createdAt: new Date("2026-10-26T06:00:00.000Z"),
        readAt: null,
      },
    ]);
  });

  test("an empty inbox is an empty list", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ notifications: [], nextCursor: null }));
    expect(await listInbox("customer-1", gateway(fetch))).toEqual([]);
  });

  test("counts the unread for the bell", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ unread: 3 }));

    expect(await unreadInboxCount("customer-1", gateway(fetch))).toBe(3);
    expect(String(fetch.mock.calls[0][0])).toBe("https://gateway.test/notifications/notifications/unread-count?userId=customer-1&app=ecommerce");
  });

  test("marks one Notification read for that Customer", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: stored.id, read: true }));

    await markInboxRead("customer-1", stored.id, gateway(fetch));

    expect(fetch).toHaveBeenCalledWith(`https://gateway.test/notifications/notifications/${stored.id}/read`, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ userId: "customer-1", app: "ecommerce" }),
    }));
  });

  test("marks every Notification read for that Customer", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ updated: 2 }));

    await markAllInboxRead("customer-1", gateway(fetch));

    expect(fetch).toHaveBeenCalledWith("https://gateway.test/notifications/notifications/read-all", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ userId: "customer-1", app: "ecommerce" }),
    }));
  });

  test("refuses an id that is not a Notification id without calling the gateway", async () => {
    const fetch = vi.fn();
    await expect(markInboxRead("customer-1", "../orders", gateway(fetch))).rejects.toThrow("Notification");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("fails when the gateway refuses", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 502 }));
    await expect(listInbox("customer-1", gateway(fetch))).rejects.toThrow("502");
  });
});

describe("Live ticket for a Customer's inbox", () => {
  test("asks the gateway for a pass naming that Customer and returns the WebSocket address", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ticket: "a.b", expiresIn: 60 }));

    const url = await liveInboxUrl("customer-1", gateway(fetch));

    expect(url).toBe("wss://gateway.test/notifications/live?ticket=a.b");
    expect(fetch).toHaveBeenCalledWith("https://gateway.test/live-tickets", expect.objectContaining({
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "customer-1" }),
    }));
  });

  test("fails when the gateway refuses", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    await expect(liveInboxUrl("customer-1", gateway(fetch))).rejects.toThrow("403");
  });
});
