import { describe, expect, test } from "vitest";

import { metPasswordRules, passwordRules } from "../lib/validators/password-rules";

describe("Password rules", () => {
  test("lists the four rules shown beside the sign-up form", () => {
    expect(passwordRules.map((rule) => rule.label)).toEqual([
      "8+ characters",
      "Uppercase letter",
      "Number",
      "Special character",
    ]);
  });

  test("meets nothing for an empty password", () => {
    expect(metPasswordRules("")).toEqual([false, false, false, false]);
  });

  test("marks each rule as it is met", () => {
    expect(metPasswordRules("abcdefgh")).toEqual([true, false, false, false]);
    expect(metPasswordRules("Abc")).toEqual([false, true, false, false]);
    expect(metPasswordRules("abc1")).toEqual([false, false, true, false]);
    expect(metPasswordRules("abc!")).toEqual([false, false, false, true]);
  });

  test("meets everything for a strong password", () => {
    expect(metPasswordRules("Sup3rUbe!")).toEqual([true, true, true, true]);
  });

  test("does not count a space or a letter as a special character", () => {
    expect(metPasswordRules("a b é")[3]).toBe(false);
  });
});
