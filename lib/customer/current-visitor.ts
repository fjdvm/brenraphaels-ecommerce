import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  completeProfilePath,
  returnPathHeader,
  signInPath,
} from "@/lib/auth/route-access";
import { getDatabase } from "@/lib/db";
import { getVisitorSession } from "@/lib/neon-auth/server";
import { classifyVisitor } from "./visitor";
import { createVisitorStore } from "./visitor-store";

export const profilePath = "/profile";

export async function currentVisitor() {
  const session = await getVisitorSession();
  return classifyVisitor(session, {
    visitorStore: createVisitorStore(getDatabase()),
  });
}

async function redirectToSignIn(): Promise<never> {
  const path = (await headers()).get(returnPathHeader);
  redirect(path ? `${signInPath}?next=${encodeURIComponent(path)}` : signInPath);
}

/** Server-side gate for protected pages; the proxy alone is not enough. */
export async function requireCustomer() {
  const visitor = await currentVisitor();
  if (visitor.state === "signed-out") {
    return redirectToSignIn();
  }
  if (visitor.state === "needs-details") {
    redirect(completeProfilePath);
  }
  return visitor.customer;
}

/**
 * Server-side gate for the complete-profile page and its action: only a signed-in
 * login still missing its Customer details belongs there.
 */
export async function requireVisitorNeedingDetails() {
  const visitor = await currentVisitor();
  if (visitor.state === "signed-out") {
    return redirectToSignIn();
  }
  if (visitor.state === "customer") {
    redirect(profilePath);
  }
  return visitor;
}
