import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function UnsubscribeCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-h-[calc(100vh-12rem)] items-center px-5 py-12 sm:px-8 sm:py-16">
      <Card className="mx-auto w-full max-w-xl p-8 text-center shadow-sm">{children}</Card>
    </section>
  );
}

export function UnsubscribeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-label="Unsubscribing">
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-2/3" />
    </div>
  );
}
