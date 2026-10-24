import { z } from "zod";
import { returnResolutions } from "../db/schema";
import { multilineTextField, textField } from "../validators/fields";

import { evidenceLimits, evidenceRoles, evidenceTypes } from "./evidence-rules";

export { evidenceLimits, evidenceRoles, evidenceTypes };
export type { EvidenceRole } from "./evidence-rules";

const uploadToken = textField("Evidence upload", { min: 1, max: 4096,
  pattern: /^[A-Za-z0-9_.-]+$/, patternMessage: "Choose evidence uploaded for this Order", rejectInvisible: true });

export const returnRequestInput = z.object({
  orderLineIds: z.array(z.number().int().positive().max(2147483647)).min(1, "Choose at least one whole Order item").max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Choose each Order item only once"),
  reason: z.enum(["damaged", "defective", "wrong item", "other"]),
  note: multilineTextField("Note", { optional: true, max: 2000,
    pattern: /^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u,
    patternMessage: "Note cannot contain angle brackets or control characters" }),
  preferredResolution: z.enum(returnResolutions),
  photoUploadTokens: z.array(uploadToken).min(1, "Attach one to three photos").max(3, "Attach one to three photos")
    .refine((tokens) => new Set(tokens).size === tokens.length, "Choose each photo only once"),
  videoUploadToken: uploadToken.optional(),
}).strict();

export const evidenceUploadInput = z.object({
  role: z.enum(evidenceRoles),
  contentType: z.enum(["image/jpeg", "image/png", "video/mp4", "video/quicktime"]),
  size: z.number().int().positive(),
}).strict().superRefine((value, ctx) => {
  if (!evidenceTypes[value.role].includes(value.contentType)) {
    ctx.addIssue({ code: "custom", message: "Photos must be JPG or PNG; videos must be MP4 or MOV", path: ["contentType"] });
  }
  if (value.size > evidenceLimits[value.role]) {
    ctx.addIssue({ code: "custom", message: value.role === "photo" ? "Photos must be 5 MB or smaller" : "Videos must be 25 MB or smaller", path: ["size"] });
  }
});

export class ReturnRequestError extends Error {
  constructor(message: string, public readonly status: 400 | 404 | 409 = 409) { super(message); }
}
