import Link from "next/link";

import { createJobPostingStore } from "@/lib/careers/job-postings";
import { getCareersDatabase } from "@/lib/careers/db";

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
    <section className="mx-auto max-w-7xl py-12 lg:py-20">
      <p className="font-serif text-lg text-primary">Bren Raphael&apos;s</p>
      <h1 className="mt-4 font-serif text-5xl text-primary">Careers</h1>
      <p className="mt-5 max-w-xl text-lg leading-8 text-on-surface-variant">Explore open roles with Bren Raphael&apos;s.</p>
      <form className="mt-10 grid gap-4 border border-outline-variant/60 bg-surface-card p-5 sm:grid-cols-4">
        <Filter label="Department" name="department" options={options.departments} selected={filters.department} />
        <Filter label="Employment type" name="employmentType" options={options.employmentTypes} selected={filters.employmentType} />
        <Filter label="Location" name="location" options={options.locations} selected={filters.location} />
        <div className="flex items-end gap-3"><button className="bg-primary px-4 py-2 font-semibold text-on-primary">Filter roles</button><Link href="/careers" className="px-2 py-2 font-semibold text-primary underline">Clear</Link></div>
      </form>
      {postings.length === 0 ? <p className="py-12 text-on-surface-variant">There are no open Job Postings matching those filters.</p> : <ul className="mt-8 grid gap-5">{postings.map((posting) => <li key={posting.id} className="border border-outline-variant/60 bg-surface-card p-6"><p className="text-sm font-semibold text-secondary">{posting.department} · {posting.location}</p><h2 className="mt-2 font-serif text-3xl text-primary"><Link href={`/careers/${posting.id}`} className="underline">{posting.title}</Link></h2><p className="mt-3 text-on-surface-variant">{posting.employmentType} · Apply by {posting.deadline.toLocaleDateString()}</p></li>)}</ul>}
    </section>
  );
}
