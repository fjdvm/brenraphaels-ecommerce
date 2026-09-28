import Link from "next/link";
import { notFound } from "next/navigation";

import { careersSession } from "@/lib/careers/auth";
import { getCareersDatabase } from "@/lib/careers/db";
import { createApplicantDocumentStore } from "@/lib/careers/documents";
import { createJobPostingStore } from "@/lib/careers/job-postings";
import { createApplicantProfileStore } from "@/lib/careers/profile";

import { ApplicationForm } from "./application-form";

type ApplyPageProps = { params: Promise<{ id: string }> };

export default async function ApplyPage({ params }: ApplyPageProps) {
  const jobPostingId = (await params).id;
  const database = getCareersDatabase();
  const [posting, applicant] = await Promise.all([createJobPostingStore(database).findOpen(jobPostingId), careersSession()]);
  if (!posting) notFound();
  if (!applicant) return <Gate title="Sign in to apply" message="Sign in as an Applicant before applying to this Job Posting." href="/careers/signin" label="Sign in" />;
  if (!applicant.verified) return <Gate title="Verify your email to apply" message="Verify your Applicant email address before submitting an Application." href="/careers/verify-email" label="Verify email" />;
  const [profile, documents] = await Promise.all([
    createApplicantProfileStore(database).find(applicant.userId),
    createApplicantDocumentStore(database).list(applicant.userId),
  ]);
  if (!profile) return <Gate title="Complete your profile to apply" message="Save your Applicant profile before submitting an Application." href="/careers/complete-profile" label="Complete profile" />;
  return <section className="mx-auto max-w-2xl py-12"><Link href={`/careers/${posting.id}`} className="font-semibold text-primary underline">← Back to Job Posting</Link><h1 className="mt-8 font-serif text-4xl text-primary">Apply for {posting.title}</h1><ApplicationForm jobPostingId={posting.id} title={posting.title} profile={profile} requiredDocuments={posting.requiredDocuments} documents={documents} /></section>;
}

function Gate({ title, message, href, label }: { title: string; message: string; href: string; label: string }) {
  return <section className="mx-auto max-w-2xl py-12"><h1 className="font-serif text-4xl text-primary">{title}</h1><p className="mt-4 text-on-surface-variant">{message}</p><Link className="mt-6 inline-block bg-primary px-5 py-3 font-semibold text-on-primary" href={href}>{label}</Link></section>;
}
