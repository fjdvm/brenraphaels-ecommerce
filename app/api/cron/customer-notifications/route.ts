import { getDatabase } from "@/lib/db";
import { sendPendingCustomerNotifications } from "@/lib/notifications/outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The scheduled job retries Notifications even when nobody has the storefront open. */
export async function GET(request: Request) {
  const secret = process.env.CUSTOMER_NOTIFICATION_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ sent: await sendPendingCustomerNotifications(getDatabase()) });
}
