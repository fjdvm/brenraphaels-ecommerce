import { notFound } from "next/navigation";
import { Suspense } from "react";

import { careersSession } from "@/lib/careers/auth";
import { createJobPostingStore } from "@/lib/careers/job-postings";
import { createApplicantDocumentStore } from "@/lib/careers/documents";
import { createApplicantProfileStore } from "@/lib/careers/profile";
import { getCareersDatabase } from "@/lib/careers/db";
import { jobPostingIdField } from "@/lib/validators/application";
import { JobDetailBody, JobDetailHeader } from "@/app/(careers)/careers/_components/job-detail";
import { ApplyCard, type ApplyAccess } from "@/app/(careers)/careers/_components/apply-card";
import { JobDetailSkeleton } from "@/app/(careers)/careers/_components/job-detail-skeleton";

type JobPostingPageProps = { params: Promise<{ id: string }> };

async function applyAccess(applicant: Awaited<ReturnType<typeof careersSession>>, database: ReturnType<typeof getCareersDatabase>): Promise<ApplyAccess> {
  if (!applicant) return { kind: "signed-out" };
  if (!applicant.verified) return { kind: "unverified" };
  const [profile, documents] = await Promise.all([
    createApplicantProfileStore(database).find(applicant.userId),
    createApplicantDocumentStore(database).list(applicant.userId),
  ]);
  return profile ? { kind: "ready", email: applicant.email, profile, documents } : { kind: "no-profile" };
}

async function JobPostingPageContent({ params }: JobPostingPageProps) {
  const id = jobPostingIdField.safeParse((await params).id);
  if (!id.success) notFound();
  const [posting, applicant] = await Promise.all([
    createJobPostingStore(getCareersDatabase()).findOpen(id.data),
    careersSession(),
  ]);
  if (!posting) notFound();
  const database = getCareersDatabase();
  const access = await applyAccess(applicant, database);

  return (
    <article className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 pb-[120px] pt-10 sm:px-10 lg:pb-[100px]">
      <JobDetailHeader posting={posting} />
      <JobDetailBody
        posting={posting}
        aside={<ApplyCard jobPostingId={posting.id} requiredDocuments={posting.requiredDocuments} access={access} />}
      />
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-line bg-white px-5 py-3.5 lg:hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-sm font-medium text-ink">{posting.title}</p>
          <p className="text-xs text-muted">Apply by {posting.deadline.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</p>
        </div>
        <a href="#apply" className="rounded-full bg-primary px-7 py-3 text-base text-on-primary">Apply now</a>
      </div>
    </article>
  );
}

export default function JobPostingPage(props: JobPostingPageProps) {
  return (
    <Suspense fallback={<JobDetailSkeleton />}>
      <JobPostingPageContent {...props} />
    </Suspense>
  );
}
