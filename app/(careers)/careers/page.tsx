import Link from "next/link";

import { careersSession } from "@/lib/careers/auth";
import { createJobPostingStore } from "@/lib/careers/job-postings";
import { getCareersDatabase } from "@/lib/careers/db";
import { parseJobFilter } from "@/lib/validators/careers";
import { BackLink } from "./_components/back-link";
import { FilterForm } from "./_components/filter-form";
import { JobPostingsList } from "./_components/job-postings-list";
import { SubmitButton } from "./_components/submit-button";

type CareersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function Filter({ label, name, options, selected }: {
  label: string;
  name: string;
  options: string[];
  selected?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-on-surface">
      {label}
      <select name={name} defaultValue={selected ?? ""} className="border border-outline-variant bg-surface-card px-3 py-2 text-on-surface">
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default async function CareersPage({ searchParams }: CareersPageProps) {
  const query = await searchParams;
  const filters = {
    department: parseJobFilter(query.department),
    employmentType: parseJobFilter(query.employmentType),
    location: parseJobFilter(query.location),
  };
  const store = createJobPostingStore(getCareersDatabase());
  const [postings, options, applicant] = await Promise.all([
    store.listOpen(filters),
    store.listOpenFilterOptions(),
    careersSession(),
  ]);

  return (
    <section className="mx-auto max-w-4xl py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackLink href="/" className="text-sm text-on-surface-variant underline">
          Back
        </BackLink>

        <div className="flex gap-4">
          {applicant ? (
            <>
              <Link className="bg-primary px-5 py-3 font-semibold text-on-primary" href="/careers/profile">Your profile</Link>
              <Link className="px-5 py-3 font-semibold text-primary underline" href="/careers/applications">Your Applications</Link>
            </>
          ) : (
            <>
              <Link className="bg-primary px-5 py-3 font-semibold text-on-primary" href="/careers/signup">
                Become an Applicant
              </Link>
              <Link className="px-5 py-3 font-semibold text-primary underline" href="/careers/signin">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>

      <p className="mt-8 font-serif text-lg text-primary">Bren Raphael&apos;s</p>
      <h1 className="mt-2 font-serif text-6xl text-primary sm:text-7xl">Career</h1>
      <p className="mt-5 max-w-xl text-on-surface-variant">
        Join our small-batch kitchen team and help us bring Bren Raphael&apos;s Ube Jam &amp; Halaya
        to more homes.
      </p>

      <FilterForm className="mt-10 grid gap-4 border border-outline-variant bg-surface-card p-5 sm:grid-cols-4">
        <Filter label="Department" name="department" options={options.departments} selected={filters.department} />
        <Filter label="Employment type" name="employmentType" options={options.employmentTypes} selected={filters.employmentType} />
        <Filter label="Location" name="location" options={options.locations} selected={filters.location} />
        <div className="flex items-end gap-3">
          <SubmitButton pendingLabel="Filtering…" className="bg-primary px-4 py-2 font-semibold text-on-primary">Filter roles</SubmitButton>
          <Link href="/careers" className="px-2 py-2 font-semibold text-primary underline">Clear</Link>
        </div>
      </FilterForm>

      <div className="mt-8">
        <JobPostingsList jobs={postings} isAuthenticated={Boolean(applicant)} />
      </div>
    </section>
  );
}
