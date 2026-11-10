import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { autoCompleteResolvedTicketsAndNotify, createTicketStore, getDatabase } = vi.hoisted(() => ({
  autoCompleteResolvedTicketsAndNotify: vi.fn(),
  createTicketStore: vi.fn(() => ({})),
  getDatabase: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/email/ticket-auto-completed-email", () => ({ sendTicketAutoCompletedEmail: vi.fn() }));
vi.mock("@/lib/support/tickets", () => ({ autoCompleteResolvedTicketsAndNotify, createTicketStore }));

import { GET } from "@/app/api/cron/auto-complete-tickets/route";

const request = (authorization?: string) =>
  new Request("http://localhost/api/cron/auto-complete-tickets", { headers: authorization ? { authorization } : {} });

describe("auto-complete Tickets cron route", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    autoCompleteResolvedTicketsAndNotify.mockReset().mockResolvedValue(2);
  });

  test("rejects a request without the cron secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect(autoCompleteResolvedTicketsAndNotify).not.toHaveBeenCalled();
  });

  test("rejects every request when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("Bearer "))).status).toBe(401);
  });

  test("completes Resolved Tickets and reports how many", async () => {
    const response = await GET(request("Bearer s3cret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ completed: 2 });
  });

  describe("GitHub Actions schedule", () => {
    const workflow = readFileSync(".github/workflows/auto-complete-tickets.yml", "utf8");

    test("runs daily at 01:00 UTC and can be triggered manually", () => {
      expect(workflow).toContain('cron: "0 1 * * *"');
      expect(workflow).toContain("workflow_dispatch:");
    });

    test("fails clearly when STOREFRONT_URL or CRON_SECRET is missing", () => {
      expect(workflow).toMatch(/vars\.STOREFRONT_URL/);
      expect(workflow).toMatch(/secrets\.CRON_SECRET/);
      expect(workflow).toMatch(/::error::.*STOREFRONT_URL/);
      expect(workflow).toMatch(/::error::.*CRON_SECRET/);
    });

    test("calls the cron route with the bearer secret and retries", () => {
      expect(workflow).toContain("Authorization: Bearer $CRON_SECRET");
      expect(workflow).toContain("/api/cron/auto-complete-tickets");
      expect(workflow).toContain("--retry 2");
    });
  });
});
