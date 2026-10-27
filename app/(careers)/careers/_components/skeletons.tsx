import { Skeleton } from "@/components/ui/skeleton";

/** Sized like the hero's two buttons so the hero doesn't shift once the Applicant session resolves. */
export function CareersHeroActionsSkeleton() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <Skeleton className="h-[59px] w-[287px] rounded-full" />
      <Skeleton className="h-[47px] w-[146px] rounded-full" />
    </div>
  );
}

/** Shown while the job list and filter options resolve on the careers list page. */
export function CareersListSkeleton() {
  return (
    <div className="flex flex-col gap-[30px]" aria-hidden="true">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[18px] w-24" />
        <Skeleton className="h-12 w-80 max-w-full" />
      </div>
      <Skeleton className="h-[127px] w-full rounded-[40px]" />
      <Skeleton className="h-[141px] w-full rounded-[40px]" />
      <Skeleton className="h-[141px] w-full rounded-[40px]" />
      <Skeleton className="h-[141px] w-full rounded-[40px]" />
    </div>
  );
}

/** Shown while a single job posting and applicant session resolve. */
export function CareersDetailSkeleton() {
  return (
    <article className="mx-auto max-w-4xl px-5 py-12 sm:px-8 lg:py-20" aria-hidden="true">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-8 h-4 w-48" />
      <Skeleton className="mt-3 h-12 w-3/4" />
      <Skeleton className="mt-4 h-6 w-64" />
      <Skeleton className="mt-6 h-12 w-32 rounded-full" />
      <Skeleton className="mt-10 h-40 w-full" />
    </article>
  );
}

/** Shown while a careers form page's applicant/profile data resolves. */
export function CareersFormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-5 py-16 sm:px-8" aria-hidden="true">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

/** Mirrors the heading row and card stack of the profile page so nothing shifts when it resolves. */
export function CareersProfileSkeleton() {
  return (
    <div className="px-5 pb-[100px] pt-[50px] sm:px-10" aria-hidden="true">
      <Skeleton className="h-[18px] w-16" />
      <Skeleton className="mt-4 h-[65px] w-full max-w-[598px]" />
      <Skeleton className="mt-4 h-[26px] w-full max-w-[520px]" />
      <div className="mt-[30px] grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[305px] rounded-[40px]" />
          <Skeleton className="h-[383px] rounded-[40px]" />
          <Skeleton className="h-[201px] rounded-[40px]" />
          <Skeleton className="h-[201px] rounded-[40px]" />
          <Skeleton className="h-[312px] rounded-[40px]" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[390px] rounded-[40px]" />
          <Skeleton className="h-[59px] rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Mirrors the heading row, empty-state card and steps of the applications page. */
export function CareersApplicationsSkeleton() {
  return (
    <div className="px-5 pt-[50px] sm:px-10" aria-hidden="true">
      <Skeleton className="h-[18px] w-16" />
      <Skeleton className="mt-4 h-[65px] w-full max-w-[480px]" />
      <Skeleton className="mt-4 h-[26px] w-full max-w-[480px]" />
      <Skeleton className="mt-[30px] h-[477px] rounded-[40px]" />
    </div>
  );
}

/** Mirrors the toolbar row and inbox card of the notifications page. */
export function CareersNotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="h-[420px] rounded-[40px]" />
    </div>
  );
}
