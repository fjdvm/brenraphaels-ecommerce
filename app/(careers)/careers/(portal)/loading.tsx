import { CareersHeroActionsSkeleton, CareersListSkeleton } from "@/app/(careers)/careers/_components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 pb-[100px] pt-[60px] sm:px-10" aria-hidden="true">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_560px]">
        <div className="flex flex-col justify-center gap-7 rounded-[40px] bg-lavender-soft p-8 sm:p-[60px]">
          <Skeleton className="h-[339px] w-full" />
          <CareersHeroActionsSkeleton />
        </div>
        <Skeleton className="min-h-[320px] rounded-[40px] lg:min-h-[560px]" />
      </div>
      <div className="pt-20">
        <CareersListSkeleton />
      </div>
    </section>
  );
}
