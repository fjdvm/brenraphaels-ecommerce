import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { careersSession } from "@/lib/careers/auth";
import { getCareersDatabase } from "@/lib/careers/db";
import { createApplicantDocumentStore } from "@/lib/careers/documents";
import { createJobPostingStore } from "@/lib/careers/job-postings";
import { createApplicantProfileStore } from "@/lib/careers/profile";
import { jobPostingIdField } from "@/lib/validators/application";

import { BackLink } from "@/app/(careers)/careers/_components/back-link";
import { CareersFormSkeleton } from "@/app/(careers)/careers/_components/skeletons";

import { ApplicationForm } from "./application-form";

type ApplyPageProps = { params: Promise<{ id: string }> };

async function ApplyPageContent({ params }: ApplyPageProps) {
  const parsedId = jobPostingIdField.safeParse((await params).id);
  if (!parsedId.success) notFound();
  const jobPostingId = parsedId.data;
  const database = getCareersDatabase();
  const [posting, applicant] = await Promise.all([createJobPostingStore(database).findOpen(jobPostingId), careersSession()]);
  if (!posting) notFound();
  if (!applicant) return <Gate back={`/careers/${posting.id}`} title="Sign in to apply" message="Sign in as an Applicant before applying to this Job Posting." href="/careers/signin" label="Sign in" />;
  if (!applicant.verified) return <Gate back={`/careers/${posting.id}`} title="Verify your email to apply" message="Verify your Applicant email address before submitting an Application." href="/careers/verify-email" label="Verify email" />;
  const [profile, documents] = await Promise.all([
    createApplicantProfileStore(database).find(applicant.userId),
    createApplicantDocumentStore(database).list(applicant.userId),
  ]);
  if (!profile) return <Gate back={`/careers/${posting.id}`} title="Complete your profile to apply" message="Save your Applicant profile before submitting an Application." href="/careers/complete-profile" label="Complete profile" />;
  return <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8"><Link href={`/careers/${posting.id}`} className="font-semibold text-primary underline">← Back to Job Posting</Link><h1 className="mt-8 font-serif text-4xl text-primary">Apply for {posting.title}</h1><ApplicationForm jobPostingId={posting.id} title={posting.title} email={applicant.email} profile={profile} requiredDocuments={posting.requiredDocuments} documents={documents} /></section>;
}

function Gate({ back, title, message, href, label }: { back: string; title: string; message: string; href: string; label: string }) {
  return <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8"><BackLink href={back} className="font-semibold text-primary underline">← Back to Job Posting</BackLink><h1 className="mt-8 font-serif text-4xl text-primary">{title}</h1><p className="mt-4 text-on-surface-variant">{message}</p><Link className="mt-6 inline-block bg-primary px-5 py-3 font-semibold text-on-primary" href={href}>{label}</Link></section>;
}

export default function ApplyPage(props: ApplyPageProps) {
  return (
    <Suspense fallback={<CareersFormSkeleton />}>
      <ApplyPageContent {...props} />
    </Suspense>
  );
}
