const whitespace = /\s+/g;
// Control characters plus invisible formatting ones (zero-width spaces, bidi overrides).
const invisibleCharacters = /[^\P{Cc}\n]|\p{Cf}/gu;
const invisibleCharacter = /[^\P{Cc}\n]|\p{Cf}/u;
const phoneSeparators = /[\s().-]/g;

/** Normalises free text: one Unicode form, single spaces, no invisible characters. */
export function cleanText(value: string) {
  return value
    .normalize("NFC")
    .replace(whitespace, " ")
    .replace(invisibleCharacters, "")
    .trim();
}

/** Whether input contains a control or invisible formatting character we reject rather than strip. */
export function hasInvisibleCharacters(value: string) {
  return invisibleCharacter.test(value);
}

/** Normalises free text while keeping intentional line breaks. */
export function cleanMultilineText(value: string) {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
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

const unsafeFileNameCharacters = /[^a-zA-Z0-9._-]/g;

/** Reduces an uploaded file's name to characters safe for a storage pathname. */
export function cleanFileName(value: string) {
  return cleanText(value).replace(unsafeFileNameCharacters, "-");
}

/** Normalises a comma-separated list: trimmed items, no blanks, no case-insensitive duplicates. */
export function cleanList(value: string) {
  const seen = new Set<string>();
  return cleanText(value)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}
