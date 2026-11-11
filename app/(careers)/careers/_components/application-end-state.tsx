import { applicationStatusDisplay } from "@/lib/careers/application-status-display";
import type { ApplicationStatus } from "@/lib/careers/applications";

const copy: Record<string, string> = {
  Rejected: "Thank you for your interest. We won't be moving forward with this application, but we'd love to see you apply for other roles.",
  Withdrawn: "You withdrew this application. You can apply for other open roles any time.",
  Declined: "You declined the offer for this role.",
  Expired: "The offer for this role expired before it was accepted.",
};

/** What a closed Application shows in place of the stepper. */
export function ApplicationEndState({ status, closedOn }: { status: ApplicationStatus; closedOn: string }) {
  return (
    <section aria-label="Application outcome" className="flex flex-col gap-1.5 rounded-3xl bg-surface-soft px-5 py-5 sm:rounded-[40px] sm:px-8 sm:py-6">
      <h2 className="font-serif text-lg text-primary sm:text-[22px]">{applicationStatusDisplay(status).label}</h2>
      <p className="text-sm tracking-[0.35px] text-body">{copy[status] ?? "This application is closed."}</p>
      <p className="text-xs tracking-[0.35px] text-muted">{closedOn}</p>
    </section>
  );
}
