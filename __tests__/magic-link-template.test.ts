import { describe, expect, test } from "vitest";

import { renderMagicLinkEmail } from "../lib/email/magic-link-template";

const destination = "https://shop.example/verify-email?token=abc&x=1";
const logoUrl = "https://shop.example/logo.jpeg";

describe("The verification and password-reset email", () => {
  test("puts the link on the button and in a paste-in fallback", () => {
    const { html } = renderMagicLinkEmail({
      linkType: "email-verification",
      destination,
      logoUrl,
    });

    const escaped = "https://shop.example/verify-email?token=abc&amp;x=1";
    expect(html.split(`href="${escaped}"`)).toHaveLength(3);
    expect(html).toContain("Please verify your email");
    expect(html).toContain("Verify my email");
  });

  test("shows the hosted logo with alt text for clients that block images", () => {
    const { html } = renderMagicLinkEmail({
      linkType: "email-verification",
      destination,
      logoUrl,
    });

    expect(html).toContain(`src="${logoUrl}"`);
    expect(html).toContain('alt="Bren Raphael\'s"');
  });

  test("has sharp edges everywhere", () => {
    const { html } = renderMagicLinkEmail({
      linkType: "email-verification",
      destination,
      logoUrl,
    });

    expect(html).not.toContain("border-radius");
  });

  test("uses reset wording and keeps the subject for a password reset", () => {
    const { html, subject, text } = renderMagicLinkEmail({
      linkType: "forget-password",
      destination,
      logoUrl,
    });

    expect(subject).toBe("Reset your password — Bren Raphael's Ube Jam & Halaya");
    expect(html).toContain("Reset password");
    expect(text).toContain(`Reset password: ${destination}`);
  });

  test("keeps the verification subject and a plain-text version with the raw link", () => {
    const { subject, text } = renderMagicLinkEmail({
      linkType: "email-verification",
      destination,
      logoUrl,
    });

    expect(subject).toBe("Verify your email — Bren Raphael's Ube Jam & Halaya");
    expect(text).toContain(`Verify my email: ${destination}`);
  });
});
