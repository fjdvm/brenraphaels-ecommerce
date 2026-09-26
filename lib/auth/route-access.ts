/** Pages anyone may open, signed in or not. */
const publicPaths = new Set([
  "/",
  "/about",
  "/contact",
  "/faq",
  "/terms",
  "/privacy",
  "/returns",
  "/careers",
  "/verify-email",
]);

/** Pages for signed-out visitors; signed-in people are sent away server-side. */
export const guestPaths = new Set([
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

export const signInPath = "/signin";

const neonSessionCookie = /^__Secure-neon-auth.*session_token$/;

export function hasSessionCookie(cookieNames: string[]) {
  return cookieNames.some((name) => neonSessionCookie.test(name));
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
  if (publicPaths.has(pathname) || guestPaths.has(pathname) || request.hasSession) {
    return { action: "next" };
  }

  const next = encodeURIComponent(`${pathname}${request.search}`);
  return { action: "redirect", to: `${signInPath}?next=${next}` };
}

/** Only follows paths within this site, and never back to a guest page. */
export function safeReturnPath(path: string | undefined | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return undefined;
  }

  const pathname = path.split(/[?#]/)[0];
  return guestPaths.has(pathname) ? undefined : path;
}
