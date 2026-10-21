import { beforeEach, describe, expect, test, vi } from "vitest";

import { queueFeedbackThankYou, sendAppEmail } from "../lib/notifications/gateway";

beforeEach(() => {
  vi.stubEnv("GATEWAY_URL", "https://gateway.example.com/");
  vi.stubEnv("GATEWAY_CALLER_KEY", "key-1");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");
});

describe("gateway App email", () => {
  test("posts the email to the notifications service with the Caller key", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));

    await sendAppEmail({ to: "jane@example.com", title: "Hi", body: "There" }, fetcher);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://gateway.example.com/notifications/emails/app");
    expect(init.headers.Authorization).toBe("Bearer key-1");
    expect(JSON.parse(init.body)).toEqual({ to: "jane@example.com", title: "Hi", body: "There", app: "ecommerce" });
  });

  test("fails when the gateway refuses the email", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("no", { status: 401 }));

    await expect(sendAppEmail({ to: "a@b.co", title: "t", body: "b" }, fetcher)).rejects.toThrow("401");
  });

  test("fails when the gateway is not configured", async () => {
    vi.stubEnv("GATEWAY_CALLER_KEY", "");

    await expect(queueFeedbackThankYou("a@b.co", 5)).rejects.toThrow("GATEWAY_CALLER_KEY");
  });
});
