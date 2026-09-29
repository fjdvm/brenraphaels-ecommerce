import { Suspense } from "react";

import { ApplicantProfileForm } from "./applicant-profile-form";
import { requireApplicantProfile } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";
import { createApplicantDocumentStore } from "@/lib/careers/documents";
import { createApplicantProfileStore } from "@/lib/careers/profile";
import { CareersFormSkeleton } from "../_components/skeletons";

async function ApplicantProfilePageContent() {
  const applicant = await requireApplicantProfile();
  const database = getCareersDatabase();
  const [profile, documents] = await Promise.all([createApplicantProfileStore(database).find(applicant.userId), createApplicantDocumentStore(database).list(applicant.userId)]);
  return <ApplicantProfileForm heading="Your Applicant profile" fullName={applicant.fullName} profile={profile ?? undefined} documents={documents} />;
}

export default function ApplicantProfilePage() {
  return (
    <Suspense fallback={<CareersFormSkeleton />}>
      <ApplicantProfilePageContent />
    </Suspense>
  );
}
