/** Pages anyone may open, signed in or not. */
const publicPaths = new Set([
  "/",
  "/about",
  "/journey",
  "/contact",
  "/faq",
  "/terms",
  "/privacy",
  "/returns",
  "/careers",
  "/verify-email",
  "/products",
]);

/** Pages for signed-out Visitors; signed-in people are sent away server-side. */
export const signedOutPaths = new Set([
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

export const signInPath = "/signin";
export const completeProfilePath = "/complete-profile";
export const profilePath = "/profile";
/** Home with the welcome modal, where a newly Verified Customer lands. */
export const welcomePath = "/?welcome=1";

/** Request header the proxy sets so server-side checks know the page asked for. */
export const returnPathHeader = "x-return-path";

const neonSessionCookie = /^__Secure-neon-auth.*session_token$/;

export function hasSessionCookie(cookies: { name: string }[]) {
  return cookies.some((cookie) => neonSessionCookie.test(cookie.name));
}

export type RouteAccess =
  | { action: "next" }
  | { action: "redirect"; to: string };

/**
 * A fast, optimistic cookie check for the Next.js proxy. It is not a security
 * boundary: protected layouts must verify the session on the server.
 */
export function decideRouteAccess(request: {
  pathname: string;
  search: string;
  hasSession: boolean;
}): RouteAccess {
  const { pathname } = request;
  if (
    publicPaths.has(pathname)
    || pathname.startsWith("/products/")
    || signedOutPaths.has(pathname)
    || request.hasSession
  ) {
    return { action: "next" };
  }

  const next = encodeURIComponent(`${pathname}${request.search}`);
  return { action: "redirect", to: `${signInPath}?next=${next}` };
}

const controlCharacters = /[\u0000-\u001f\u007f]/;
const placeholderOrigin = "http://return-path.invalid";

/** Only follows paths within this site, and never back to a signed-out page. */
export function safeReturnPath(path: string | undefined | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return undefined;
  }

  // Browsers drop tabs and newlines when parsing a URL, so "/\t/evil.example"
  // would otherwise point off-site.
  if (controlCharacters.test(path)) {
    return undefined;
  }
  const resolved = new URL(path, placeholderOrigin);
  if (resolved.origin !== placeholderOrigin) {
    return undefined;
  }

  return signedOutPaths.has(resolved.pathname) ? undefined : path;
}
