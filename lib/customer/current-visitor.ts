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

export async function currentVisitor() {
  const session = await getVisitorSession();
  return classifyVisitor(session, {
    visitorStore: createVisitorStore(getDatabase()),
  });
}

/** Server-side gate for protected pages; the proxy alone is not enough. */
export async function requireCustomer() {
  const visitor = await currentVisitor();
  if (visitor.state === "signed-out") {
    const path = (await headers()).get(returnPathHeader);
    redirect(path ? `${signInPath}?next=${encodeURIComponent(path)}` : signInPath);
  }
  if (visitor.state === "needs-details") {
    redirect(completeProfilePath);
  }
  return visitor.customer;
}
