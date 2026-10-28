import { notFound } from "next/navigation";
import { Suspense } from "react";

import { createApplicationStore } from "@/lib/careers/applications";
import { requireApplicant } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";
import { ApplicationHeader, applicationDate } from "@/app/(careers)/careers/_components/application-header";
import { ApplicationStepper } from "@/app/(careers)/careers/_components/application-stepper";
import { CareersApplicationSkeleton } from "@/app/(careers)/careers/_components/skeletons";

type ApplicationPageProps = { params: Promise<{ referenceNumber: string }> };

async function ApplicationPageContent({ params }: ApplicationPageProps) {
  const [applicant, { referenceNumber }] = await Promise.all([requireApplicant(), params]);
  const application = await createApplicationStore(getCareersDatabase()).findSummaryForApplicant(applicant.userId, referenceNumber);
  if (!application) notFound();

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 pb-[100px] pt-[50px] sm:px-10 lg:px-40">
      <ApplicationHeader application={application} />
      <ApplicationStepper status={application.status} appliedOn={applicationDate.format(application.appliedAt)} />
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
