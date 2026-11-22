import { z } from "zod";

import { idNumberField, idTypes, validateIdPhoto, type IdType } from "./id-fields";

/** The form fields a Customer fills in to say they are a Senior Citizen or PWD. Photos are Files, so they are checked by hand. */
export const seniorPwdFieldNames = ["seniorPwd", "idType", "idNumber", "idFront", "idBack"] as const;

const present = (value: unknown): value is File => typeof File !== "undefined" && value instanceof File && (value.size > 0 || value.name !== "");

/**
 * The answer to "Are you a Senior Citizen or PWD?". A "yes" needs the ID type, its number and a photo of the front;
 * the back is optional. `required` is false where the question is not asked again (Account settings), so "yes" is assumed.
 */
export function seniorPwdSchema({ required = true } = {}) {
  return z
    .object({
      seniorPwd: required
        ? z.enum(["yes", "no"], { message: "Tell us if you're a Senior Citizen or PWD" })
        : z.literal("yes").default("yes"),
      idType: z.unknown(),
      idNumber: z.unknown(),
      idFront: z.unknown(),
      idBack: z.unknown(),
    })
    .superRefine((value, context) => {
      if (value.seniorPwd !== "yes") return;
      const add = (path: string, message: string) => context.addIssue({ code: "custom", path: [path], message });
      if (!idTypes.includes(value.idType as IdType)) add("idType", "Choose Senior Citizen ID or PWD ID");
      const number = idNumberField.safeParse(value.idNumber ?? "");
      if (!number.success) add("idNumber", number.error.issues[0]?.message ?? "Enter your ID number");
      checkPhoto(value.idFront, true, (message) => add("idFront", message));
      checkPhoto(value.idBack, false, (message) => add("idBack", message));
    });
}

function checkPhoto(value: unknown, required: boolean, fail: (message: string) => void) {
  if (!present(value)) {
    if (required) fail("Upload a photo of the front of your ID");
    return;
  }
  try {
    validateIdPhoto(value);
  } catch (error) {
    fail(error instanceof Error ? error.message : "We couldn't use that photo.");
  }
}

/** The Senior/PWD fields of a form, as the schema reads them. */
export function seniorPwdFormValues(formData: FormData) {
  const values: Record<string, unknown> = {};
  for (const name of seniorPwdFieldNames) values[name] = formData.get(name) ?? undefined;
  return values;
}

/** What the Customer sent for their ID, ready to store; undefined when they said they are not a Senior Citizen or PWD. */
export type SeniorPwdApplication = {
  idType: IdType;
  idNumber: string;
  /** What the browser read off the photo, if anything; only compared with `idNumber` on the server, never kept. */
  idNumberRead?: string;
  front: File;
  back?: File;
};

export type ParsedApplication =
  | { ok: true; application?: SeniorPwdApplication }
  | { ok: false; fieldErrors: Record<string, string[] | undefined> };

/** Reads and checks the Senior/PWD fields of a submitted form. */
export function parseSeniorPwdForm(formData: FormData, options: { required?: boolean } = {}): ParsedApplication {
  const values = seniorPwdFormValues(formData);
  const parsed = seniorPwdSchema(options).safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (parsed.data.seniorPwd !== "yes") return { ok: true };
  return {
    ok: true,
    application: {
      idType: values.idType as IdType,
      idNumber: String(values.idNumber),
      idNumberRead: readNumber(formData.get("idNumberRead")),
      front: values.idFront as File,
      back: present(values.idBack) ? values.idBack : undefined,
    },
  };
}


/** The browser's reading, kept only if it looks like an ID number at all. */
function readNumber(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  return idNumberField.safeParse(value).success ? value : undefined;
}
