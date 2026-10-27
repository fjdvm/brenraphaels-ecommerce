import crypto from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCareersDatabase, syncApplicationStatusWebhook } = vi.hoisted(() => ({
  getCareersDatabase: vi.fn(),
  syncApplicationStatusWebhook: vi.fn(),
}));

vi.mock("../lib/careers/hr-ats-webhook", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/careers/hr-ats-webhook")>()),
  syncApplicationStatusWebhook,
}));

vi.mock("../lib/careers/db", () => ({ getCareersDatabase }));

let post: (request: Request) => Promise<Response>;

beforeAll(async () => {
  process.env.HR_ATS_WEBHOOK_SECRET = "test-secret";
  ({ POST: post } = await import("../app/api/webhooks/hr-ats/route"));
});

function signedRequest(body: string, signature?: string) {
  const validSignature = crypto
    .createHmac("sha256", "test-secret")
    .update(body)
    .digest("hex");
  return new Request("https://shop.example.test/api/webhooks/hr-ats", {
    body,
    headers: {
      "Content-Type": "application/json",
      "X-HR-ATS-Signature": signature ?? `sha256=${validSignature}`,
    },
    method: "POST",
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/webhooks/hr-ats", () => {
  it.each(["job_posting.created", "job_posting.updated", "job_posting.closed"])("rejects retired %s events without applying any update", async (eventType) => {
    const event = {
      event: eventType,
      data: {
        id: "ats-1",
        title: "Pastry Chef",
        department: "Kitchen",
        description: "Make desserts.",
        requirements: "Pastry experience.",
        employmentType: "Full-time",
        location: "Makati",
        deadline: "2030-02-01T00:00:00.000Z",
        requiredDocuments: ["Resume"],
        screeningCriteria: ["Pastry experience"],
        status: "closed",
      },
    };
    const body = JSON.stringify(event);

    expect((await post(signedRequest(body))).status).toBe(400);
    expect(getCareersDatabase).not.toHaveBeenCalled();
    expect(syncApplicationStatusWebhook).not.toHaveBeenCalled();
  });

  it("accepts a valid signed Application-status-change event", async () => {
    const event = {
      event: "application.status_changed",
      data: { referenceNumber: "BR-20260928-0001", status: "Interviewing" },
    };
    const body = JSON.stringify(event);

    expect((await post(signedRequest(body))).status).toBe(204);
    expect(syncApplicationStatusWebhook).toHaveBeenCalledWith(event);
  });

  it("rejects an unsigned or invalid request", async () => {
    expect((await post(signedRequest("{}", "sha256=invalid"))).status).toBe(400);
    expect((await post(new Request("https://shop.example.test/api/webhooks/hr-ats", { method: "POST", body: "{}" }))).status).toBe(400);
  });

  it("rejects a signed event with an invalid Job Posting payload", async () => {
    expect((await post(signedRequest(JSON.stringify({ event: "job_posting.closed", data: { id: "ats-1" } })))).status).toBe(400);
  });

  it("rejects a signed event with an invalid Application-status-change payload", async () => {
    expect((await post(signedRequest(JSON.stringify({ event: "application.status_changed", data: { referenceNumber: "" } })))).status).toBe(400);
  });
});
