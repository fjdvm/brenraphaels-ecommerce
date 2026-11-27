import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { careersSession } from "../lib/careers/auth";
import { getVisitorSession } from "../lib/neon-auth/server";

const set = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({ set }),
  headers: async () => new Headers({ cookie: "__Secure-neon-auth.session_token=token" }),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => {},
}));

/** The message Next.js throws for a cookie write during a page render (E1180). */
const duringRender = "Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org";

const later = "2030-01-01T00:00:00.000Z";
const user = { id: "user-1", email: "ana@example.com", name: "Ana Cruz", emailVerified: true, createdAt: later, updatedAt: later };

beforeEach(() => {
  for (const prefix of ["", "CAREERS_"]) {
    vi.stubEnv(`${prefix}NEON_AUTH_BASE_URL`, "https://auth.example.test/auth");
    vi.stubEnv(`${prefix}NEON_AUTH_COOKIE_SECRET`, "a-test-cookie-secret-of-at-least-32-characters");
  }
  // Neon Auth refreshing the session: the answer carries a new session cookie.
  vi.stubGlobal("fetch", async () =>
    Response.json(
      { user, session: { id: "session-1", userId: user.id, expiresAt: later, createdAt: later, updatedAt: later } },
      { headers: { "Set-Cookie": "__Secure-neon-auth.session_token=fresh; Path=/; HttpOnly; Secure" } },
    ),
  );
});

afterEach(() => {
  set.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.each([
  ["Customer", getVisitorSession],
  ["Applicant", careersSession],
])("%s session read when Neon Auth sends a cookie", (_name, readSession) => {
  test("still reads the session while a page renders, where cookies cannot be written", async () => {
    set.mockImplementation(() => {
      throw new Error(duringRender);
    });

    await expect(readSession()).resolves.toMatchObject({ userId: "user-1", email: "ana@example.com" });
  });

  test("saves the cookie where writing is allowed", async () => {
    await readSession();

    expect(set).toHaveBeenCalledWith("__Secure-neon-auth.session_token", "fresh", expect.anything());
  });

  test("does not hide any other cookie failure", async () => {
    set.mockImplementation(() => {
      throw new Error("cookie store is broken");
    });

    await expect(readSession()).rejects.toThrow("cookie store is broken");
  });
});
