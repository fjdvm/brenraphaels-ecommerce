import { beforeEach, describe, expect, test, vi } from "vitest";

import { writeAuditEvent } from "../lib/audit/gateway";
import { feedbackRequestContent, sendAppNotification, sendFeedbackRequest } from "../lib/notifications/gateway";

beforeEach(() => {
  vi.stubEnv("API_GATEWAY_URL", "https://gateway.example.com/");
  vi.stubEnv("API_GATEWAY_CALLER_KEY", "key-1");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com/");
});

describe("Feedback request content", () => {
  test("links to the Order's Feedback form on the Orders page", () => {
    const content = feedbackRequestContent(208, "https://shop.example.com/");

    expect(content.title).toMatch(/Order #208/);
    expect(content.button.link).toBe("https://shop.example.com/profile/orders?order=208");
  });
});

describe("gateway in-app Notification", () => {
  test("posts the Notification to the notifications service for the Customer", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));

    await sendAppNotification(
      { userId: "customer-1", type: "feedback.request", title: "T", body: "B", link: "https://shop.example.com/x" },
      fetcher,
    );

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://gateway.example.com/notifications/notifications");
    expect(init.headers.Authorization).toBe("Bearer key-1");
    expect(JSON.parse(init.body)).toEqual({
      type: "feedback.request", title: "T", body: "B", link: "https://shop.example.com/x",
      sendingApp: "ecommerce", targetApp: "ecommerce", userIds: ["customer-1"],
    });
  });

  test("fails when the gateway refuses it", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("no", { status: 400 }));

    await expect(sendAppNotification({ userId: "c", type: "t", title: "T", body: "B" }, fetcher)).rejects.toThrow("400");
  });
});

describe("sending a Feedback request", () => {
  test("sends the email and the Notification, both linking to the Order", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));

    await sendFeedbackRequest({ orderId: 208, customerId: "customer-1", customerName: "Jane Doe", email: "jane@example.com" }, fetcher);

    const urls = fetcher.mock.calls.map(([url]) => url);
    expect(urls).toEqual([
      "https://gateway.example.com/notifications/emails/app",
      "https://gateway.example.com/notifications/notifications",
    ]);
    const email = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(email).toMatchObject({ to: "jane@example.com", button: { link: "https://shop.example.com/profile/orders?order=208" } });
    expect(JSON.parse(fetcher.mock.calls[1][1].body).link).toBe("https://shop.example.com/profile/orders?order=208");
  });

  test("fails when either send fails", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 202 }))
      .mockResolvedValueOnce(new Response("no", { status: 500 }));

    await expect(
      sendFeedbackRequest({ orderId: 1, customerId: "c", customerName: "J", email: "j@example.com" }, fetcher),
    ).rejects.toThrow("500");
  });
});

describe("gateway audit event", () => {
  test("posts the event to audit-logs with the Caller key", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    const event = { source: "Ecommerce", action: "feedback.request_sent" } as never;

    await writeAuditEvent(event, fetcher);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://gateway.example.com/audit/events");
    expect(init.headers.Authorization).toBe("Bearer key-1");
    expect(JSON.parse(init.body)).toEqual(event);
  });

  test("fails when audit-logs refuses the event", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("no", { status: 400 }));

    await expect(writeAuditEvent({} as never, fetcher)).rejects.toThrow("400");
  });
});
