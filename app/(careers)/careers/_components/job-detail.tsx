import { ArrowLeft, Briefcase, Calendar, Check, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ShareRoleButton } from "@/app/(careers)/careers/_components/share-role-button";
import type { JobPosting } from "@/lib/careers/job-postings";

const chipClass =
  "flex items-center gap-2 rounded-full bg-white py-2 pl-3 pr-3.5 text-sm text-body";
const sectionHeadingClass = "font-serif text-[22px] leading-[1.3] text-primary";

const formatDate = (date: Date, withYear: boolean) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

/** A line that is only a section label. HRMS saves the Qualifications box as "Qualifications:" plus its lines (older postings also carry "Responsibilities:"). */
const SECTION_LABEL = /^(qualifications|responsibilities):$/i;

/** One entry per non-blank line, minus any leading bullet marker the HR author typed and any line that is only a section label. */
export function requirementItems(requirements: string): string[] {
  return requirements
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !SECTION_LABEL.test(line))
    .map((line) => line.replace(/^[-*•]\s*/, ""))
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

/** A headed checklist section, omitted when there are no items (including Postings that predate the field). */
function CheckList({ heading, items }: { heading: string; items: string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className={sectionHeadingClass}>{heading}</h2>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3.5 leading-[1.6] text-body">
            <span aria-hidden className="mt-[3px] flex size-[22px] shrink-0 items-center justify-center rounded-full bg-lavender">
              <Check className="size-[13px] text-primary" />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Back link and the hero: eyebrow, title, optional tagline, chips and Share role. Rows without data are left out. */
export function JobDetailHeader({ posting, children }: { posting: JobPosting; children?: ReactNode }) {
  const iconClass = "size-4 text-primary";
  return (
    <header className="flex flex-col gap-6">
      <Link href="/careers" className="flex items-center gap-2 text-sm font-medium text-primary">
        <ArrowLeft aria-hidden className="size-[18px]" />
        All open roles
      </Link>
      <div className="flex flex-col gap-6 bg-lavender-soft px-6 py-8 sm:px-10 sm:py-12 lg:flex-row lg:items-end lg:gap-10 lg:px-[60px] lg:py-14">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-[18px]">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
            {posting.department} · {posting.location.split(",")[0]}
          </p>
          <h1 className="font-serif text-4xl leading-[1.2] text-primary sm:text-[54px]">{posting.title}</h1>
          {posting.tagline ? <p className="leading-[1.6] text-body">{posting.tagline}</p> : null}
          <ul className="flex flex-wrap gap-2">
            <Chip icon={<MapPin aria-hidden className={iconClass} />}>{posting.location}</Chip>
            <Chip icon={<Clock aria-hidden className={iconClass} />}>{posting.employmentType}</Chip>
            {posting.openings ? (
              <Chip icon={<Briefcase aria-hidden className={iconClass} />}>
                {posting.openings} {posting.openings === 1 ? "opening" : "openings"}
              </Chip>
            ) : null}
            <Chip icon={<Calendar aria-hidden className={iconClass} />}>
              Apply by {formatDate(posting.deadline, true)}
            </Chip>
          </ul>
        </div>
        <div className="flex shrink-0 flex-row items-center gap-3 lg:flex-col lg:items-end lg:gap-2.5">
          {posting.postedAt ? (
            <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-body">
              Posted {formatDate(posting.postedAt, false)}
            </span>
          ) : null}
          <ShareRoleButton
            title={posting.title}
            className="rounded-full border border-primary px-[22px] py-2.5 text-sm font-medium text-primary"
          />
        </div>
        {children}
      </div>
    </header>
  );
}

/** About the role, then What you'll do, What we're looking for and What you'll get (each omitted when empty), beside an optional Apply card. */
export function JobDetailBody({ posting, aside, children }: { posting: JobPosting; aside?: ReactNode; children?: ReactNode }) {
  const requirements = requirementItems(posting.requirements);

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-9 border border-line bg-white px-6 py-8 sm:px-[52px] sm:py-12">
        <section className="flex flex-col gap-4">
          <h2 className={sectionHeadingClass}>About the role</h2>
          <p className="whitespace-pre-line leading-[1.6] text-body">{posting.description}</p>
        </section>
        <CheckList heading="What you’ll do" items={posting.responsibilities} />
        <CheckList heading="What we’re looking for" items={requirements} />
        <CheckList heading="What you’ll get" items={posting.benefits} />
        {children}
      </div>
      {aside}
    </div>
  );
}
