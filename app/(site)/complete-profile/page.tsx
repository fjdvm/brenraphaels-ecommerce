import type { Metadata } from "next";
import { Suspense } from "react";

import { listProvinces } from "@/lib/address/locations";
import { CompleteProfileForm } from "@/components/features/auth/complete-profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { splitFullName } from "@/lib/customer/complete-profile-schema";
import { requireVisitorNeedingDetails } from "@/lib/customer/current-visitor";

export const metadata: Metadata = { title: "Complete your profile" };

/** Skeleton shown immediately while the visitor and form defaults resolve. */
function CompleteProfilePageSkeleton() {
  return (
    <section className="bg-surface-container-low px-5 py-12 sm:px-8 sm:py-16" aria-hidden="true">
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </section>
  );
}

async function CompleteProfilePageContent() {
  const visitor = await requireVisitorNeedingDetails();

  return (
    <section className="bg-surface-container-low px-5 py-12 sm:px-8 sm:py-16">
      <CompleteProfileForm
        email={visitor.email}
        defaults={splitFullName(visitor.fullName)}
        provinces={listProvinces()}
      />
    </section>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<CompleteProfilePageSkeleton />}>
      <CompleteProfilePageContent />
    </Suspense>
  );
}
