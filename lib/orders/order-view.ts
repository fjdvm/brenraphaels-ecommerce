import type { Order, OrderStatus } from "./orders";

/** The slice of an Order that decides how it is presented on the My orders page. */
export type OrderView = Pick<Order, "fulfillmentMethod" | "paymentMethod" | "status" | "deliveryFeeInCentavos" | "paymentProof">;

export type TrackerStep = { label: string; state: "done" | "current" | "upcoming" };
export type OrderFilter = "to-pay" | "processing" | "on-the-way" | "completed" | "cancelled";
export type OrderBadge = { text: string; tone: "lavender" | "neutral" | "warning" };

const stageByStatus: Record<Exclude<OrderStatus, "cancelled">, number> = {
  placed: 0,
  confirmed: 1,
  "awaiting payment": 1,
  paid: 1,
  preparing: 2,
  dispatched: 3,
  delivered: 4,
};

/** The five stops of an Order's journey, or null when a cancelled Order has no journey to show. */
export function orderTrackerSteps(order: OrderView): TrackerStep[] | null {
  if (order.status === "cancelled") return null;
  const labels = [
    "Placed",
    "Confirmed",
    "Preparing",
    order.fulfillmentMethod === "pickup" ? "Ready for pickup" : "Out for delivery",
    "Completed",
  ];
  const stage = stageByStatus[order.status];
  return labels.map((label, index) => ({
    label,
    state: order.status === "delivered" || index < stage ? "done" : index === stage ? "current" : "upcoming",
  }));
}

/** A GCash Order is waiting on the Customer once staff confirmed it and no proof has been sent. */
export function needsPayment(order: OrderView) {
  return order.paymentMethod === "gcash" && order.status === "confirmed" && order.paymentProof === null;
}

/** A Delivery Order whose fee staff have not quoted yet. */
export function awaitingDeliveryFee(order: OrderView) {
  return order.fulfillmentMethod === "delivery"
    && order.deliveryFeeInCentavos === null
    && order.status !== "cancelled"
    && order.status !== "delivered";
}

export function orderFilterOf(order: OrderView): OrderFilter {
  if (order.status === "cancelled") return "cancelled";
  if (order.status === "delivered") return "completed";
  if (order.status === "dispatched") return "on-the-way";
  return needsPayment(order) ? "to-pay" : "processing";
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function orderBadges(order: OrderView): OrderBadge[] {
  const badges: OrderBadge[] = [
    { text: capitalise(order.status), tone: order.status === "placed" || order.status === "cancelled" ? "neutral" : "lavender" },
  ];
  if (needsPayment(order)) badges.push({ text: "Payment needed", tone: "warning" });
  if (awaitingDeliveryFee(order)) badges.push({ text: "Delivery fee pending", tone: "warning" });
  return badges;
}

const placedAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

/** "Oct 16, 2026 · 2:14 PM", always in the shop's time zone. */
export function formatPlacedAt(date: Date) {
  const parts = Object.fromEntries(placedAt.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.month} ${parts.day}, ${parts.year} · ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

/** Subtotal plus the delivery fee once staff have quoted it. */
export function orderTotalInCentavos(order: Pick<Order, "subtotalInCentavos" | "deliveryFeeInCentavos">) {
  return order.subtotalInCentavos + (order.deliveryFeeInCentavos ?? 0);
}
