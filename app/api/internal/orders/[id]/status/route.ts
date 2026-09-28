import { getDatabase } from "@/lib/db";
import { sendOrderConfirmedEmail } from "@/lib/email/order-confirmed-email";
import { verifyInternalOrderStatusUpdate } from "@/lib/orders/internal-status";
import { createOrderStore } from "@/lib/orders/orders";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/internal/orders/[id]/status">,
) {
  const { id } = await context.params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return Response.json({ error: "Invalid Order status request" }, { status: 400 });
  }

  try {
    const update = verifyInternalOrderStatusUpdate(await request.json(), request.headers);
    const orderStore = createOrderStore(getDatabase());
    const order = await orderStore.advance(orderId, update);
    if (
      order.status === "confirmed"
      && order.fulfillmentMethod === "delivery"
      && order.deliveryFeeInCentavos !== null
    ) {
      const recipient = await orderStore.customerEmailForOrder(order.id);
      if (recipient) {
        try {
          await sendOrderConfirmedEmail(recipient, order);
        } catch (error) {
          console.error("Order-confirmed email could not be sent", error);
        }
      }
    }
    return Response.json(order);
  } catch {
    return Response.json({ error: "Invalid Order status request" }, { status: 400 });
  }
}
