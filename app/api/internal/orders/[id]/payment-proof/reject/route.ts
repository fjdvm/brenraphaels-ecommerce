import { after } from "next/server";
import { z, ZodError } from "zod";

import { getDatabase } from "@/lib/db";
import { sendOnceAndRecord } from "@/lib/email/outcomes";
import { sendPaymentEmail } from "@/lib/email/payment-emails";
import { sendPendingCustomerNotifications } from "@/lib/notifications/outbox";
import { verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { publishAfterCommit, publishCustomerOrderEvent } from "@/lib/orders/live-events";
import { createOrderStore, OrderStatusUpdateError } from "@/lib/orders/orders";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { staffAttribution } from "@/lib/validators/staff";

export const runtime = "nodejs";

const rejection = z.object({ reason: z.string().trim().min(1).max(500), ...staffAttribution.shape }).strict();

/** Staff reject the latest proof with a reason; the Customer is emailed the re-upload link once. */
export async function POST(request: Request, context: RouteContext<"/api/internal/orders/[id]/payment-proof/reject">) {
  if (!verifyCreomsCredential(request.headers)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid Order id." }, { status: 400 });

  try {
    const input = rejection.parse(await request.json());
    const store = createOrderStore(getDatabase());
    const { order, rejections, managerReview } = await store.rejectPaymentProof(id, input);
    scheduleOrdersChanged();
    after(async () => {
      await publishAfterCommit(store.customerIdForOrder(id), { type: "order.updated", orderId: String(id) }, publishCustomerOrderEvent);
      try {
        const recipient = await store.customerEmailForOrder(id);
        if (recipient) {
          // The third rejection sends only the Manager review email. Each rejection is its own occurrence, so a retry never repeats it and two real rejections each get one.
          const kind = managerReview ? "manager-review-started" : "payment-rejected";
          const occurrence = managerReview ? "" : String(rejections);
          await sendOnceAndRecord(id, kind, (email) => sendPaymentEmail(kind, recipient, order, email, occurrence), getDatabase(), occurrence);
        }
      } catch (error) {
        console.error("Payment-rejected email outcome could not be recorded", error);
      }
      try { await sendPendingCustomerNotifications(getDatabase(), id); }
      catch (error) { console.error("Customer Notification delivery will be retried by the cron job", error); }
    });
    return Response.json({ id: order.id, status: order.status, rejections, managerReview, deliveryFeeInCentavos: order.deliveryFeeInCentavos });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) return Response.json({ error: "Enter a reason for rejecting the proof." }, { status: 400 });
    if (error instanceof OrderStatusUpdateError) return Response.json({ error: error.message }, { status: error.message === "Order was not found." ? 404 : 409 });
    return Response.json({ error: "The rejection could not be confirmed. Refresh before retrying." }, { status: 503 });
  }
}
