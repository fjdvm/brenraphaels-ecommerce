import { storeSchedule, closedDay, address } from "../site/store-info";
import { deliveryFeeRange } from "./policy";
import type { QuestionKind } from "./policy";

/** The part of a Customer's own Order the assistant may read: status words, dates and the courier link. No name, address, phone or amounts. */
export type AssistantOrder = {
  id: number;
  status: string;
  fulfillmentMethod: "pickup" | "delivery";
  paymentMethod: string;
  createdAt: Date;
  paidAt: Date | null;
  deliveredAt: Date | null;
  receivedAt: Date | null;
  refundWindowExtended: boolean;
  courierName: string | null;
  courierTrackingUrl: string | null;
  proofSubmitted: boolean;
  proofRejected: boolean;
  feePending: boolean;
};

export type Card = { title: string; lines: { label: string; value: string }[] };

const when = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila",
});

/** "Nov 17, 2026, 2:14 PM" in the shop's time zone; the one date format the fact check recognises. */
export function formatWhen(date: Date): string {
  return when.format(date);
}

const day = 24 * 60 * 60 * 1000;

export function paymentWords(order: AssistantOrder): string {
  if (order.status === "cancelled") return "not applicable, the order is cancelled";
  if (order.paidAt) return "paid";
  if (order.paymentMethod === "cash-on-delivery") return "cash on delivery, paid when it arrives";
  if (order.proofSubmitted && order.proofRejected) return "last payment proof was turned down, a new proof is needed";
  if (order.proofSubmitted) return "payment proof sent, waiting for the team to check it";
  if (order.status === "placed") return "not yet due, the team has not confirmed the order";
  return "waiting for your payment proof";
}

export function returnWindowEnds(order: AssistantOrder): Date | null {
  if (!order.deliveredAt || order.status === "cancelled") return null;
  return new Date(order.deliveredAt.getTime() + day * (order.refundWindowExtended ? 2 : 1));
}

/** The Order card: every fact is written by our code from the record, never by the model. */
export function orderCard(order: AssistantOrder, now: Date): Card {
  const lines: Card["lines"] = [
    { label: "Order", value: `#${order.id}` },
    { label: "Status", value: order.status },
    { label: "Fulfilment", value: order.fulfillmentMethod },
    { label: "Payment", value: paymentWords(order) },
    { label: "Placed", value: formatWhen(order.createdAt) },
  ];
  if (order.paidAt) lines.push({ label: "Paid", value: formatWhen(order.paidAt) });
  if (order.courierName && order.courierTrackingUrl) {
    lines.push({ label: "Courier", value: order.courierName }, { label: "Tracking link", value: order.courierTrackingUrl });
  }
  if (order.feePending) lines.push({ label: "Delivery fee", value: "a teammate will confirm it" });
  if (order.deliveredAt) lines.push({ label: order.fulfillmentMethod === "pickup" ? "Picked up" : "Delivered", value: formatWhen(order.deliveredAt) });
  if (order.receivedAt) lines.push({ label: "Received", value: formatWhen(order.receivedAt) });
  const ends = returnWindowEnds(order);
  if (ends && !order.receivedAt) {
    lines.push({ label: "Return window", value: ends.getTime() > now.getTime() ? `open until ${formatWhen(ends)}` : `closed since ${formatWhen(ends)}` });
  }
  return { title: `Order #${order.id}`, lines };
}

export const deliveryFeeText = `Delivery fees usually fall between ₱${deliveryFeeRange.fromPesos} and ₱${deliveryFeeRange.toPesos}, depending on the location. A teammate confirms the fee before your order is packed.`;

export const shopInfoText = `Pickup is at our store: ${address}. Hours: ${storeSchedule.map((row) => `${row.days} ${row.hours}`).join("; ")}. ${closedDay}.`;

export const shopRulesText =
  "You can cancel an order before it is dispatched. A GCash order that is not paid within 24 hours is cancelled. You can request a Return within 24 hours of delivery. Delivery is free for orders over ₱2,500. We accept GCash and cash on delivery. For GCash, pay with the details shown at checkout, then send your payment proof with the reference number from your order page.";

/** Fixed shop facts for the kinds that need no Order. */
export function shopFact(kind: QuestionKind): string | undefined {
  if (kind === "delivery_fee") return deliveryFeeText;
  if (kind === "shop_info") return shopInfoText;
  if (kind === "shop_rules") return shopRulesText;
  return undefined;
}

/** The facts the model may use for an Order: what the card shows, as plain text. */
export function orderFactsText(order: AssistantOrder, now: Date): string {
  return orderCard(order, now).lines.map((line) => `${line.label}: ${line.value}`).join("\n");
}
