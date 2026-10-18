/** The password rules, as checked live beside the sign-up form; `passwordField` enforces the same ones. */
export const passwordRules = [
  { label: "8+ characters", test: (password: string) => password.length >= 8 },
  { label: "Uppercase letter", test: (password: string) => /[A-Z]/.test(password) },
  { label: "Number", test: (password: string) => /\d/.test(password) },
  {
    label: "Special character",
    test: (password: string) => /[^\p{L}\p{N}\s]/u.test(password),
  },
] as const;

/** Whether each rule in `passwordRules` is met, in the same order. */
export function metPasswordRules(password: string) {
  return passwordRules.map((rule) => rule.test(password));
}
