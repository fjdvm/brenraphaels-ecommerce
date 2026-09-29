import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the job list, filters, and applicant session resolve on the careers list page. */
export function CareersListSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex gap-4">
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-32" />
      </div>
      <Skeleton className="mt-10 h-24 w-full" />
      <div className="mt-8 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

/** Shown while a single job posting and applicant session resolve. */
export function CareersDetailSkeleton() {
  return (
    <article className="mx-auto max-w-4xl py-12 lg:py-20" aria-hidden="true">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-8 h-4 w-48" />
      <Skeleton className="mt-3 h-12 w-3/4" />
      <Skeleton className="mt-4 h-6 w-64" />
      <Skeleton className="mt-6 h-12 w-32" />
      <Skeleton className="mt-10 h-40 w-full" />
    </article>
  );
}

/** Shown while a careers form page's applicant/profile data resolves. */
export function CareersFormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-16" aria-hidden="true">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
