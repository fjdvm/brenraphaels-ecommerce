import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a Job Posting and the Applicant session resolve; sized like the hero, description card and Apply card. */
export function JobDetailSkeleton() {
  return (
    <article aria-hidden="true" className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 pb-[100px] pt-10 sm:px-10">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-[320px] w-full sm:h-[308px]" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Skeleton className="h-[560px] w-full lg:flex-1" />
        <Skeleton className="h-[640px] w-full lg:w-[460px] lg:shrink-0" />
      </div>
    </article>
  );
}
