import { beforeEach, describe, expect, test } from "vitest";

import { mintCreomsCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";

const key = "k".repeat(40);
const oldKey = "o".repeat(40);
const now = new Date("2026-10-22T10:00:00Z");

beforeEach(() => {
  process.env.CREOMS_SERVICE_SECRET = key;
  delete process.env.CREOMS_SERVICE_SECRET_PREVIOUS;
});

function headersWith(token?: string) {
  return new Headers(token ? { Authorization: `Bearer ${token}` } : {});
}

describe("CREOMS service credential", () => {
  test("accepts a fresh credential signed with the current key", () => {
    const token = mintCreomsCredential({ now });
    expect(verifyCreomsCredential(headersWith(token), now)).toBe(true);
  });

  test("refuses a missing credential, garbage and the wrong key", () => {
    expect(verifyCreomsCredential(headersWith(), now)).toBe(false);
    expect(verifyCreomsCredential(headersWith("not.a.jwt"), now)).toBe(false);
    expect(verifyCreomsCredential(headersWith("x"), now)).toBe(false);
    const forged = mintCreomsCredential({ now, secret: "z".repeat(40) });
    expect(verifyCreomsCredential(headersWith(forged), now)).toBe(false);
  });

  test("refuses an expired credential", () => {
    const token = mintCreomsCredential({ now, lifetimeSeconds: 60 });
    expect(verifyCreomsCredential(headersWith(token), new Date(now.getTime() + 61_000))).toBe(false);
  });

  test("refuses a credential issued in the future or living longer than 15 minutes", () => {
    const early = mintCreomsCredential({ now: new Date(now.getTime() + 600_000) });
    expect(verifyCreomsCredential(headersWith(early), now)).toBe(false);
    const long = mintCreomsCredential({ now, lifetimeSeconds: 3600 });
    expect(verifyCreomsCredential(headersWith(long), now)).toBe(false);
  });

  test("refuses a credential for another audience or scope", () => {
    expect(verifyCreomsCredential(headersWith(mintCreomsCredential({ now, audience: "other" })), now)).toBe(false);
    expect(verifyCreomsCredential(headersWith(mintCreomsCredential({ now, scope: "feedback:read" })), now)).toBe(false);
  });

  test("refuses a token that claims a different algorithm", () => {
    const [, payload] = mintCreomsCredential({ now }).split(".");
    const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    expect(verifyCreomsCredential(headersWith(`${none}.${payload}.`), now)).toBe(false);
  });

  test("the retired shared secret no longer works", () => {
    process.env.ORDER_STATUS_API_SECRET = "test-secret";
    expect(verifyCreomsCredential(headersWith("test-secret"), now)).toBe(false);
    expect(verifyCreomsCredential(new Headers({ "X-Order-Status-Secret": "test-secret" }), now)).toBe(false);
  });

  test("refuses everything when no key is configured or the key is too short", () => {
    const token = mintCreomsCredential({ now });
    delete process.env.CREOMS_SERVICE_SECRET;
    expect(verifyCreomsCredential(headersWith(token), now)).toBe(false);
    process.env.CREOMS_SERVICE_SECRET = "short";
    expect(verifyCreomsCredential(headersWith(mintCreomsCredential({ now, secret: "short" })), now)).toBe(false);
  });

  test("rotation: the previous key keeps working until it is removed", () => {
    const withOld = mintCreomsCredential({ now, secret: oldKey });
    expect(verifyCreomsCredential(headersWith(withOld), now)).toBe(false);
    process.env.CREOMS_SERVICE_SECRET_PREVIOUS = oldKey;
    expect(verifyCreomsCredential(headersWith(withOld), now)).toBe(true);
    delete process.env.CREOMS_SERVICE_SECRET_PREVIOUS;
    expect(verifyCreomsCredential(headersWith(withOld), now)).toBe(false);
  });
});
