import type { Metadata } from "next";

import { ContactNumberForm } from "@/components/features/customer/contact-number-form";
import { CustomerNameForm } from "@/components/features/customer/customer-name-form";
import { Card } from "@/components/ui/card";
import { requireCustomer } from "@/lib/customer/current-visitor";

export const metadata: Metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const customer = await requireCustomer();

  return (
    <Card className="p-6 shadow-sm sm:p-10">
      <h2 className="font-serif text-3xl text-primary">My details</h2>
      <section className="mt-8 border-b border-outline-variant/60 pb-8">
        <h3 className="text-lg font-bold text-on-surface">
          Personal information
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">
          Keep your name up to date so we can personalise your orders and
          account communications.
        </p>
        <div className="mt-6">
          <CustomerNameForm
            firstName={customer.firstName}
            middleName={customer.middleName}
            lastName={customer.lastName}
          />
        </div>
      </section>
      <section className="pt-8">
        <h3 className="text-lg font-bold text-on-surface">Contact details</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">
          Your email address is used to sign in and cannot be changed here.
        </p>
        <div className="mt-6 max-w-xl">
          <ContactNumberForm
            email={customer.email}
            contactNumber={customer.contactNumber}
          />
        </div>
      </section>
    </Card>
  );
}
