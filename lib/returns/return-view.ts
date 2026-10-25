import type { CustomerReturn } from "./customer-reads";

const statusLabels: Record<CustomerReturn["status"], string> = {
  requested: "Requested",
  approved: "Approved",
  "goods received": "Goods received",
  refunded: "Refunded",
  replaced: "Replaced",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const returnStatusLabel = (status: CustomerReturn["status"]) => statusLabels[status];

export const resolutionLabel = (resolution: "refund" | "replacement") => (resolution === "refund" ? "Refund" : "Replacement");

/** The Returns tab counts every Return except those the Customer cancelled. */
export const countedReturns = (returns: CustomerReturn[]) => returns.filter(({ status }) => status !== "cancelled").length;
