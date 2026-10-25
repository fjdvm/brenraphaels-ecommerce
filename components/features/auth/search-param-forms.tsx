"use client";

import { useSearchParams } from "next/navigation";

import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";
import { SignInForm } from "@/components/features/auth/sign-in-form";

/** Reads `next` on the client so the sign-in page itself never waits on the request. */
export function SignInFormWithNext() {
  const next = useSearchParams().get("next");
  return <SignInForm next={next ?? undefined} />;
}

/** Reads `token` on the client so the reset page itself never waits on the request. */
export function ResetPasswordFormWithToken() {
  const token = useSearchParams().get("token");
  return <ResetPasswordForm token={token ?? undefined} />;
}
