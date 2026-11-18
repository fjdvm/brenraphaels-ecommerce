/** `collected` is to Pickup what `delivered` is to Delivery: one fulfilment milestone for every rule. */
export const completedStatuses = ["delivered", "collected"] as const;
/** Completed, including Orders since marked `received`. */
export const completedOrReceivedStatuses = ["delivered", "collected", "received"] as const;

export function isCompleted(status: string) {
  return (completedStatuses as readonly string[]).includes(status);
}

export function isCompletedOrReceived(status: string) {
  return (completedOrReceivedStatuses as readonly string[]).includes(status);
}

/** When the Order was delivered or collected; `collected_at` stands in for `delivered_at`. */
export function completedAtOf(order: { deliveredAt: Date | null; collectedAt: Date | null }) {
  return order.deliveredAt ?? order.collectedAt;
}
