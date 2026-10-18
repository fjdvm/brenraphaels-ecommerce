import type { Metadata } from "next";
import { Suspense } from "react";

import { AddressBookHeading } from "@/components/features/customer/address-book-heading";
import { AddressForms } from "@/components/features/customer/address-forms";
import { AddressesSkeleton } from "@/components/features/customer/skeletons";
import { listProvinces } from "@/lib/address/locations";
import { requireCustomer } from "@/lib/customer/current-visitor";

export const metadata: Metadata = { title: "Address book" };

async function AddressBookContent() {
  const customer = await requireCustomer();
  return (
    <AddressForms
      addresses={customer.addresses}
      provinces={listProvinces()}
      recipient={{ name: customer.fullName, contactNumber: customer.contactNumber }}
    />
  );
}

export default function AddressBookPage() {
  return (
    <section className="flex flex-col gap-[30px]">
      <AddressBookHeading />
      <Suspense fallback={<AddressesSkeleton />}>
        <AddressBookContent />
      </Suspense>
    </section>
  );
}
