import { ArrowRight, Briefcase, Clock, MapPin } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { JobPosting } from "@/lib/careers/job-postings";

const pillClass =
  "flex items-center gap-1.5 rounded-full bg-surface-soft py-1.5 pl-3 pr-3.5 text-xs tracking-[0.35px] text-body";

export function JobPostingsList({ jobs }: { jobs: JobPosting[] }) {
  if (jobs.length === 0) {
    return (
      <p className="rounded-[40px] border border-line bg-white px-8 py-10 text-sm tracking-[0.35px] text-body">
        There are no open Job Postings matching those filters.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-[30px]">
      {jobs.map((job) => (
        <li
          key={job.id}
          className="flex flex-col gap-5 rounded-[40px] border border-line bg-white p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8"
        >
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-lavender text-primary"
          >
            <Briefcase className="size-[25px]" strokeWidth={1.5} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <h3 className="font-serif text-2xl leading-[1.25] text-primary sm:text-[28px]">{job.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-lavender px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary">
                {job.department}
              </span>
              <span className={pillClass}>
                <MapPin aria-hidden className="size-3.5" />
                {job.location}
              </span>
              <span className={pillClass}>
                <Clock aria-hidden className="size-3.5" />
                {job.employmentType}
              </span>
            </div>
          </div>
          <Button asChild variant="pill-outline" size="pill-sm" className="shrink-0 self-start sm:self-auto">
            <Link href={`/careers/${job.id}`}>
              View &amp; apply
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
