"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { PasswordInput } from "@/components/ui/password-input";
import { submitApplicantResetPassword } from "./actions";
import { BackLink } from "../_components/back-link";
import { Field, RequiredNote, fieldProps } from "../_components/field";
import { SubmitButton } from "../_components/submit-button";

export default function ApplicantResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ApplicantResetPasswordForm />
    </Suspense>
  );
}

function ApplicantResetPasswordForm() {
  const [state, action] = useActionState(submitApplicantResetPassword, {});
  const token = useSearchParams().get("token") ?? "";
  const errors = state.fieldErrors ?? {};
  return (
    <section className="mx-auto max-w-md py-16">
      <BackLink href="/careers" className="text-sm underline">Back</BackLink>
      <h1 className="mt-8 font-serif text-4xl text-primary">Choose a new password</h1>
      <form action={action} className="mt-6 grid gap-4" noValidate>
        <input name="token" type="hidden" value={token} />
        <RequiredNote />
        <Field id="reset-password" label="New password" required error={errors.password?.[0]} hint="At least 8 characters with an uppercase letter, a number, and a special character.">
          <PasswordInput {...fieldProps("reset-password", errors.password?.[0])} required name="password" autoComplete="new-password" minLength={8} maxLength={128} className="rounded" />
        </Field>
        <Field id="reset-confirm-password" label="Confirm new password" required error={errors.confirmPassword?.[0]}>
          <PasswordInput {...fieldProps("reset-confirm-password", errors.confirmPassword?.[0])} required name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={128} className="rounded" />
        </Field>
        <SubmitButton pendingLabel="Resetting password…" className="rounded bg-primary p-3 font-semibold text-on-primary">Reset password</SubmitButton>
      </form>
      {state.message ? <p className="mt-4 text-sm" role="alert">{state.message}</p> : null}
    </section>
  );
}
