import { z } from "zod";

import { optionalNameField, optionalPhoneField, optionalTextField, urlField } from "./fields";

export const couriers = ["Lalamove", "Grab"] as const;

const trackingLink = urlField("Tracking link", 2048)
  .refine((value) => /^https:\/\//i.test(value), "The tracking link must start with https://")
  .refine((value) => { try { const url = new URL(value); return !url.username && !url.password; } catch { return false; } }, "The tracking link cannot hold a user name or password");

/** Courier booking Staff record at dispatch. The link is optional and, when given, `https` only; Staff can add it later. */
export const courierBooking = z.object({
  name: z.enum(couriers, { error: "Choose Lalamove or Grab" }),
  trackingUrl: trackingLink.optional(),
  riderName: optionalNameField({ max: 120, pattern: /^[\p{L}\p{M}\s'.-]+$/u, patternMessage: "Rider name can only contain letters, spaces, hyphens, apostrophes and periods" }).optional(),
  riderPlate: optionalTextField({ max: 16, pattern: /^[A-Za-z0-9 -]+$/, patternMessage: "Plate number can only contain letters, digits, spaces and hyphens" }).optional(),
  riderPhone: optionalPhoneField({ pattern: /^(\+?63|0)9\d{9}$/, patternMessage: "Enter a Philippine mobile number, like 0917 123 4567" }).optional(),
}).strict();

/** A rebooking after a failed delivery still needs the new booking's link. */
export const rebookCourierBooking = courierBooking.extend({ trackingUrl: trackingLink });

export type CourierBooking = z.infer<typeof courierBooking>;
