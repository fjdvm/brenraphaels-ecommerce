import { handleCallback } from "@vercel/queue";

import {
  createHrAtsApiClient,
  deliverApplicationEvent,
  HR_ATS_DELIVERY_MAX_ATTEMPTS,
  parseApplicationDeliveryEvent,
} from "@/lib/careers/hr-ats-delivery";

export const runtime = "nodejs";

export const POST = handleCallback(
  async (message) => {
    const event = parseApplicationDeliveryEvent(message);
    await deliverApplicationEvent(event, createHrAtsApiClient());
  },
  {
    retry: (error, metadata) => {
      if (metadata.deliveryCount > HR_ATS_DELIVERY_MAX_ATTEMPTS) {
        console.error("HR-ATS delivery permanently failed after repeated retries", {
          messageId: metadata.messageId,
          deliveryCount: metadata.deliveryCount,
          error,
        });
        return { acknowledge: true };
      }
      return { afterSeconds: Math.min(300, 2 ** metadata.deliveryCount * 5) };
    },
  },
);
