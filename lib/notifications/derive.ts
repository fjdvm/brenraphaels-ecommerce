import { awaitingDeliveryFee, needsPayment } from "../orders/order-view";
import type { Order } from "../orders/orders";
import type { Ticket } from "../support/tickets";

export type NotificationItem = {
  id: string;
  category: "orders" | "support";
  icon: "support" | "payment" | "confirmed" | "delivery" | "order";
  title: string;
  body: string;
  at: Date;
  /** Something the Customer still has to do; shown highlighted until it is dealt with. */
  needsAction: boolean;
  href?: string;
  actionLabel?: string;
};

function statusNotification(order: Order): NotificationItem {
  const base = { id: `order-${order.id}-status`, category: "orders" as const, at: order.createdAt, needsAction: false };
  const pickup = order.fulfillmentMethod === "pickup";
  if (awaitingDeliveryFee(order)) {
    return {
      ...base,
      icon: "delivery",
      title: `Delivery fee pending · Order #${order.id}`,
      body: "We'll message you the delivery fee before dispatch.",
    };
  }
  switch (order.status) {
    case "placed":
      return { ...base, icon: "order", title: `Order #${order.id} placed`, body: "We've received your order and will confirm it shortly." };
    case "confirmed":
    case "awaiting payment":
    case "paid":
      return {
        ...base,
        icon: "confirmed",
        title: `Order #${order.id} confirmed`,
        body: pickup
          ? "We've confirmed your order. Pickup at our Antipolo store once it's ready."
          : "We've confirmed your order and will deliver it to you.",
      };
    case "preparing":
      return { ...base, icon: "order", title: `Order #${order.id} is being prepared`, body: "Our team is getting your order ready." };
    case "dispatched":
      return {
        ...base,
        icon: "delivery",
        title: pickup ? `Order #${order.id} is ready for pickup` : `Order #${order.id} is on the way`,
        body: pickup ? "Drop by our Antipolo store whenever you're ready." : "Your order has left our store.",
      };
    case "delivered":
    case "received":
      return { ...base, icon: "confirmed", title: `Order #${order.id} completed`, body: "Thanks for ordering from Bren Raphael's." };
    case "cancelled":
      return { ...base, icon: "order", title: `Order #${order.id} cancelled`, body: "This order has been cancelled." };
  }
}

/** Builds the Customer's feed from their Orders and Support Tickets; nothing is stored. */
export function deriveNotifications({ orders, tickets }: { orders: Order[]; tickets: Ticket[] }): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const ticket of tickets) {
    const last = ticket.messages.at(-1);
    if (ticket.status !== "open" || last?.sender !== "staff") continue;
    items.push({
      id: `ticket-${ticket.id}-reply`,
      category: "support",
      icon: "support",
      title: `New reply from Customer Care · ${ticket.subject}`,
      body: `“${last.body}”`,
      at: last.createdAt,
      needsAction: true,
      href: `/support/${ticket.id}`,
      actionLabel: "Open conversation",
    });
  }

  for (const order of orders) {
    if (needsPayment(order)) {
      items.push({
        id: `order-${order.id}-payment`,
        category: "orders",
        icon: "payment",
        title: `Payment needed for Order #${order.id}`,
        body: "Submit your GCash reference number so we can prepare your order.",
        at: order.createdAt,
        needsAction: true,
        href: "/profile/orders",
        actionLabel: "Pay now",
      });
    }
    items.push(statusNotification(order));
  }

  // Stable for equal times: the payment prompt stays above its Order's status note.
  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}
