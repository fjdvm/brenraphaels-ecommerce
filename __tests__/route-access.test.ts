import { describe, expect, test } from "vitest";

import { decideRouteAccess, safeReturnPath } from "../lib/auth/route-access";

describe("Route access (proxy cookie check)", () => {
  test.each([
    "/",
    "/about",
    "/contact",
    "/faq",
    "/terms",
    "/privacy",
    "/returns",
    "/careers",
    "/verify-email",
    "/signin",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ])("%s is reachable without signing in", (pathname) => {
    expect(decideRouteAccess({ pathname, search: "", hasSession: false })).toEqual({
      action: "next",
    });
  });

  test("a protected page sends a signed-out visitor to sign in and remembers the page", () => {
    expect(
      decideRouteAccess({ pathname: "/profile", search: "?tab=1", hasSession: false }),
    ).toEqual({ action: "redirect", to: "/signin?next=%2Fprofile%3Ftab%3D1" });
  });

  test("an unknown page is protected by default", () => {
    expect(
      decideRouteAccess({ pathname: "/orders/12", search: "", hasSession: false }),
    ).toEqual({ action: "redirect", to: "/signin?next=%2Forders%2F12" });
  });

  test("a visitor with a session cookie may continue to protected pages", () => {
    expect(
      decideRouteAccess({ pathname: "/profile", search: "", hasSession: true }),
    ).toEqual({ action: "next" });
  });
});

describe("Return path after signing in", () => {
  test("accepts a path within the site", () => {
    expect(safeReturnPath("/profile?tab=1")).toBe("/profile?tab=1");
  });

  test.each([
    undefined,
    "",
    "profile",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "/signin",
    "/signup",
  ])("rejects %s", (path) => {
    expect(safeReturnPath(path)).toBeUndefined();
  });
});
