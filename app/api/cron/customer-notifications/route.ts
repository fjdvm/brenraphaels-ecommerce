import { getDatabase } from "@/lib/db";
import { retryFailedOrderEmails } from "@/lib/email/retry";
import { sendPendingCustomerNotifications } from "@/lib/notifications/outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The scheduled job retries Notifications and failed Order emails even when nobody has the storefront open. */
export async function GET(request: Request) {
  const secret = process.env.CUSTOMER_NOTIFICATION_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sent = await sendPendingCustomerNotifications(getDatabase());
  let emailsSent = 0;
  try {
    emailsSent = await retryFailedOrderEmails();
  } catch (error) {
    console.error("Order emails will be retried", error);
  }
  return Response.json({ sent, emailsSent });
}
