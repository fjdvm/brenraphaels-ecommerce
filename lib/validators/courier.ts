import { z } from "zod";

import { optionalNameField, optionalPhoneField, optionalTextField, urlField } from "./fields";

export const couriers = ["Lalamove", "Grab"] as const;

/** Courier booking Staff record at dispatch. Only `https` links are accepted until real links are collected. */
export const courierBooking = z.object({
  name: z.enum(couriers, { error: "Choose Lalamove or Grab" }),
  trackingUrl: urlField("Tracking link", 2048).refine((value) => /^https:\/\//i.test(value), "The tracking link must start with https://"),
  riderName: optionalNameField({ max: 120, pattern: /^[\p{L}\p{M}\s'.-]+$/u, patternMessage: "Rider name can only contain letters, spaces, hyphens, apostrophes and periods" }).optional(),
  riderPlate: optionalTextField({ max: 16, pattern: /^[A-Za-z0-9 -]+$/, patternMessage: "Plate number can only contain letters, digits, spaces and hyphens" }).optional(),
  riderPhone: optionalPhoneField({ pattern: /^(\+?63|0)9\d{9}$/, patternMessage: "Enter a Philippine mobile number, like 0917 123 4567" }).optional(),
}).strict();

export type CourierBooking = z.infer<typeof courierBooking>;
