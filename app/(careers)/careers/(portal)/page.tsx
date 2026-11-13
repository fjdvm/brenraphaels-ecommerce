import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { HeroImages } from "@/components/features/careers/hero-images";
import { HowHiringWorks } from "@/components/features/careers/how-hiring-works";
import { WhyWorkWithUs } from "@/components/features/careers/why-work-with-us";
import { eyebrowClass } from "@/components/features/about/section-heading";
import { Button } from "@/components/ui/button";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createJobPostingStore } from "@/lib/careers/job-postings";
import { createApplicationStore } from "@/lib/careers/applications";
import { careersSession } from "@/lib/careers/auth";
import { getCareersDatabase } from "@/lib/careers/db";
import { parseJobFilter } from "@/lib/validators/careers";
import { FilterField, FilterForm } from "@/app/(careers)/careers/_components/filter-form";
import { JobPostingsList, OpenRolesHeading } from "@/app/(careers)/careers/_components/job-postings-list";
import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";
import { CareersListSkeleton } from "@/app/(careers)/careers/_components/skeletons";

type CareersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function Filter({ label, name, allLabel, options, selected }: {
  label: string;
  name: string;
  allLabel: string;
  options: string[];
  selected?: string;
}) {
  return (
    <FilterField>
      <label htmlFor={`filter-${name}`} className={fieldLabelClass}>{label}</label>
      <Select id={`filter-${name}`} name={name} defaultValue={selected ?? ""} className={cn(fieldClass, "rounded-none px-3.5 py-[11px]")}>
        <option value="">{allLabel}</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </Select>
    </FilterField>
  );
}

async function OpenRoles({ searchParams }: CareersPageProps) {
  const query = await searchParams;
  const filters = {
    department: parseJobFilter(query.department),
    employmentType: parseJobFilter(query.employmentType),
    location: parseJobFilter(query.location),
  };
  const isFiltered = Boolean(filters.department || filters.employmentType || filters.location);
  const db = getCareersDatabase();
  const store = createJobPostingStore(db);
  const [postings, allOpen, options, applicant] = await Promise.all([store.listOpen(filters), store.listOpen(), store.listOpenFilterOptions(), careersSession()]);
  const applicationStatuses = applicant ? await createApplicationStore(db).statusesByPostingForApplicant(applicant.userId) : {};

  return (
    <div className="flex flex-col gap-6">
      <OpenRolesHeading count={postings.length} filtered={isFiltered} />

      <FilterForm
        groups={[
          { name: "department", label: "Department", allLabel: "All", options: options.departments },
          { name: "employmentType", label: "Employment type", allLabel: "All", options: options.employmentTypes },
          { name: "location", label: "Location", allLabel: "All locations", options: options.locations },
        ]}
        selected={filters}
        postings={allOpen.map(({ department, employmentType, location }) => ({ department, employmentType, location }))}
        className="flex flex-col gap-4 border border-line bg-white p-4 lg:flex-row lg:items-end lg:gap-3"
      >
        <Filter label="Department" name="department" allLabel="All departments" options={options.departments} selected={filters.department} />
        <Filter label="Employment type" name="employmentType" allLabel="All types" options={options.employmentTypes} selected={filters.employmentType} />
        <FilterField>
          <Combobox
            label="Location"
            name="location"
            placeholder="All locations"
            emptyMessage="No locations with open roles"
            options={options.locations.map((location) => ({ value: location, label: location }))}
            defaultValue={filters.location}
            className="gap-2"
            inputClassName="rounded-none px-3.5 py-[11px]"
          />
        </FilterField>
        <div className="flex items-center gap-1">
          <SubmitButton
            pendingLabel="Filtering…"
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-[9px] text-sm font-medium tracking-[0.35px] text-white transition-colors hover:bg-primary-container"
          >
            Filter roles
          </SubmitButton>
          <Button asChild variant="link" size="link-sm" className="px-3">
            <Link href="/careers">Clear</Link>
          </Button>
        </div>
      </FilterForm>

      <JobPostingsList jobs={postings} applicationStatuses={applicationStatuses} filtered={isFiltered} />
    </div>
  );
}

export default function CareersPage(props: CareersPageProps) {
  return (
    <>
      <section className="mx-auto w-full max-w-[1440px] px-5 pb-[100px] pt-[60px] sm:px-10">
        <div className="grid items-stretch gap-10 lg:grid-cols-2 lg:gap-[60px]">
          <div className="flex flex-col justify-center gap-7 bg-lavender-soft p-8 sm:p-[60px]">
            <div className="flex max-w-[660px] flex-col gap-4">
              <p className={eyebrowClass}>Careers at Bren Raphael&apos;s</p>
              <h1 className="font-serif text-5xl leading-[1.1] text-primary sm:text-7xl">
                Join our small-batch kitchen.
              </h1>
              <p className="leading-[1.6] tracking-[0.35px] text-body">
                Help us bring Bren Raphael&apos;s Ube Jam &amp; Halaya to more homes — and grow a Filipino
                brand rooted in family, faith and real ube.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button asChild variant="pill" size="pill-lg">
                <Link href="#open-roles">
                  See open roles
                  <ArrowRight aria-hidden className="size-5" />
                </Link>
              </Button>
              <Button asChild variant="pill-outline" size="pill-lg">
                <Link href="#how-hiring-works">How hiring works</Link>
              </Button>
            </div>
          </div>
          <HeroImages />
        </div>
      </section>

      <section id="open-roles" className="mx-auto w-full max-w-[1440px] scroll-mt-6 px-5 pb-[100px] pt-20 sm:px-10">
        <Suspense fallback={<CareersListSkeleton />}>
          <OpenRoles {...props} />
        </Suspense>
      </section>

      <WhyWorkWithUs />

      <HowHiringWorks />
    </>
  );
}
