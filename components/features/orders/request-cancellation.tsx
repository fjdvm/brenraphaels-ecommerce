"use client";

import type { CancellationStatus } from "@/lib/orders/cancellation-status";

/**
 * Shows the outcome of a cancellation request that already exists. Customers can no longer start one: once the shop
 * starts preparing an Order, it cannot be cancelled from the storefront.
 */
export function RequestCancellation({ request }: { request: CancellationStatus | null }) {
  const status = request?.status;
  if (status === "waiting-manager") return <p className="text-sm text-body" role="status">Cancellation requested. We&apos;ll email you when a Manager decides.</p>;
  if (status === "approved") return <p className="text-sm text-body" role="status">Cancellation approved. We&apos;re finishing the stock and refund steps.</p>;
  if (status === "cancelled") return <p className="text-sm font-medium text-primary" role="status">Order cancelled.</p>;
  if (status === "declined") {
    return <p className="text-sm text-body" role="status">Cancellation request declined{request?.declineReason ? `: ${request.declineReason}` : "."} Your order is still on its way.</p>;
  }

  return null;
}
