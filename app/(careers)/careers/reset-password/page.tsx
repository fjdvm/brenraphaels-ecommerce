"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { PasswordInput } from "@/components/ui/password-input";
import { submitApplicantResetPassword } from "./actions";
import { BackLink } from "../_components/back-link";

export default function ApplicantResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ApplicantResetPasswordForm />
    </Suspense>
  );
}

function ApplicantResetPasswordForm() {
  const [state, action, pending] = useActionState(submitApplicantResetPassword, {});
  const token = useSearchParams().get("token") ?? "";
  return <section className="mx-auto max-w-md py-16"><BackLink href="/careers" className="text-sm underline">Back</BackLink><h1 className="mt-8 font-serif text-4xl text-primary">Choose a new password</h1><form action={action} className="mt-6 grid gap-4"><input name="token" type="hidden" value={token}/><PasswordInput required name="password" autoComplete="new-password" minLength={8} placeholder="New password" className="rounded"/><PasswordInput required name="confirmPassword" autoComplete="new-password" minLength={8} placeholder="Confirm new password" className="rounded"/><button disabled={pending} className="rounded bg-primary p-3 font-semibold text-on-primary">Reset password</button></form>{state.message ? <p className="mt-4 text-sm" role="alert">{state.message}</p> : null}</section>;
}
