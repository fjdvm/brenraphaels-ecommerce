import { createNeonAuth } from "@neondatabase/auth/next/server";

import type { NeonAuth } from "../customer/sign-up";

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
};
