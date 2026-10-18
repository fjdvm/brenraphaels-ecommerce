import { AddressesSkeleton } from "@/components/features/customer/skeletons";
import { PageHeading } from "@/components/ui/page-heading";

export default function Loading() {
  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow="My account" title="Address book">
        <p className="tracking-[0.35px] text-body">Manage where we deliver your orders.</p>
      </PageHeading>
      <AddressesSkeleton />
    </section>
  );
}
