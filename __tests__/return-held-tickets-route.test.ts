import { beforeEach, describe, expect, test, vi } from "vitest";

const { returnDueHolds, getDatabase } = vi.hoisted(() => ({ returnDueHolds: vi.fn(), getDatabase: vi.fn() }));

vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/support/tickets", () => ({ createTicketStore: () => ({ returnDueHolds }) }));

import { GET } from "@/app/api/cron/return-held-tickets/route";

const request = (authorization?: string) =>
  new Request("http://localhost/api/cron/return-held-tickets", { headers: authorization ? { authorization } : {} });

describe("return held Tickets cron route", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    returnDueHolds.mockReset().mockResolvedValue(3);
  });

  test("rejects a request without the cron secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect(returnDueHolds).not.toHaveBeenCalled();
  });

  test("returns due holds and reports how many", async () => {
    const response = await GET(request("Bearer s3cret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ returned: 3 });
  });
});
