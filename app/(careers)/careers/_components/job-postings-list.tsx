import { ArrowRight, Clock, MapPin, Tag } from "lucide-react";
import Link from "next/link";

import { eyebrowClass } from "@/components/features/about/section-heading";
import { Button } from "@/components/ui/button";
import type { JobPosting } from "@/lib/careers/job-postings";

const detailClass = "flex items-center gap-1.5 text-sm tracking-[0.35px] text-body";

/** Eyebrow, section title and the number of Open Job Postings, as in the design. */
export function OpenRolesHeading({ count }: { count: number }) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-2">
        <p className={eyebrowClass}>Open roles</p>
        <h2 className="font-serif text-3xl leading-[1.2] text-primary sm:text-[32px]">
          Find your place in our kitchen
        </h2>
      </div>
      <p className="shrink-0 text-sm font-medium tracking-[0.35px] text-body">
        {count} open {count === 1 ? "role" : "roles"}
      </p>
    </div>
  );
}

export function JobPostingsList({ jobs }: { jobs: JobPosting[] }) {
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
          className="flex flex-col gap-4 rounded-2xl border border-line bg-white px-6 py-[22px] sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <h3 className="font-serif text-xl leading-[1.3] text-primary">{job.title}</h3>
            <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
              <span className={detailClass}>
                <Tag aria-hidden className="size-4" />
                {job.department}
              </span>
              <span className={detailClass}>
                <MapPin aria-hidden className="size-4" />
                {job.location}
              </span>
              <span className={detailClass}>
                <Clock aria-hidden className="size-4" />
                {job.employmentType}
              </span>
            </div>
          </div>
          <Button asChild variant="pill" size="pill-sm" className="shrink-0 self-start sm:self-auto">
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
