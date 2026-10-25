import { Suspense } from "react";

import { VerifyEmailConfirmation } from "@/components/features/auth/verify-email-confirmation";
import {
  VerifyEmailFallback,
  VerifyEmailShell,
} from "@/components/features/auth/verify-email-shell";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

async function Confirmation({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  return <VerifyEmailConfirmation token={typeof token === "string" ? token : undefined} />;
}

export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  return (
    <VerifyEmailShell>
      <Suspense fallback={<VerifyEmailFallback />}>
        <Confirmation searchParams={searchParams} />
      </Suspense>
    </VerifyEmailShell>
  );
}
