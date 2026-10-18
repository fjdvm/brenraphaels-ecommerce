import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { completeProfilePath } from "@/lib/auth/route-access";
import { AuthShell } from "@/components/shared/auth-shell";
import { AuthCard } from "@/components/features/auth/auth-card";
import { Skeleton } from "@/components/ui/skeleton";
import { currentVisitor } from "@/lib/customer/current-visitor";

/** Mirrors the card, heading, and field shape of the sign-in form so nothing jumps once it resolves. */
function SignedOutGateFallback() {
  return (
    <AuthCard aria-hidden="true">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-[77px] w-full" />
      <Skeleton className="h-[77px] w-full" />
      <Skeleton className="h-[59px] w-full rounded-full" />
    </AuthCard>
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
