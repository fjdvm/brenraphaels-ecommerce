import { ArrowRight, Briefcase } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { eyebrowClass } from "@/components/features/about/section-heading";
import { Button } from "@/components/ui/button";
import { canWithdrawApplication, createApplicationStore } from "@/lib/careers/applications";
import { requireApplicant } from "@/lib/careers/current-applicant";
import { getCareersDatabase } from "@/lib/careers/db";

import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";
import { CareersApplicationsSkeleton } from "@/app/(careers)/careers/_components/skeletons";
import { withdrawApplicationAction } from "./actions";

const steps = [
  { title: "Apply", text: "Send your profile and résumé for an open role." },
  { title: "Review", text: "Our team reviews your application and gets back to you." },
  { title: "Interview", text: "We'll message you to schedule a short interview." },
  { title: "Welcome", text: "Join the Bren Raphael's family!" },
];

async function ApplicationsList() {
  const applicant = await requireApplicant();
  const applications = await createApplicationStore(getCareersDatabase()).listForApplicant(applicant.userId);

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
    <ul className="flex flex-col gap-5">
      {applications.map((application) => (
        <li key={application.referenceNumber} className="flex flex-col gap-4 rounded-[40px] border border-line bg-white p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-lavender text-primary">
            <Briefcase className="size-[25px]" strokeWidth={1.5} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <p className="font-serif text-2xl leading-[1.25] text-primary">Reference number: {application.referenceNumber}</p>
            <p>
              <span className="rounded-full bg-lavender px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary">
                Status: {application.status}
              </span>
            </p>
          </div>
          {canWithdrawApplication(application.status) ? (
            <form action={withdrawApplicationAction}>
              <input type="hidden" name="referenceNumber" value={application.referenceNumber} />
              <SubmitButton
                pendingLabel="Withdrawing…"
                className="rounded-full border border-primary px-[22px] py-2.5 text-sm font-medium tracking-wide text-primary hover:bg-lavender-soft"
              >
                Withdraw Application
              </SubmitButton>
            </form>
          ) : null}
        </li>
      ))}
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

      <section id="how-hiring-works" className="mx-auto w-full max-w-[1440px] px-5 pb-[100px] sm:px-10">
        <h2 className="font-serif text-[22px] leading-[1.3] text-primary">How hiring works</h2>
        <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex flex-col items-start gap-3 rounded-[40px] bg-surface-soft p-[30px]">
              <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-primary text-[13px] font-medium tracking-[0.35px] text-white">
                {index + 1}
              </span>
              <h3 className="font-serif text-lg leading-[1.35] text-primary">{step.title}</h3>
              <p className="text-sm leading-normal tracking-[0.35px] text-body">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
