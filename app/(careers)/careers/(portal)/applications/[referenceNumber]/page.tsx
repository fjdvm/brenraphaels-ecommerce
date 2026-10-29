import { notFound } from "next/navigation";
import { Suspense } from "react";

import { createApplicationStore } from "@/lib/careers/applications";
import { requireApplicant } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";
import { ApplicationHeader, applicationDate } from "@/app/(careers)/careers/_components/application-header";
import { ApplicationOffer } from "@/app/(careers)/careers/_components/application-offer";
import { ApplicationStageDetails } from "@/app/(careers)/careers/_components/application-stage-details";
import { ApplicationSubmission } from "@/app/(careers)/careers/_components/application-submission";
import { ApplicationStepper } from "@/app/(careers)/careers/_components/application-stepper";
import { CareersApplicationSkeleton } from "@/app/(careers)/careers/_components/skeletons";

type ApplicationPageProps = { params: Promise<{ referenceNumber: string }> };

async function ApplicationPageContent({ params }: ApplicationPageProps) {
  const [applicant, { referenceNumber }] = await Promise.all([requireApplicant(), params]);
  const store = createApplicationStore(getCareersDatabase());
  const [application, submission] = await Promise.all([
    store.findSummaryForApplicant(applicant.userId, referenceNumber),
    store.findSubmissionForApplicant(applicant.userId, referenceNumber),
  ]);
  if (!application || !submission) notFound();

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 pb-[100px] pt-[50px] sm:px-10 lg:px-40">
      <ApplicationHeader application={application} />
      <ApplicationStepper status={application.status} appliedOn={applicationDate.format(application.appliedAt)} />
      {application.status === "Interview" ? <ApplicationStageDetails status={application.status} updatedAt={submission.updatedAt} /> : null}
      {application.status === "Offer" ? <ApplicationOffer status={application.status} updatedAt={submission.updatedAt} jobTitle={application.title} /> : null}
      {application.status === "Interview" || application.status === "Offer" ? (
        <ApplicationSubmission appliedAt={application.appliedAt} documents={submission.documents} profile={submission.profile} />
      ) : null}
    </section>
  );
}

export default function ApplicationPage(props: ApplicationPageProps) {
  return (
    <Suspense fallback={<CareersApplicationSkeleton />}>
      <ApplicationPageContent {...props} />
    </Suspense>
  );
}
