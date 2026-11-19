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

const acceptedTypes = new Set(["image/jpeg", "image/png"]);
const maximumBytes = 5 * 1024 * 1024;

export function validateIdPhoto(file: File) {
  if (!acceptedTypes.has(file.type)) throw new Error("Upload a JPEG or PNG photo of your ID.");
  if (file.size === 0) throw new Error("Choose a photo of your ID to upload.");
  if (file.size > maximumBytes) throw new Error("ID photos must be 5 MB or smaller.");
}

