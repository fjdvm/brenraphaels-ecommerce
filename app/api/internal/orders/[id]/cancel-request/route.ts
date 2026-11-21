import { after } from "next/server";
import { z, ZodError } from "zod";
import { getDatabase } from "@/lib/db";
import { sendOrderCancelledEmail } from "@/lib/email/order-cancelled-email";
import { sendPendingCustomerNotifications } from "@/lib/notifications/outbox";
import { CancelRequestError } from "@/lib/orders/cancel-requests";
import { verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { publishAfterCommit, publishCustomerOrderEvent } from "@/lib/orders/live-events";
import { createOrderStore, OrderStatusUpdateError } from "@/lib/orders/orders";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { createStockReservations } from "@/lib/orders/stock-reservations";
import { orderCancelRequests } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { staffAttribution } from "@/lib/validators/staff";
import { textField } from "@/lib/validators/fields";

export const runtime = "nodejs";

const reason = textField("Reason", { min: 1, max: 1000, pattern: /^[^<>\p{Cc}]+$/u, patternMessage: "Enter plain text without markup or control characters", rejectInvisible: true });
const decision = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approved"), requestId: z.uuid(), ...staffAttribution.shape }).strict(),
  z.object({ decision: z.literal("declined"), requestId: z.uuid(), reason, ...staffAttribution.shape }).strict(),
]);

/** Staff or a Manager approves or declines a Customer's cancellation request. Only CREOMS's signed credential may call it. */
export async function POST(request: Request, context: RouteContext<"/api/internal/orders/[id]/cancel-request">) {
  if (!verifyCreomsCredential(request.headers)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid Order number." }, { status: 400 });
  try {
    const input = decision.parse(await request.json());
    const db = getDatabase(), store = createOrderStore(db);
    const status = input.decision;
    if (input.decision === "declined") {
      await store.declineCancel(id, input.requestId, input.reason, { staffId: input.staffId, staffName: input.staffName });
    } else {
      const [existing] = await db.select({ status: orderCancelRequests.status, reason: orderCancelRequests.reason }).from(orderCancelRequests)
        .where(and(eq(orderCancelRequests.id, input.requestId), eq(orderCancelRequests.orderId, id)));
      if (!existing) throw new CancelRequestError("Cancellation request was not found.");
      if (existing.status === "approved") return Response.json({ id, requestId: input.requestId, status });
      const order = await store.advance(id, { status: "cancelled", cancelReason: existing.reason, cancelRequestId: input.requestId, staffId: input.staffId, staffName: input.staffName });
      after(async () => {
        try {
          const recipient = await store.customerEmailForOrder(id);
          if (recipient) await sendOrderCancelledEmail(recipient, order);
        } catch (error) { console.error("Order-cancelled email could not be sent", error); }
      });
    }
    scheduleOrdersChanged();
    after(async () => {
      await publishAfterCommit(store.customerIdForOrder(id), { type: "order.updated", orderId: String(id) }, publishCustomerOrderEvent);
      await createStockReservations(db).sendPending();
      try { await sendPendingCustomerNotifications(db, id); } catch (error) { console.error("Customer Notification delivery will be retried by the cron job", error); }
    });
    return Response.json({ id, requestId: input.requestId, status });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON." }, { status: 400 });
    if (error instanceof CancelRequestError || error instanceof OrderStatusUpdateError) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: "The decision could not be confirmed. Refresh the Order before retrying." }, { status: 503 });
  }
}
