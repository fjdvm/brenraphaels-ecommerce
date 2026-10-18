import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AddressForms } from "@/components/features/customer/address-forms";
import { AddressesSkeleton } from "@/components/features/customer/skeletons";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
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
      <PageHeading
        aside={
          <Button asChild size="pill-lg" variant="pill">
            <Link href="/profile/addresses?add=1" scroll={false}>
              Add address
              <ArrowRight aria-hidden className="size-5" />
            </Link>
          </Button>
        }
        eyebrow="My account"
        title="Address book"
      >
        <p className="tracking-[0.35px] text-body">Manage where we deliver your orders.</p>
      </PageHeading>
      <Suspense fallback={<AddressesSkeleton />}>
        <AddressBookContent />
      </Suspense>
    </section>
  );
}
