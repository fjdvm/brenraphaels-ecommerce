"use client";

import Link from "next/link";
import { useActionState } from "react";

import { PasswordInput } from "@/components/ui/password-input";
import { submitApplicantSignUp } from "./actions";
import { BackLink } from "../_components/back-link";
import { Field, RequiredNote, fieldProps } from "../_components/field";
import { SubmitButton } from "../_components/submit-button";

export default function ApplicantSignUpPage() {
  const [state, action] = useActionState(submitApplicantSignUp, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <section className="mx-auto max-w-md py-16">
      <BackLink href="/careers" className="text-sm underline">
        Back
      </BackLink>
      <h1 className="mt-8 font-serif text-4xl text-primary">Become an Applicant</h1>
      <form action={action} className="mt-6 grid gap-4" noValidate>
        <RequiredNote />
        <Field id="signup-first-name" label="First name" required error={errors.firstName?.[0]}>
          <input {...fieldProps("signup-first-name", errors.firstName?.[0])} required name="firstName" defaultValue={values.firstName} autoComplete="given-name" maxLength={100} className="rounded border p-3" />
        </Field>
        <Field id="signup-middle-name" label="Middle name" error={errors.middleName?.[0]}>
          <input {...fieldProps("signup-middle-name", errors.middleName?.[0])} name="middleName" defaultValue={values.middleName} autoComplete="additional-name" maxLength={100} className="rounded border p-3" />
        </Field>
        <Field id="signup-last-name" label="Last name" required error={errors.lastName?.[0]}>
          <input {...fieldProps("signup-last-name", errors.lastName?.[0])} required name="lastName" defaultValue={values.lastName} autoComplete="family-name" maxLength={100} className="rounded border p-3" />
        </Field>
        <Field id="signup-email" label="Email address" required error={errors.email?.[0]}>
          <input {...fieldProps("signup-email", errors.email?.[0])} required name="email" type="email" defaultValue={values.email} autoComplete="email" maxLength={256} className="rounded border p-3" />
        </Field>
        <Field id="signup-password" label="Password" required error={errors.password?.[0]} hint="At least 8 characters with an uppercase letter, a number, and a special character.">
          <PasswordInput {...fieldProps("signup-password", errors.password?.[0])} required name="password" autoComplete="new-password" minLength={8} maxLength={128} className="rounded" />
        </Field>
        <Field id="signup-confirm-password" label="Confirm password" required error={errors.confirmPassword?.[0]}>
          <PasswordInput {...fieldProps("signup-confirm-password", errors.confirmPassword?.[0])} required name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={128} className="rounded" />
        </Field>
        <SubmitButton pendingLabel="Creating your account…" className="rounded bg-primary p-3 font-semibold text-on-primary">
          Create Applicant account
        </SubmitButton>
      </form>
      {state.message ? (
        <p className="mt-4 text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <p className="mt-5 text-sm">
        Already an Applicant?{" "}
        <Link className="underline" href="/careers/signin">
          Sign in
        </Link>
      </p>
    </section>
  );
}
