import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInForm } from "@/components/features/auth/sign-in-form";
import { SignInFormWithNext } from "@/components/features/auth/search-param-forms";

export const metadata: Metadata = { title: "Sign in" };

// The fallback is the form itself, so the page shows up complete and instantly.
export default function SignInPage() {
  return (
    <Suspense fallback={<SignInForm />}>
      <SignInFormWithNext />
    </Suspense>
  );
}
