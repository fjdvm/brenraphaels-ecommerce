import { createNeonAuth } from "@neondatabase/auth/next/server";
import { createAuthServer, extractNeonAuthCookies } from "@neondatabase/auth/server";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";

import type { NeonAuth } from "../customer/sign-up";
import type { VerificationAuth } from "../customer/email-verification";
import type { PasswordResetAuth } from "../customer/password-reset";
import type { SignInAuth } from "../customer/sign-in";
import type { VisitorSession } from "../customer/visitor";
import { writeCookieIfAllowed } from "./cookie-write";
import { verifyEmailWithNeon } from "./verify-email";

function neonAuthConfig() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !cookieSecret) {
    throw new Error(
      "NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET are required for sign-up.",
    );
  }

  return { baseUrl, cookieSecret };
}

function getNeonAuth() {
  const { baseUrl, cookieSecret } = neonAuthConfig();
  return createNeonAuth({
    baseUrl,
    cookies: { secret: cookieSecret },
  });
}

// Pages read the session while rendering, and `createNeonAuth` does not let us
// replace its cookie writer, so that read gets its own server with one that
// tolerates the render. Otherwise it matches the SDK's Next.js adapter.
function sessionReader() {
  return createAuthServer({
    ...neonAuthConfig(),
    context: async () => {
      const cookieStore = await cookies();
      const headerStore = await headers();
      return {
        getCookies: () => extractNeonAuthCookies(headerStore),
        setCookie: (name, value, options) =>
          writeCookieIfAllowed(() => cookieStore.set(name, value, options)),
        getHeader: (name) => headerStore.get(name) ?? null,
        getOrigin: () => headerStore.get("origin") || headerStore.get("referer")?.split("/").slice(0, 3).join("/") || "",
        getFramework: () => "nextjs",
      };
    },
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
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl || !siteUrl) {
      throw new Error("NEON_AUTH_BASE_URL and NEXT_PUBLIC_SITE_URL are required.");
    }

    const cookieStore = await cookies();
    return verifyEmailWithNeon({
      baseUrl,
      token,
      origin: new URL(siteUrl).origin,
      setCookie: ({ name, value, options }) => cookieStore.set(name, value, options),
    });
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
    // both an expired and a used link. Verification also sees TOKEN_EXPIRED,
    // so accept it here in case Neon's hosted service sends it too.
    if (result.error.code === "INVALID_TOKEN" || result.error.code === "TOKEN_EXPIRED") {
      return "invalid";
    }
    throw new Error(result.error.message);
  },
};

// Memoized per request: the Header's session badge and the layout's Cart sync
// both need the current session, and each is a network round trip to Neon
// Auth. `cache()` collapses those into a single call per request.
export const getVisitorSession = cache(async function getVisitorSession(): Promise<VisitorSession> {
  // Neon Auth swallows Next.js's "dynamic usage" signal and reports no session,
  // so opt in to per-request rendering ourselves before it reads cookies.
  await connection();
  const { data } = await sessionReader().getSession();
  return data?.user
    ? {
        userId: data.user.id,
        email: data.user.email,
        fullName: data.user.name ?? "",
      }
    : null;
});

export async function signOutVisitor() {
  await getNeonAuth().signOut();
}
