import { textField } from "../validators/fields";

export const addressFieldMaximumLength = 100;
const addressCharacters = /^[\p{L}\p{M}\p{N}\s,.#\-/']+$/u;
const postalCodeCharacters = /^\d{4}$/;

function addressField(label: string) {
  return textField(label, {
    min: 1,
    max: addressFieldMaximumLength,
    pattern: addressCharacters,
    patternMessage: "Contains characters that are not allowed",
  });
}

// The delivery Address fields shared by sign-up and Address management.
export const addressFields = {
  street: addressField("Street address"),
  barangay: addressField("Barangay"),
  city: addressField("City or municipality"),
  province: addressField("Province"),
  postalCode: textField("Postal code", {
    min: 4,
    max: 4,
    pattern: postalCodeCharacters,
    patternMessage: "Enter a four-digit Philippine postal code",
  }),
};

export const addressLabels = ["Home", "Work", "Other"] as const;
