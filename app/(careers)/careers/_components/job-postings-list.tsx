import { ArrowRight, Briefcase, Clock, MapPin } from "lucide-react";
import Link from "next/link";

import { eyebrowClass } from "@/components/features/about/section-heading";
import { Button } from "@/components/ui/button";
import type { JobPosting } from "@/lib/careers/job-postings";

const chipClass = "flex items-center gap-1.5 rounded-full bg-surface-soft px-2.5 py-1 text-xs tracking-[0.35px] text-body";

/** Eyebrow, section title and the number of Open Job Postings, as in the design. */
export function OpenRolesHeading({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={eyebrowClass}>Open roles</p>
      <h2 className="font-serif text-3xl leading-[1.2] text-primary sm:text-[32px]">
        {count} {count === 1 ? "position" : "positions"} open
      </h2>
    </div>
  );
}

/** `applicationStatuses` maps Job Posting id to the signed-in Applicant's Application status; omit it for signed-out visitors. */
export function JobPostingsList({ jobs, applicationStatuses = {} }: { jobs: JobPosting[]; applicationStatuses?: Record<string, string> }) {
  if (jobs.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-white px-6 py-8 text-sm tracking-[0.35px] text-body">
        There are no open Job Postings matching those filters.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {jobs.map((job) => (
        <li
          key={job.id}
          className="flex flex-col gap-4 rounded-[40px] border border-line bg-white px-6 py-[22px] sm:flex-row sm:items-center sm:gap-5"
        >
          <span aria-hidden className="grid size-[50px] shrink-0 place-items-center rounded-full bg-lavender text-primary">
            <Briefcase className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="font-serif text-xl leading-[1.3] text-primary">{job.title}</h3>
              {applicationStatuses[job.id] ? (
                <span className="rounded-full bg-lavender px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary">{applicationStatuses[job.id]}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-lavender px-2.5 py-1 text-xs font-medium tracking-[0.35px] text-primary">
                {job.department}
              </span>
              <span className={chipClass}>
                <MapPin aria-hidden className="size-3.5" />
                {job.location}
              </span>
              <span className={chipClass}>
                <Clock aria-hidden className="size-3.5" />
                {job.employmentType}
              </span>
            </div>
          </div>
          {applicationStatuses[job.id] ? (
            <Button asChild variant="pill-outline" size="pill-sm" className="shrink-0 self-start sm:self-auto">
              <Link href="/careers/applications">
                View application
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="pill-outline" size="pill-sm" className="shrink-0 self-start sm:self-auto">
              <Link href={`/careers/${job.id}`}>
                View &amp; apply
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
