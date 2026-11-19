import type { Metadata } from "next";
import { Suspense } from "react";

import { ContactNumberForm } from "@/components/features/customer/contact-number-form";
import { CustomerNameForm } from "@/components/features/customer/customer-name-form";
import { DeleteAccountCard } from "@/components/features/customer/delete-account-card";
import { PasswordResetCardForm } from "@/components/features/customer/password-reset-card-form";
import { SettingsCard } from "@/components/features/customer/settings-card";
import { SettingsSkeleton } from "@/components/features/customer/skeletons";
import { SeniorPwdIdForm } from "@/components/features/customer/senior-pwd-id-form";
import { PageHeading } from "@/components/ui/page-heading";
import { getDatabase } from "@/lib/db";
import { describeRule, loadDiscountRule } from "@/lib/senior-pwd/discount-rule";
import { latestVerification } from "@/lib/senior-pwd/store";
import { requireCustomer } from "@/lib/customer/current-visitor";

export const metadata: Metadata = { title: "Account settings" };

async function SeniorPwdSection({ customerId }: { customerId: string }) {
  const [verification, rule] = await Promise.all([latestVerification(getDatabase(), customerId), loadDiscountRule()]);
  const status = verification?.status;
  return (
    <SettingsCard
      title="Senior Citizen / PWD"
      description="Verified Senior Citizens and PWDs get a discount on every order, applied automatically at checkout."
    >
      {status === "approved" ? (
        <p className="text-sm leading-[1.6] tracking-[0.35px] text-ink" role="status">
          You&apos;re verified{verification?.expiresOn ? ` until ${verification.expiresOn}` : ""}. You get {describeRule(rule)} automatically. Bring your original ID when you pick up in store.
        </p>
      ) : status === "pending" ? (
        <p className="text-sm leading-[1.6] tracking-[0.35px] text-ink" role="status">
          We&apos;re checking your ID. Your orders are at full price until it&apos;s approved, and we&apos;ll email you the result.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {status ? (
            <p className="text-sm leading-[1.6] tracking-[0.35px] text-ink">
              {status === "expired" ? "Your last ID check has expired." : "Your last ID wasn't approved."} You can send an ID again below.
            </p>
          ) : null}
          <SeniorPwdIdForm />
        </div>
      )}
    </SettingsCard>
  );
}

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
      <SeniorPwdSection customerId={customer.userId} />
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
