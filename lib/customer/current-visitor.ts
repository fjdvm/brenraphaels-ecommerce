import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getDatabase } from "@/lib/db";
import { getVisitorSession } from "@/lib/neon-auth/server";
import { signInPath } from "@/lib/auth/route-access";
import { classifyVisitor } from "./visitor";
import { createVisitorStore } from "./visitor-store";

export function currentVisitor() {
  return getVisitorSession().then((session) =>
    classifyVisitor(session, { visitorStore: createVisitorStore(getDatabase()) }),
  );
}

/** Server-side gate for protected pages; the proxy alone is not enough. */
export async function requireCustomer() {
  const visitor = await currentVisitor();
  if (visitor.state === "signed-out") {
    const path = (await headers()).get("x-return-path");
    redirect(path ? `${signInPath}?next=${encodeURIComponent(path)}` : signInPath);
  }
  if (visitor.state === "needs-details") {
    redirect("/complete-profile");
  }
  return visitor.customer;
}
