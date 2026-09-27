import Link from "next/link";

import { createJobPostingStore } from "@/lib/careers/job-postings";
import { getCareersDatabase } from "@/lib/careers/db";
import { BackLink } from "./_components/back-link";
import { JobPostingsList } from "./_components/job-postings-list";

type CareersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleSearchParameter(parameter: string | string[] | undefined) {
  return typeof parameter === "string" ? parameter : undefined;
}

function Filter({ label, name, options, selected }: {
  label: string;
  name: string;
  options: string[];
  selected?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-on-surface">
      {label}
      <select name={name} defaultValue={selected ?? ""} className="rounded-(--radius-sm) border border-outline-variant bg-surface-card px-3 py-2 text-on-surface">
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default async function CareersPage({ searchParams }: CareersPageProps) {
  const query = await searchParams;
  const filters = {
    department: singleSearchParameter(query.department),
    employmentType: singleSearchParameter(query.employmentType),
    location: singleSearchParameter(query.location),
  };
  const store = createJobPostingStore(getCareersDatabase());
  const [postings, options] = await Promise.all([
    store.listOpen(filters),
    store.listOpenFilterOptions(),
  ]);

  return (
    <section className="mx-auto max-w-4xl py-16">
      <BackLink fallbackHref="/" className="text-sm text-on-surface-variant underline">
        Back
      </BackLink>

      <p className="mt-8 font-serif text-lg text-primary">Bren Raphael&apos;s</p>
      <h1 className="mt-2 font-serif text-6xl text-primary sm:text-7xl">Career</h1>
      <p className="mt-5 max-w-xl text-on-surface-variant">
        Join our small-batch kitchen team and help us bring Bren Raphael&apos;s Ube Jam &amp; Halaya
        to more homes.
      </p>

      <form className="mt-10 grid gap-4 rounded-(--radius-md) border border-outline-variant bg-surface-card p-5 sm:grid-cols-4">
        <Filter label="Department" name="department" options={options.departments} selected={filters.department} />
        <Filter label="Employment type" name="employmentType" options={options.employmentTypes} selected={filters.employmentType} />
        <Filter label="Location" name="location" options={options.locations} selected={filters.location} />
        <div className="flex items-end gap-3">
          <button className="rounded-(--radius-sm) bg-primary px-4 py-2 font-semibold text-on-primary">Filter roles</button>
          <Link href="/careers" className="px-2 py-2 font-semibold text-primary underline">Clear</Link>
        </div>
      </form>

      <div className="mt-8">
        <JobPostingsList jobs={postings} />
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-outline-variant pt-8">
        <p className="max-w-sm text-on-surface-variant">
          Don&apos;t see the right fit yet? Build a reusable Applicant profile and be ready when new
          openings post.
        </p>
        <div className="flex gap-4">
          <Link
            className="rounded-(--radius-sm) bg-primary px-5 py-3 font-semibold text-on-primary"
            href="/careers/signup"
          >
            Become an Applicant
          </Link>
          <Link className="px-5 py-3 font-semibold text-primary underline" href="/careers/signin">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
