import { PartyPopper } from "lucide-react";

import type { ApplicationStatus } from "@/lib/careers/applications";

import { applicationDate } from "./application-header";

/** Offer stage details Careers already holds: the status itself and when it last changed. Pay, start date and the offer letter live in HR-ATS, so there are no sections for them and no Accept or Decline. */
export function ApplicationOffer({ status, updatedAt, jobTitle }: { status: ApplicationStatus; updatedAt: Date; jobTitle: string | null }) {
  return (
    <section aria-labelledby="offer-heading" className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary">
          <PartyPopper aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col">
          <h2 id="offer-heading" className="text-lg font-semibold text-ink">
            We&apos;d love to have you on the team!
          </h2>
          <p className="text-sm text-body">
            {jobTitle ? `Your offer for ${jobTitle} is on its way.` : "Your offer is on its way."} We&apos;ll email you the details.
          </p>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-surface-soft p-4">
          <dt className="text-xs text-body">Status</dt>
          <dd className="text-base font-semibold text-ink">{status}</dd>
        </div>
        <div className="rounded-2xl bg-surface-soft p-4">
          <dt className="text-xs text-body">Status updated</dt>
          <dd className="text-base font-semibold text-ink">{applicationDate.format(updatedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}
