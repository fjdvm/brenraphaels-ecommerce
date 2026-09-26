import type { Metadata } from "next";

import { AddressForms } from "@/components/features/customer/address-forms";
import { ContactNumberForm } from "@/components/features/customer/contact-number-form";
import { Card } from "@/components/ui/card";
import { requireCustomer } from "@/lib/customer/current-visitor";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const customer = await requireCustomer();

  return (
    <section className="bg-surface-container-low px-5 py-12 sm:px-8 sm:py-16">
      <Card className="mx-auto max-w-2xl rounded-2xl p-6 shadow-sm sm:p-8">
        <h1 className="font-serif text-4xl text-primary">Your profile</h1>
        <dl className="mt-6 space-y-4">
          <Detail label="Full name" value={customer.fullName} />
        </dl>
        <ContactNumberForm
          email={customer.email}
          contactNumber={customer.contactNumber}
        />

        <h2 className="mt-8 border-t border-outline-variant/60 pt-6 font-serif text-2xl text-primary">
          Addresses
        </h2>
        <AddressForms addresses={customer.addresses} />
      </Card>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-on-surface-variant">{label}</dt>
      <dd className="text-lg text-on-surface">{value}</dd>
    </div>
  );
}
