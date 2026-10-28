import { Check } from "lucide-react";

import { applicationProgress } from "@/lib/careers/application-progress";
import type { ApplicationStatus } from "@/lib/careers/applications";

const stepLabels = ["Apply", "Review", "Interview", "Offer", "Welcome"];

/** The design's five-step stepper on the Application page; the dated sub-line is only known for Apply (the applied date). Closed Applications show no current step. */
export function ApplicationStepper({ status, appliedOn }: { status: ApplicationStatus; appliedOn: string }) {
  const progress = applicationProgress(status);
  return (
    <ol aria-label="Application progress" className="flex flex-col gap-4 rounded-2xl bg-surface-soft p-4 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3.5">
      {stepLabels.map((label, index) => {
        const number = index + 1;
        const done = !progress.closed && number < progress.step;
        const current = !progress.closed && number === progress.step;
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="flex items-center gap-2.5 sm:flex-1 sm:last:flex-none">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                done ? "border-primary bg-primary text-white" : current ? "border-primary bg-white text-primary" : "border-line bg-white text-body"
              }`}
            >
              {done ? <Check aria-hidden className="size-3.5" /> : number}
            </span>
            <span className="flex flex-col leading-tight">
              <span className={`text-sm ${done || current ? "font-semibold text-ink" : "text-body"}`}>{label}</span>
              <span className="text-xs text-body">{number === 1 ? appliedOn : "—"}</span>
            </span>
            {number < stepLabels.length ? <span aria-hidden className={`hidden h-px flex-1 sm:block ${done ? "bg-primary" : "bg-line"}`} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
