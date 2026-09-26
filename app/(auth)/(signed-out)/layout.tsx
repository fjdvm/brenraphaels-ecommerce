import { redirect } from "next/navigation";

import { completeProfilePath } from "@/lib/auth/route-access";
import { AuthShell } from "@/components/shared/auth-shell";
import { currentVisitor } from "@/lib/customer/current-visitor";

// Sign-in, sign-up and password pages are for signed-out Visitors only. The
// real session is checked here, so a stale cookie never traps anyone.
export default async function SignedOutLayout({ children }: LayoutProps<"/">) {
  const visitor = await currentVisitor();
  if (visitor.state === "customer") {
    redirect("/");
  }
  if (visitor.state === "needs-details") {
    redirect(completeProfilePath);
  }

  return <AuthShell>{children}</AuthShell>;
}
