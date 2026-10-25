import type { Metadata } from "next";
import { Suspense } from "react";

import { listProvinces } from "@/lib/address/locations";
import { CompleteProfilePageSkeleton } from "@/components/features/auth/complete-profile-skeleton";
import { CompleteProfileForm } from "@/components/features/auth/complete-profile-form";
import { splitFullName } from "@/lib/customer/complete-profile-schema";
import { requireVisitorNeedingDetails } from "@/lib/customer/current-visitor";

export const metadata: Metadata = { title: "Complete your profile" };

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
