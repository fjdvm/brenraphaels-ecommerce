import { ApplicantProfileForm } from "./applicant-profile-form";
import { requireApplicantProfile } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";
import { createApplicantDocumentStore } from "@/lib/careers/documents";
import { createApplicantProfileStore } from "@/lib/careers/profile";

export default async function ApplicantProfilePage() {
  const applicant = await requireApplicantProfile();
  const database = getCareersDatabase();
  const [profile, documents] = await Promise.all([createApplicantProfileStore(database).find(applicant.userId), createApplicantDocumentStore(database).list(applicant.userId)]);
  return <ApplicantProfileForm heading="Your Applicant profile" fullName={applicant.fullName} profile={profile ?? undefined} documents={documents} />;
}
