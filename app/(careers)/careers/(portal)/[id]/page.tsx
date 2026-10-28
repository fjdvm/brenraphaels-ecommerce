import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { careersSession } from "@/lib/careers/auth";
import { createJobPostingStore } from "@/lib/careers/job-postings";
import { getCareersDatabase } from "@/lib/careers/db";
import { jobPostingIdField } from "@/lib/validators/application";
import { JobDetailBody, JobDetailHeader } from "@/app/(careers)/careers/_components/job-detail";
import { CareersDetailSkeleton } from "@/app/(careers)/careers/_components/skeletons";

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
    <article>
      <JobDetailHeader posting={posting}>
        <Link
          href={applicant ? `/careers/${posting.id}/apply` : "/careers/signin"}
          className="mt-2 inline-block rounded-full bg-primary px-6 py-3 font-semibold text-on-primary"
        >
          Apply
        </Link>
      </JobDetailHeader>
      <JobDetailBody posting={posting}>
        {posting.requiredDocuments.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-ink">Required Documents</h2>
            <ul className="list-disc pl-5 text-body">{posting.requiredDocuments.map((document) => <li key={document}>{document}</li>)}</ul>
          </section>
        )}
      </JobDetailBody>
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
