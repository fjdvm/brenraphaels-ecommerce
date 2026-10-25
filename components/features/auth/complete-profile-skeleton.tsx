import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton shown immediately while the visitor and form defaults resolve. */
export function CompleteProfilePageSkeleton() {
  return (
    <section className="bg-surface-container-low px-5 py-12 sm:px-8 sm:py-16" aria-hidden="true">
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </section>
  );
}
