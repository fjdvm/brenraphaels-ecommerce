import { z } from "zod";

import {
  deliveryFields,
  nameFields,
  preferenceFields,
} from "./sign-up-schema";

/** What a signed-in login still owes us: the name parts, delivery details and preferences. */
export const completeProfileFields = {
  ...nameFields,
  ...deliveryFields,
  ...preferenceFields,
};

export const completeProfileSchema = z.object(completeProfileFields);

export type CompleteProfileInput = z.input<typeof completeProfileSchema>;

/** Reads the complete-profile form's fields; an unticked checkbox is simply absent. */
export function completeProfileFormValues(formData: FormData) {
  const values: Record<string, FormDataEntryValue | null | boolean> = {};
  for (const field of Object.keys(completeProfileFields)) {
    values[field] = formData.get(field);
  }
  values.terms = formData.get("terms") === "on";
  return values;
}

/**
 * A best guess at the name parts of a login's single name: the first word is
 * the first name, the last word the last name, anything between the middle
 * name. It only pre-fills the form; the Customer corrects it.
 */
export function splitFullName(fullName: string) {
  const words = fullName.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { firstName: words[0] ?? "", middleName: "", lastName: "" };
  }

  return {
    firstName: words[0],
    middleName: words.slice(1, -1).join(" "),
    lastName: words[words.length - 1],
  };
}
