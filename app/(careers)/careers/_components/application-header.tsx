import { ArrowLeft, Clock, FileText, MapPin, Tag } from "lucide-react";
import type { ReactNode } from "react";

import { applicationStatusDisplay } from "@/lib/careers/application-status-display";
import type { ApplicationSummary } from "@/lib/careers/applications";

import { BackLink } from "./back-link";

export const applicationDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" });

function Meta({ icon, children, className = "" }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <li className={`items-center gap-1.5 text-sm tracking-[0.35px] text-body ${className || "flex"}`}>
      {icon}
      {children}
    </li>
  );
}

/** Back link, title, status badge and the summary line with the department, Location, employment type, applied date and Reference number. */
export function ApplicationHeader({ application }: { application: ApplicationSummary }) {
  const icon = "size-4 shrink-0";
  return (
    <header className="flex flex-col items-start gap-4 sm:gap-5">
      <BackLink href="/careers/applications" className="flex items-center gap-1.5 text-sm font-medium tracking-[0.35px] text-primary">
        <ArrowLeft aria-hidden className="size-4 sm:size-[18px]" />
        Your applications
      </BackLink>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
        <h1 className="font-serif text-[28px] leading-[1.25] text-primary sm:text-[54px] sm:leading-[1.2]">{application.title ?? "Job posting unavailable"}</h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="rounded-full bg-lavender px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary">{applicationStatusDisplay(application.status).label}</span>
          <span className="text-xs tracking-[0.35px] text-muted sm:hidden">Ref. {application.referenceNumber}</span>
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {application.department ? <Meta icon={<Tag aria-hidden className={icon} />}>{application.department}</Meta> : null}
        {application.location ? <Meta icon={<MapPin aria-hidden className={icon} />}>{application.location}</Meta> : null}
        {application.employmentType ? <Meta icon={<Clock aria-hidden className={icon} />}>{application.employmentType}</Meta> : null}
        <Meta className="hidden sm:flex" icon={<FileText aria-hidden className={icon} />}>
          Applied {applicationDate.format(application.appliedAt)} · Ref. {application.referenceNumber}
        </Meta>
      </ul>
      <p className="text-sm tracking-[0.35px] text-body sm:hidden">Applied {applicationDate.format(application.appliedAt)}</p>
    </header>
  );
}
