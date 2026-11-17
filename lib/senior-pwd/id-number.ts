import crypto from "node:crypto";

import { textField } from "../validators/fields";

export const idTypes = ["senior", "pwd"] as const;
export type IdType = (typeof idTypes)[number];

/** The number printed on the ID: letters, digits, hyphens and spaces only. */
export const idNumberField = textField("ID number", {
  min: 4,
  max: 30,
  pattern: /^[A-Za-z0-9][A-Za-z0-9 -]*$/,
  patternMessage: "Enter the letters, digits and hyphens from your ID number",
  rejectInvisible: true,
});

/** Spaces, hyphens and case never make a different ID. */
export function normalizeIdNumber(idNumber: string): string {
  return idNumber.replace(/[\s-]+/g, "").toUpperCase();
}

/**
 * The keyed hash kept in place of the number, so the same ID cannot verify a second account.
 * The number itself is never stored, emailed or logged.
 */
export function hashIdNumber(idNumber: string, secret = process.env.SENIOR_PWD_ID_SECRET): string {
  if (!secret || secret.length < 32) throw new Error("SENIOR_PWD_ID_SECRET must be set to at least 32 characters.");
  return crypto.createHmac("sha256", secret).update(normalizeIdNumber(idNumber)).digest("hex");
}

/** 5% off one unit of the chosen item, in centavos. */
export function seniorPwdDiscount(unitPriceInCentavos: number): number {
  return Math.round(unitPriceInCentavos * 0.05);
}

/** The photo is kept this long while it waits for review; file-storage then removes it. */
export const PHOTO_REVIEW_DAYS = 7;

const acceptedTypes = new Set(["image/jpeg", "image/png"]);
const maximumBytes = 5 * 1024 * 1024;

export function validateIdPhoto(file: File) {
  if (!acceptedTypes.has(file.type)) throw new Error("Upload a JPEG or PNG photo of your ID.");
  if (file.size === 0) throw new Error("Choose a photo of your ID to upload.");
  if (file.size > maximumBytes) throw new Error("ID photos must be 5 MB or smaller.");
}

/** Today in Philippine Time, as `YYYY-MM-DD`. */
export function philippineToday(now: Date): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** One ID never gets more than this much discount in a week (₱125), in centavos. */
export const WEEKLY_DISCOUNT_CAP_IN_CENTAVOS = 12_500;

/** The Monday-to-Sunday week (Philippine Time) that `at` falls in: from Monday 00:00 up to, not including, the next Monday 00:00. */
export function philippineWeek(at: Date): { start: Date; end: Date } {
  const shifted = new Date(at.getTime() + 8 * 60 * 60 * 1000);
  const sinceMonday = (shifted.getUTCDay() + 6) % 7;
  const mondayUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - sinceMonday);
  const start = new Date(mondayUtc - 8 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
}

const peso = (centavos: number) => `₱${(centavos / 100).toFixed(2)}`;

/**
 * The 5% discount held to what this ID has left of its weekly cap. `reason` is set only when the discount was reduced
 * and never contains the ID number.
 */
export function capSeniorPwdDiscount(wantedInCentavos: number, usedThisWeekInCentavos: number) {
  const left = Math.max(0, WEEKLY_DISCOUNT_CAP_IN_CENTAVOS - usedThisWeekInCentavos);
  const discountInCentavos = Math.min(wantedInCentavos, left);
  const reason = discountInCentavos < wantedInCentavos
    ? `This ID has used ${peso(Math.min(usedThisWeekInCentavos, WEEKLY_DISCOUNT_CAP_IN_CENTAVOS))} of its ${peso(WEEKLY_DISCOUNT_CAP_IN_CENTAVOS)} weekly limit, so the discount was reduced from ${peso(wantedInCentavos)} to ${peso(discountInCentavos)}.`
    : null;
  return { discountInCentavos, allowanceUsedInCentavos: usedThisWeekInCentavos, reason };
}
