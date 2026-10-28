import { ArrowLeft, Clock, FileText, MapPin, Tag } from "lucide-react";
import type { ReactNode } from "react";

import type { ApplicationSummary } from "@/lib/careers/applications";

import { BackLink } from "./back-link";

export const applicationDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" });

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5 text-sm text-body">
      {icon}
      {children}
    </li>
  );
}

/** Back link, title, status chip and the summary line with the applied date and Reference number. */
export function ApplicationHeader({ application }: { application: ApplicationSummary }) {
  const icon = "size-4 shrink-0";
  return (
    <header className="flex flex-col items-start gap-3.5">
      <BackLink href="/careers/applications" className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <ArrowLeft aria-hidden className="size-4" />
        Your applications
      </BackLink>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-3xl font-bold text-ink sm:text-[40px]">{application.title ?? "Job posting unavailable"}</h1>
        <span className="rounded-full bg-lavender px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary">{application.status}</span>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {application.department ? <Meta icon={<Tag aria-hidden className={icon} />}>{application.department}</Meta> : null}
        {application.location ? <Meta icon={<MapPin aria-hidden className={icon} />}>{application.location}</Meta> : null}
        {application.employmentType ? <Meta icon={<Clock aria-hidden className={icon} />}>{application.employmentType}</Meta> : null}
        <Meta icon={<FileText aria-hidden className={icon} />}>
          Applied {applicationDate.format(application.appliedAt)} · Ref. {application.referenceNumber}
        </Meta>
      </ul>
    </header>
  );
}
