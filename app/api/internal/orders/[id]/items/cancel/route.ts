import { after } from "next/server";
import { z, ZodError } from "zod";
import { getDatabase } from "@/lib/db";
import { verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { createOrderStore, OrderStatusUpdateError } from "@/lib/orders/orders";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { publishAfterCommit, publishCustomerOrderEvent } from "@/lib/orders/live-events";
import { sendPendingCustomerNotifications } from "@/lib/notifications/outbox";
import { staffAttribution } from "@/lib/validators/staff";

const cancellation = z.object({
  lineIds: z.array(z.number().int().positive()).min(1).max(100),
  expectedStatus: z.enum(["placed", "confirmed", "awaiting payment", "paid", "preparing"]),
  ...staffAttribution.shape,
}).strict();

export async function POST(request: Request, context: RouteContext<"/api/internal/orders/[id]/items/cancel">) {
  if (!verifyCreomsCredential(request.headers)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid Order id." }, { status: 400 });
  try {
    const input = cancellation.parse(await request.json());
    const store = createOrderStore(getDatabase());
    const order = await store.cancelItems(id, input.lineIds, input, input.expectedStatus);
    scheduleOrdersChanged();
    after(async () => {
      await publishAfterCommit(store.customerIdForOrder(id), { type: "order.updated", orderId: String(id) }, publishCustomerOrderEvent);
      await sendPendingCustomerNotifications(getDatabase(), id);
    });
    return Response.json(order);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) return Response.json({ error: "Choose this Order's whole line items to cancel." }, { status: 400 });
    if (error instanceof OrderStatusUpdateError) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: "Item cancellation could not be confirmed. Refresh before retrying." }, { status: 503 });
  }
}
