import { getDatabase } from "@/lib/db";
import { sendOrderConfirmedEmail } from "@/lib/email/order-confirmed-email";
import { sendOrderDeliveredEmail } from "@/lib/email/order-delivered-email";
import { sendOrderPaidEmail } from "@/lib/email/order-paid-email";
import { verifyInternalOrderStatusUpdate } from "@/lib/orders/internal-status";
import { createOrderStore, type Order, type OrderStore } from "@/lib/orders/orders";

export const runtime = "nodejs";

/** A failed or slow status-change email must never fail the status update itself. */
async function notifyCustomer(
  orderStore: OrderStore,
  order: Order,
  label: string,
  send: (recipient: string, order: Order) => Promise<void>,
) {
  const recipient = await orderStore.customerEmailForOrder(order.id);
  if (!recipient) return;
  try {
    await send(recipient, order);
  } catch (error) {
    console.error(`Order-${label} email could not be sent`, error);
  }
}

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
      await notifyCustomer(orderStore, order, "confirmed", sendOrderConfirmedEmail);
    }
    if (order.status === "paid") {
      await notifyCustomer(orderStore, order, "paid", sendOrderPaidEmail);
    }
    if (order.status === "delivered") {
      await notifyCustomer(orderStore, order, "delivered", sendOrderDeliveredEmail);
    }
    return Response.json(order);
  } catch {
    return Response.json({ error: "Invalid Order status request" }, { status: 400 });
  }
}
