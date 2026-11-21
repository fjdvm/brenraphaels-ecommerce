import { createStockReservations } from "@/lib/orders/stock-reservations";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { after } from "next/server";
import { ZodError } from "zod";

import { sendPendingCustomerNotifications } from "@/lib/notifications/outbox";
import { getDatabase } from "@/lib/db";
import { sendOrderConfirmedEmail } from "@/lib/email/order-confirmed-email";
import { sendFulfilmentEmail, type FulfilmentEmailKind } from "@/lib/email/fulfilment-emails";
import { sendOrderDeliveryConfirmedEmail } from "@/lib/email/order-delivery-confirmed-email";
import { sendOnceAndRecord } from "@/lib/email/outcomes";
import { sendOrderPickupConfirmedEmail } from "@/lib/email/order-pickup-confirmed-email";
import { sendOrderOnlineDeliveryConfirmedEmail } from "@/lib/email/order-online-delivery-confirmed-email";
import { sendOrderOnlinePickupConfirmedEmail } from "@/lib/email/order-online-pickup-confirmed-email";
import { sendPaymentEmail } from "@/lib/email/payment-emails";
import { ORDER_CANCELLED_BY_SHOP_EMAIL_KIND, sendOrderCancelledByShopEmail } from "@/lib/email/order-rejected-email";
import { DeliveryPhotoUnavailable, InvalidDeliveryPhoto, verifyDeliveryPhoto } from "@/lib/orders/verify-delivery-photo";
import { verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { parseInternalOrderStatusUpdate } from "@/lib/orders/internal-status";
import { publishAfterCommit, publishCustomerOrderEvent } from "@/lib/orders/live-events";
import { isPrepaid } from "@/lib/orders/payment-methods";
import { createOrderStore, OrderStatusUpdateError, type Order, type OrderStore } from "@/lib/orders/orders";

export const runtime = "nodejs";

/** A failed or slow status-change email must never fail the status update itself. */
async function notifyCustomer(
  orderStore: OrderStore,
  order: Order,
  label: string,
  send: (recipient: string, order: Order) => Promise<void>,
) {
  try {
    const recipient = await orderStore.customerEmailForOrder(order.id);
    if (!recipient) return;
    await send(recipient, order);
  } catch (error) {
    console.error(`Order-${label} email could not be sent`, error);
  }
}

/** Records and sends one fulfilment Status email at most once per Order, so an edit or repeated save never sends a second. */
async function sendFulfilment(orderStore: OrderStore, order: Order, kind: FulfilmentEmailKind) {
  try {
    const recipient = await orderStore.customerEmailForOrder(order.id);
    if (recipient) await sendOnceAndRecord(order.id, kind, (email) => sendFulfilmentEmail(kind, recipient, order, email));
  } catch (error) {
    console.error(`Order-${kind} email outcome could not be recorded`, error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/internal/orders/[id]/status">,
) {
  if (!verifyCreomsCredential(request.headers)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return Response.json({ error: "Invalid Order id." }, { status: 400 });
  }

  try {
    const update = parseInternalOrderStatusUpdate(await request.json());
    if (update.status === "delivered") await verifyDeliveryPhoto(update.deliveryPhotoFileId);
    const orderStore = createOrderStore(getDatabase());
    let replayed = false;
    let order: Order;
    if (update.status === "confirmed") {
      const { status: _status, ...amounts } = update;
      void _status;
      ({ order, replayed } = await orderStore.confirm(orderId, amounts));
    } else {
      order = await orderStore.advance(orderId, update);
    }
    scheduleOrdersChanged();
    // Confirm the committed change before email or gateway latency can exhaust CREOMS's timeout.
    after(async () => {
      await publishAfterCommit(
        orderStore.customerIdForOrder(order.id),
        { type: "order.updated", orderId: String(order.id) },
        publishCustomerOrderEvent,
      );
      if (update.status === "preparing") {
        try { await createStockReservations(getDatabase()).sendPending(); }
        catch (error) { console.error("Packing audit delivery remains queued for the cron job", error); }
      }
      if (
        update.status === "confirmed"
        && !replayed
        && order.fulfillmentMethod === "delivery"
        && order.deliveryFeeInCentavos !== null
      ) {
        if (order.paymentMethod === "cash-on-delivery" || isPrepaid(order.paymentMethod)) {
          const online = isPrepaid(order.paymentMethod);
          try {
            const recipient = await orderStore.customerEmailForOrder(order.id);
            if (recipient) {
              await sendOnceAndRecord(
                order.id,
                online ? "online-delivery-confirmed" : "delivery-confirmed",
                (email) => online ? sendOrderOnlineDeliveryConfirmedEmail(recipient, order, email) : sendOrderDeliveryConfirmedEmail(recipient, order, email),
              );
            }
          } catch (error) {
            console.error("Delivery confirmation email outcome could not be recorded", error);
          }
        } else {
          await notifyCustomer(orderStore, order, "confirmed", sendOrderConfirmedEmail);
        }
      }
      if (
        update.status === "confirmed"
        && !replayed
        && order.fulfillmentMethod === "pickup"
      ) {
        const online = isPrepaid(order.paymentMethod);
        try {
          const recipient = await orderStore.customerEmailForOrder(order.id);
          if (recipient) {
            await sendOnceAndRecord(
              order.id,
              online ? "online-pickup-confirmed" : "pickup-confirmed",
              (email) => online ? sendOrderOnlinePickupConfirmedEmail(recipient, order, email) : sendOrderPickupConfirmedEmail(recipient, order, email),
            );
          }
        } catch (error) {
          console.error("Pickup confirmation email outcome could not be recorded", error);
        }
      }
      if (update.status === "paid") {
        try {
          const recipient = await orderStore.customerEmailForOrder(order.id);
          if (recipient) await sendOnceAndRecord(order.id, "payment-verified", (email) => sendPaymentEmail("payment-verified", recipient, order, email));
        } catch (error) {
          console.error("Payment-verified email outcome could not be recorded", error);
        }
      }
      if (update.status === "cancelled") {
        try {
          const recipient = await orderStore.customerEmailForOrder(order.id);
          if (recipient) await sendOnceAndRecord(order.id, ORDER_CANCELLED_BY_SHOP_EMAIL_KIND, (email) => sendOrderCancelledByShopEmail(recipient, order, email));
        } catch (error) {
          console.error("Shop cancellation email outcome could not be recorded", error);
        }
      }
      if (update.status === "preparing") await sendFulfilment(orderStore, order, "preparing");
      if (update.status === "dispatched" && order.courier) await sendFulfilment(orderStore, order, "dispatched");
      if (update.status === "ready for pickup") await sendFulfilment(orderStore, order, "ready-for-pickup");
      if (update.status === "delivered" || update.status === "collected") await sendFulfilment(orderStore, order, "completed");
      try {
        await sendPendingCustomerNotifications(getDatabase(), order.id);
      } catch (error) {
        console.error("Customer Notification delivery will be retried by the cron job", error);
      }
    });
    return Response.json(order);
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    if (error instanceof OrderStatusUpdateError) return Response.json({ error: error.message }, { status: error.message === "Order was not found." ? 404 : 409 });
    if (error instanceof InvalidDeliveryPhoto) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof DeliveryPhotoUnavailable) return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ error: "Order status change could not be confirmed. Refresh before retrying." }, { status: 503 });
  }
}
