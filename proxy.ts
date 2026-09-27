import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  decideRouteAccess,
  hasSessionCookie,
  returnPathHeader,
} from "@/lib/auth/route-access";

// A fast cookie check only. It is not a security boundary: protected layouts
// verify the real session on the server.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const access = decideRouteAccess({
    pathname,
    search,
    hasSession: hasSessionCookie(request.cookies.getAll()),
  });

  if (access.action === "redirect") {
    return NextResponse.redirect(new URL(access.to, request.url));
  }

  // Lets a server-side check send a signed-out visitor back where they were going.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(returnPathHeader, `${pathname}${search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Skip Neon Auth and webhook endpoints, Next.js internals, static files and the
    // BotID challenge script (149e9513-…; withBotId rewrites it). Signed-out Visitors
    // must be able to load it, or their form submissions carry no BotID check.
    "/((?!api/|_next/|149e9513-01fa-4fb0-aad4-566afd725d1b/|favicon.ico|icon.jpeg|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:jpe?g|png|svg|webp|ico)$).*)",
  ],
};
