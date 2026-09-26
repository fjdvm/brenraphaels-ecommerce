import { createNeonAuth } from "@neondatabase/auth/next/server";

import type { NeonAuth } from "../customer/sign-up";
import type { VerificationAuth } from "../customer/email-verification";

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
