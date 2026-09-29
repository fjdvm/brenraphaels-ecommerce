import { Suspense } from "react";

import { ApplicantProfileForm } from "../profile/applicant-profile-form";
import { requireApplicantNeedingProfile } from "@/lib/careers/current-applicant";
import { CareersFormSkeleton } from "../_components/skeletons";

async function CompleteApplicantProfilePageContent() {
  const applicant = await requireApplicantNeedingProfile();
  return <ApplicantProfileForm heading="Complete your Applicant profile" fullName={applicant.fullName} />;
}

export default function CompleteApplicantProfilePage() {
  return (
    <Suspense fallback={<CareersFormSkeleton />}>
      <CompleteApplicantProfilePageContent />
    </Suspense>
  );
}
