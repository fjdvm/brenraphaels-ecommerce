import type { Metadata } from "next";

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
          <Detail label="Email" value={customer.email} />
          <Detail label="Contact number" value={customer.contactNumber} />
        </dl>

        <h2 className="mt-8 border-t border-outline-variant/60 pt-6 font-serif text-2xl text-primary">
          Addresses
        </h2>
        <ul className="mt-4 space-y-4">
          {customer.addresses.map((address, index) => (
            <li
              key={index}
              className="rounded-xl border border-outline-variant/60 p-4 text-on-surface"
            >
              <p className="font-semibold">
                {address.label}
                {address.isDefault ? (
                  <span className="ml-2 rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-secondary">
                    Default address
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-on-surface-variant">
                {address.street}, {address.barangay}
                <br />
                {address.city}, {address.province} {address.postalCode}
                <br />
                {address.country}
              </p>
            </li>
          ))}
        </ul>
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
