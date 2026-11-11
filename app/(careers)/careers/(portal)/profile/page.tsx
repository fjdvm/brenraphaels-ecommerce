import { Suspense } from "react";

import { listCityProvinceLocations } from "@/lib/address/locations";

import { ApplicantProfileForm } from "./applicant-profile-form";
import { requireApplicantProfile } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";
import { createApplicantDocumentStore } from "@/lib/careers/documents";
import { createApplicantProfileStore } from "@/lib/careers/profile";
import { CareersProfileSkeleton } from "@/app/(careers)/careers/_components/skeletons";

async function ApplicantProfilePageContent() {
  const applicant = await requireApplicantProfile();
  const database = getCareersDatabase();
  const [profile, documents] = await Promise.all([createApplicantProfileStore(database).find(applicant.userId), createApplicantDocumentStore(database).list(applicant.userId)]);
  return <ApplicantProfileForm heading="Your applicant profile" fullName={applicant.fullName} profile={profile ?? undefined} documents={documents} locations={listCityProvinceLocations()} />;
}

export default function ApplicantProfilePage() {
  return (
    <Suspense fallback={<CareersProfileSkeleton />}>
      <ApplicantProfilePageContent />
    </Suspense>
  );
}
