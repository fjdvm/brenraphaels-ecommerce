import { z } from "zod";

import { courierBooking } from "../validators/courier";
import { fileIdField } from "../validators/file-id";
import { staffAttribution } from "../validators/staff";
import { orderStatuses } from "./orders";

const statusUpdate = z.discriminatedUnion("status", [
  z.object({ status: z.literal("preparing"), ...staffAttribution.shape }).strict(),
  z.object({
    status: z.literal("paid"),
    deliveryFeeInCentavos: z.number().int().nonnegative().optional(),
    approvedAnyway: z.object({ reason: z.string().trim().min(1).max(500) }).strict().optional(),
    ...staffAttribution.shape,
  }).strict(),
  z.object({
    status: z.literal("confirmed"),
    subtotalInCentavos: z.number().int().nonnegative(),
    approvedDiscountInCentavos: z.number().int().nonnegative(),
    /** Null for Pickup; ₱0 is a valid entered fee for Delivery. */
    deliveryFeeInCentavos: z.number().int().nonnegative().nullable(),
    totalInCentavos: z.number().int().nonnegative(),
    staffId: z.unknown().optional(),
    staffName: z.unknown().optional(),
  }).strict(),
  z.object({
    status: z.literal("delivered"),
    deliveryPhotoFileId: fileIdField,
    deliveryFeeInCentavos: z.number().int().nonnegative().optional(),
    staffId: z.unknown().optional(),
    staffName: z.unknown().optional(),
  }).strict(),
  z.object({
    status: z.literal("dispatched"),
    courier: courierBooking.optional(),
    deliveryFeeInCentavos: z.number().int().nonnegative().optional(),
    staffId: z.unknown().optional(),
    staffName: z.unknown().optional(),
  }).strict(),
  z.object({
    status: z.enum(orderStatuses).exclude(["paid", "received", "delivered", "dispatched", "preparing", "confirmed"]),
    deliveryFeeInCentavos: z.number().int().nonnegative().optional(),
    // Attribution is only used for paid; other moves ignore it.
    staffId: z.unknown().optional(),
    staffName: z.unknown().optional(),
  }).strict(),
]);

export type InternalOrderStatusUpdate = ReturnType<typeof parseInternalOrderStatusUpdate>;

/** Validates the body of an already-authenticated Order status request. */
export function parseInternalOrderStatusUpdate(payload: unknown) {
  const update = statusUpdate.parse(payload);
  if (update.status === "paid" || update.status === "preparing") return update;
  if (update.status === "confirmed") return {
    status: update.status,
    subtotalInCentavos: update.subtotalInCentavos,
    approvedDiscountInCentavos: update.approvedDiscountInCentavos,
    deliveryFeeInCentavos: update.deliveryFeeInCentavos,
    totalInCentavos: update.totalInCentavos,
  };
  if (update.status === "delivered") return {
    status: update.status,
    deliveryPhotoFileId: update.deliveryPhotoFileId,
    ...(update.deliveryFeeInCentavos === undefined ? {} : { deliveryFeeInCentavos: update.deliveryFeeInCentavos }),
  };
  return {
    status: update.status,
    ...(update.status === "cancelled" && (update.staffId !== undefined || update.staffName !== undefined) ? staffAttribution.parse(update) : {}),
    ...("courier" in update && update.courier ? { courier: update.courier } : {}),
    ...(update.deliveryFeeInCentavos === undefined ? {} : { deliveryFeeInCentavos: update.deliveryFeeInCentavos }),
  };
}
