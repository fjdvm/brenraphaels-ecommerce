import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for the Ticket list and the open-Ticket form while they load. */
export function SupportContentSkeleton() {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]" aria-hidden="true">
      <div>
        <Skeleton className="h-8 w-40" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
      <div className="space-y-4 rounded-md border border-outline-variant/60 bg-surface-card p-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/** Placeholder for one Ticket's header and Message thread while they load. */
export function TicketDetailSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
