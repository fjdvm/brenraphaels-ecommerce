import type { VerificationResult } from "../customer/email-verification";

export type ForwardedCookie = {
  name: string;
  value: string;
  options: {
    path?: string;
    maxAge?: number;
    expires?: Date;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
  };
};

type VerifyEmailWithNeon = {
  baseUrl: string;
  token: string;
  /** Neon only accepts requests from a trusted origin. */
  origin: string;
  setCookie(cookie: ForwardedCookie): void;
  fetch?: typeof fetch;
};

function parseSetCookie(header: string): ForwardedCookie | null {
  const [pair, ...attributes] = header.split(";").map((part) => part.trim());
  const separator = pair.indexOf("=");
  if (separator < 1) {
    return null;
  }

  const options: ForwardedCookie["options"] = {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  };
  for (const attribute of attributes) {
    const [key, ...rest] = attribute.split("=");
    const value = rest.join("=");
    switch (key.toLowerCase()) {
      case "path":
        options.path = value;
        break;
      case "max-age":
        options.maxAge = Number(value);
        break;
      case "expires":
        options.expires = new Date(value);
        break;
    }
  }

  return {
    name: pair.slice(0, separator),
    value: decodeURIComponent(pair.slice(separator + 1)),
    options,
  };
}

// The SDK's verifyEmail POSTs to Neon's /verify-email, which only answers GET.
export async function verifyEmailWithNeon({
  baseUrl,
  token,
  origin,
  setCookie,
  fetch: fetchImplementation = fetch,
}: VerifyEmailWithNeon): Promise<VerificationResult> {
  const url = new URL("verify-email", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("token", token);

  const response = await fetchImplementation(url, {
    method: "GET",
    headers: { Origin: origin },
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });

  if (response.ok) {
    // Neon signs the Customer in when verification succeeds; pass its session on.
    for (const header of response.headers.getSetCookie()) {
      const cookie = parseSetCookie(header);
      if (cookie) {
        setCookie(cookie);
      }
    }
    return "verified";
  }

  const body = (await response.json().catch(() => null)) as { code?: string } | null;
  if (response.status >= 500 || (response.status === 404 && !body)) {
    throw new Error(`Neon Auth could not verify the email (HTTP ${response.status}).`);
  }

  return body?.code === "TOKEN_EXPIRED" ? "expired" : "invalid";
}
