import { ArrowRight, Heart, Star, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { HeroCarousel } from "@/components/features/careers/hero-carousel";
import { eyebrowClass } from "@/components/features/about/section-heading";
import { Button } from "@/components/ui/button";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Select } from "@/components/ui/select";
import { careersSession } from "@/lib/careers/auth";
import { createJobPostingStore } from "@/lib/careers/job-postings";
import { getCareersDatabase } from "@/lib/careers/db";
import { parseJobFilter } from "@/lib/validators/careers";
import { FilterField, FilterForm } from "@/app/(careers)/careers/_components/filter-form";
import { JobPostingsList } from "@/app/(careers)/careers/_components/job-postings-list";
import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";
import { CareersHeroActionsSkeleton, CareersListSkeleton } from "@/app/(careers)/careers/_components/skeletons";

type CareersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const reasons = [
  { icon: Heart, title: "A family business", text: "Grow with a team built on family, faith and perseverance." },
  { icon: Star, title: "Proudly Filipino", text: "Help bring authentic ube flavors closer to every home." },
  { icon: User, title: "Real impact", text: "Support local communities and better income for Filipino farmers." },
];

function Filter({ label, name, allLabel, options, selected }: {
  label: string;
  name: string;
  allLabel: string;
  options: string[];
  selected?: string;
}) {
  return (
    <FilterField name={name}>
      <label htmlFor={`filter-${name}`} className={fieldLabelClass}>{label}</label>
      <Select id={`filter-${name}`} name={name} defaultValue={selected ?? ""} className={fieldClass}>
        <option value="">{allLabel}</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </Select>
    </FilterField>
  );
}

async function HeroActions() {
  const applicant = await careersSession();
  if (applicant) {
    return (
      <Button asChild variant="pill" size="pill-lg">
        <Link href="/careers/applications">
          Your applications
          <ArrowRight aria-hidden className="size-5" />
        </Link>
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button asChild variant="pill" size="pill-lg">
        <Link href="/careers/signup">
          Become an applicant
          <ArrowRight aria-hidden className="size-5" />
        </Link>
      </Button>
      <Button asChild variant="link" size="pill-lg" className="px-0 py-2.5">
        <Link href="/careers/signin">Applicant sign in</Link>
      </Button>
    </div>
  );
}

async function OpenRoles({ searchParams }: CareersPageProps) {
  const query = await searchParams;
  const filters = {
    department: parseJobFilter(query.department),
    employmentType: parseJobFilter(query.employmentType),
    location: parseJobFilter(query.location),
  };
  const store = createJobPostingStore(getCareersDatabase());
  const [postings, options] = await Promise.all([store.listOpen(filters), store.listOpenFilterOptions()]);

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-4">
        <p className={eyebrowClass}>Open roles</p>
        <h2 className="font-serif text-3xl leading-[1.2] text-primary sm:text-[40px]">
          {postings.length} {postings.length === 1 ? "position" : "positions"} open
        </h2>
      </div>

      <FilterForm
        chips={[
          { name: "department", label: "Department", selected: filters.department },
          { name: "employmentType", label: "Type", selected: filters.employmentType },
          { name: "location", label: "Location", selected: filters.location },
        ]}
        className="flex flex-col gap-4 rounded-[40px] border border-line bg-white p-6 lg:flex-row lg:items-end"
      >
        <Filter label="Department" name="department" allLabel="All departments" options={options.departments} selected={filters.department} />
        <Filter label="Employment type" name="employmentType" allLabel="All types" options={options.employmentTypes} selected={filters.employmentType} />
        <Filter label="Location" name="location" allLabel="All locations" options={options.locations} selected={filters.location} />
        <div className="flex items-center gap-4">
          <SubmitButton
            pendingLabel="Filtering…"
            className="inline-flex items-center justify-center rounded-full bg-primary px-9 py-4 text-lg tracking-[0.45px] text-white transition-colors hover:bg-primary-container"
          >
            Filter roles
          </SubmitButton>
          <Button asChild variant="link" size="link-sm">
            <Link href="/careers">Clear</Link>
          </Button>
        </div>
      </FilterForm>

      <JobPostingsList jobs={postings} />
    </div>
  );
}

export default function CareersPage(props: CareersPageProps) {
  return (
    <>
      <section className="mx-auto w-full max-w-[1440px] px-5 pb-[100px] pt-[60px] sm:px-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_560px]">
          <div className="flex flex-col justify-center gap-7 rounded-[40px] bg-lavender-soft p-8 sm:p-[60px]">
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
            <Suspense fallback={<CareersHeroActionsSkeleton />}>
              <HeroActions />
            </Suspense>
          </div>
          <HeroCarousel />
        </div>
      </section>

      <section id="open-roles" className="mx-auto w-full max-w-[1440px] scroll-mt-6 px-5 pb-[100px] pt-20 sm:px-10">
        <Suspense fallback={<CareersListSkeleton />}>
          <OpenRoles {...props} />
        </Suspense>
      </section>

      <section id="life" className="mx-auto w-full max-w-[1440px] scroll-mt-6 px-5 pb-[100px] pt-20 sm:px-10">
        <div className="flex flex-col gap-4">
          <p className={eyebrowClass}>Life at Bren Raphael&apos;s</p>
          <h2 className="font-serif text-3xl leading-[1.2] text-primary sm:text-[40px]">Why work with us</h2>
        </div>
        <ul className="mt-[30px] grid gap-5 md:grid-cols-3">
          {reasons.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col items-start gap-3.5 rounded-[40px] bg-surface-soft p-9">
              <span aria-hidden className="flex size-[52px] items-center justify-center rounded-full bg-white text-primary">
                <Icon className="size-[23px]" strokeWidth={1.5} />
              </span>
              <h3 className="font-serif text-[22px] leading-[1.3] text-primary">{title}</h3>
              <p className="text-sm leading-normal tracking-[0.35px] text-body">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
