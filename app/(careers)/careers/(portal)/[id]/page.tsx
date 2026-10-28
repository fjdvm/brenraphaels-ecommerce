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
import { CareersDetailSkeleton } from "@/app/(careers)/careers/_components/skeletons";

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
    <article>
      <JobDetailHeader posting={posting} />
      <JobDetailBody
        posting={posting}
        aside={<ApplyCard jobPostingId={posting.id} requiredDocuments={posting.requiredDocuments} access={access} />}
      />
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
