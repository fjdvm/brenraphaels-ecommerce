import { after } from "next/server";
import { getDatabase } from "@/lib/db";
import { sendExpiredOrderEmails } from "@/lib/email/payment-expired";
import { createStockReservations } from "@/lib/orders/stock-reservations";
import { sendPendingCustomerNotifications } from "@/lib/notifications/outbox";
import { publishCustomerOrderEvent } from "@/lib/orders/live-events";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Server-scheduled lifecycle work, never a browser stock poll. */
export async function GET(request: Request) {
  const secret = process.env.CUSTOMER_NOTIFICATION_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const maintenance = createStockReservations(getDatabase());
  const cancelled = await maintenance.expire(new Date(), async (customerId, orderId) => {
    await publishCustomerOrderEvent(customerId, { type: "order.updated", orderId: String(orderId) });
  });
  if (cancelled) scheduleOrdersChanged();
  after(async () => {
    await maintenance.drain();
    await maintenance.sendPending();
    try { await sendExpiredOrderEmails(getDatabase()); } catch (error) { console.error("Order-expired emails will be retried by the next run", error); }
    await sendPendingCustomerNotifications(getDatabase());
  });
  return Response.json({ cancelled });
}
