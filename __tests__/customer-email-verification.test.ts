import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  resendCustomerVerification,
  verifyCustomerEmail,
} from "../lib/customer/email-verification";
import { createVerificationResendStore } from "../lib/customer/verification-resend-store";
import { createVerificationTokenStore } from "../lib/customer/verification-token-store";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;

beforeEach(async () => {
  client = await createTestDatabase();
});

afterEach(async () => {
  await client.close();
});

function authStub(result: "verified" | "expired" | "invalid" = "verified") {
  return {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    verifyEmail: vi.fn().mockResolvedValue(result),
  };
}

function verificationDependencies(
  auth: ReturnType<typeof authStub>,
) {
  return {
    auth,
    now: new Date("2026-09-26T08:00:00.000Z"),
    tokenStore: createVerificationTokenStore(drizzle(client)),
  };
}

describe("Customer email verification", () => {
  test("verifies a valid link", async () => {
    const auth = authStub();

    await expect(
      verifyCustomerEmail("valid-token", verificationDependencies(auth)),
    ).resolves.toBe("verified");
    expect(auth.verifyEmail).toHaveBeenCalledWith("valid-token");
  });

  test("reports an expired link", async () => {
    const auth = authStub("expired");

    await expect(
      verifyCustomerEmail("expired-token", verificationDependencies(auth)),
    ).resolves.toBe("expired");
  });

  test("reports an invalid or already-used link", async () => {
    const auth = authStub();

    await expect(verifyCustomerEmail(undefined, verificationDependencies(auth))).resolves.toBe(
      "invalid",
    );
    await expect(
      verifyCustomerEmail("used-token", verificationDependencies(auth)),
    ).resolves.toBe("verified");
    await expect(
      verifyCustomerEmail("used-token", verificationDependencies(auth)),
    ).resolves.toBe("invalid");
  });

  test("treats an oversized token as invalid without asking Neon", async () => {
    const auth = authStub();

    await expect(
      verifyCustomerEmail("a".repeat(5_000), verificationDependencies(auth)),
    ).resolves.toBe("invalid");
    expect(auth.verifyEmail).not.toHaveBeenCalled();
  });

  test("limits resends to once every 60 seconds for an email", async () => {
    const auth = authStub();
    const resendStore = createVerificationResendStore(drizzle(client));
    const firstRequest = new Date("2026-09-26T08:00:00.000Z");

    await expect(
      resendCustomerVerification("JANE@example.com", {
        auth,
        resendStore,
        now: firstRequest,
      }),
    ).resolves.toBe("sent");
    await expect(
      resendCustomerVerification("jane@example.com", {
        auth,
        resendStore,
        now: new Date(firstRequest.getTime() + 59_000),
      }),
    ).resolves.toBe("cooldown");
    await expect(
      resendCustomerVerification("jane@example.com", {
        auth,
        resendStore,
        now: new Date(firstRequest.getTime() + 60_000),
      }),
    ).resolves.toBe("sent");

    expect(auth.sendVerificationEmail).toHaveBeenCalledTimes(2);
  });
});
