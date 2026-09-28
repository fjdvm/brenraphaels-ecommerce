import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

let put: (request: Request, context: { params: Promise<{ referenceNumber: string }> }) => Promise<Response>;

beforeAll(async () => {
  ({ PUT: put } = await import("../app/api/internal/hr-ats/applications/[referenceNumber]/route"));
});

afterEach(() => vi.unstubAllEnvs());

function deliveryRequest(body: unknown, apiKey?: string) {
  return new Request("https://shop.example.test/api/internal/hr-ats/applications/BR-20260928-0001", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(apiKey !== undefined ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ referenceNumber: "BR-20260928-0001" }) };

describe("PUT /api/internal/hr-ats/applications/[referenceNumber]", () => {
  test("accepts a delivery signed with the shared HR-ATS API key, adopting the Reference number as its own id", async () => {
    vi.stubEnv("HR_ATS_API_KEY", "test-key");
    const event = { type: "application.submitted", referenceNumber: "BR-20260928-0001", jobPostingId: "ats-1", profileSnapshot: {}, documentsSnapshot: [], consentedAt: "2026-09-28T10:00:00.000Z" };

    const response = await put(deliveryRequest(event, "test-key"), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "BR-20260928-0001" });
  });

  test("rejects a missing or invalid API key", async () => {
    vi.stubEnv("HR_ATS_API_KEY", "test-key");
    const event = { type: "application.withdrawn", referenceNumber: "BR-20260928-0001" };

    expect((await put(deliveryRequest(event), context)).status).toBe(400);
    expect((await put(deliveryRequest(event, "wrong-key"), context)).status).toBe(400);
  });

  test("rejects a malformed delivery payload", async () => {
    vi.stubEnv("HR_ATS_API_KEY", "test-key");

    expect((await put(deliveryRequest({ type: "application.submitted" }, "test-key"), context)).status).toBe(400);
  });

  test("rejects a payload whose Reference number does not match the URL", async () => {
    vi.stubEnv("HR_ATS_API_KEY", "test-key");
    const event = { type: "application.withdrawn", referenceNumber: "BR-99999999-9999" };

    expect((await put(deliveryRequest(event, "test-key"), context)).status).toBe(400);
  });
});
