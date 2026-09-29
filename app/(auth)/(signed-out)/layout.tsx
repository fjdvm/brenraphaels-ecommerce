import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { completeProfilePath } from "@/lib/auth/route-access";
import { AuthShell } from "@/components/shared/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { currentVisitor } from "@/lib/customer/current-visitor";

function SignedOutGateFallback() {
  return (
    <div className="w-full max-w-md space-y-4" aria-hidden="true">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

// Sign-in, sign-up and password pages are for signed-out Visitors only. The
// real session is checked here, so a stale cookie never traps anyone.
async function SignedOutGate({ children }: { children: ReactNode }) {
  const visitor = await currentVisitor();
  if (visitor.state === "customer") {
    redirect("/");
  }
  if (visitor.state === "needs-details") {
    redirect(completeProfilePath);
  }

  return children;
}

export default function SignedOutLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthShell>
      <Suspense fallback={<SignedOutGateFallback />}>
        <SignedOutGate>{children}</SignedOutGate>
      </Suspense>
    </AuthShell>
  );
}
