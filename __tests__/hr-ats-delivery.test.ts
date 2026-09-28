import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createHrAtsApiClient,
  deliverApplicationEvent,
  parseApplicationDeliveryEvent,
  verifyInternalHrAtsApiKey,
  type ApplicationDeliveryEvent,
} from "../lib/careers/hr-ats-delivery";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const submittedEvent: ApplicationDeliveryEvent = {
  type: "application.submitted",
  referenceNumber: "BR-20260928-0001",
  jobPostingId: "ats-1",
  profileSnapshot: { fullName: "Jane Doe" },
  documentsSnapshot: [{ id: 7, name: "resume.pdf" }],
  consentedAt: "2026-09-28T10:00:00.000Z",
};

describe("deliverApplicationEvent", () => {
  test("hands the event to the HR-ATS API client", async () => {
    const client = { deliverApplication: vi.fn().mockResolvedValue(undefined) };

    await deliverApplicationEvent(submittedEvent, client);

    expect(client.deliverApplication).toHaveBeenCalledWith(submittedEvent);
  });

  test("propagates a client failure so the queue retries", async () => {
    const client = { deliverApplication: vi.fn().mockRejectedValue(new Error("HR-ATS unavailable")) };

    await expect(deliverApplicationEvent(submittedEvent, client)).rejects.toThrow("HR-ATS unavailable");
  });
});

describe("parseApplicationDeliveryEvent", () => {
  test("accepts a well-formed submitted or withdrawn event", () => {
    expect(parseApplicationDeliveryEvent(submittedEvent)).toEqual(submittedEvent);
    expect(parseApplicationDeliveryEvent({ type: "application.withdrawn", referenceNumber: "BR-20260928-0001" }))
      .toEqual({ type: "application.withdrawn", referenceNumber: "BR-20260928-0001" });
  });

  test("rejects a malformed or unrecognized event", () => {
    expect(() => parseApplicationDeliveryEvent({ type: "application.submitted" })).toThrow();
    expect(() => parseApplicationDeliveryEvent({ type: "application.hired", referenceNumber: "BR-1" })).toThrow();
    expect(() => parseApplicationDeliveryEvent(null)).toThrow();
  });
});

describe("createHrAtsApiClient", () => {
  test("PUTs the event to HR_ATS_API_BASE_URL, authorized with HR_ATS_API_KEY", async () => {
    vi.stubEnv("HR_ATS_API_BASE_URL", "https://hr-ats.example.test/api");
    vi.stubEnv("HR_ATS_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await createHrAtsApiClient().deliverApplication(submittedEvent);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hr-ats.example.test/api/applications/BR-20260928-0001",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "Authorization": "Bearer test-key", "Content-Type": "application/json" }),
        body: JSON.stringify(submittedEvent),
      }),
    );
  });

  test("throws on a non-2xx response so the caller retries", async () => {
    vi.stubEnv("HR_ATS_API_BASE_URL", "https://hr-ats.example.test/api");
    vi.stubEnv("HR_ATS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(createHrAtsApiClient().deliverApplication(submittedEvent)).rejects.toThrow("503");
  });

  test("throws when HR-ATS is not configured", async () => {
    vi.stubEnv("HR_ATS_API_BASE_URL", "");
    vi.stubEnv("HR_ATS_API_KEY", "");

    await expect(createHrAtsApiClient().deliverApplication(submittedEvent)).rejects.toThrow("not configured");
  });
});

describe("verifyInternalHrAtsApiKey", () => {
  test("accepts the shared HR_ATS_API_KEY as a Bearer credential", () => {
    vi.stubEnv("HR_ATS_API_KEY", "test-key");
    expect(() => verifyInternalHrAtsApiKey(new Headers({ Authorization: "Bearer test-key" }))).not.toThrow();
  });

  test("rejects a missing or invalid credential", () => {
    vi.stubEnv("HR_ATS_API_KEY", "test-key");
    expect(() => verifyInternalHrAtsApiKey(new Headers())).toThrow();
    expect(() => verifyInternalHrAtsApiKey(new Headers({ Authorization: "Bearer wrong-key" }))).toThrow();
  });
});
