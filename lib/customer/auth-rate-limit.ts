import { isIP } from "node:net";
import { headers } from "next/headers";

// Demo, single instance: five attempts per client address PER ACTION in a fixed
// ten-minute window, including invalid submissions. Restarting clears limits.
const maxAttempts = 5;
const windowMs = 10 * 60 * 1_000;
export const authRateLimitMessage =
  "Too many attempts. Please try again in 10 minutes.";

type AuthAction = "sign-up" | "forgot-password" | "resend-verification";
const attempts = new Map<string, { count: number; expiresAt: number }>();

export async function allowAuthAttempt(action: AuthAction): Promise<boolean> {
  const requestHeaders = await headers();
  // Azure Container Apps appends the trusted address on the right. Never trust
  // client-supplied prefixes or x-real-ip. Invalid/missing addresses share a bucket.
  // https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const address = forwarded && isIP(forwarded)
    ? new URL(`http://${isIP(forwarded) === 6 ? `[${forwarded}]` : forwarded}`).hostname
    : "unknown";
  const now = Date.now();
  // Lazy expiry also removes clients that never return, bounding retained state
  // to addresses seen within the current ten minutes.
  for (const [key, entry] of attempts) {
    if (entry.expiresAt <= now) attempts.delete(key);
  }
  const key = `${action}:${address}`;
  const entry = attempts.get(key);
  if (entry) {
    if (entry.count >= maxAttempts) return false;
    entry.count++;
  } else {
    attempts.set(key, { count: 1, expiresAt: now + windowMs });
  }
  return true;
}
