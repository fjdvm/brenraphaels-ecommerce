import { Suspense, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { requireCustomer } from "@/lib/customer/current-visitor";

function ProtectedGateFallback() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// Every page in this group needs a signed-in Customer with saved details. The
// proxy only does a fast cookie check; this is the real check.
async function ProtectedGate({ children }: { children: ReactNode }) {
  await requireCustomer();
  return children;
}

export default function ProtectedLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ProtectedGateFallback />}>
      <ProtectedGate>{children}</ProtectedGate>
    </Suspense>
  );
}
