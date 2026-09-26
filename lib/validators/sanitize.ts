const whitespace = /\s+/g;
// Control characters plus invisible formatting ones (zero-width spaces, bidi overrides).
const invisibleCharacters = /[\p{Cc}\p{Cf}]/gu;
const phoneSeparators = /[\s().-]/g;

/** Normalises free text: one Unicode form, single spaces, no invisible characters. */
export function cleanText(value: string) {
  return value
    .normalize("NFC")
    .replace(whitespace, " ")
    .replace(invisibleCharacters, "")
    .trim();
}

export function cleanEmail(value: string) {
  return cleanText(value).toLowerCase();
}

/** Drops the spaces, dashes and brackets people type inside a phone number. */
export function cleanPhone(value: string) {
  return cleanText(value).replace(phoneSeparators, "");
}
