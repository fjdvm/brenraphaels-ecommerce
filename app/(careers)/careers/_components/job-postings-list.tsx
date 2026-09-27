"use client";

import Link from "next/link";
import { useState } from "react";
import type { JobPosting } from "@/lib/careers/job-postings";

export function JobPostingsList({ jobs }: { jobs: JobPosting[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (jobs.length === 0) {
    return (
      <p className="rounded-(--radius-md) border border-outline-variant bg-surface-card px-5 py-8 text-sm text-on-surface-variant">
        There are no open Job Postings matching those filters.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-(--radius-md) border border-outline-variant bg-surface-card">
      <div className="grid grid-cols-[2fr_1.5fr_1fr_auto] gap-4 border-b border-outline-variant px-5 py-3 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
        <span>Position</span>
        <span>Location</span>
        <span>Type</span>
        <span aria-hidden />
      </div>

      {jobs.map((job) => {
        const isOpen = openId === job.id;
        return (
          <div key={job.id} className="border-b border-outline-variant last:border-b-0">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : job.id)}
              aria-expanded={isOpen}
              className="grid w-full grid-cols-[2fr_1.5fr_1fr_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-container-low"
            >
              <span>
                <span className="block font-semibold text-on-surface">{job.title}</span>
                <span className="block text-xs text-on-surface-variant">{job.department}</span>
              </span>
              <span className="text-on-surface-variant">{job.location}</span>
              <span className="text-on-surface-variant">{job.employmentType}</span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-on-primary transition-colors ${isOpen ? "bg-primary" : "bg-secondary"}`}
                aria-hidden
              >
                {isOpen ? "−" : "+"}
              </span>
            </button>

            {isOpen ? (
              <div className="grid grid-cols-[2fr_2.5fr] gap-4 px-5 pb-6">
                <span aria-hidden />
                <div className="text-sm text-on-surface-variant">
                  <p>{job.description}</p>

                  <p className="mt-4 font-semibold text-on-surface">Requirements:</p>
                  <p className="mt-1 whitespace-pre-line">{job.requirements}</p>

                  {job.requiredDocuments.length > 0 ? (
                    <>
                      <p className="mt-4 font-semibold text-on-surface">Required documents:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {job.requiredDocuments.map((document) => (
                          <li key={document}>{document}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  <p className="mt-4">Apply by {job.deadline.toLocaleDateString()}</p>

                  <Link
                    href={`/careers/${job.id}`}
                    className="mt-4 inline-block font-semibold text-primary underline"
                  >
                    View full posting
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
