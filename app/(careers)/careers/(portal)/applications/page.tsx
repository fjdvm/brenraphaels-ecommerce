import { ArrowRight, Briefcase } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { eyebrowClass } from "@/components/features/about/section-heading";
import { HowHiringWorks } from "@/components/features/careers/how-hiring-works";
import { Button } from "@/components/ui/button";
import { applicationProgress } from "@/lib/careers/application-progress";
import { canWithdrawApplication, createApplicationStore } from "@/lib/careers/applications";
import { requireApplicant } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";

import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";
import { CareersApplicationsSkeleton } from "@/app/(careers)/careers/_components/skeletons";
import { ApplicationProgressStrip } from "@/app/(careers)/careers/_components/application-progress-strip";
import { withdrawApplicationAction } from "./actions";

const appliedDate = new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" });

async function ApplicationsList() {
  const applicant = await requireApplicant();
  const applications = await createApplicationStore(getCareersDatabase()).listSummariesForApplicant(applicant.userId);

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-[40px] border border-line bg-white px-6 py-16 text-center sm:p-20">
        <span aria-hidden className="flex size-24 items-center justify-center rounded-full bg-lavender text-primary">
          <Briefcase className="size-[43px]" strokeWidth={1.25} />
        </span>
        <h2 className="font-serif text-3xl leading-[1.2] text-primary sm:text-[40px]">No applications yet</h2>
        <p className="max-w-[460px] leading-[1.6] tracking-[0.35px] text-body">
          When you apply for a role, you&apos;ll see its status here — from received to interview.
        </p>
        <Button asChild variant="pill" size="pill-lg">
          <Link href="/careers#open-roles">
            See open roles
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {applications.map((application) => {
        const details = [
          application.department,
          application.employmentType,
          application.location,
          `Applied ${appliedDate.format(application.appliedAt)}`,
        ].filter(Boolean);
        const progress = applicationProgress(application.status);
        return (
          <li key={application.referenceNumber} className="flex flex-col gap-4 rounded-[24px] border border-line bg-white p-5 sm:px-[17px] sm:py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 className="font-serif text-xl leading-[1.3] text-primary">{application.title ?? "Job posting unavailable"}</h2>
                <span className="rounded-full bg-lavender px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary">{application.status}</span>
              </div>
              <p className="text-sm tracking-[0.35px] text-body">{details.join(" · ")}</p>
              <p className="text-xs tracking-[0.35px] text-body">Reference number: {application.referenceNumber}</p>
            </div>
            {canWithdrawApplication(application.status) ? (
              <form action={withdrawApplicationAction} className="shrink-0">
                <input type="hidden" name="referenceNumber" value={application.referenceNumber} />
                <SubmitButton
                  pendingLabel="Withdrawing…"
                  className="rounded-full border border-primary px-[22px] py-2.5 text-sm font-medium tracking-wide text-primary hover:bg-lavender-soft"
                >
                  Withdraw Application
                </SubmitButton>
              </form>
            ) : null}
            </div>
            <ApplicationProgressStrip progress={progress} />
          </li>
        );
      })}
    </ul>
  );
}

export default function ApplicationsPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-[1440px] px-5 pb-[100px] pt-[50px] sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-[30px]">
          <div className="flex flex-col gap-4">
            <p className={eyebrowClass}>Careers</p>
            <h1 className="font-serif text-4xl leading-[1.2] text-primary sm:text-[54px]">Your applications</h1>
            <p className="leading-[1.6] tracking-[0.35px] text-body">Track every application you&apos;ve submitted.</p>
          </div>
          <Button asChild variant="pill-outline" size="pill-lg">
            <Link href="/careers#open-roles">
              Browse job postings
              <ArrowRight aria-hidden className="size-5" />
            </Link>
          </Button>
        </div>
        <div className="mt-[30px]">
          <Suspense fallback={<CareersApplicationsSkeleton />}>
            <ApplicationsList />
          </Suspense>
        </div>
      </section>

      <HowHiringWorks />
    </>
  );
}
