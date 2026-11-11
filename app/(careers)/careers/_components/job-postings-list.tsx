import { ArrowRight, Briefcase, Clock, MapPin, Search } from "lucide-react";
import Link from "next/link";

import { eyebrowClass } from "@/components/features/about/section-heading";
import { Button } from "@/components/ui/button";
import type { JobPosting } from "@/lib/careers/job-postings";

const chipClass = "flex items-center gap-1.5 rounded-full bg-surface-soft px-2.5 py-1 text-xs tracking-[0.35px] text-body";

/** Eyebrow, section title and the number of Open Job Postings, as in the design. */
export function OpenRolesHeading({ count, filtered = false }: { count: number; filtered?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={eyebrowClass}>Open roles</p>
      <h2 className="font-serif text-3xl leading-[1.2] text-primary sm:text-[32px]">
        {count} {count === 1 ? "position" : "positions"} {filtered ? "match" : "open"}
      </h2>
    </div>
  );
}

/** `applicationStatuses` maps Job Posting id to the signed-in Applicant's Application status; omit it for signed-out visitors. */
export function JobPostingsList({ jobs, applicationStatuses = {}, filtered = false }: { jobs: JobPosting[]; applicationStatuses?: Record<string, string>; filtered?: boolean }) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3.5 rounded-[40px] border border-line bg-white px-6 py-10 text-center sm:px-10 sm:py-14">
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-lavender text-primary sm:size-16">
          <Search className="size-6 sm:size-[26px]" />
        </span>
        <h3 className="font-serif text-2xl leading-[1.25] text-primary sm:text-[28px]">
          {filtered ? "No roles match these filters" : "No open roles right now"}
        </h3>
        <p className="max-w-xl leading-[1.6] tracking-[0.35px] text-body">
          {filtered
            ? "Try another department or employment type, or get an email when a matching role opens."
            : "There are no open Job Postings at the moment. Check back soon, or get an email when a role opens."}
        </p>
        <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {filtered ? (
            <Button asChild variant="pill" size="pill-lg">
              <Link href="/careers">Clear filters</Link>
            </Button>
          ) : null}
          <Button asChild variant="pill-outline" size="pill-lg">
            <Link href="/careers/profile">Email me new roles</Link>
          </Button>
        </div>
      </div>
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
