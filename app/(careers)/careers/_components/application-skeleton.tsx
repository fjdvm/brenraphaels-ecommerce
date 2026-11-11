import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the header, stepper and two columns of a single Application page; used by both loading.tsx and the Suspense fallback. */
export function ApplicationPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pb-[100px] pt-5 sm:px-10 sm:pt-10" aria-hidden="true">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-[40px] w-full max-w-[520px] sm:h-[65px]" />
      <Skeleton className="h-5 w-full max-w-[420px]" />
      <Skeleton className="h-[74px] rounded-3xl sm:h-[84px] sm:rounded-[40px]" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Skeleton className="h-[280px] w-full rounded-[28px] sm:rounded-[40px] lg:flex-1" />
        <div className="flex w-full flex-col gap-5 lg:w-[440px] lg:shrink-0">
          <Skeleton className="h-[200px] rounded-[28px] sm:rounded-[40px]" />
          <Skeleton className="h-[190px] rounded-[28px] sm:rounded-[40px]" />
        </div>
      </div>
    </div>
  );
}
