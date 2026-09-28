import { describe, expect, test } from "vitest";

import { shouldShowHeaderSignOut } from "../components/shared/header";

describe("Header sign out visibility", () => {
  test.each(["/", "/about", "/faq", "/contact"])(
    "shows on %s",
    (pathname) => {
      expect(shouldShowHeaderSignOut(pathname)).toBe(true);
    },
  );

  test.each(["/products", "/profile/orders", "/journey", "/careers"])(
    "does not show on %s",
    (pathname) => {
      expect(shouldShowHeaderSignOut(pathname)).toBe(false);
    },
  );
});
