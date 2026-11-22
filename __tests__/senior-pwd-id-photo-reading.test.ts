import { describe, expect, test } from "vitest";

import { findIdNumber } from "../lib/senior-pwd/id-photo-reading";

describe("reading the ID number off a Senior/PWD ID photo", () => {
  test("takes the labelled number on a Senior Citizen ID", () => {
    expect(findIdNumber("REPUBLIC OF THE PHILIPPINES\nOFFICE FOR SENIOR CITIZENS AFFAIRS\nOSCA ID No.: 0458721\nDELA CRUZ, MARIA")).toBe("0458721");
  });

  test("takes the labelled number on a PWD ID and stops at the next column", () => {
    expect(findIdNumber("PWD ID NO. 13-7404-000-0001234    Type of Disability")).toBe("13-7404-000-0001234");
  });

  test("falls back to the national PWD number format", () => {
    expect(findIdNumber("JUAN DELA CRUZ\n13-7404-000-0001234\nVALID UNTIL 2028")).toBe("13-7404-000-0001234");
  });

  test("ignores text with no number and labels without digits", () => {
    expect(findIdNumber("SENIOR CITIZEN\nNAME: MARIA DELA CRUZ")).toBeUndefined();
    expect(findIdNumber("ID No.: NONE")).toBeUndefined();
  });
});
