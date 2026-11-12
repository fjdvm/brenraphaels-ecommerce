import { notFound } from "next/navigation";
import { Suspense } from "react";

import { offerPresentation } from "@/lib/careers/application-offer";
import { applicationProgress } from "@/lib/careers/application-progress";
import { canWithdrawApplication, createApplicationStore } from "@/lib/careers/applications";
import { requireApplicant } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";
import { ApplicationHeader, applicationDate } from "@/app/(careers)/careers/_components/application-header";
import { ApplicationDocuments } from "@/app/(careers)/careers/_components/application-documents";
import { offerRepliesEnabled } from "@/lib/careers/offer-reply";
import { readRequestedDocuments } from "@/lib/careers/offer-documents";
import { ApplicationOffer } from "@/app/(careers)/careers/_components/application-offer";
import { createHrmsOfferDetailsGateway, type OfferDetails } from "@/lib/careers/offer-details";
import { OfferDetailsForm } from "@/app/(careers)/careers/_components/offer-details-form";
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
  const { view: offerView, showDocuments, outcomeStatus } = offerPresentation(application.status, submission.offer);
  const requested = showDocuments && offerView !== "hired" ? await readRequestedDocuments(getCareersDatabase(), applicant.userId, referenceNumber) : null;
  // Your details is for an Offer still open to change: Sent or Accepted, never Declined, Withdrawn or Hired.
  const detailsOpen = (offerView === "reply" || offerView === "accepted") && submission.offer;
  let savedDetails: OfferDetails | null = null;
  if (detailsOpen) {
    try {
      savedDetails = await createHrmsOfferDetailsGateway().read({ offerId: detailsOpen.id, applicantId: applicant.userId });
    } catch (error) {
      console.error("Your details could not be read", error instanceof Error ? error.message : "unknown error");
    }
  }
  const updatedOn = applicationDate.format(submission.updatedAt);
  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pb-[100px] pt-5 sm:px-10 sm:pt-10">
      <ApplicationHeader application={application} />
      {progress.closed ? (
        <ApplicationEndState status={outcomeStatus} closedOn={updatedOn} />
      ) : (
        <ApplicationStepper
          status={application.status}
          appliedOn={shortDate.format(application.appliedAt)}
          updatedOn={application.status === "Received" ? undefined : shortDate.format(submission.updatedAt)}
        />
      )}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-col gap-5 lg:flex-1">
          {application.status === "Interview" ? <ApplicationInterview interview={submission.interview} referenceNumber={application.referenceNumber} rescheduleEnabled={offerRepliesEnabled()} /> : null}
          {offerView && submission.offer ? <ApplicationOffer view={offerView} jobTitle={application.title} offer={submission.offer} referenceNumber={application.referenceNumber} repliesEnabled={offerRepliesEnabled()} /> : null}
          {savedDetails ? <OfferDetailsForm referenceNumber={application.referenceNumber} initial={savedDetails} /> : null}
          {/* Once Hired the checklist is read-only: no required list means no Upload buttons. */}
          {showDocuments ? <ApplicationDocuments documents={submission.documents} required={offerView === "hired" ? undefined : requested?.documents ?? submission.requiredDocuments} referenceNumber={application.referenceNumber} /> : null}
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
