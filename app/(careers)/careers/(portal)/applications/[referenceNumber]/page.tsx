import { notFound } from "next/navigation";
import { Suspense } from "react";

import { applicationProgress } from "@/lib/careers/application-progress";
import { canWithdrawApplication, createApplicationStore } from "@/lib/careers/applications";
import { requireApplicant } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";
import { ApplicationHeader, applicationDate } from "@/app/(careers)/careers/_components/application-header";
import { ApplicationDocuments } from "@/app/(careers)/careers/_components/application-documents";
import { ApplicationOffer } from "@/app/(careers)/careers/_components/application-offer";
import { ApplicationInterview } from "@/app/(careers)/careers/_components/application-interview";
import { ApplicationSubmission } from "@/app/(careers)/careers/_components/application-submission";
import { ApplicationStepper } from "@/app/(careers)/careers/_components/application-stepper";
import { ApplicationEndState } from "@/app/(careers)/careers/_components/application-end-state";
import { ApplicationPageSkeleton } from "@/app/(careers)/careers/_components/application-skeleton";
import { ApplicationHelp, ApplicationMessages } from "@/app/(careers)/careers/_components/application-side-panels";
import { WithdrawApplication } from "@/app/(careers)/careers/_components/withdraw-application";

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Manila" });

type ApplicationPageProps = { params: Promise<{ referenceNumber: string }> };

async function ApplicationPageContent({ params }: ApplicationPageProps) {
  const [applicant, { referenceNumber }] = await Promise.all([requireApplicant(), params]);
  const store = createApplicationStore(getCareersDatabase());
  const [application, submission] = await Promise.all([
    store.findSummaryForApplicant(applicant.userId, referenceNumber),
    store.findSubmissionForApplicant(applicant.userId, referenceNumber),
  ]);
  if (!application || !submission) notFound();

  const progress = applicationProgress(application.status);
  const updatedOn = applicationDate.format(submission.updatedAt);
  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pb-[100px] pt-5 sm:px-10 sm:pt-10">
      <ApplicationHeader application={application} />
      {progress.closed ? (
        <ApplicationEndState status={application.status} closedOn={updatedOn} />
      ) : (
        <ApplicationStepper
          status={application.status}
          appliedOn={shortDate.format(application.appliedAt)}
          updatedOn={application.status === "Received" ? undefined : shortDate.format(submission.updatedAt)}
        />
      )}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-col gap-5 lg:flex-1">
          {application.status === "Interview" ? <ApplicationInterview interview={submission.interview} /> : null}
          {application.status === "Offer" ? <ApplicationOffer jobTitle={application.title} offer={submission.offer} /> : null}
          {application.status === "Offer" ? <ApplicationDocuments documents={submission.documents} required={submission.requiredDocuments} /> : null}
          {application.status === "Interview" || application.status === "Offer" ? (
            <ApplicationSubmission appliedAt={application.appliedAt} documents={application.status === "Offer" ? [] : submission.documents} profile={submission.profile} />
          ) : null}
          {canWithdrawApplication(application.status) ? <WithdrawApplication referenceNumber={application.referenceNumber} /> : null}
        </div>
        <aside className="flex w-full flex-col gap-5 lg:w-[440px] lg:shrink-0">
          <ApplicationMessages />
          <ApplicationHelp />
        </aside>
      </div>
    </section>
  );
}

export default function ApplicationPage(props: ApplicationPageProps) {
  return (
    <Suspense fallback={<ApplicationPageSkeleton />}>
      <ApplicationPageContent {...props} />
    </Suspense>
  );
}
