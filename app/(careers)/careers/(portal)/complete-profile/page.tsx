import { Suspense } from "react";

import { listCityLocations } from "@/lib/address/locations";
import { ApplicantProfileForm } from "../profile/applicant-profile-form";
import { requireApplicantNeedingProfile } from "@/lib/careers/current-applicant";
import { CareersProfileSkeleton } from "@/app/(careers)/careers/_components/skeletons";

async function CompleteApplicantProfilePageContent() {
  const applicant = await requireApplicantNeedingProfile();
  return <ApplicantProfileForm locations={listCityLocations()} heading="Complete your applicant profile" fullName={applicant.fullName} />;
}

export default function CompleteApplicantProfilePage() {
  return (
    <Suspense fallback={<CareersProfileSkeleton />}>
      <CompleteApplicantProfilePageContent />
    </Suspense>
  );
}
