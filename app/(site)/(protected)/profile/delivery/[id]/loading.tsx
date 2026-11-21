import { DeliveryMapSkeleton } from "@/components/features/customer/skeletons";
import { PageHeading } from "@/components/ui/page-heading";

export default function Loading() {
  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow="Delivery" title="Track Order" />
      <DeliveryMapSkeleton />
    </section>
  );
}
