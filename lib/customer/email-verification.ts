export const resendCooldownSeconds = 60;
const tokenMaximumLength = 2_048;

export type VerificationAuth = {
  verifyEmail(token: string): Promise<"verified" | "expired" | "invalid">;
  sendVerificationEmail(email: string): Promise<void>;
};

export type VerificationResendStore = {
  claimResend(email: string, requestedAt: Date): Promise<boolean>;
};

export type VerificationTokenStore = {
  claimVerifiedToken(token: string, verifiedAt: Date): Promise<boolean>;
};

export type VerificationResult = "verified" | "expired" | "invalid";

export async function verifyCustomerEmail(
  token: string | undefined,
  dependencies: {
    auth: VerificationAuth;
    tokenStore: VerificationTokenStore;
    now: Date;
  },
): Promise<VerificationResult> {
  if (!token || token.length > tokenMaximumLength) {
    return "invalid";
  }

  const result = await dependencies.auth.verifyEmail(token);
  if (result !== "verified") {
    return result;
  }

  return (await dependencies.tokenStore.claimVerifiedToken(token, dependencies.now))
    ? "verified"
    : "invalid";
}

export async function resendCustomerVerification(
  email: string,
  dependencies: {
    auth: VerificationAuth;
    resendStore: VerificationResendStore;
    now: Date;
  },
) {
  const normalizedEmail = email.toLowerCase();
  const canResend = await dependencies.resendStore.claimResend(
    normalizedEmail,
    dependencies.now,
  );
  if (!canResend) {
    return "cooldown" as const;
  }

  await dependencies.auth.sendVerificationEmail(normalizedEmail);
  return "sent" as const;
}
