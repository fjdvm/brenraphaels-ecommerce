import { describe, expect, test } from "vitest";

import { applicantProfileSchema } from "../lib/careers/profile";
import { resetApplicantPassword, signInApplicant, requestApplicantPasswordReset, type ApplicantAuth } from "../lib/careers/identity";
import { parseJobFilter } from "../lib/validators/careers";
import { cleanList } from "../lib/validators/sanitize";
import { vi } from "vitest";

const auth = (): ApplicantAuth => ({
  createLogin: vi.fn(),
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn().mockResolvedValue("reset"),
  sendVerificationEmail: vi.fn(),
  signIn: vi.fn().mockResolvedValue("signed-in"),
});

describe("Applicant profile validation", () => {
  test("normalizes every field before it is persisted", () => {
    const profile = applicantProfileSchema.parse({
      fullName: "  jane   DOE ",
      phone: "+63 (917) 123-4567",
      location: "  Quezon   City ",
      summary: "Line one  \r\n\r\nLine   two",
      skills: "Excel,  hiring , excel,, Baking",
      education: [{ school: " UP  Diliman ", qualification: "BA", fieldOfStudy: "", startedOn: "2015-06", completedOn: "2019-04" }],
      workHistory: [{ employer: "Bren Raphael", title: " Coordinator ", startedOn: "", endedOn: "", description: "" }],
    });
    expect(profile).toMatchObject({
      fullName: "Jane Doe",
      phone: "+639171234567",
      location: "Quezon City",
      skills: "Excel, hiring, Baking",
      education: [{ school: "UP Diliman", fieldOfStudy: null, startedOn: "2015-06" }],
      workHistory: [{ title: "Coordinator", startedOn: null, description: null }],
    });
    expect(profile.summary).toBe("Line one\n\nLine two");
  });

  test("turns blank optional fields into null", () => {
    const profile = applicantProfileSchema.parse({ fullName: "Jane Doe", phone: "", location: " ", summary: "" });
    expect(profile).toMatchObject({ phone: null, location: null, summary: null, skills: "", education: [], workHistory: [] });
  });

  test.each([
    [{ fullName: "" }, "fullName"],
    [{ fullName: "Jane 123" }, "fullName"],
    [{ fullName: "Jane Doe", phone: "call me" }, "phone"],
    [{ fullName: "Jane Doe", phone: "123" }, "phone"],
    [{ fullName: "Jane Doe", location: "<script>" }, "location"],
    [{ fullName: "Jane Doe", summary: "<b>hi</b>" }, "summary"],
    [{ fullName: "Jane Doe", skills: "a; DROP TABLE" }, "skills"],
    [{ fullName: "Jane Doe", education: [{ school: "", qualification: "BA" }] }, "education"],
    [{ fullName: "Jane Doe", education: [{ school: "UP", qualification: "" }] }, "education"],
    [{ fullName: "Jane Doe", education: [{ school: "UP", qualification: "BA", startedOn: "2020-13" }] }, "education"],
    [{ fullName: "Jane Doe", education: [{ school: "UP", qualification: "BA", startedOn: "2020-05", completedOn: "2019-05" }] }, "education"],
    [{ fullName: "Jane Doe", workHistory: [{ employer: "", title: "Lead" }] }, "workHistory"],
    [{ fullName: "Jane Doe", workHistory: [{ employer: "Co", title: "" }] }, "workHistory"],
    [{ fullName: "Jane Doe", workHistory: [{ employer: "Co", title: "Lead", startedOn: "2999-01" }] }, "workHistory"],
    [{ fullName: "Jane Doe", workHistory: [{ employer: "Co", title: "Lead", startedOn: "2022-05", endedOn: "2021-01" }] }, "workHistory"],
  ])("rejects %j", (input, section) => {
    const result = applicantProfileSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path[0]).toBe(section);
  });
});

describe("Careers sign-in, reset and filters", () => {
  test("sign-in reports field errors for a bad email or empty password", async () => {
    const result = await signInApplicant({ email: "nope", password: "" }, { auth: auth() });
    expect(result).toMatchObject({ status: "invalid", fieldErrors: { email: [expect.any(String)], password: ["Enter your password"] } });
  });

  test("forgot-password reports a field error for a bad email", async () => {
    await expect(requestApplicantPasswordReset("nope", { auth: auth() })).resolves.toMatchObject({ status: "invalid-email", fieldErrors: { email: [expect.any(String)] } });
  });

  test("reset-password rejects a malformed token and reports password field errors", async () => {
    const dependencies = { auth: auth() };
    await expect(resetApplicantPassword({ token: "has space", password: "Password123!", confirmPassword: "Password123!" }, dependencies)).resolves.toEqual({ status: "invalid-link" });
    await expect(resetApplicantPassword({ token: "a".repeat(2_049), password: "Password123!", confirmPassword: "Password123!" }, dependencies)).resolves.toEqual({ status: "invalid-link" });
    await expect(resetApplicantPassword({ token: "abc", password: "weak", confirmPassword: "different" }, dependencies)).resolves.toMatchObject({ status: "invalid-password", fieldErrors: { password: expect.any(Array) } });
    await expect(resetApplicantPassword({ token: "abc", password: "Password123!", confirmPassword: "Password123?" }, dependencies)).resolves.toMatchObject({ fieldErrors: { confirmPassword: ["Passwords do not match"] } });
    await expect(resetApplicantPassword({ token: "abc", password: "Password123!", confirmPassword: "Password123!" }, dependencies)).resolves.toEqual({ status: "reset" });
  });

  test("job filters from the URL are normalized and unexpected values dropped", () => {
    expect(parseJobFilter("  Full   time ")).toBe("Full time");
    expect(parseJobFilter("")).toBeUndefined();
    expect(parseJobFilter(["a", "b"])).toBeUndefined();
    expect(parseJobFilter("<script>alert(1)</script>")).toBeUndefined();
    expect(parseJobFilter("x".repeat(101))).toBeUndefined();
  });

  test("cleanList trims, drops blanks and case-insensitive duplicates", () => {
    expect(cleanList(" a , ,B,b , c ")).toBe("a, B, c");
  });
});
