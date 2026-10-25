import { postToGateway } from "../gateway";

/**
 * An invalidation signal for one Customer's open Orders pages: it names what changed, never its details. The browser
 * refetches on receipt, so a missed event only costs freshness, never correctness.
 */
export type CustomerOrderEvent =
  | { type: "order.updated"; orderId: string }
  | { type: "return.updated"; orderId: string; returnId: string };

export type CustomerOrderEventPublisher = (customerId: string, event: CustomerOrderEvent) => Promise<void>;

/** Publishes to the Customer's live Orders channel through the api-gateway, as the storefront's Caller. */
export function publishCustomerOrderEvent(
  customerId: string, event: CustomerOrderEvent, fetcher: typeof fetch = fetch,
): Promise<void> {
  return postToGateway("/notifications/orders/events", { customerId, event }, "Order event", fetcher);
}

/**
 * Publishes after a change has committed and never throws: a failed publish is logged and cannot fail or undo the
 * change. `customerId` may be a lookup; its failure is treated the same way.
 */
export async function publishAfterCommit(
  customerId: string | undefined | Promise<string | undefined>,
  event: CustomerOrderEvent,
  publish: CustomerOrderEventPublisher,
): Promise<void> {
  try {
    const recipient = await customerId;
    if (!recipient) return;
    await publish(recipient, event);
  } catch (error) {
    console.error(`${event.type} event for Order ${event.orderId} could not be published`, error);
  }
}
