import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordFormWithToken } from "@/components/features/auth/search-param-forms";
import { SignedOutGateFallback } from "@/components/features/auth/signed-out-gate-fallback";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<SignedOutGateFallback />}>
      <ResetPasswordFormWithToken />
    </Suspense>
  );
}
