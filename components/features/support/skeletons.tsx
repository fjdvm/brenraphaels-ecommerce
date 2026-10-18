import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for the inbox column while the Customer's Tickets load. */
export function SupportInboxSkeleton() {
  return (
    <div aria-hidden="true" className="hidden flex-col gap-4 border-r border-line p-6 lg:flex">
      <Skeleton className="h-11 rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-[38px] w-24 rounded-full" />
        <Skeleton className="h-[38px] w-28 rounded-full" />
      </div>
      <Skeleton className="h-[78px]" />
      <Skeleton className="h-[78px]" />
      <Skeleton className="h-[78px]" />
    </div>
  );
}

/** Placeholder for a conversation's header, thread and composer. */
export function ConversationSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-[600px] flex-col">
      <div className="flex flex-col gap-2 border-b border-line p-6 sm:px-8">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex flex-1 flex-col gap-5 p-8">
        <Skeleton className="h-20 w-2/3 rounded-3xl" />
        <Skeleton className="ml-auto h-12 w-1/3 rounded-3xl" />
        <Skeleton className="h-20 w-2/3 rounded-3xl" />
      </div>
      <div className="p-6">
        <Skeleton className="h-[60px] rounded-full" />
      </div>
    </div>
  );
}

/** Placeholder for the new-ticket form. */
export function NewTicketSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5 p-6 sm:p-[60px]">
      <Skeleton className="h-12 w-72 max-w-full" />
      <Skeleton className="h-6 w-96 max-w-full" />
      <Skeleton className="h-[50px]" />
      <Skeleton className="h-[44px] w-2/3" />
      <Skeleton className="h-[50px]" />
      <Skeleton className="h-[128px]" />
    </div>
  );
}
