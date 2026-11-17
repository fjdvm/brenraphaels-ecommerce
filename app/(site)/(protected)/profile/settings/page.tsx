import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactNumberForm } from "@/components/features/customer/contact-number-form";
import { CustomerNameForm } from "@/components/features/customer/customer-name-form";
import { DeleteAccountCard } from "@/components/features/customer/delete-account-card";
import { PasswordResetCardForm } from "@/components/features/customer/password-reset-card-form";
import { SettingsCard } from "@/components/features/customer/settings-card";
import { SettingsSkeleton } from "@/components/features/customer/skeletons";
import { PageHeading } from "@/components/ui/page-heading";
import { requireCustomer } from "@/lib/customer/current-visitor";

export const metadata: Metadata = { title: "Account settings" };

async function SettingsContent() {
  const customer = await requireCustomer();

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard
        title="Personal information"
        description="Keep your name up to date so we can personalise your orders."
      >
        <CustomerNameForm
          firstName={customer.firstName}
          middleName={customer.middleName}
          lastName={customer.lastName}
        />
      </SettingsCard>
      <SettingsCard
        title="Contact details"
        description="Your email is used to sign in and can't be changed here."
      >
        <ContactNumberForm email={customer.email} contactNumber={customer.contactNumber} />
      </SettingsCard>
      <SettingsCard title="Password" description="Use at least 8 characters with an uppercase letter, a number and a symbol.">
        <PasswordResetCardForm email={customer.email} />
      </SettingsCard>
      <SettingsCard title="Delete account" description="Close your account. This can't be done while an order, return or ticket is still in progress.">
        <DeleteAccountCard />
      </SettingsCard>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow="My account" title="Account settings" />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </section>
  );
}
