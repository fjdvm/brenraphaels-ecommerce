import { positiveIntegerField, textField } from "./fields";

const opaqueIdCharacters = /^[A-Za-z0-9_-]+$/;

/** IDs are server-authorized opaque values, never arbitrary free text. */
const opaqueIdField = (label: string) => textField(label, {
  min: 1,
  max: 128,
  pattern: opaqueIdCharacters,
  patternMessage: `Choose a valid ${label.toLowerCase()}.`,
});

export const jobPostingIdField = opaqueIdField("Job Posting");
export const applicationReferenceNumberField = opaqueIdField("Application");
export const applicationConsentField = textField("Data-privacy consent", {
  min: 3,
  max: 3,
  pattern: /^yes$/,
  patternMessage: "Consent to the data-privacy notice before submitting.",
});

export function applicationDocumentIds(values: FormDataEntryValue[]) {
  const documentId = positiveIntegerField("Document", { message: "Choose a valid Document." });
  const parsed = values.map((value) => documentId.safeParse(value));
  return parsed.every((value) => value.success)
    ? parsed.map((value) => value.data)
    : null;
}
