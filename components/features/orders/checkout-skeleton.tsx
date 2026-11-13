import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the Cart, Addresses and Customer resolve; shaped like the loaded checkout. */
export function CheckoutSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 pb-[100px] pt-10 sm:px-10 lg:pt-[60px]" aria-hidden="true">
      <Skeleton className="h-[18px] w-44" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[18px] w-28" />
        <Skeleton className="h-[65px] w-64" />
      </div>
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-6">
          <Skeleton className="h-[190px] w-full" />
          <Skeleton className="h-[260px] w-full" />
        </div>
        <Skeleton className="h-[460px] w-full lg:w-[460px]" />
      </div>
    </div>
  );
}
