import type { FormEvent } from "react";

const nameCharacters = /[^\p{L}\p{M}\s'.-]/gu;
const addressCharacters = /[^\p{L}\p{M}\p{N}\s,.#\-/']/gu;
const phoneCharacters = /[^0-9+().\s-]/g;

function replaceInputValue(event: FormEvent<HTMLInputElement>, value: string) {
  if (event.currentTarget.value !== value) {
    event.currentTarget.value = value;
  }
}

/** Remove characters that cannot be part of a person's name. */
export function sanitizeNameInput(event: FormEvent<HTMLInputElement>) {
  replaceInputValue(event, event.currentTarget.value.replace(nameCharacters, ""));
}

/** Keep a Philippine postal code numeric and no longer than its four digits. */
export function sanitizePostalCodeInput(event: FormEvent<HTMLInputElement>) {
  replaceInputValue(event, event.currentTarget.value.replace(/\D/g, "").slice(0, 4));
}

/** Keep only the punctuation that people commonly use while entering a PH number. */
export function sanitizePhoneInput(event: FormEvent<HTMLInputElement>) {
  replaceInputValue(event, event.currentTarget.value.replace(phoneCharacters, ""));
}

/** Keep street-address input within the server's permitted character set. */
export function sanitizeStreetInput(event: FormEvent<HTMLInputElement>) {
  replaceInputValue(event, event.currentTarget.value.replace(addressCharacters, ""));
}

const emailCharacters = /[^A-Za-z0-9.!#$%&'*+/=?^_`{|}~@-]/g;

/** Keep only the characters an email address can have; spaces and symbols never enter the box. */
export function sanitizeEmailInput(event: FormEvent<HTMLInputElement>) {
  replaceInputValue(event, event.currentTarget.value.replace(emailCharacters, ""));
}
