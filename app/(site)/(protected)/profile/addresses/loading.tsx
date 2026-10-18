import { AddressBookHeading } from "@/components/features/customer/address-book-heading";
import { AddressesSkeleton } from "@/components/features/customer/skeletons";

export default function Loading() {
  return (
    <section className="flex flex-col gap-[30px]">
      <AddressBookHeading />
      <AddressesSkeleton />
    </section>
  );
}
