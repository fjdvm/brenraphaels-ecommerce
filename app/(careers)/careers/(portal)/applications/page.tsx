import { ArrowRight, Briefcase, CalendarDays, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { eyebrowClass } from "@/components/features/about/section-heading";
import { HowHiringWorks } from "@/components/features/careers/how-hiring-works";
import { Button } from "@/components/ui/button";
import { applicationProgress } from "@/lib/careers/application-progress";
import { canWithdrawApplication, createApplicationStore } from "@/lib/careers/applications";
import type { ApplicationSummary } from "@/lib/careers/applications";
import { requireApplicant } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";

import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";
import { CareersApplicationsSkeleton } from "@/app/(careers)/careers/_components/skeletons";
import { ApplicationProgressStrip } from "@/app/(careers)/careers/_components/application-progress-strip";
import { withdrawApplicationAction } from "./actions";

const appliedDate = new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" });

type View = "active" | "closed" | "all";

function parseView(value: string | string[] | undefined): View {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "closed" || raw === "all" ? raw : "active";
}

function isClosed(application: ApplicationSummary) {
  return applicationProgress(application.status).closed;
}

function StatusBadge({ status }: { status: string }) {
  const closed = applicationProgress(status).closed;
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium tracking-[0.35px] ${closed ? "bg-warning-soft text-warning" : "bg-lavender text-primary"}`}
    >
      {status}
    </span>
  );
}

function ViewTabs({ view, counts }: { view: View; counts: Record<View, number> }) {
  const tabs: { key: View; label: string }[] = [
    { key: "active", label: `Active ${counts.active}` },
    { key: "closed", label: `Closed ${counts.closed}` },
    { key: "all", label: `All ${counts.all}` },
  ];
  return (
    <nav aria-label="Filter applications" className="flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === "active" ? "/careers/applications" : `/careers/applications?view=${tab.key}`}
          aria-current={view === tab.key ? "page" : undefined}
          className={`rounded-full border px-3.5 py-2 text-[13px] font-medium leading-[1.4] tracking-[0.35px] sm:px-[18px] sm:py-2.5 sm:text-sm sm:leading-[1.5] ${
            view === tab.key ? "border-lavender bg-lavender text-primary" : "border-line bg-white text-body hover:bg-lavender-soft"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function ApplicationCard({ application }: { application: ApplicationSummary }) {
  const progress = applicationProgress(application.status);
  const detailHref = `/careers/applications/${encodeURIComponent(application.referenceNumber)}`;
  const meta = [
    application.location ? { Icon: MapPin, text: application.location } : null,
    application.employmentType ? { Icon: Clock, text: application.employmentType } : null,
    { Icon: CalendarDays, text: `Applied ${appliedDate.format(application.appliedAt)}` },
  ].filter((item) => item !== null);
  const highlighted = application.status === "Interview";

  return (
    <li className="flex flex-col gap-3.5 rounded-[28px] border border-line bg-white px-5 py-6 sm:gap-5 sm:rounded-[40px] sm:px-8 sm:pb-7 sm:pt-8">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lavender text-primary sm:size-[52px]">
            <Briefcase className="size-5 sm:size-[22px]" strokeWidth={1.5} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-2">
            <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <h2 className="font-serif text-lg leading-[1.35] text-primary sm:text-[28px] sm:leading-[1.25]">
                <Link href={detailHref} className="hover:underline">
                  {application.title ?? "Job posting unavailable"}
                </Link>
              </h2>
              <StatusBadge status={application.status} />
            </div>
            <ul className="hidden flex-wrap items-center gap-x-5 gap-y-1 text-sm tracking-[0.35px] text-body sm:flex">
              {meta.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5">
                  <Icon aria-hidden className="size-4" strokeWidth={1.5} />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Button asChild variant={highlighted ? "pill" : "pill-outline"} size="pill-sm" className="hidden sm:inline-flex">
          <Link href={detailHref}>
            View details
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Button>
      </div>

      <ApplicationProgressStrip status={application.status} progress={progress} />

      <p className="text-xs tracking-[0.35px] text-body">
        <span className="sm:hidden">{meta.map((item) => item.text).join(" · ")} · </span>
        Reference number: {application.referenceNumber}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant={highlighted ? "pill" : "pill-outline"} size="pill-sm" className="w-full sm:hidden">
          <Link href={detailHref}>
            View details
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Button>
        {canWithdrawApplication(application.status) ? (
          <form action={withdrawApplicationAction} className="sm:shrink-0">
            <input type="hidden" name="referenceNumber" value={application.referenceNumber} />
            <SubmitButton
              pendingLabel="Withdrawing…"
              className="w-full rounded-full border border-primary px-[22px] py-2.5 text-sm font-medium tracking-wide text-primary hover:bg-lavender-soft sm:w-auto"
            >
              Withdraw Application
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </li>
  );
}

async function ApplicationsList({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const applicant = await requireApplicant();
  const view = parseView((await searchParams).view);
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

  const closedCount = applications.filter(isClosed).length;
  const counts: Record<View, number> = { active: applications.length - closedCount, closed: closedCount, all: applications.length };
  const visible = view === "all" ? applications : applications.filter((application) => isClosed(application) === (view === "closed"));

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <ViewTabs view={view} counts={counts} />
      {visible.length === 0 ? (
        <p className="rounded-[28px] border border-line bg-white px-6 py-10 text-center tracking-[0.35px] text-body">
          {view === "active" ? "You have no active applications." : "You have no closed applications."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4 sm:gap-6">
          {visible.map((application) => (
            <ApplicationCard key={application.referenceNumber} application={application} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ApplicationsPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  return (
    <>
      <section className="mx-auto w-full max-w-[1440px] px-4 pb-7 pt-6 sm:px-10 sm:pb-[60px] sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-[30px]">
          <div className="flex flex-col gap-2 sm:gap-3">
            <p className={eyebrowClass}>Careers</p>
            <h1 className="font-serif text-[28px] leading-[1.25] text-primary sm:text-[54px] sm:leading-[1.2]">Your applications</h1>
            <p className="text-sm leading-[1.5] tracking-[0.35px] text-body sm:text-base sm:leading-[1.6]">Track every application you&apos;ve submitted.</p>
          </div>
          <Button asChild variant="pill-outline" size="pill-lg" className="hidden sm:inline-flex">
            <Link href="/careers#open-roles">
              Browse job postings
              <ArrowRight aria-hidden className="size-5" />
            </Link>
          </Button>
        </div>
        <div className="mt-4 sm:mt-6">
          <Suspense fallback={<CareersApplicationsSkeleton />}>
            <ApplicationsList searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      <HowHiringWorks />
    </>
  );
}
