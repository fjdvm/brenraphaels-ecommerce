import crypto from "node:crypto";

import type { LimitPeriod } from "./discount-rule";

export { idNumberField, idTypes, validateIdPhoto, type IdType } from "./id-fields";

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

/** The photo is kept this long while it waits for review; file-storage then removes it. */
export const PHOTO_REVIEW_DAYS = 7;

/** Today in Philippine Time, as `YYYY-MM-DD`. */
export function philippineToday(now: Date): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** One ID never gets more than this much discount per period by default (₱125 a week), in centavos. */
export const WEEKLY_DISCOUNT_CAP_IN_CENTAVOS = 12_500;

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The Monday-to-Sunday week (Philippine Time) that `at` falls in: from Monday 00:00 up to, not including, the next Monday 00:00. */
export function philippineWeek(at: Date): { start: Date; end: Date } {
  return philippinePeriod(at, "week");
}

/** The Philippine-Time day, Monday-to-Sunday week or calendar month that `at` falls in: from its start up to, not including, the next one. */
export function philippinePeriod(at: Date, per: LimitPeriod): { start: Date; end: Date } {
  const shifted = new Date(at.getTime() + PH_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const [startUtc, endUtc] = per === "day"
    ? [Date.UTC(year, month, day), Date.UTC(year, month, day + 1)]
    : per === "month"
      ? [Date.UTC(year, month, 1), Date.UTC(year, month + 1, 1)]
      : (() => {
          const monday = Date.UTC(year, month, day - ((shifted.getUTCDay() + 6) % 7));
          return [monday, monday + 7 * 86_400_000];
        })();
  return { start: new Date(startUtc - PH_OFFSET_MS), end: new Date(endUtc - PH_OFFSET_MS) };
}

const peso = (centavos: number) => `₱${(centavos / 100).toFixed(2)}`;
const periodAdjective: Record<LimitPeriod, string> = { day: "daily", week: "weekly", month: "monthly" };

/**
 * The discount held to what this ID has left of its limit for the period (₱125 a week unless the Order was placed under
 * another rule). `reason` is set only when the discount was reduced and never contains the ID number.
 */
export function capSeniorPwdDiscount(
  wantedInCentavos: number,
  usedThisPeriodInCentavos: number,
  limit: { limitInCentavos: number; per: LimitPeriod } = { limitInCentavos: WEEKLY_DISCOUNT_CAP_IN_CENTAVOS, per: "week" },
) {
  const left = Math.max(0, limit.limitInCentavos - usedThisPeriodInCentavos);
  const discountInCentavos = Math.min(wantedInCentavos, left);
  const reason = discountInCentavos < wantedInCentavos
    ? `This ID has used ${peso(Math.min(usedThisPeriodInCentavos, limit.limitInCentavos))} of its ${peso(limit.limitInCentavos)} ${periodAdjective[limit.per]} limit, so the discount was reduced from ${peso(wantedInCentavos)} to ${peso(discountInCentavos)}.`
    : null;
  return { discountInCentavos, allowanceUsedInCentavos: usedThisPeriodInCentavos, reason };
}
