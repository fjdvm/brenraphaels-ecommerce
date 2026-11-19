import { z } from "zod";

import {
  confirmPasswordField,
  emailField,
  optionalNameField,
  passwordField,
  passwordsMatch,
  personNameCharacterPattern,
  personNameCharacterPatternMessage,
  nameTextField,
} from "../validators/fields";
import { seniorPwdFieldNames, seniorPwdSchema } from "../senior-pwd/application-schema";
import { cleanText } from "../validators/sanitize";
import { addressFieldMaximumLength, addressFields } from "./address-fields";
import { customerContactNumberSchema } from "./contact-number";

const nameMaximumLength = 50;

/**
 * A Province, City or Barangay picked from a dropdown. Whether it is a real
 * place, and one that goes with the others, is checked on the server against
 * the location list, which is too large to ship to the browser.
 */
function locationChoiceField(label: string) {
  return z
    .string({ error: `Choose a ${label}` })
    .max(addressFieldMaximumLength, "Choose from the list")
    .transform(cleanText)
    .pipe(z.string().min(1, `Choose a ${label}`));
}

function nameField(label: string) {
  return nameTextField(label, {
    min: 1,
    max: nameMaximumLength,
    pattern: personNameCharacterPattern,
    patternMessage: personNameCharacterPatternMessage,
  });
}

export const nameFields = {
  firstName: nameField("First name"),
  middleName: optionalNameField({
    max: nameMaximumLength,
    pattern: personNameCharacterPattern,
    patternMessage: personNameCharacterPatternMessage,
  }),
  lastName: nameField("Last name"),
};

const accountFields = {
  ...nameFields,
  email: emailField,
  password: passwordField,
  confirmPassword: confirmPasswordField,
};

export const deliveryFields = {
  contactNumber: customerContactNumberSchema.shape.contactNumber,
  street: addressFields.street,
  barangay: locationChoiceField("barangay"),
  city: locationChoiceField("city or municipality"),
  province: locationChoiceField("province"),
  postalCode: addressFields.postalCode,
};

export const preferenceFields = {
  marketingOptIn: z.enum(["yes", "no"], {
    message: "Please let us know if you'd like to receive marketing emails",
  }),
  terms: z.literal(true, {
    error: "You must accept the Terms of Service",
  }),
};

type SignUpStep = { title: string; fields: string[]; schema: z.ZodType };

/** The sign-up form is shown one step at a time; each step validates alone. */
export const signUpSteps: readonly SignUpStep[] = [
  {
    title: "Your login",
    fields: Object.keys(accountFields),
    schema: passwordsMatch(z.object(accountFields)),
  },
  {
    title: "Delivery details",
    fields: Object.keys(deliveryFields),
    schema: z.object(deliveryFields),
  },
  {
    title: "Senior / PWD",
    fields: [...seniorPwdFieldNames],
    schema: seniorPwdSchema(),
  },
  {
    title: "Preferences",
    fields: Object.keys(preferenceFields),
    schema: z.object(preferenceFields),
  },
];

export const customerSignUpSchema = passwordsMatch(
  z.object({ ...accountFields, ...deliveryFields, ...preferenceFields }),
);

export type CustomerSignUp = z.input<typeof customerSignUpSchema>;

/** Reads the sign-up form's fields; an unticked checkbox is simply absent. */
export function signUpFormValues(formData: FormData) {
  const values: Record<string, FormDataEntryValue | null | boolean> = {};
  for (const step of signUpSteps) {
    for (const field of step.fields) {
      values[field] = formData.get(field);
    }
  }
  values.terms = formData.get("terms") === "on";
  return values;
}

/** Joins the name parts, skipping an empty middle name. */
export function composeFullName(name: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}) {
  return [name.firstName, name.middleName, name.lastName].filter(Boolean).join(" ");
}

/**
 * The message for one sign-up field as it is left, or undefined when it is fine. Uses the same step
 * schema as Continue and the server, so the inline message never differs from the submitted one.
 */
export function signUpFieldError(
  step: number,
  field: string,
  values: ReturnType<typeof signUpFormValues>,
): string | undefined {
  const result = signUpSteps[step].schema.safeParse(values);
  // The "boxes match" rule only runs once every other field is valid, so check it on its own here.
  if (field === "confirmPassword" && values.confirmPassword && values.password !== values.confirmPassword) {
    return "Passwords do not match";
  }
  if (result.success) return undefined;
  return z.flattenError(result.error as z.ZodError<Record<string, unknown>>).fieldErrors[field]?.[0];
}
