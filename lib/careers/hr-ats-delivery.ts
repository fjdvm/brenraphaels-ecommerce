import crypto from "node:crypto";

import { send } from "@vercel/queue";
import { z } from "zod";

export const HR_ATS_DELIVERY_TOPIC = "hr-ats-application-delivery";

/** Delivery keeps retrying a poison message until this many attempts, then gives up and alerts. */
export const HR_ATS_DELIVERY_MAX_ATTEMPTS = 10;

const applicationDeliveryEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("application.submitted"),
    referenceNumber: z.string().min(1),
    jobPostingId: z.string().min(1),
    profileSnapshot: z.unknown(),
    documentsSnapshot: z.unknown(),
    consentedAt: z.string(),
  }),
  z.object({
    type: z.literal("application.withdrawn"),
    referenceNumber: z.string().min(1),
  }),
]);

export type ApplicationDeliveryEvent = z.infer<typeof applicationDeliveryEvent>;

/** Validates a dequeued message before it is handed to the HR-ATS API client. */
export function parseApplicationDeliveryEvent(message: unknown): ApplicationDeliveryEvent {
  return applicationDeliveryEvent.parse(message);
}

/** Enqueues a submitted or withdrawn Application for durable, retrying delivery to HR-ATS (ADR-0005). */
export async function enqueueApplicationDelivery(event: ApplicationDeliveryEvent): Promise<void> {
  await send(HR_ATS_DELIVERY_TOPIC, event, { idempotencyKey: `${event.type}:${event.referenceNumber}` });
}

export type HrAtsApiClient = {
  deliverApplication(event: ApplicationDeliveryEvent): Promise<void>;
};

/** Calls the real (or, until it exists, stand-in) HR-ATS API. Throws on any non-2xx or network failure so the queue retries. */
export function createHrAtsApiClient(): HrAtsApiClient {
  return {
    async deliverApplication(event) {
      const baseUrl = process.env.HR_ATS_API_BASE_URL;
      const apiKey = process.env.HR_ATS_API_KEY;
      if (!baseUrl || !apiKey) throw new Error("HR-ATS API is not configured.");

      const response = await fetch(`${baseUrl}/applications/${encodeURIComponent(event.referenceNumber)}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });
      if (!response.ok) throw new Error(`HR-ATS delivery failed with status ${response.status}`);
    },
  };
}

/** The queue consumer's delivery-triggering logic: hand a dequeued event to the HR-ATS API client. */
export async function deliverApplicationEvent(
  event: ApplicationDeliveryEvent,
  client: Pick<HrAtsApiClient, "deliverApplication">,
): Promise<void> {
  await client.deliverApplication(event);
}

/** Verifies the interim shared-secret credential the stand-in HR-ATS-receiving endpoint checks (ADR-0003's placeholder pattern, mirrored for ADR-0005). */
export function verifyInternalHrAtsApiKey(headers: Headers) {
  const secret = process.env.HR_ATS_API_KEY;
  const supplied = headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) throw new Error("Missing HR-ATS API key.");

  const expected = Buffer.from(secret);
  const received = Buffer.from(supplied);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error("Invalid HR-ATS API key.");
  }
}
