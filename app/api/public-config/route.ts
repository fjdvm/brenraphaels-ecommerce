export const dynamic = "force-dynamic";

export function GET() {
  const env = process.env;
  const turnstileSiteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!turnstileSiteKey) {
    return Response.json({ error: "Security check unavailable" }, { status: 503 });
  }
  return Response.json({ turnstileSiteKey }, { headers: { "Cache-Control": "no-store" } });
}
