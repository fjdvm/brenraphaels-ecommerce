"use client";

import { useActionState } from "react";
import { submitApplicantForgotPassword } from "./actions";
import { BackLink } from "../_components/back-link";
import { Field, RequiredNote, fieldProps } from "../_components/field";
import { SubmitButton } from "../_components/submit-button";

export default function ApplicantForgotPasswordPage() {
  const [state, action] = useActionState(submitApplicantForgotPassword, {});
  return (
    <section className="mx-auto max-w-md py-16">
      <BackLink href="/careers" className="text-sm underline">Back</BackLink>
      <h1 className="mt-8 font-serif text-4xl text-primary">Reset password</h1>
      <form action={action} className="mt-6 grid gap-4" noValidate>
        <RequiredNote />
        <Field id="forgot-email" label="Email address" required error={state.fieldErrors?.email?.[0]}>
          <input {...fieldProps("forgot-email", state.fieldErrors?.email?.[0])} required name="email" type="email" defaultValue={state.values?.email} autoComplete="email" maxLength={256} className="rounded border p-3" />
        </Field>
        <SubmitButton pendingLabel="Sending reset link…" className="rounded bg-primary p-3 font-semibold text-on-primary">Email reset link</SubmitButton>
      </form>
      {state.message && !state.fieldErrors ? <p className="mt-4 text-sm" role="alert">{state.message}</p> : null}
    </section>
  );
}
