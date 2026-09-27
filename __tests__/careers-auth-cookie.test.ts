import { describe, expect, test } from "vitest";

import { careersAuthCookies } from "../lib/careers/auth";

describe("Careers Auth cookies", () => {
  test("keeps the path-scoped Applicant session when the Customer session shares its name", () => {
    const applicant = "__Secure-neon-auth.session_token=applicant-session";
    const customer = "__Secure-neon-auth.session_token=customer-session";

    // Browser Cookie headers order the more specific /careers cookie first.
    expect(careersAuthCookies(`${applicant}; ${customer}; theme=system`)).toBe(applicant);
  });

  test("keeps each first Careers Auth cookie while discarding unrelated cookies", () => {
    expect(careersAuthCookies("theme=system; __Secure-neon-auth.session_token=applicant; __Secure-neon-auth.local.session_data=cached")).toBe("__Secure-neon-auth.session_token=applicant; __Secure-neon-auth.local.session_data=cached");
  });
});
