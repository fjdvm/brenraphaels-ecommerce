import { redirect } from "next/navigation";

import { careersSession } from "./auth";
import { getCareersDatabase } from "./db";
import { hasApplicantProfile } from "./profile";

export async function requireApplicant() {
  const applicant = await careersSession();
  if (!applicant) redirect("/careers/signin");
  return applicant;
}

/** Gates the reusable-profile area until an Applicant saves their first profile. */
export async function requireApplicantProfile() {
  const applicant = await requireApplicant();
  if (!(await hasApplicantProfile(applicant.userId, getCareersDatabase()))) {
    redirect("/careers/complete-profile");
  }
  return applicant;
}

/** Allows only a signed-in Applicant who still needs their first profile. */
export async function requireApplicantNeedingProfile() {
  const applicant = await requireApplicant();
  if (await hasApplicantProfile(applicant.userId, getCareersDatabase())) {
    redirect("/careers/profile");
  }
  return applicant;
}
