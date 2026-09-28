import { beforeAll, describe, expect, test, vi } from "vitest";

const { handleCallback, deliverApplicationEvent, parseApplicationDeliveryEvent, createHrAtsApiClient } = vi.hoisted(() => ({
  handleCallback: vi.fn((handler: unknown, options: unknown) => ({ handler, options })),
  deliverApplicationEvent: vi.fn(),
  parseApplicationDeliveryEvent: vi.fn(),
  createHrAtsApiClient: vi.fn(() => "client"),
}));

vi.mock("@vercel/queue", () => ({ handleCallback }));
vi.mock("@/lib/careers/hr-ats-delivery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/careers/hr-ats-delivery")>()),
  deliverApplicationEvent,
  parseApplicationDeliveryEvent,
  createHrAtsApiClient,
}));

beforeAll(async () => {
  await import("../app/api/queues/hr-ats-delivery/route");
});

function registeredHandler(): (message: unknown) => Promise<void> {
  return handleCallback.mock.calls[0][0] as (message: unknown) => Promise<void>;
}

type Retry = (error: unknown, metadata: { deliveryCount: number }) => { afterSeconds: number } | { acknowledge: true } | undefined;

function registeredRetry(): Retry {
  return (handleCallback.mock.calls[0][1] as { retry: Retry }).retry;
}

describe("POST /api/queues/hr-ats-delivery (thin adapter)", () => {
  test("registers a handler that parses the message and delivers it via the HR-ATS API client", async () => {
    parseApplicationDeliveryEvent.mockReturnValue({ type: "application.withdrawn", referenceNumber: "BR-1" });
    deliverApplicationEvent.mockResolvedValue(undefined);

    await registeredHandler()({ type: "application.withdrawn", referenceNumber: "BR-1" });

    expect(parseApplicationDeliveryEvent).toHaveBeenCalledWith({ type: "application.withdrawn", referenceNumber: "BR-1" });
    expect(createHrAtsApiClient).toHaveBeenCalled();
    expect(deliverApplicationEvent).toHaveBeenCalledWith({ type: "application.withdrawn", referenceNumber: "BR-1" }, "client");
  });

  test("lets a delivery failure propagate so @vercel/queue retries", async () => {
    parseApplicationDeliveryEvent.mockReturnValue({ type: "application.withdrawn", referenceNumber: "BR-1" });
    deliverApplicationEvent.mockRejectedValue(new Error("HR-ATS unavailable"));

    await expect(registeredHandler()({ type: "application.withdrawn", referenceNumber: "BR-1" })).rejects.toThrow("HR-ATS unavailable");
  });

  test("acknowledges (stops retrying) a message that has failed past the delivery-count threshold", () => {
    expect(registeredRetry()(new Error("still failing"), { deliveryCount: 11 })).toEqual({ acknowledge: true });
  });

  test("backs off with a retry instead of acknowledging at or under the threshold", () => {
    expect(registeredRetry()(new Error("transient"), { deliveryCount: 1 })).toEqual({ afterSeconds: expect.any(Number) });
    expect(registeredRetry()(new Error("transient"), { deliveryCount: 10 })).not.toEqual({ acknowledge: true });
  });
});
