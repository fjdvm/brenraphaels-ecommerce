import { z } from "zod";

import { cleanEmail, cleanName, cleanPhone, cleanText } from "./sanitize";

/** Stops absurdly large input before it is sanitised; specific limits follow. */
const maximumRawLength = 1_000;

export const emailMaximumLength = 256;
export const passwordMaximumLength = 128;

export const emailField = z
  .string({ error: "Enter a valid email address" })
  .max(maximumRawLength, "Enter a valid email address")
  .transform(cleanEmail)
  .pipe(
    z
      .string()
      .max(emailMaximumLength, `Must be ${emailMaximumLength} characters or fewer`)
      .email("Enter a valid email address"),
  );

export function textField(
  label: string,
  rules: { min: number; max: number; pattern: RegExp; patternMessage: string },
) {
  return z
    .string({ error: `${label} is required` })
    .max(maximumRawLength, `Must be ${rules.max} characters or fewer`)
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(rules.min, `${label} is required`)
        .max(rules.max, `Must be ${rules.max} characters or fewer`)
        .regex(rules.pattern, rules.patternMessage),
    );
}

/** A text field whose persisted value follows the site's display-name casing. */
export function nameTextField(
  label: string,
  rules: { min: number; max: number; pattern: RegExp; patternMessage: string },
) {
  return z
    .string({ error: `${label} is required` })
    .max(maximumRawLength, `Must be ${rules.max} characters or fewer`)
    .transform(cleanName)
    .pipe(
      z
        .string()
        .min(rules.min, `${label} is required`)
        .max(rules.max, `Must be ${rules.max} characters or fewer`)
        .regex(rules.pattern, rules.patternMessage),
    );
}

export function phoneField(
  label: string,
  rules: { pattern: RegExp; patternMessage: string },
) {
  return z
    .string({ error: `${label} is required` })
    .max(maximumRawLength, rules.patternMessage)
    .transform(cleanPhone)
    .pipe(z.string().regex(rules.pattern, rules.patternMessage));
}

/** Optional free text: absent, null or blank all become an empty string. */
export function optionalTextField(rules: {
  max: number;
  pattern: RegExp;
  patternMessage: string;
}) {
  return z
    .string()
    .max(maximumRawLength, `Must be ${rules.max} characters or fewer`)
    .nullish()
    .transform((value) => cleanText(value ?? ""))
    .pipe(
      z
        .string()
        .max(rules.max, `Must be ${rules.max} characters or fewer`)
        .refine((value) => value === "" || rules.pattern.test(value), rules.patternMessage),
    );
}

/** Optional name input, with the same casing rules as required name fields. */
export function optionalNameField(rules: {
  max: number;
  pattern: RegExp;
  patternMessage: string;
}) {
  return z
    .string()
    .max(maximumRawLength, `Must be ${rules.max} characters or fewer`)
    .nullish()
    .transform((value) => cleanName(value ?? ""))
    .pipe(
      z
        .string()
        .max(rules.max, `Must be ${rules.max} characters or fewer`)
        .refine((value) => value === "" || rules.pattern.test(value), rules.patternMessage),
    );
}

/** A person's name: letters (any script), spaces, and the punctuation names actually use. */
export const personNameCharacterPattern = /^[\p{L}\p{M}\s'.-]+$/u;
export const personNameCharacterPatternMessage =
  "Can only contain letters, spaces, hyphens, apostrophes, and periods";

/** Joins first/middle/last into one display name, skipping an empty middle name. */
export function composeFullName(name: { firstName: string; middleName?: string | null; lastName: string }) {
  return [name.firstName, name.middleName, name.lastName].filter(Boolean).join(" ");
}

/** The rules for choosing a password; sign-in never applies them to old passwords. */
export const passwordField = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(passwordMaximumLength, `Must be ${passwordMaximumLength} characters or fewer`)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^\p{L}\p{N}\s]/u, "Password must contain at least one special character");

export const confirmPasswordField = z
  .string({ error: "Confirm your password" })
  .max(passwordMaximumLength, `Must be ${passwordMaximumLength} characters or fewer`);

type PasswordPair = { password: string; confirmPassword: string };

/** Adds the "both password boxes match" rule to a schema that has the pair. */
export function passwordsMatch<T extends z.ZodType<PasswordPair>>(schema: T) {
  return schema.refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
}
