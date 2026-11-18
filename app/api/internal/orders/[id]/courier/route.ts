import { after } from "next/server";
import { ZodError, z } from "zod";

import { getDatabase } from "@/lib/db";
import { verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { publishAfterCommit, publishCustomerOrderEvent } from "@/lib/orders/live-events";
import { createOrderStore, OrderStatusUpdateError } from "@/lib/orders/orders";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { courierBooking } from "@/lib/validators/courier";
import { staffAttribution } from "@/lib/validators/staff";

export const runtime = "nodejs";

const body = z.object({ courier: courierBooking, ...staffAttribution.shape }).strict();

/**
 * Staff add or fix the courier booking of a dispatched Delivery Order: the link, the courier or the rider details.
 * It replaces the whole booking and never emails the Customer again; the Customer's Order page updates live.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/internal/orders/[id]/courier">,
) {
  if (!verifyCreomsCredential(request.headers)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orderId = Number((await context.params).id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return Response.json({ error: "Invalid Order id." }, { status: 400 });
  }

  try {
    const { courier } = body.parse(await request.json());
    const orderStore = createOrderStore(getDatabase());
    const order = await orderStore.updateCourier(orderId, courier);
    scheduleOrdersChanged();
    after(async () => {
      await publishAfterCommit(
        orderStore.customerIdForOrder(order.id),
        { type: "order.updated", orderId: String(order.id) },
        publishCustomerOrderEvent,
      );
    });
    // Internal answer for CREOMS only; rider details never reach the Customer.
    return Response.json({ id: order.id, status: order.status, courier: { name: order.courier?.name, trackingUrl: order.courier?.trackingUrl ?? null }, deliveryFeeInCentavos: order.deliveryFeeInCentavos });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    if (error instanceof OrderStatusUpdateError) return Response.json({ error: error.message }, { status: error.message === "Order was not found." ? 404 : 409 });
    return Response.json({ error: "The booking could not be saved. Refresh the Order before retrying." }, { status: 503 });
  }
}
