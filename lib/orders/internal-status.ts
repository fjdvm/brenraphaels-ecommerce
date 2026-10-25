import { z } from "zod";

import { fileIdField } from "../validators/file-id";
import { staffAttribution } from "../validators/staff";
import { orderStatuses, type OrderStatus } from "./orders";

const statusUpdate = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("paid"),
    deliveryFeeInCentavos: z.number().int().nonnegative().optional(),
    ...staffAttribution.shape,
  }).strict(),
  z.object({
    status: z.literal("delivered"),
    deliveryPhotoFileId: fileIdField,
    deliveryFeeInCentavos: z.number().int().nonnegative().optional(),
    staffId: z.unknown().optional(),
    staffName: z.unknown().optional(),
  }).strict(),
  z.object({
    status: z.enum(orderStatuses).exclude(["paid", "received", "delivered"]),
    deliveryFeeInCentavos: z.number().int().nonnegative().optional(),
    // Attribution is only used for paid; other moves ignore it.
    staffId: z.unknown().optional(),
    staffName: z.unknown().optional(),
  }).strict(),
]);

export type InternalOrderStatusUpdate = {
  status: OrderStatus;
  deliveryFeeInCentavos?: number;
  deliveryPhotoFileId?: string;
  staffId?: string;
  staffName?: string;
};

/** Validates the body of an already-authenticated Order status request. */
export function parseInternalOrderStatusUpdate(payload: unknown): InternalOrderStatusUpdate {
  const update = statusUpdate.parse(payload);
  if (update.status === "paid") return update;
  return {
    status: update.status,
    ...(update.status === "delivered" ? { deliveryPhotoFileId: update.deliveryPhotoFileId } : {}),
    ...(update.deliveryFeeInCentavos === undefined ? {} : { deliveryFeeInCentavos: update.deliveryFeeInCentavos }),
  };
}
