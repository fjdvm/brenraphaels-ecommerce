import { z } from "zod";

import {
  confirmPasswordField,
  emailField,
  optionalTextField,
  passwordField,
  passwordsMatch,
  textField,
} from "../validators/fields";
import { customerContactNumberSchema } from "./contact-number";

const nameMaximumLength = 50;
const addressFieldMaximumLength = 100;

const nameCharacters = /^[\p{L}\p{M}\s'.-]+$/u;
const addressCharacters = /^[\p{L}\p{M}\p{N}\s,.#\-/'&]+$/u;
const postalCodeCharacters = /^[\p{L}\p{N}\s-]+$/u;

function addressField(label: string) {
  return textField(label, {
    min: 1,
    max: addressFieldMaximumLength,
    pattern: addressCharacters,
    patternMessage: "Contains characters that are not allowed",
  });
}

const nameCharactersMessage =
  "Can only contain letters, spaces, hyphens, apostrophes, and periods";

function nameField(label: string) {
  return textField(label, {
    min: 1,
    max: nameMaximumLength,
    pattern: nameCharacters,
    patternMessage: nameCharactersMessage,
  });
}

const accountFields = {
  firstName: nameField("First name"),
  middleName: optionalTextField({
    max: nameMaximumLength,
    pattern: nameCharacters,
    patternMessage: nameCharactersMessage,
  }),
  lastName: nameField("Last name"),
  email: emailField,
  password: passwordField,
  confirmPassword: confirmPasswordField,
};

const deliveryFields = {
  contactNumber: customerContactNumberSchema.shape.contactNumber,
  street: addressField("Street address"),
  barangay: addressField("Barangay"),
  city: addressField("City or municipality"),
  province: addressField("Province"),
  postalCode: textField("Postal code", {
    min: 1,
    max: addressFieldMaximumLength,
    pattern: postalCodeCharacters,
    patternMessage: "Contains characters that are not allowed",
  }),
};

const preferenceFields = {
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
