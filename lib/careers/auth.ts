import { createAuthServer } from "@neondatabase/auth/server";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";

import { verifyEmailWithNeon } from "../neon-auth/verify-email";
import type { ApplicantAuth } from "./identity";

const neonAuthCookiePrefix = "__Secure-neon-auth";

/**
 * Browsers send a path-specific cookie before a root-path cookie with the
 * same name. Keep that first value rather than letting a generic parser
 * overwrite it with Storefront's root-scoped session later in the header.
 */
export function careersAuthCookies(cookieHeader: string) {
  const selected = new Set<string>();
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => {
      const name = cookie.slice(0, cookie.indexOf("="));
      if (!name.startsWith(neonAuthCookiePrefix) || selected.has(name)) return false;
      selected.add(name);
      return true;
    })
    .join("; ");
}

function careersAuth() {
  const baseUrl = process.env.CAREERS_NEON_AUTH_BASE_URL;
  const secret = process.env.CAREERS_NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) throw new Error("CAREERS_NEON_AUTH_BASE_URL and CAREERS_NEON_AUTH_COOKIE_SECRET are required.");
  return createAuthServer({
    baseUrl,
    cookieSecret: secret,
    context: async () => {
      const cookieStore = await cookies();
      const headerStore = await headers();
      return {
        getCookies: () => careersAuthCookies(headerStore.get("cookie") ?? ""),
        // A separate Neon instance alone is not enough on one host: the SDK's
        // cookie names are fixed. Path scope lets both sessions coexist.
        setCookie: (name, value, options) => {
          cookieStore.set(name, value, { ...options, path: "/careers" });
        },
        getHeader: (name) => headerStore.get(name) ?? null,
        getOrigin: () => headerStore.get("origin") || headerStore.get("referer")?.split("/").slice(0, 3).join("/") || "",
        getFramework: () => "nextjs",
      };
    },
  });
}

export const careersApplicantAuth: ApplicantAuth = {
  async createLogin(input) { const result = await careersAuth().signUp.email(input); if (result.error) throw new Error(result.error.message); },
  async signIn(input) { const result = await careersAuth().signIn.email(input); if (!result.error) return "signed-in"; return result.error.code === "EMAIL_NOT_VERIFIED" ? "unverified" : "invalid"; },
  async sendVerificationEmail(email) { const result = await careersAuth().sendVerificationEmail({ email }); if (result.error) throw new Error(result.error.message); },
  async requestPasswordReset(email) { const result = await careersAuth().requestPasswordReset({ email }); if (result.error) throw new Error(result.error.message); },
  async resetPassword(input) { const result = await careersAuth().resetPassword(input); if (!result.error) return "reset"; if (result.error.code === "INVALID_TOKEN" || result.error.code === "TOKEN_EXPIRED") return "invalid"; throw new Error(result.error.message); },
};

export async function signOutApplicant() { await careersAuth().signOut(); }
export async function careersSession() { await connection(); const { data } = await careersAuth().getSession(); return data?.user ? { userId: data.user.id, email: data.user.email, fullName: data.user.name ?? "", verified: data.user.emailVerified } : null; }
export async function verifyApplicantEmail(token: string) { const baseUrl = process.env.CAREERS_NEON_AUTH_BASE_URL; const siteUrl = process.env.NEXT_PUBLIC_SITE_URL; if (!baseUrl || !siteUrl) throw new Error("CAREERS_NEON_AUTH_BASE_URL and NEXT_PUBLIC_SITE_URL are required."); const cookieStore = await cookies(); return verifyEmailWithNeon({ baseUrl, token, origin: new URL(siteUrl).origin, setCookie: (cookie) => cookieStore.set(cookie.name, cookie.value, { ...cookie.options, path: "/careers" }) }); }
