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

/** Stores the screenshot as a Private File in file-storage and returns its id. */
export async function uploadPaymentProofScreenshot(file: File, files: Pick<TicketFiles, "upload">): Promise<string> {
  validatePaymentProofScreenshot(file);

  return files.upload({
    filename: cleanFileName(file.name),
    contentType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
}
