import { Check } from "lucide-react";

import { applicationStepLabels } from "@/lib/careers/application-status-display";
import { applicationProgress } from "@/lib/careers/application-progress";
import type { ApplicationStatus } from "@/lib/careers/applications";

/** The five-step stepper. A date sits under a step only once it is known: Apply always, and the current step once HR-ATS has moved the Application there. */
export function ApplicationStepper({ status, appliedOn, updatedOn }: { status: ApplicationStatus; appliedOn: string; updatedOn?: string }) {
  const progress = applicationProgress(status);
  return (
    <ol aria-label="Application progress" className="flex items-start bg-surface-soft px-3 pb-3.5 pt-4 sm:items-center sm:gap-3.5 sm:px-8 sm:py-6">
      {applicationStepLabels.map((label, index) => {
        const number = index + 1;
        const done = number < progress.step;
        const current = number === progress.step;
        const date = number === 1 ? appliedOn : current ? updatedOn : undefined;
        const reached = done || current;
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="flex flex-1 flex-col items-center gap-1.5 sm:flex-row sm:gap-3.5 sm:last:flex-none">
            <span className="flex w-full items-center sm:w-auto">
              <span aria-hidden className={`h-0.5 flex-1 sm:hidden ${number > 1 && reached ? "bg-primary" : number > 1 ? "bg-line" : "bg-transparent"}`} />
              <span
                className={`flex size-[26px] shrink-0 items-center justify-center rounded-full border text-xs sm:size-9 sm:text-sm sm:font-medium ${
                  done ? "border-primary bg-primary text-white" : current ? "border-primary bg-white text-primary" : "border-line bg-white text-muted"
                }`}
              >
                {done ? <Check aria-hidden className="size-3.5 sm:size-4" /> : number}
              </span>
              <span aria-hidden className={`h-0.5 flex-1 sm:hidden ${done ? "bg-primary" : "bg-line"}`} />
            </span>
            <span className="flex flex-col items-center leading-[1.4] sm:items-start sm:leading-normal">
              <span className={`text-[13px] sm:text-sm ${reached ? "font-medium text-primary" : "text-muted"}`}>{label}</span>
              {date ? <span className="text-xs tracking-[0.35px] text-muted">{date}</span> : <span className="hidden text-xs text-muted sm:block">—</span>}
            </span>
            {number < applicationStepLabels.length ? <span aria-hidden className={`hidden h-0.5 flex-1 sm:block ${done ? "bg-primary" : "bg-line"}`} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
