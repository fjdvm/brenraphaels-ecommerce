import { z } from "zod";

import { cleanEmail, cleanMultilineText, cleanName, cleanPhone, cleanText, hasInvisibleCharacters } from "./sanitize";

/** Stops absurdly large input before it is sanitised; specific limits follow. */
const maximumRawLength = 10_000;

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
  rules: { min: number; max: number; pattern: RegExp; patternMessage: string; rejectInvisible?: boolean },
) {
  return z
    .string({ error: `${label} is required` })
    .max(maximumRawLength, `Must be ${rules.max} characters or fewer`)
    .refine(
      (value) => !rules.rejectInvisible || !hasInvisibleCharacters(value),
      "Enter text without invisible characters",
    )
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

/** Optional phone number: absent, null or blank all become an empty string. */
export function optionalPhoneField(rules: { pattern: RegExp; patternMessage: string }) {
  return z
    .string()
    .max(maximumRawLength, rules.patternMessage)
    .nullish()
    .transform((value) => cleanPhone(value ?? ""))
    .pipe(z.string().refine((value) => value === "" || rules.pattern.test(value), rules.patternMessage));
}

/** An optional `YYYY-MM` month (what `<input type="month">` submits) that is not in the future. */
export function optionalMonthField(label: string) {
  const message = `Enter a valid ${label.toLowerCase()} (month and year)`;
  return z
    .string()
    .max(maximumRawLength, message)
    .nullish()
    .transform((value) => cleanText(value ?? ""))
    .pipe(
      z
        .string()
        .refine((value) => value === "" || /^(19|20)[0-9]{2}-(0[1-9]|1[0-2])$/.test(value), message)
        .refine((value) => value === "" || value <= new Date().toISOString().slice(0, 7), `${label} cannot be in the future`),
    );
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

/** Free text that retains line breaks, for messages and longer descriptions. */
export function multilineTextField(
  label: string,
  rules: { min?: number; max: number; optional?: boolean; pattern: RegExp; patternMessage: string },
) {
  const minimum = rules.min ?? 1;
  return z
    .string({ error: rules.optional ? undefined : `${label} is required` })
    .max(maximumRawLength, `Must be ${rules.max} characters or fewer`)
    .nullish()
    .refine(
      (value) => value == null || value === "" || rules.pattern.test(value),
      rules.patternMessage,
    )
    .transform((value) => cleanMultilineText(value ?? ""))
    .pipe(
      z
        .string()
        .refine((value) => rules.optional || value.length >= minimum, `${label} is required`)
        .max(rules.max, `Must be ${rules.max} characters or fewer`)
    );
}

/** A browser URL captured with a report. It must be an absolute http(s) URL. */
export function urlField(label: string, maximumLength: number) {
  return z
    .string({ error: `${label} is required` })
    .max(maximumRawLength, `Must be ${maximumLength} characters or fewer`)
    .transform(cleanText)
    .pipe(
      z
        .string()
        .max(maximumLength, `Must be ${maximumLength} characters or fewer`)
        .url(`Enter a valid ${label.toLowerCase()}`)
        .refine((value) => /^https?:\/\//i.test(value), `Enter a valid ${label.toLowerCase()}`),
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

/** A positive whole-number form field, rejecting decimals and non-numeric input. */
export function positiveIntegerField(
  label: string,
  rules: { min?: number; max?: number; message?: string } = {},
) {
  const minimum = rules.min ?? 1;
  const maximum = rules.max ?? Number.MAX_SAFE_INTEGER;
  const message = rules.message ?? `Enter a valid ${label.toLowerCase()}`;

  return z
    .string({ error: `${label} is required` })
    .max(maximumRawLength, message)
    .regex(/^[1-9][0-9]*$/, message)
    .transform(Number)
    .pipe(z.number().int().min(minimum, message).max(maximum, message));
}

/** Optional positive whole-number field: absent, null, or blank becomes undefined. */
export function optionalPositiveIntegerField(
  label: string,
  rules: { min?: number; max?: number; message?: string } = {},
) {
  const minimum = rules.min ?? 1;
  const maximum = rules.max ?? Number.MAX_SAFE_INTEGER;
  const message = rules.message ?? `Enter a valid ${label.toLowerCase()}`;
  const required = positiveIntegerField(label, rules);
  return z.union([
    required,
    z.number().int(message).min(minimum, message).max(maximum, message),
    z.literal(""),
    z.null(),
  ], { error: message }).optional().transform((value) =>
    value === "" || value == null ? undefined : value,
  );
}

type PasswordPair = { password: string; confirmPassword: string };

/** Adds the "both password boxes match" rule to a schema that has the pair. */
export function passwordsMatch<T extends z.ZodType<PasswordPair>>(schema: T) {
  return schema.refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
}
