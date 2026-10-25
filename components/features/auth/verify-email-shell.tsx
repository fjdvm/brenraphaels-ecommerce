import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/** The static frame of the verify-email page; the confirmation streams in beneath the heading. */
export function VerifyEmailShell({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-[calc(100vh-12rem)] items-center px-5 py-12 sm:px-8 sm:py-16">
      <Card className="mx-auto w-full max-w-xl p-8 text-center shadow-sm">
        <h1 className="font-serif text-4xl text-primary">Verify your email</h1>
        {children}
      </Card>
    </section>
  );
}

/** Stands in for the confirmation status while the token is read. */
export function VerifyEmailFallback() {
  return (
    <div className="mt-6 flex flex-col items-center gap-3" aria-hidden="true">
      <Skeleton className="h-5 w-64 max-w-full" />
      <Skeleton className="h-11 w-40 rounded-full" />
    </div>
  );
}
