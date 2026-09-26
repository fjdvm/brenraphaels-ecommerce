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

/** Normalises a person's name without changing punctuation that is part of it. */
export function cleanName(value: string) {
  return cleanText(value).replace(/(^|[\s'.-])(\p{L})/gu, (_, prefix: string, letter: string) =>
    `${prefix}${letter.toLocaleUpperCase()}`,
  ).replace(/(\p{L})(\p{L}*)/gu, (_, first: string, rest: string) =>
    `${first}${rest.toLocaleLowerCase()}`,
  );
}

export function cleanEmail(value: string) {
  return cleanText(value).toLowerCase();
}

/** Drops the spaces, dashes and brackets people type inside a phone number. */
export function cleanPhone(value: string) {
  return cleanText(value).replace(phoneSeparators, "");
}
