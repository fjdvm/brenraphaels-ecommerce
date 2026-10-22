import crypto from "node:crypto";

/**
 * The service credential CREOMS presents to the internal Order status endpoint (ADR-0003).
 * It is a short-lived HS256 JWT that CREOMS mints from a signing key only the two apps hold,
 * so a leaked token expires on its own and only ever opens Order status.
 */
export const creomsIssuer = "creoms";
export const creomsAudience = "brenraphaels-orders";
export const creomsOrderStatusScope = "orders:status";
export const maxCredentialLifetimeSeconds = 15 * 60;
export const defaultCredentialLifetimeSeconds = 5 * 60;
const minKeyLength = 32;

type Claims = { iss?: unknown; aud?: unknown; scope?: unknown; iat?: unknown; exp?: unknown };

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(signingInput: string, key: string) {
  return crypto.createHmac("sha256", key).update(signingInput).digest("base64url");
}

/** Current key first, then the previous one so CREOMS can switch keys without downtime. */
function signingKeys() {
  return [process.env.CREOMS_SERVICE_SECRET, process.env.CREOMS_SERVICE_SECRET_PREVIOUS]
    .filter((key): key is string => typeof key === "string" && key.length >= minKeyLength);
}

/** Mints a credential the way CREOMS does. The storefront only uses it in tests and the documented example. */
export function mintCreomsCredential(options: {
  now?: Date;
  lifetimeSeconds?: number;
  secret?: string;
  audience?: string;
  scope?: string;
} = {}) {
  const iat = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const signingInput = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    iss: creomsIssuer,
    aud: options.audience ?? creomsAudience,
    scope: options.scope ?? creomsOrderStatusScope,
    iat,
    exp: iat + (options.lifetimeSeconds ?? defaultCredentialLifetimeSeconds),
  })}`;
  return `${signingInput}.${sign(signingInput, options.secret ?? process.env.CREOMS_SERVICE_SECRET ?? "")}`;
}

function signatureMatches(signingInput: string, supplied: string) {
  const received = Buffer.from(supplied);
  return signingKeys().some((key) => {
    const expected = Buffer.from(sign(signingInput, key));
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  });
}

function parseJson(part: string): unknown {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** True only for a validly signed, unexpired credential scoped to Order status. Never throws. */
export function verifyCreomsCredential(headers: Headers, now = new Date()): boolean {
  const token = headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const parts = token?.split(".");
  if (!parts || parts.length !== 3) return false;
  const [header, payload, signature] = parts;

  const parsedHeader = parseJson(header) as { alg?: unknown } | null;
  if (parsedHeader?.alg !== "HS256") return false;
  if (!signatureMatches(`${header}.${payload}`, signature)) return false;

  const claims = parseJson(payload) as Claims | null;
  if (!claims || typeof claims.iat !== "number" || typeof claims.exp !== "number") return false;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  return claims.iss === creomsIssuer
    && claims.aud === creomsAudience
    && claims.scope === creomsOrderStatusScope
    && claims.iat <= nowSeconds
    && claims.exp > nowSeconds
    && claims.exp - claims.iat <= maxCredentialLifetimeSeconds;
}
