import Link from "next/link";

import { SignOutButton } from "@/components/shared/sign-out-button";
import { careersSession } from "@/lib/careers/auth";
import { signOutApplicantAction } from "../actions";

/** Applicant links pinned above every Careers page while an Applicant is signed in. */
export async function ApplicantNav() {
  const applicant = await careersSession();
  if (!applicant) return null;

  return (
    <nav aria-label="Applicant" className="mx-auto mb-2 flex max-w-4xl flex-wrap items-center justify-end gap-x-6 gap-y-2 border-b border-outline-variant pb-4">
      <Link className="bg-primary px-5 py-2 font-semibold text-on-primary" href="/careers/profile">Your profile</Link>
      <Link className="font-semibold text-primary underline" href="/careers/applications">Your Applications</Link>
      <SignOutButton action={signOutApplicantAction} className="text-primary" />
    </nav>
  );
}
