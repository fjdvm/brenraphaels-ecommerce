import { afterEach, expect, test, vi } from "vitest";

const { removeDue, database } = vi.hoisted(() => ({ removeDue: vi.fn(), database: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDatabase: database }));
vi.mock("@/lib/orders/delivery-photo-retention", () => ({
  createDeliveryPhotoRetentionStore: () => ({ removeDue }),
}));
import { GET } from "../app/api/cron/delivery-photo-retention/route";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

test.each([undefined, "", "Bearer wrong"])("refuses unauthenticated scheduled requests: %s", async (authorization) => {
  vi.stubEnv("CRON_SECRET", "expected-secret");
  const response = await GET(new Request("https://store.test/api/cron/delivery-photo-retention", {
    headers: authorization === undefined ? {} : { authorization },
  }));
  expect(response.status).toBe(401);
  expect(database).not.toHaveBeenCalled();
  expect(removeDue).not.toHaveBeenCalled();
});

test("fails closed when no cron secret is configured", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(new Request("https://store.test/api/cron/delivery-photo-retention", {
    headers: { authorization: "Bearer " },
  }))).status).toBe(401);
  expect(database).not.toHaveBeenCalled();
});

test.each([{ removed: 2, failed: 0, status: 200 }, { removed: 1, failed: 1, status: 500 }])(
  "reports the scheduled run with HTTP $status", async ({ removed, failed, status }) => {
    vi.stubEnv("CRON_SECRET", "expected-secret");
    removeDue.mockResolvedValue({ removed, failed });
    const response = await GET(new Request("https://store.test/api/cron/delivery-photo-retention", {
      headers: { authorization: "Bearer expected-secret" },
    }));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ removed, failed });
    expect(removeDue).toHaveBeenCalledWith(expect.any(Date));
  },
);
