import { beforeEach, expect, test, vi } from "vitest";

const sendPendingCustomerNotifications = vi.hoisted(() => vi.fn());
const retryFailedOrderEmails = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/notifications/outbox", () => ({ sendPendingCustomerNotifications }));
vi.mock("@/lib/email/retry", () => ({ retryFailedOrderEmails }));

import { GET } from "@/app/api/cron/customer-notifications/route";

const request = (token = "secret") => new Request("https://shop.test/api/cron/customer-notifications", { headers: { authorization: `Bearer ${token}` } });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CUSTOMER_NOTIFICATION_CRON_SECRET", "secret");
  sendPendingCustomerNotifications.mockResolvedValue(2);
  retryFailedOrderEmails.mockResolvedValue(1);
});

test("refuses a wrong secret and retries nothing", async () => {
  expect((await GET(request("bad"))).status).toBe(401);
  expect(retryFailedOrderEmails).not.toHaveBeenCalled();
});

test("retries Notifications and failed Order emails", async () => {
  const response = await GET(request());
  expect(await response.json()).toEqual({ sent: 2, emailsSent: 1 });
});

test("an email retry failure never fails the job", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  retryFailedOrderEmails.mockRejectedValue(new Error("db down"));
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sent: 2, emailsSent: 0 });
});
