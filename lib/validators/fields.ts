import { z } from "zod";

import { cleanEmail, cleanPhone, cleanText } from "./sanitize";

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
