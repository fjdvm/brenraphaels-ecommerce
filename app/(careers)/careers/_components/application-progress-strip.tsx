import { CalendarDays, Clock } from "lucide-react";

import type { ApplicationProgress } from "@/lib/careers/application-progress";
import type { ApplicationStatus } from "@/lib/careers/applications";

const messages: Record<string, { title: string; detail: string }> = {
  Received: { title: "We've received your application", detail: "Our team will review it shortly." },
  Screening: { title: "We're reviewing your application", detail: "Expect an update within 5 working days." },
  Interview: { title: "You're at the interview stage", detail: "We'll message you with the details." },
  Offer: { title: "You're at the offer stage", detail: "We'll be in touch with the details." },
  Hired: { title: "Welcome to the team", detail: "Your application was successful." },
  Rejected: { title: "This application is closed", detail: "Thank you for your interest in Bren Raphael's." },
  Declined: { title: "This application is closed", detail: "You declined this opportunity." },
  Expired: { title: "This application is closed", detail: "It expired before a decision was made." },
  Withdrawn: { title: "This application is closed", detail: "You withdrew this application." },
};

/** Status banner of an Application card: what the status means plus the five-segment "Step N of 5" or "Closed" strip. */
export function ApplicationProgressStrip({ status, progress }: { status: ApplicationStatus; progress: ApplicationProgress }) {
  const label = progress.closed ? "Closed" : `Step ${progress.step} of ${progress.total}`;
  const message = messages[status] ?? { title: status, detail: "" };
  const highlighted = status === "Interview";
  const Icon = highlighted ? CalendarDays : Clock;
  return (
    <div
      className={`flex flex-col gap-3 rounded-[18px] px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:rounded-3xl sm:py-[18px] sm:pl-[18px] sm:pr-[22px] ${highlighted ? "bg-lavender-soft" : "bg-surface"}`}
      role="group"
      aria-label={`${message.title}. ${label}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-primary sm:size-10">
          <Icon className="size-[15px] sm:size-[18px]" strokeWidth={1.5} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5 leading-[1.5] tracking-[0.35px]">
          <p className={`text-sm font-medium ${highlighted ? "text-primary" : "text-ink"}`}>{message.title}</p>
          {message.detail ? <p className="text-xs text-body">{message.detail}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-3">
        <div aria-hidden className="flex flex-1 items-center gap-1.5 sm:flex-none">
          {Array.from({ length: progress.total }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-[3px] sm:w-9 sm:flex-none ${progress.closed ? "bg-line" : index < progress.step ? "bg-primary" : "bg-accent/35"}`}
            />
          ))}
        </div>
        <p className="shrink-0 text-xs tracking-[0.35px] text-muted">{label}</p>
      </div>
    </div>
  );
}
