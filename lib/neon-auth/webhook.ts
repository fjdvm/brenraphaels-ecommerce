import crypto from "node:crypto";

const maximumWebhookAgeMs = 5 * 60 * 1000;
// `kid` is only unique within an Auth issuer. Careers and Storefront use
// different Neon Auth instances, so cache by both the issuer and key id.
const publicKeys = new Map<string, crypto.KeyObject>();

type NeonWebhookEnvelope = {
  event_data?: {
    link_type?: string;
    link_url?: string;
    token?: string;
  };
  event_type?: string;
  user?: {
    email?: string;
  };
};

function neonAuthBaseUrl(baseUrl = process.env.NEON_AUTH_BASE_URL) {
  if (!baseUrl) {
    throw new Error("NEON_AUTH_BASE_URL is not configured");
  }

  return baseUrl.replace(/\/$/, "");
}

async function getPublicKey(keyId: string, baseUrl?: string) {
  const issuer = neonAuthBaseUrl(baseUrl);
  const cacheKey = `${issuer}:${keyId}`;
  const cachedKey = publicKeys.get(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }

  const response = await fetch(`${issuer}/.well-known/jwks.json`, {
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) {
    throw new Error("Unable to retrieve Neon Auth signing keys");
  }

  const jwks = (await response.json()) as { keys?: crypto.JsonWebKey[] };
  const jwk = jwks.keys?.find((key) => key.kid === keyId);
  if (!jwk) {
    throw new Error("Neon Auth signing key was not found");
  }

  const publicKey = crypto.createPublicKey({ format: "jwk", key: jwk });
  publicKeys.set(cacheKey, publicKey);
  return publicKey;
}

function parseTimestamp(timestamp: string) {
  if (!/^\d+$/.test(timestamp)) {
    throw new Error("Invalid Neon timestamp");
  }

  const value = Number(timestamp);
  if (!Number.isSafeInteger(value) || Date.now() - value > maximumWebhookAgeMs) {
    throw new Error("Neon webhook timestamp is too old");
  }

  return value;
}

export async function verifyNeonWebhook(
  rawBody: string,
  headers: Headers,
  baseUrl?: string,
): Promise<NeonWebhookEnvelope> {
  const signature = headers.get("x-neon-signature");
  const keyId = headers.get("x-neon-signature-kid");
  const timestamp = headers.get("x-neon-timestamp");

  if (!signature || !keyId || !timestamp) {
    throw new Error("Missing Neon webhook signature headers");
  }

  parseTimestamp(timestamp);

  const [header, detachedPayload, signatureValue, ...extraParts] = signature.split(".");
  if (!header || detachedPayload !== "" || !signatureValue || extraParts.length > 0) {
    throw new Error("Invalid Neon webhook signature format");
  }

  const body = Buffer.from(rawBody).toString("base64url");
  const signaturePayload = Buffer.from(`${timestamp}.${body}`).toString("base64url");
  const signingInput = Buffer.from(`${header}.${signaturePayload}`);
  const publicKey = await getPublicKey(keyId, baseUrl);
  const isValid = crypto.verify(
    null,
    signingInput,
    publicKey,
    Buffer.from(signatureValue, "base64url"),
  );

  if (!isValid) {
    throw new Error("Invalid Neon webhook signature");
  }

  try {
    return JSON.parse(rawBody) as NeonWebhookEnvelope;
  } catch {
    throw new Error("Invalid Neon webhook body");
  }
}
