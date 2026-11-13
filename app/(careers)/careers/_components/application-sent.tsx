import { ArrowRight, Check, Mail } from "lucide-react";
import Link from "next/link";

const sentAtFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" });
const steps = ["Apply", "Review", "Interview", "Welcome"];

export type ApplicationSentProps = {
  firstName: string;
  role: string;
  referenceNumber: string;
  /** ISO timestamp of when the Application was submitted. */
  sentAt: string;
  /** The address the confirmation went to; only set when the submit result says an email was sent. */
  emailedTo?: string;
};

/** The inline confirmation that replaces the apply form after a successful submit. */
export function ApplicationSent({ firstName, role, referenceNumber, sentAt, emailedTo }: ApplicationSentProps) {
  const sent = sentAtFormat.format(new Date(sentAt)).replace(/\s?(am|pm)$/i, (_, meridiem: string) => ` ${meridiem.toUpperCase()}`);
  return (
    <div role="status" className="mt-8 flex flex-col gap-5">
      <section className="flex flex-col items-center gap-4 border border-line bg-white px-[22px] pb-7 pt-9 sm:gap-[22px] sm:px-16 sm:pb-14 sm:pt-[60px]">
        <span aria-hidden className="flex size-[72px] items-center justify-center rounded-full bg-success-soft text-success sm:size-20"><Check className="size-8 sm:size-9" strokeWidth={1.5} /></span>
        <h2 className="text-center font-serif text-[28px] leading-tight text-primary sm:text-[40px] sm:leading-[1.2]">Application sent!</h2>
        <p className="text-center text-sm leading-normal tracking-[0.35px] text-body sm:text-base sm:leading-[1.6]">Thanks, {firstName}. Our team will review your application for {role} and get back to you within 5 working days.</p>
        <dl className="flex w-full flex-col bg-surface-soft text-sm sm:flex-row">
          <Detail label="Role" value={role} className="sm:flex" hideOnMobile />
          <Detail label="Reference" value={referenceNumber} />
          <Detail label="Sent" value={sent} />
        </dl>
        <ol aria-label="Application progress" className="hidden w-full items-center gap-2.5 sm:flex">
          {steps.map((label, index) => {
            const done = index === 0;
            const current = index === 1;
            return (
              <li key={label} aria-current={current ? "step" : undefined} className="flex items-center gap-2.5 last:flex-none [&:not(:last-child)]:flex-1">
                <span className="flex items-center gap-2">
                  <span className={`flex size-7 items-center justify-center rounded-full border text-[13px] font-medium ${done ? "border-primary bg-primary text-white" : current ? "border-primary bg-white text-primary" : "border-line bg-white text-muted"}`}>{done ? <Check aria-hidden className="size-3.5" /> : index + 1}</span>
                  <span className={`text-sm ${done || current ? "font-medium text-primary" : "text-muted"}`}>{label}</span>
                </span>
                {index < steps.length - 1 ? <span aria-hidden className={`h-0.5 flex-1 ${done ? "bg-primary" : "bg-line"}`} /> : null}
              </li>
            );
          })}
        </ol>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:pt-2">
          <Link href={`/careers/applications/${encodeURIComponent(referenceNumber)}`} className="flex items-center justify-center gap-2.5 rounded-full bg-primary px-9 py-4 text-lg tracking-[0.45px] text-white">Track your application <ArrowRight aria-hidden className="size-5" /></Link>
          <Link href="/careers" className="flex items-center justify-center rounded-full border border-primary px-9 py-4 text-lg tracking-[0.45px] text-primary">Browse more roles</Link>
        </div>
      </section>
      {emailedTo ? (
        <p className="flex items-start gap-2.5 bg-lavender-soft px-4 py-3.5 text-sm leading-normal tracking-[0.35px] text-primary sm:items-center sm:px-[18px]"><Mail aria-hidden className="size-[18px] shrink-0" />
          <span>We also sent a copy to {emailedTo}. Updates will show in Your applications and in your email.</span></p>
      ) : null}
    </div>
  );
}

function Detail({ label, value, className = "", hideOnMobile = false }: { label: string; value: string; className?: string; hideOnMobile?: boolean }) {
  return (
    <div className={`flex-1 flex-row justify-between gap-2 px-4 py-3.5 sm:flex-col sm:justify-start sm:gap-1 sm:px-5 sm:py-[18px] ${hideOnMobile ? "hidden" : "flex"} ${className}`}>
      <dt className="text-muted sm:text-xs">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
