import { applicationProgress } from "./application-progress";
import type { ApplicationStatus } from "./applications";

/** Display-only wording for an Application's stored status; the stored statuses, webhook and closed-status rule are unchanged. */
export const applicationStepLabels = ["Apply", "Review", "Interview", "Offer", "Welcome"] as const;

/** The confirmation's shorter stepper: no Offer step yet. */
export const applicationConfirmationStepLabels = ["Apply", "Review", "Interview", "Welcome"] as const;

const badgeLabels: Record<string, string> = {
  Received: "Application received",
  Screening: "Under review",
  Interview: "Interview scheduled",
  Offer: "Offer received",
  Hired: "Hired",
  Rejected: "Not selected",
  Declined: "Offer declined",
  Expired: "Offer expired",
  Withdrawn: "Withdrawn",
};

export type ApplicationStatusDisplay = { label: string; step: number; closed: boolean };

/** Badge label plus the stepper step (1-5, or 0 when closed); an unknown status falls back to the first step. */
export function applicationStatusDisplay(status: ApplicationStatus): ApplicationStatusDisplay {
  const { closed, step } = applicationProgress(status);
  return { label: badgeLabels[status] ?? badgeLabels.Received, step, closed };
}
