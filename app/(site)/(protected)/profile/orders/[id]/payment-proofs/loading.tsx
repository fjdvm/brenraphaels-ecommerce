import { PageHeading } from "@/components/ui/page-heading";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow="My orders" title="Payment proofs" />
      <div aria-hidden="true" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton className="h-[560px]" key={key} />
        ))}
      </div>
    </section>
  );
}
