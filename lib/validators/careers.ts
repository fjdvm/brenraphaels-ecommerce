import { z } from "zod";

import {
  multilineTextField,
  nameTextField,
  optionalMonthField,
  optionalPhoneField,
  optionalTextField,
  personNameCharacterPattern,
  personNameCharacterPatternMessage,
  textField,
} from "./fields";
import { cleanList } from "./sanitize";

/** Letters, digits and the punctuation that appears in school, employer, role and place names. */
const titleCharacters = /^[\p{L}\p{M}\p{N}\s'’.,&()/#+:-]+$/u;
const titleCharactersMessage = "Can only contain letters, numbers, spaces, and common punctuation";
const skillCharacters = /^[\p{L}\p{M}\p{N}\s'’.,&()/#+-]+$/u;
const proseCharacters = /^[^<>{}\\]*$/u;
const proseCharactersMessage = "Can't contain the characters < > { } or \\";

export const applicantPhonePattern = /^\+?[0-9]{7,15}$/;

const titleRules = (max: number) => ({ min: 1, max, pattern: titleCharacters, patternMessage: titleCharactersMessage });
const orNull = (value: string) => value || null;

export const applicantFullNameField = nameTextField("Full name", {
  min: 2,
  max: 200,
  pattern: personNameCharacterPattern,
  patternMessage: personNameCharacterPatternMessage,
});
export const applicantPhoneField = optionalPhoneField({
  pattern: applicantPhonePattern,
  patternMessage: "Enter a valid contact number using digits only (7 to 15, optional leading +)",
}).transform(orNull);
export const applicantLocationField = optionalTextField({ max: 200, pattern: titleCharacters, patternMessage: titleCharactersMessage }).transform(orNull);
export const applicantSummaryField = multilineTextField("Professional summary", { max: 2_000, optional: true, pattern: proseCharacters, patternMessage: proseCharactersMessage }).transform(orNull);
export const applicantSkillsField = z
  .string()
  .max(10_000, "Must be 2000 characters or fewer")
  .nullish()
  .transform((value) => cleanList(value ?? ""))
  .pipe(
    z
      .string()
      .max(2_000, "Must be 2000 characters or fewer")
      .refine((value) => value === "" || skillCharacters.test(value), "Can only contain letters, numbers, spaces, and common punctuation"),
  );

export const schoolField = textField("School", titleRules(200));
export const qualificationField = textField("Qualification", titleRules(200));
export const fieldOfStudyField = optionalTextField({ max: 200, pattern: titleCharacters, patternMessage: titleCharactersMessage }).transform(orNull);
export const employerField = textField("Employer", titleRules(200));
export const jobTitleField = textField("Job title", titleRules(200));
export const workDescriptionField = multilineTextField("Work description", { max: 2_000, optional: true, pattern: proseCharacters, patternMessage: proseCharactersMessage }).transform(orNull);
export const monthField = (label: string) => optionalMonthField(label).transform(orNull);

/** Search-parameter filters come from the URL, so anything unexpected is dropped rather than queried. */
export const jobFilterField = optionalTextField({ max: 100, pattern: titleCharacters, patternMessage: titleCharactersMessage });
export function parseJobFilter(value: string | string[] | undefined) {
  const parsed = jobFilterField.safeParse(typeof value === "string" ? value : undefined);
  return parsed.success && parsed.data ? parsed.data : undefined;
}

const tokenCharacters = /^[^\s\p{C}]+$/u;
/** Emailed one-time tokens (verification, password reset) are opaque; reject anything with whitespace or control characters. */
export const emailedTokenField = z
  .string({ error: "This link is invalid or has expired." })
  .max(2_048, "This link is invalid or has expired.")
  .regex(tokenCharacters, "This link is invalid or has expired.");

/** Sign-in accepts the password as typed (no trimming) but bounds it. */
export const signInPasswordField = z
  .string({ error: "Enter your password" })
  .min(1, "Enter your password")
  .max(128, "Must be 128 characters or fewer");
