import { describe, expect, test } from "vitest";

import { hasTransparentHeader } from "../components/shared/header";

describe("Header transparency", () => {
  test("floats over the landing page photo until the visitor scrolls", () => {
    expect(hasTransparentHeader("/", false)).toBe(true);
    expect(hasTransparentHeader("/", true)).toBe(false);
  });

  test.each(["/products", "/about", "/faq"])("stays solid on %s", (pathname) => {
    expect(hasTransparentHeader(pathname, false)).toBe(false);
  });
});
