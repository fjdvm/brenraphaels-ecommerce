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
