import crypto from "node:crypto";

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

/** Verifies the interim CREOMS credential before accepting a status update. */
export function verifyInternalOrderStatusUpdate(
  payload: unknown,
  headers: Headers,
): InternalOrderStatusUpdate {
  const secret = process.env.ORDER_STATUS_API_SECRET;
  const supplied = headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
    ?? headers.get("X-Order-Status-Secret");
  if (!secret || !supplied) throw new Error("Missing Order status API secret.");

  const expected = Buffer.from(secret);
  const received = Buffer.from(supplied);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error("Invalid Order status API secret.");
  }

  return statusUpdate.parse(payload);
}
