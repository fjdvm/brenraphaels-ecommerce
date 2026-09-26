import { describe, expect, test, vi } from "vitest";

import { verifyEmailWithNeon } from "../lib/neon-auth/verify-email";

const baseUrl = "https://ep-example.neonauth.example.neon.tech/neondb/auth";
const origin = "https://shop.example.com";

function respond(status: number, body: unknown, cookies: string[] = []) {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

function verify(response: Response) {
  const fetchStub = vi.fn().mockResolvedValue(response);
  const setCookie = vi.fn();
  const result = verifyEmailWithNeon({
    baseUrl,
    token: "token-value",
    origin,
    setCookie,
    fetch: fetchStub,
  });
  return { fetchStub, result, setCookie };
}

describe("verifyEmailWithNeon", () => {
  test("asks Neon with a GET carrying the token and a trusted origin", async () => {
    const { fetchStub, result } = verify(respond(200, { status: true }));
    await result;

    const [url, init] = fetchStub.mock.calls[0];
    expect(String(url)).toBe(`${baseUrl}/verify-email?token=token-value`);
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ Origin: origin });
  });

  test("passes Neon's session cookies on when verification succeeds", async () => {
    const { result, setCookie } = verify(
      respond(200, { status: true }, [
        "__Secure-neon-auth.session_token=abc%2Bdef%3D.sig%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax",
      ]),
    );

    await expect(result).resolves.toBe("verified");
    expect(setCookie).toHaveBeenCalledWith({
      name: "__Secure-neon-auth.session_token",
      value: "abc+def=.sig=",
      options: {
        path: "/",
        maxAge: 604800,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      },
    });
  });

  test("reports an expired link and sets no cookies", async () => {
    const { result, setCookie } = verify(
      respond(401, { code: "TOKEN_EXPIRED", message: "Token expired" }),
    );

    await expect(result).resolves.toBe("expired");
    expect(setCookie).not.toHaveBeenCalled();
  });

  test("reports an invalid or used link", async () => {
    const { result } = verify(respond(401, { code: "INVALID_TOKEN", message: "Invalid token" }));

    await expect(result).resolves.toBe("invalid");
  });

  test("fails loudly when Neon is unavailable or the endpoint is missing", async () => {
    await expect(verify(respond(503, null)).result).rejects.toThrow("HTTP 503");
    await expect(verify(respond(404, null)).result).rejects.toThrow("HTTP 404");
  });
});
