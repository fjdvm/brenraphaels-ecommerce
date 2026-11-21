import { Skeleton } from "@/components/ui/skeleton";

export function OrdersSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-[30px]">
      <div className="flex gap-2.5">
        {[56, 80, 104, 150, 104].map((width) => (
          <Skeleton className="h-[38px] rounded-full" key={width} style={{ width }} />
        ))}
      </div>
      <Skeleton className="h-[640px]" />
      <Skeleton className="h-[260px]" />
      <Skeleton className="h-[130px]" />
    </div>
  );
}

export function DeliveriesSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <Skeleton className="h-[150px]" />
      <Skeleton className="h-[150px]" />
      <Skeleton className="h-[150px]" />
    </div>
  );
}

export function DeliveryMapSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-[38px] w-[200px] rounded-full" />
        <Skeleton className="h-[38px] w-[90px]" />
      </div>
      <Skeleton className="h-[calc(100dvh-280px)] min-h-[420px]" />
    </div>
  );
}

export function AddressesSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-[30px]">
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-[190px]" />
        <Skeleton className="h-[190px]" />
      </div>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-[30px]">
      <div className="flex gap-2.5">
        {[48, 88, 76, 84].map((width) => (
          <Skeleton className="h-[38px] rounded-full" key={width} style={{ width }} />
        ))}
      </div>
      <Skeleton className="h-[460px]" />
      <Skeleton className="h-[200px]" />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <Skeleton className="h-[246px]" />
      <Skeleton className="h-[246px]" />
      <Skeleton className="h-[246px]" />
      <Skeleton className="h-[246px]" />
    </div>
  );
}
