import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { careersSession } from "@/lib/careers/auth";
import { createJobPostingStore } from "@/lib/careers/job-postings";
import { getCareersDatabase } from "@/lib/careers/db";
import { jobPostingIdField } from "@/lib/validators/application";
import { CareersDetailSkeleton } from "../_components/skeletons";

type JobPostingPageProps = { params: Promise<{ id: string }> };

async function JobPostingPageContent({ params }: JobPostingPageProps) {
  const id = jobPostingIdField.safeParse((await params).id);
  if (!id.success) notFound();
  const [posting, applicant] = await Promise.all([
    createJobPostingStore(getCareersDatabase()).findOpen(id.data),
    careersSession(),
  ]);
  if (!posting) notFound();

  return (
    <article className="mx-auto max-w-4xl py-12 lg:py-20">
      <Link href="/careers" className="font-semibold text-primary underline">← All careers</Link>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-secondary">{posting.department} · {posting.location}</p>
      <h1 className="mt-3 font-serif text-5xl leading-tight text-primary">{posting.title}</h1>
      <p className="mt-4 text-lg text-on-surface-variant">{posting.employmentType} · Apply by {posting.deadline.toLocaleDateString()}</p>
      <Link
        href={applicant ? `/careers/${posting.id}/apply` : "/careers/signin"}
        className="mt-6 inline-block bg-primary px-6 py-3 font-semibold text-on-primary"
      >
        Apply
      </Link>
      <section className="mt-10"><h2 className="font-serif text-2xl text-primary">About the role</h2><p className="mt-3 whitespace-pre-line leading-7 text-on-surface-variant">{posting.description}</p></section>
      <section className="mt-8"><h2 className="font-serif text-2xl text-primary">Requirements</h2><p className="mt-3 whitespace-pre-line leading-7 text-on-surface-variant">{posting.requirements}</p></section>
      <section className="mt-8"><h2 className="font-serif text-2xl text-primary">Required Documents</h2><ul className="mt-3 list-disc pl-5 text-on-surface-variant">{posting.requiredDocuments.map((document) => <li key={document}>{document}</li>)}</ul></section>
    </article>
  );
}

export default function JobPostingPage(props: JobPostingPageProps) {
  return (
    <Suspense fallback={<CareersDetailSkeleton />}>
      <JobPostingPageContent {...props} />
    </Suspense>
  );
}
