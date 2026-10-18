import { describe, expect, test } from "vitest";

import { hasTransparentHeader, shouldShowHeaderSignOut } from "../components/shared/header";

describe("Header sign out visibility", () => {
  test.each([
    "/",
    "/about",
    "/journey",
    "/vision-mission",
    "/faq",
    "/contact",
    "/products",
    "/products/ube-jam-smooth",
    "/cart",
    "/checkout",
  ])(
    "shows on %s",
    (pathname) => {
      expect(shouldShowHeaderSignOut(pathname)).toBe(true);
    },
  );

  test.each(["/profile/orders", "/support"])(
    "does not show on %s",
    (pathname) => {
      expect(shouldShowHeaderSignOut(pathname)).toBe(false);
    },
  );
});

describe("Header transparency", () => {
  test("floats over the landing page photo until the visitor scrolls", () => {
    expect(hasTransparentHeader("/", false)).toBe(true);
    expect(hasTransparentHeader("/", true)).toBe(false);
  });

  test.each(["/products", "/about", "/faq"])("stays solid on %s", (pathname) => {
    expect(hasTransparentHeader(pathname, false)).toBe(false);
  });
});
