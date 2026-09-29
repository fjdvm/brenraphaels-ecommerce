import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { completeProfilePath } from "@/lib/auth/route-access";
import { AuthShell } from "@/components/shared/auth-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { currentVisitor } from "@/lib/customer/current-visitor";

/** Mirrors the Card, heading, and field shape of the sign-in/sign-up forms so nothing jumps once they resolve. */
function SignedOutGateFallback() {
  return (
    <Card className="mx-auto w-full max-w-md p-6 shadow-sm sm:p-8" aria-hidden="true">
      <div className="mb-7 flex flex-col items-center gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-5">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="mt-6 flex justify-center">
        <Skeleton className="h-4 w-40" />
      </div>
    </Card>
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
