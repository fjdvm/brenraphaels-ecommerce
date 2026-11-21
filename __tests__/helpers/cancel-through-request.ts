import { type OrderStore } from "@/lib/orders/orders";

type Store = Pick<OrderStore, "requestCancel" | "advance">;

/** What a Customer's request plus a Staff approval amounts to: the Order ends up cancelled with the Customer's reason. */
export async function cancelThroughRequest(store: Store, customerId: string, orderId: number, reason: string) {
  const { requestId } = await store.requestCancel(customerId, orderId, reason);
  return store.advance(orderId, { status: "cancelled", cancelReason: reason.trim(), cancelRequestId: requestId, staffId: "staff-1", staffName: "Staff One" });
}

