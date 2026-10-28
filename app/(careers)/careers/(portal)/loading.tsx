import { CareersListSkeleton } from "@/app/(careers)/careers/_components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 pb-[100px] pt-[60px] sm:px-10" aria-hidden="true">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-[60px]">
        <div className="flex flex-col gap-7">
          <Skeleton className="h-[339px] w-full" />
          <Skeleton className="h-[59px] w-[287px] rounded-full" />
        </div>
        <Skeleton className="aspect-[4/3] rounded-[28px]" />
      </div>
      <div className="pt-20">
        <CareersListSkeleton />
      </div>
    </section>
  );
}
