import crypto from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

const { syncJobPostingWebhook } = vi.hoisted(() => ({
  syncJobPostingWebhook: vi.fn(),
}));

vi.mock("../lib/careers/hr-ats-webhook", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/careers/hr-ats-webhook")>()),
  syncJobPostingWebhook,
}));

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

describe("POST /api/webhooks/hr-ats", () => {
  it("accepts a valid signed Job Posting event", async () => {
    const event = {
      event: "job_posting.closed",
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

    expect((await post(signedRequest(body))).status).toBe(204);
    expect(syncJobPostingWebhook).toHaveBeenCalledWith(event);
  });

  it("rejects an unsigned or invalid request", async () => {
    expect((await post(signedRequest("{}", "sha256=invalid"))).status).toBe(400);
    expect((await post(new Request("https://shop.example.test/api/webhooks/hr-ats", { method: "POST", body: "{}" }))).status).toBe(400);
  });

  it("rejects a signed event with an invalid Job Posting payload", async () => {
    expect((await post(signedRequest(JSON.stringify({ event: "job_posting.closed", data: { id: "ats-1" } })))).status).toBe(400);
  });
});
