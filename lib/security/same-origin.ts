/**
 * Whether a browser request comes from our own site. Behind the container platform `request.url` carries the internal
 * host (HOSTNAME=0.0.0.0), never the public one, so the Origin header is also compared with the configured site URL
 * and the forwarded host. A request with no Origin header (same-origin GET-like or non-browser) is allowed, as before.
 */
export function isSameOrigin(request: Request, env: Record<string, string | undefined> = process.env): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set<string>();
  const add = (value: string | undefined | null) => {
    try {
      if (value) allowed.add(new URL(value).origin);
    } catch {
      // An unparsable value allows nothing.
    }
  };
  add(request.url);
  add(env.NEXT_PUBLIC_SITE_URL);
  const host = request.headers.get("x-forwarded-host");
  if (host) add(`${request.headers.get("x-forwarded-proto") ?? "https"}://${host}`);
  return allowed.has(origin);
}
