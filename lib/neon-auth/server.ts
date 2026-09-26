import { createNeonAuth } from "@neondatabase/auth/next/server";
import { connection } from "next/server";

import type { NeonAuth } from "../customer/sign-up";
import type { VerificationAuth } from "../customer/email-verification";
import type { PasswordResetAuth } from "../customer/password-reset";
import type { SignInAuth } from "../customer/sign-in";
import type { VisitorSession } from "../customer/visitor";

function getNeonAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !cookieSecret) {
    throw new Error(
      "NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET are required for sign-up.",
    );
  }

  return createNeonAuth({
    baseUrl,
    cookies: { secret: cookieSecret },
  });
}

async function sendVerificationEmail(email: string) {
  const result = await getNeonAuth().sendVerificationEmail({ email });
  if (result.error) {
    throw new Error(result.error.message);
  }
}

export const neonAuth: NeonAuth = {
  async createLogin({ email, password, fullName }) {
    const result = await getNeonAuth().signUp.email({
      email,
      password,
      name: fullName,
    });

    if (result.error || !result.data?.user) {
      throw new Error(result.error?.message ?? "Unable to create your login.");
    }

    return { userId: result.data.user.id };
  },
  sendVerificationEmail,
};

export const neonVerificationAuth: VerificationAuth = {
  async verifyEmail(token) {
    const result = await getNeonAuth().verifyEmail({ query: { token } });
    if (!result.error) {
      return "verified";
    }

    return result.error.code === "TOKEN_EXPIRED" ? "expired" : "invalid";
  },

  sendVerificationEmail,
};

export const neonSignInAuth: SignInAuth = {
  async signIn({ email, password }) {
    const result = await getNeonAuth().signIn.email({ email, password });
    if (!result.error) {
      return "signed-in";
    }

    // Better Auth runs on Neon's side, so whether it checks the password before
    // the verification status is unconfirmed. If it checks verification first,
    // an unverified email is distinguishable here: the accepted trade-off is
    // that the ticket requires telling unverified people to confirm their email.
    return result.error.code === "EMAIL_NOT_VERIFIED" ? "unverified" : "invalid";
  },
};

export const neonPasswordResetAuth: PasswordResetAuth = {
  async requestPasswordReset(email) {
    const result = await getNeonAuth().requestPasswordReset({ email });
    if (result.error) {
      throw new Error(result.error.message);
    }
  },

  async resetPassword({ token, newPassword }) {
    const result = await getNeonAuth().resetPassword({ token, newPassword });
    if (!result.error) {
      return "reset";
    }

    // Better Auth spends a reset link when it is used and gives one error for
    // both an expired and a used link.
    if (result.error.code === "INVALID_TOKEN") {
      return "invalid";
    }
    throw new Error(result.error.message);
  },
};

export async function getVisitorSession(): Promise<VisitorSession> {
  // Neon Auth swallows Next.js's "dynamic usage" signal and reports no session,
  // so opt in to per-request rendering ourselves before it reads cookies.
  await connection();
  const { data } = await getNeonAuth().getSession();
  return data?.user ? { userId: data.user.id, email: data.user.email } : null;
}

export async function signOutVisitor() {
  await getNeonAuth().signOut();
}
