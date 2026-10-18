import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the Cart and session resolve; shaped like the loaded Cart page. */
export function CartSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 pb-[100px] pt-10 sm:px-10 lg:pt-[60px]" aria-hidden="true">
      <Skeleton className="h-[18px] w-24" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[18px] w-24" />
        <Skeleton className="h-[65px] w-48" />
      </div>
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-7">
          <Skeleton className="h-[72px] w-full" />
          <Skeleton className="h-[72px] w-full" />
        </div>
        <Skeleton className="h-[420px] w-full rounded-[40px] lg:w-[460px]" />
      </div>
    </div>
  );
}
