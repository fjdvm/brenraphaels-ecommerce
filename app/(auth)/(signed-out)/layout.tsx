import { Suspense } from "react";

import { StorefrontToaster } from "@/components/shared/storefront-toast";
import { redirect } from "next/navigation";

import { completeProfilePath } from "@/lib/auth/route-access";
import { AuthShell } from "@/components/shared/auth-shell";
import { currentVisitor } from "@/lib/customer/current-visitor";

// Sign-in, sign-up and password pages are for signed-out Visitors only. The
// forms render at once; the real session is checked beside them, so a stale
// cookie never traps anyone and the forms never wait on the backend.
async function SignedOutRedirect() {
  const visitor = await currentVisitor();
  if (visitor.state === "customer") {
    redirect("/");
  }
  if (visitor.state === "needs-details") {
    redirect(completeProfilePath);
  }

  return null;
}

export default function SignedOutLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <SignedOutRedirect />
      </Suspense>
      {children}
      <StorefrontToaster />
    </AuthShell>
  );
}
