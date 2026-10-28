import type { ApplicationStatus } from "./applications";

const steps = ["Received", "Screening", "Interview", "Offer", "Hired"] as const;
const closedStatuses = new Set(["Rejected", "Declined", "Expired", "Withdrawn"]);

export const applicationProgressStepCount = steps.length;

export type ApplicationProgress =
  | { closed: false; step: number; total: number }
  | { closed: true; step: 0; total: number };

/** Where an Application sits on the five-step strip; closed and rejected Applications show their end state instead of a step. */
export function applicationProgress(status: ApplicationStatus): ApplicationProgress {
  if (closedStatuses.has(status)) return { closed: true, step: 0, total: steps.length };
  const index = steps.indexOf(status as (typeof steps)[number]);
  return { closed: false, step: index === -1 ? 1 : index + 1, total: steps.length };
}
