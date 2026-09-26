import { z } from "zod";

import {
  emailField,
  passwordMaximumLength,
  phoneField,
  textField,
} from "../validators/fields";

const nameMaximumLength = 100;
const addressFieldMaximumLength = 100;

const philippineMobileNumber = /^(\+63|0)9\d{9}$/;
const nameCharacters = /^[\p{L}\p{M}\s'.-]+$/u;
const addressCharacters = /^[\p{L}\p{M}\p{N}\s,.#\-/'&]+$/u;
const postalCodeCharacters = /^[\p{L}\p{N}\s-]+$/u;

const password = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(passwordMaximumLength, `Must be ${passwordMaximumLength} characters or fewer`)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

function addressField(label: string) {
  return textField(label, {
    min: 1,
    max: addressFieldMaximumLength,
    pattern: addressCharacters,
    patternMessage: "Contains characters that are not allowed",
  });
}

const accountFields = {
  fullName: textField("Full name", {
    min: 2,
    max: nameMaximumLength,
    pattern: nameCharacters,
    patternMessage:
      "Can only contain letters, spaces, hyphens, apostrophes, and periods",
  }),
  email: emailField,
  password,
  confirmPassword: z
    .string({ error: "Confirm your password" })
    .max(passwordMaximumLength, `Must be ${passwordMaximumLength} characters or fewer`),
};

const deliveryFields = {
  contactNumber: phoneField("Contact number", {
    pattern: philippineMobileNumber,
    patternMessage: "Enter a valid PH mobile number, e.g. 09171234567",
  }),
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

type PasswordPair = { password: string; confirmPassword: string };

function passwordsMatch<T extends z.ZodType<PasswordPair>>(schema: T) {
  return schema.refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
}

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
