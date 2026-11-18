import { z } from "zod";
import { textField } from "../validators/fields";
import type { TicketFiles } from "../support/ticket-files";
import { cleanFileName } from "../validators/sanitize";

export const gcashReferenceNumberField = textField("GCash reference number", {
  min: 6,
  max: 20,
  pattern: /^[0-9]+$/,
  patternMessage: "Enter the digits from your GCash reference number",
});

/** The reference from a GCash, Maya or bank receipt: digits for the wallets, letters and digits for a bank. */
export const referenceNumberField = textField("Reference number", {
  min: 6,
  max: 30,
  pattern: /^[A-Za-z0-9]+$/,
  patternMessage: "Enter the letters and digits from your reference number",
});

/** Wallet references are digits only; a bank's may carry letters. */
export function referenceProblem(method: string, reference: string): string | null {
  if (method !== "bank-transfer" && !/^[0-9]{6,20}$/.test(reference)) return "Enter the digits from your reference number (6 to 20).";
  return null;
}

const acceptedScreenshotTypes = new Set(["image/jpeg", "image/png"]);
const maximumScreenshotBytes = 5 * 1024 * 1024;

export function validatePaymentProofScreenshot(file: File) {
  if (!acceptedScreenshotTypes.has(file.type)) {
    throw new Error("Upload a JPEG or PNG screenshot.");
  }
  if (file.size === 0) {
    throw new Error("Choose a screenshot to upload.");
  }
  if (file.size > maximumScreenshotBytes) {
    throw new Error("Screenshots must be 5 MB or smaller.");
  }
}

/** The file's first bytes must be a real JPEG or PNG, whatever its name or declared type says. */
export function hasImageContent(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/png") return bytes.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (contentType === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}

/** Stores the screenshot as a Private File in file-storage and returns its id. */
export async function uploadPaymentProofScreenshot(file: File, files: Pick<TicketFiles, "upload">): Promise<string> {
  validatePaymentProofScreenshot(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasImageContent(bytes, file.type)) throw new Error("That file isn't a real JPEG or PNG image.");

  return files.upload({ filename: cleanFileName(file.name), contentType: file.type, bytes });
}

/** Customer-confirmed fields are optional for older clients; checks explain missing values. */
export const confirmedProofFields = {
  confirmedAmountInCentavos: z.number().int().min(0).max(2147483647).optional(),
  confirmedPaidAt: z.date().refine(date => Number.isFinite(date.getTime()), "Enter a valid payment date").optional(),
  confirmedRecipient: textField("Recipient", { min: 1, max: 160, pattern: /^[\p{L}\p{N} .+'’()/-]+$/u, patternMessage: "Enter the account number or name on your receipt" }).optional(),
};
export const confirmedProofInput = z.object(confirmedProofFields);

/** Preserve centavos exactly; reject rounding, exponents and non-decimal input. */
export const confirmedAmountField = textField("Amount paid", {
  min: 1, max: 20, pattern: /^\d+(?:\.\d{1,2})?$/,
  patternMessage: "Enter an amount with at most two decimal places",
}).transform(value => Math.round(Number(value) * 100)).pipe(z.number().int().min(0).max(2147483647));

/** datetime-local is explicitly Philippine time; reject calendar normalization. */
export const confirmedPaidAtField = textField("Payment date", {
  min: 16, max: 16, pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
  patternMessage: "Enter a valid payment date and time",
}).refine(value => {
  const date = new Date(`${value}Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === value;
}, "Enter a real calendar date and time").transform(value => new Date(`${value}+08:00`));
