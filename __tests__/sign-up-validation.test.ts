import { describe, expect, test } from "vitest";

import {
  customerSignUpSchema,
  signUpFormValues,
  signUpSteps,
} from "../lib/customer/sign-up-schema";
import { cleanEmail, cleanPhone, cleanText } from "../lib/validators/sanitize";

const validSignUp = {
  fullName: "Jane Doe",
  email: "jane@example.com",
  password: "Password1",
  confirmPassword: "Password1",
  contactNumber: "09171234567",
  street: "123 Katipunan Avenue",
  barangay: "Loyola Heights",
  city: "Quezon City",
  province: "Metro Manila",
  postalCode: "1108",
  marketingOptIn: "yes",
  terms: true,
};

describe("Sanitising text", () => {
  test("collapses whitespace and drops invisible characters", () => {
    expect(cleanText("  Jane​ \t  Doe\n")).toBe("Jane Doe");
    expect(cleanText("José")).toBe("José");
    expect(cleanText("a‮b\u0000c")).toBe("abc");
  });

  test("lowercases emails and strips spaces from Contact numbers", () => {
    expect(cleanEmail("  Jane@Example.COM ")).toBe("jane@example.com");
    expect(cleanPhone("+63 917-123 (4567)")).toBe("+639171234567");
  });
});

describe("Sign-up validation", () => {
  test("stores the sanitised values", () => {
    const parsed = customerSignUpSchema.parse({
      ...validSignUp,
      fullName: "  Jane​   Doe ",
      email: " JANE@Example.com ",
      contactNumber: "0917 123 4567",
      street: "123   Katipunan\tAvenue",
    });

    expect(parsed).toMatchObject({
      fullName: "Jane Doe",
      email: "jane@example.com",
      contactNumber: "09171234567",
      street: "123 Katipunan Avenue",
    });
  });

  test("accepts accented letters and periods in names and addresses", () => {
    const parsed = customerSignUpSchema.parse({
      ...validSignUp,
      fullName: "José Peña Jr.",
      barangay: "Barangay Niño",
    });

    expect(parsed).toMatchObject({ fullName: "José Peña Jr.", barangay: "Barangay Niño" });
  });

  test("never alters the password", () => {
    const parsed = customerSignUpSchema.parse({
      ...validSignUp,
      password: " Password1 ",
      confirmPassword: " Password1 ",
    });

    expect(parsed.password).toBe(" Password1 ");
  });

  test.each([
    ["fullName", "<script>alert(1)</script>"],
    ["street", "12 <b>Main</b>"],
    ["city", "Quezon <City>"],
    ["postalCode", "11<08"],
    ["email", "jane@example.com\nbcc:evil@example.com"],
  ])("rejects markup and stray characters in %s", (field, value) => {
    expect(
      customerSignUpSchema.safeParse({ ...validSignUp, [field]: value }).success,
    ).toBe(false);
  });

  test("reports a friendly message when a field is missing entirely", () => {
    const result = customerSignUpSchema.safeParse({
      ...validSignUp,
      fullName: null,
    });

    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toContain(
      "Full name is required",
    );
  });

  test("builds form values from FormData, treating an unticked box as false", () => {
    const formData = new FormData();
    formData.set("fullName", "Jane Doe");
    formData.set("terms", "on");

    expect(signUpFormValues(formData)).toMatchObject({
      fullName: "Jane Doe",
      terms: true,
    });
    expect(signUpFormValues(new FormData()).terms).toBe(false);
  });
});

describe("Sign-up steps", () => {
  const [account, delivery, preferences] = signUpSteps;

  test("there are three steps that together cover every field", () => {
    const fields = signUpSteps.flatMap((step) => step.fields).sort();

    expect(signUpSteps).toHaveLength(3);
    expect(fields).toEqual(Object.keys(validSignUp).sort());
  });

  test("the account step checks the passwords match", () => {
    const result = account.schema.safeParse({
      ...validSignUp,
      confirmPassword: "Different1",
    });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      "confirmPassword",
    ]);
  });

  test("each step validates only its own fields", () => {
    const onlyAccount = {
      fullName: "Jane Doe",
      email: "jane@example.com",
      password: "Password1",
      confirmPassword: "Password1",
    };

    expect(account.schema.safeParse(onlyAccount).success).toBe(true);
    expect(delivery.schema.safeParse(onlyAccount).success).toBe(false);
    expect(preferences.schema.safeParse({ marketingOptIn: "no", terms: true }).success).toBe(
      true,
    );
    expect(preferences.schema.safeParse({ terms: true }).success).toBe(false);
    expect(preferences.schema.safeParse({ marketingOptIn: "no", terms: false }).success).toBe(
      false,
    );
  });
});
