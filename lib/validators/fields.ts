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
