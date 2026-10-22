import { z } from "zod";

import { orderStatuses, type OrderStatus } from "./orders";

const statusUpdate = z.object({
  status: z.enum(orderStatuses),
  deliveryFeeInCentavos: z.number().int().nonnegative().optional(),
}).strict();

export type InternalOrderStatusUpdate = {
  status: OrderStatus;
  deliveryFeeInCentavos?: number;
};

/** Validates the body of an already-authenticated Order status request. */
export function parseInternalOrderStatusUpdate(payload: unknown): InternalOrderStatusUpdate {
  return statusUpdate.parse(payload);
}
