import { Skeleton } from "@/components/ui/skeleton";

const card = "rounded-[40px]";

export function OrdersSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-[30px]">
      <div className="flex gap-2.5">
        {[56, 80, 104, 150, 104].map((width) => (
          <Skeleton className="h-[38px] rounded-full" key={width} style={{ width }} />
        ))}
      </div>
      <Skeleton className={`h-[640px] ${card}`} />
      <Skeleton className={`h-[260px] ${card}`} />
      <Skeleton className={`h-[130px] ${card}`} />
    </div>
  );
}

export function AddressesSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-[30px]">
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className={`h-[190px] ${card}`} />
        <Skeleton className={`h-[190px] ${card}`} />
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
      <Skeleton className={`h-[460px] ${card}`} />
      <Skeleton className={`h-[200px] ${card}`} />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <Skeleton className={`h-[246px] ${card}`} />
      <Skeleton className={`h-[246px] ${card}`} />
      <Skeleton className={`h-[246px] ${card}`} />
    </div>
  );
}
