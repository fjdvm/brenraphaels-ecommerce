/** Verify every submission on the server; tokens are single-use and expire after five minutes. */
export const turnstileErrorMessage = "Please complete the security check and try again.";

export async function verifyTurnstile(formData: FormData): Promise<boolean> {
  const token = formData.get("cf-turnstile-response");
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || typeof token !== "string" || !token.trim() || token.length > 2048) {
    return false;
  }
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    return typeof result === "object" && result !== null &&
      "success" in result && result.success === true;
  } catch {
    return false;
  }
}
