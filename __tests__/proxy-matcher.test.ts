import { describe, expect, test } from "vitest";

import { config } from "@/proxy";

// Next compiles the matcher with path-to-regexp; for this pattern (a leading slash and
// one negative-lookahead group) an anchored RegExp behaves the same.
const [matcher] = config.matcher;
const proxyRuns = (pathname: string) => new RegExp(`^${matcher}$`).test(pathname);

describe("Proxy matcher", () => {
  test.each([
    "/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/a-4-a/c.js",
    "/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/anything/else",
  ])("skips the BotID challenge script so signed-out Visitors can load it: %s", (pathname) => {
    expect(proxyRuns(pathname)).toBe(false);
  });

  test.each(["/", "/signup", "/signin", "/forgot-password", "/verify-email", "/profile"])(
    "still runs for pages: %s",
    (pathname) => {
      expect(proxyRuns(pathname)).toBe(true);
    },
  );

  test("still skips Next.js internals and endpoints", () => {
    expect(proxyRuns("/_next/static/chunk.js")).toBe(false);
    expect(proxyRuns("/api/auth/session")).toBe(false);
  });
});
