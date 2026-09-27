import { ApplicantProfileForm } from "../profile/applicant-profile-form";
import { requireApplicantNeedingProfile } from "@/lib/careers/current-applicant";

export default async function CompleteApplicantProfilePage() {
  const applicant = await requireApplicantNeedingProfile();
  return <ApplicantProfileForm heading="Complete your Applicant profile" fullName={applicant.fullName} />;
}
