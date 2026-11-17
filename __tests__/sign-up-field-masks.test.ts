import { describe, expect, test } from "vitest";

import { sanitizeEmailInput } from "../components/features/customer/input-sanitizers";
import { signUpFieldError, signUpFormValues } from "../lib/customer/sign-up-schema";

function typed(value: string) {
  const input = { value } as HTMLInputElement;
  sanitizeEmailInput({ currentTarget: input } as React.FormEvent<HTMLInputElement>);
  return input.value;
}

function values(entries: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return signUpFormValues(form);
}

describe("Sign-up email mask", () => {
  test("typing or pasting spaces and symbols an email cannot have drops them", () => {
    expect(typed("jane doe@exa mple.com")).toBe("janedoe@example.com");
    expect(typed("jane<script>@example.com")).toBe("janescript@example.com");
    expect(typed("jane+shop@example.com")).toBe("jane+shop@example.com");
  });
});

describe("Sign-up inline field message", () => {
  test("a field left with a bad value gets the same message Continue would show", () => {
    expect(signUpFieldError(0, "email", values({ email: "jane@" }))).toBe("Enter a valid email address");
    expect(signUpFieldError(0, "confirmPassword", values({ password: "Password1!", confirmPassword: "x" }))).toBe(
      "Passwords do not match",
    );
    expect(signUpFieldError(1, "contactNumber", values({ contactNumber: "123" }))).toBe(
      "Enter a valid PH mobile number, e.g. 09171234567",
    );
  });

  test("a good value has no message, and other fields' problems do not leak in", () => {
    expect(signUpFieldError(0, "email", values({ email: "jane@example.com" }))).toBeUndefined();
  });
});
