import { describe, expect, test } from "vitest";

import { isSameOrigin } from "../lib/security/same-origin";

const request = (origin: string | null, headers: Record<string, string> = {}, url = "http://0.0.0.0:3000/api/x") =>
  new Request(url, { method: "POST", headers: { ...(origin ? { origin } : {}), ...headers } });

describe("isSameOrigin", () => {
  test("allows a request with no Origin header", () => {
    expect(isSameOrigin(request(null), {})).toBe(true);
  });
  test("allows the origin of the request URL", () => {
    expect(isSameOrigin(request("http://localhost:3000", {}, "http://localhost:3000/api/x"), {})).toBe(true);
  });
  test("allows the public site behind the container host", () => {
    expect(isSameOrigin(request("https://shop.example.com"), { NEXT_PUBLIC_SITE_URL: "https://shop.example.com" })).toBe(true);
    expect(isSameOrigin(request("https://shop.example.com", { "x-forwarded-host": "shop.example.com", "x-forwarded-proto": "https" }), {})).toBe(true);
  });
  test("rejects another site", () => {
    expect(isSameOrigin(request("https://evil.example"), { NEXT_PUBLIC_SITE_URL: "https://shop.example.com" })).toBe(false);
  });
});
