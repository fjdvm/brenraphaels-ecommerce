import { textField } from "../validators/fields";

export const gcashReferenceNumberField = textField("GCash reference number", {
  min: 6,
  max: 20,
  pattern: /^[0-9]+$/,
  patternMessage: "Enter the digits from your GCash reference number",
});

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

/** Uploads the screenshot privately, namespaced by Order so it can never be guessed. */
export async function uploadPaymentProofScreenshot(
  file: File,
  dependencies: {
    orderId: number;
    put(
      pathname: string,
      body: File,
      options: { access: "private"; addRandomSuffix: true },
    ): Promise<{ pathname: string }>;
  },
): Promise<string> {
  validatePaymentProofScreenshot(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const blob = await dependencies.put(`payment-proofs/${dependencies.orderId}/${safeName}`, file, {
    access: "private",
    addRandomSuffix: true,
  });
  return blob.pathname;
}
