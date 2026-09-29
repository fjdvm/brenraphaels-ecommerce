"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { submitApplicantSignIn } from "./actions";
import { BackLink } from "../_components/back-link";
import { Field, RequiredNote, fieldProps } from "../_components/field";
import { SubmitButton } from "../_components/submit-button";

export default function ApplicantSignInPage() {
  const [state, action] = useActionState(submitApplicantSignIn, {});
  const errors = state.fieldErrors ?? {};
  return (
    <section className="mx-auto max-w-md py-16">
      <BackLink href="/careers" className="text-sm underline">Back</BackLink>
      <h1 className="mt-8 font-serif text-4xl text-primary">Applicant sign in</h1>
      <form action={action} className="mt-6 grid gap-4" noValidate>
        <RequiredNote />
        <Field id="signin-email" label="Email address" required error={errors.email?.[0]}>
          <input {...fieldProps("signin-email", errors.email?.[0])} required name="email" type="email" defaultValue={state.values?.email} autoComplete="email" maxLength={256} className="rounded border p-3" />
        </Field>
        <Field id="signin-password" label="Password" required error={errors.password?.[0]}>
          <PasswordInput {...fieldProps("signin-password", errors.password?.[0])} required name="password" autoComplete="current-password" maxLength={128} className="rounded" />
        </Field>
        <SubmitButton pendingLabel="Signing in…" className="rounded bg-primary p-3 font-semibold text-on-primary">Sign in</SubmitButton>
      </form>
      {state.message ? <p className="mt-4 text-sm" role="alert">{state.message}</p> : null}
      <Link className="mt-5 inline-block text-sm underline" href="/careers/forgot-password">Forgot your password?</Link>
    </section>
  );
}
