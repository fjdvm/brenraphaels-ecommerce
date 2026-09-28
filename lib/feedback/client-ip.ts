/** Reads the client's IP from proxy headers; Vercel always sets x-forwarded-for. */
export function resolveClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  const forwarded = forwardedFor?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}
