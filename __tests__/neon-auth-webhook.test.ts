import crypto from "node:crypto";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { createTransport, sendMail } = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

const keyId = "test-neon-key";
const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
const jwks = {
  keys: [
    {
      ...publicKey.export({ format: "jwk" }),
      alg: "EdDSA",
      kid: keyId,
      use: "sig",
    },
  ],
};

let post: (request: Request) => Promise<Response>;

beforeAll(async () => {
  process.env.BREVO_SMTP_HOST = "smtp.example.test";
  process.env.BREVO_SMTP_PORT = "587";
  process.env.BREVO_SMTP_USER = "smtp-user";
  process.env.BREVO_SMTP_KEY = "smtp-key";
  process.env.EMAIL_FROM_ADDRESS = "hello@example.test";
  process.env.EMAIL_FROM_NAME = "Bren Raphael's Ube Jam & Halaya";
  process.env.NEON_AUTH_BASE_URL = "https://auth.example.test/neondb/auth";
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.test";

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(jwks)),
  );
  createTransport.mockReturnValue({ sendMail });
  ({ POST: post } = await import("../app/api/webhooks/neon-auth/route"));
});

afterEach(() => {
  vi.clearAllMocks();
  createTransport.mockReturnValue({ sendMail });
  sendMail.mockResolvedValue({});
});

function sign(rawBody: string, timestamp = Date.now()) {
  const header = Buffer.from(
    JSON.stringify({ alg: "EdDSA", kid: keyId }),
  ).toString("base64url");
  const body = Buffer.from(rawBody).toString("base64url");
  const signingInput = `${header}.${Buffer.from(`${timestamp}.${body}`).toString("base64url")}`;
  const signature = crypto
    .sign(null, Buffer.from(signingInput), privateKey)
    .toString("base64url");

  return {
    "X-Neon-Signature": `${header}..${signature}`,
    "X-Neon-Signature-Kid": keyId,
    "X-Neon-Timestamp": String(timestamp),
    "X-Neon-Event-Type": "send.magic_link",
  };
}

function request(rawBody: string, headers: Record<string, string>) {
  return new Request("https://shop.example.test/api/webhooks/neon-auth", {
    body: rawBody,
    headers: { "Content-Type": "application/json", ...headers },
    method: "POST",
  });
}

function magicLinkPayload(linkType: "email-verification" | "forget-password") {
  return JSON.stringify({
    event_data: {
      link_type: linkType,
      link_url: "https://auth.example.test/verify?token=neon-token",
      token: "neon-token",
    },
    event_type: "send.magic_link",
    user: { email: "customer@example.test" },
  });
}

describe("POST /api/webhooks/neon-auth", () => {
  it("accepts a valid signed verification event and sends the branded email", async () => {
    const body = magicLinkPayload("email-verification");
    const response = await post(request(body, sign(body)));

    expect(response.status).toBe(204);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { pass: "smtp-key", user: "smtp-user" },
        host: "smtp.example.test",
        port: 587,
        secure: false,
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: {
          address: "hello@example.test",
          name: "Bren Raphael's Ube Jam & Halaya",
        },
        subject: "Verify your email — Bren Raphael's Ube Jam & Halaya",
        text: expect.stringContaining(
          "https://shop.example.test/verify-email?token=neon-token",
        ),
        to: "customer@example.test",
      }),
    );
    expect(sendMail.mock.calls[0][0].html).toContain("#452175");
    expect(sendMail.mock.calls[0][0].html).toContain(
      'href="https://shop.example.test/verify-email?token=neon-token"',
    );
    expect(sendMail.mock.calls[0][0].html.match(/<a /g)).toHaveLength(2); // button and pasted-link fallback
  });

  it("sends password-reset links to this app's reset-password page", async () => {
    const body = magicLinkPayload("forget-password");
    const response = await post(request(body, sign(body)));

    expect(response.status).toBe(204);
    expect(sendMail.mock.calls[0][0].html).toContain(
      'href="https://shop.example.test/reset-password?token=neon-token"',
    );
  });

  it("rejects a bad signature", async () => {
    const body = magicLinkPayload("email-verification");
    const headers = sign(body);
    headers["X-Neon-Signature"] = `${headers["X-Neon-Signature"]}tampered`;

    expect((await post(request(body, headers))).status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("rejects missing signature headers", async () => {
    expect((await post(request("{}", {}))).status).toBe(400);
  });

  it("rejects a signature timestamp older than five minutes", async () => {
    const body = magicLinkPayload("email-verification");
    const staleTimestamp = Date.now() - 5 * 60 * 1000 - 1;

    expect((await post(request(body, sign(body, staleTimestamp)))).status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("returns an error when SMTP delivery fails", async () => {
    sendMail.mockRejectedValueOnce(new Error("SMTP unavailable"));
    const body = magicLinkPayload("email-verification");

    expect((await post(request(body, sign(body)))).status).toBe(500);
  });
});
