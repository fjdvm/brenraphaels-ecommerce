import { evidenceFileError, maxPhotos } from "./evidence-rules";

export const returnReasons = [
  { value: "damaged", label: "Damaged" },
  { value: "defective", label: "Defective" },
  { value: "wrong item", label: "Wrong item" },
  { value: "other", label: "Other" },
] as const;
export type ReturnReason = (typeof returnReasons)[number]["value"];
export type PreferredResolution = "refund" | "replacement";

export type ReturnFormValues = {
  orderLineIds: number[];
  reason: ReturnReason | "";
  note: string;
  photos: { type: string; size: number }[];
  video: { type: string; size: number } | null;
  preferredResolution: PreferredResolution | "";
};

export type ReturnFormErrors = Partial<Record<"orderLineIds" | "reason" | "note" | "photos" | "video" | "preferredResolution", string>>;

const noteLimit = 2000;
const notePattern = /^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u;

/** Mirrors the server's rules so mistakes show before anything uploads. The server remains the authority. */
export function validateReturnForm(values: ReturnFormValues): ReturnFormErrors {
  const errors: ReturnFormErrors = {};
  if (values.orderLineIds.length === 0) errors.orderLineIds = "Choose at least one item to return.";
  if (!values.reason) errors.reason = "Choose a reason.";
  if (values.note.length > noteLimit) errors.note = `Note must be ${noteLimit} characters or fewer.`;
  else if (!notePattern.test(values.note)) errors.note = "Note cannot contain angle brackets or control characters.";
  if (values.photos.length < 1 || values.photos.length > maxPhotos) errors.photos = "Attach one to three photos.";
  else errors.photos = values.photos.map((photo) => evidenceFileError(photo, "photo")).find(Boolean);
  if (values.video) errors.video = evidenceFileError(values.video, "video");
  if (!values.preferredResolution) errors.preferredResolution = "Choose a refund or a replacement.";
  for (const key of Object.keys(errors) as (keyof ReturnFormErrors)[]) if (!errors[key]) delete errors[key];
  return errors;
}
