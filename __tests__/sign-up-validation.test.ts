import { describe, expect, test } from "vitest";

import {
  customerSignUpSchema,
  signUpFormValues,
  signUpSteps,
} from "../lib/customer/sign-up-schema";
import { cleanEmail, cleanName, cleanPhone, cleanText } from "../lib/validators/sanitize";

const validSignUp = {
  firstName: "Jane",
  middleName: "",
  lastName: "Doe",
  email: "jane@example.com",
  password: "Password1!",
  confirmPassword: "Password1!",
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

  test("uses consistent title case for names", () => {
    expect(cleanName("fItZ")).toBe("Fitz");
    expect(cleanName("dela cruz")).toBe("Dela Cruz");
    expect(cleanName("anne-marie o'connor")).toBe("Anne-Marie O'Connor");
  });
});

describe("Sign-up validation", () => {
  test("stores the sanitised values", () => {
    const parsed = customerSignUpSchema.parse({
      ...validSignUp,
      firstName: "  Jane​  ",
      middleName: "  mARIE \t aNNE ",
      lastName: "dOE",
      email: " JANE@Example.com ",
      contactNumber: "0917 123 4567",
      street: "123   Katipunan\tAvenue",
    });

    expect(parsed).toMatchObject({
      firstName: "Jane",
      middleName: "Marie Anne",
      lastName: "Doe",
      email: "jane@example.com",
      contactNumber: "09171234567",
      street: "123 Katipunan Avenue",
    });
  });

  test("accepts accented letters and periods in names and addresses", () => {
    const parsed = customerSignUpSchema.parse({
      ...validSignUp,
      firstName: "José",
      lastName: "Peña Jr.",
      barangay: "Barangay Niño",
    });

    expect(parsed).toMatchObject({ firstName: "José", lastName: "Peña Jr.", barangay: "Barangay Niño" });
  });

  test("never alters the password", () => {
    const parsed = customerSignUpSchema.parse({
      ...validSignUp,
      password: " Password1! ",
      confirmPassword: " Password1! ",
    });

    expect(parsed.password).toBe(" Password1! ");
  });

  test.each([
    ["firstName", "<script>alert(1)</script>"],
    ["middleName", "Marie<b>"],
    ["lastName", "Doe123"],
    ["street", "12 <b>Main</b>"],
    ["postalCode", "11<08"],
    ["postalCode", "11A8"],
    ["postalCode", "108"],
    ["email", "jane@example.com\nbcc:evil@example.com"],
  ])("rejects markup and stray characters in %s", (field, value) => {
    expect(
      customerSignUpSchema.safeParse({ ...validSignUp, [field]: value }).success,
    ).toBe(false);
  });

  test.each(["province", "city", "barangay"])("asks for %s to be chosen when none is", (field) => {
    const result = customerSignUpSchema.safeParse({ ...validSignUp, [field]: "" });

    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toEqual([
      expect.stringMatching(/^Choose a /),
    ]);
  });

  test("reports a friendly message when a field is missing entirely", () => {
    const result = customerSignUpSchema.safeParse({
      ...validSignUp,
      firstName: null,
      lastName: "",
    });

    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(messages).toContain("First name is required");
    expect(messages).toContain("Last name is required");
  });

  test("the middle name is optional", () => {
    for (const middleName of [undefined, null, "", "   "]) {
      const result = customerSignUpSchema.safeParse({ ...validSignUp, middleName });

      expect(result.success ? result.data.middleName : "invalid").toBe("");
    }
  });

  test.each([
    ["Password1", "Password must contain at least one special character"],
    ["password1!", "Password must contain at least one uppercase letter"],
    ["Password!!", "Password must contain at least one number"],
    ["Pa1!", "Password must be at least 8 characters"],
  ])("rejects the password %s", (password, message) => {
    const result = customerSignUpSchema.safeParse({
      ...validSignUp,
      password,
      confirmPassword: password,
    });

    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toContain(
      message,
    );
  });

  test("accepts a password with a special character", () => {
    expect(
      customerSignUpSchema.safeParse({
        ...validSignUp,
        password: "Sup3r secret#",
        confirmPassword: "Sup3r secret#",
      }).success,
    ).toBe(true);
  });

  test("builds form values from FormData, treating an unticked box as false", () => {
    const formData = new FormData();
    formData.set("firstName", "Jane");
    formData.set("terms", "on");

    expect(signUpFormValues(formData)).toMatchObject({
      firstName: "Jane",
      terms: true,
    });
    expect(signUpFormValues(new FormData()).terms).toBe(false);
  });
});

describe("Sign-up steps", () => {
  const [account, delivery, seniorPwd, preferences] = signUpSteps;

  test("there are four steps that together cover every field, the Senior/PWD question included", () => {
    const fields = signUpSteps.flatMap((step) => step.fields).sort();

    expect(signUpSteps).toHaveLength(4);
    expect(seniorPwd.title).toBe("Senior / PWD");
    expect(fields).toEqual([...Object.keys(validSignUp), "seniorPwd", "idType", "idNumber", "idExpiry", "noExpiry", "idFront", "idBack"].sort());
  });

  test("the account step checks the passwords match", () => {
    const result = account.schema.safeParse({
      ...validSignUp,
      confirmPassword: "Different1!",
    });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      "confirmPassword",
    ]);
  });

  test("each step validates only its own fields", () => {
    const onlyAccount = {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      password: "Password1!",
      confirmPassword: "Password1!",
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
