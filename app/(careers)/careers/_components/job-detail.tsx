import { ArrowLeft, Calendar, Check, Clock, MapPin, Tag } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { JobPosting } from "@/lib/careers/job-postings";

const chipClass =
  "flex items-center gap-1.5 rounded-full border border-line bg-white py-1.5 pl-2.5 pr-3 text-[13px] font-medium text-ink";
const sectionHeadingClass = "text-xl font-semibold text-ink";

const formatDeadline = (deadline: Date) =>
  deadline.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** One entry per non-blank line, minus any leading bullet marker the HR author typed. */
export function requirementItems(requirements: string): string[] {
  return requirements
    .split("\n")
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className={chipClass}>
      {icon}
      {children}
    </li>
  );
}

/** Back link, title and the department, location, employment type and deadline chips, as in the design. */
export function JobDetailHeader({ posting, children }: { posting: JobPosting; children?: ReactNode }) {
  return (
    <header className="bg-surface-container-low">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-3.5 px-5 py-8 sm:px-10 lg:px-40">
        <Link href="/careers" className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ArrowLeft aria-hidden className="size-4" />
          All open roles
        </Link>
        <h1 className="text-3xl font-bold text-ink sm:text-[40px]">{posting.title}</h1>
        <ul className="flex flex-wrap items-center gap-2.5">
          <Chip icon={<Tag aria-hidden className="size-[15px] text-primary" />}>{posting.department}</Chip>
          <Chip icon={<MapPin aria-hidden className="size-[15px] text-primary" />}>{posting.location}</Chip>
          <Chip icon={<Clock aria-hidden className="size-[15px] text-primary" />}>{posting.employmentType}</Chip>
          <Chip icon={<Calendar aria-hidden className="size-[15px] text-primary" />}>
            Apply by {formatDeadline(posting.deadline)}
          </Chip>
        </ul>
        {children}
      </div>
    </header>
  );
}

/** About the role, then What we're looking for (omitted when the Job Posting has no requirements). */
export function JobDetailBody({ posting, children }: { posting: JobPosting; children?: ReactNode }) {
  const requirements = requirementItems(posting.requirements);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-5 pb-[72px] pt-10 sm:px-10 lg:px-40">
      <section className="flex flex-col gap-3">
        <h2 className={sectionHeadingClass}>About the role</h2>
        <p className="whitespace-pre-line leading-[26px] text-body">{posting.description}</p>
      </section>
      {requirements.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={sectionHeadingClass}>What we’re looking for</h2>
          <ul className="flex flex-col gap-3">
            {requirements.map((item) => (
              <li key={item} className="flex items-start gap-2.5 leading-[26px] text-ink">
                <span aria-hidden className="mt-[5px] flex size-4 shrink-0 items-center justify-center rounded-full bg-lavender-soft">
                  <Check className="size-2.5 text-primary" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
      {children}
    </div>
  );
}
