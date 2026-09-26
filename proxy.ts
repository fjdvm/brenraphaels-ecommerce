import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decideRouteAccess, hasSessionCookie } from "@/lib/auth/route-access";

// A fast cookie check only. It is not a security boundary: protected layouts
// verify the real session on the server.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const access = decideRouteAccess({
    pathname,
    search,
    hasSession: hasSessionCookie(request.cookies.getAll().map((cookie) => cookie.name)),
  });

  if (access.action === "redirect") {
    return NextResponse.redirect(new URL(access.to, request.url));
  }

  // Lets a server-side check send a signed-out visitor back where they were going.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-return-path", `${pathname}${search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Skip Neon Auth and webhook endpoints, Next.js internals and static files.
    "/((?!api/|_next/|favicon.ico|icon.jpeg|.*\\.(?:jpe?g|png|svg|webp|ico)$).*)",
  ],
};
