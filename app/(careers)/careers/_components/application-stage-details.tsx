import { Video } from "lucide-react";

import type { ApplicationStatus } from "@/lib/careers/applications";

import { applicationDate } from "./application-header";

/** Stage details Careers already holds: the status itself and when it last changed. No actions or Messages at this stage. */
export function ApplicationStageDetails({ status, updatedAt }: { status: ApplicationStatus; updatedAt: Date }) {
  return (
    <section aria-labelledby="stage-heading" className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary">
          <Video aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col">
          <h2 id="stage-heading" className="text-lg font-semibold text-ink">
            {status} stage
          </h2>
          <p className="text-sm text-body">We&apos;ll email you the interview details.</p>
        </div>
      </div>
      <dl className="rounded-2xl bg-surface-soft p-4">
        <dt className="text-xs text-body">Status updated</dt>
        <dd className="text-base font-semibold text-ink">{applicationDate.format(updatedAt)}</dd>
      </dl>
    </section>
  );
}
