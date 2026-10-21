import { writeAuditEvent } from "@/lib/audit/gateway";
import { getDatabase } from "@/lib/db";
import { createFeedbackRequestStore, sendDueFeedbackRequests } from "@/lib/orders/feedback-requests";
import { sendFeedbackRequest } from "@/lib/notifications/gateway";

export const runtime = "nodejs";

/** Daily Vercel Cron job; Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sent = await sendDueFeedbackRequests(new Date(), {
    store: createFeedbackRequestStore(getDatabase()),
    send: (feedbackRequest) => sendFeedbackRequest(feedbackRequest),
    audit: writeAuditEvent,
  });
  return Response.json({ sent });
}
