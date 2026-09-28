"use client";

import Link from "next/link";
import { useActionState } from "react";

import { PasswordInput } from "@/components/ui/password-input";
import { submitApplicantSignUp } from "./actions";
import { BackLink } from "../_components/back-link";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.[0] ? (
    <p className="text-sm text-red-700" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

export default function ApplicantSignUpPage() {
  const [state, action, pending] = useActionState(submitApplicantSignUp, {});
  const fieldErrors = state.fieldErrors ?? {};
  return (
    <section className="mx-auto max-w-md py-16">
      <BackLink href="/careers" className="text-sm underline">
        Back
      </BackLink>
      <h1 className="mt-8 font-serif text-4xl text-primary">Become an Applicant</h1>
      <form action={action} className="mt-6 grid gap-4" noValidate>
        <input required name="firstName" placeholder="First name" className="rounded border p-3" />
        <FieldError errors={fieldErrors.firstName} />
        <input name="middleName" placeholder="Middle name (optional)" className="rounded border p-3" />
        <FieldError errors={fieldErrors.middleName} />
        <input required name="lastName" placeholder="Last name" className="rounded border p-3" />
        <FieldError errors={fieldErrors.lastName} />
        <input required name="email" type="email" placeholder="Email address" className="rounded border p-3" />
        <FieldError errors={fieldErrors.email} />
        <PasswordInput
          required
          name="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Password"
          className="rounded"
        />
        <FieldError errors={fieldErrors.password} />
        <PasswordInput
          required
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          placeholder="Confirm password"
          className="rounded"
        />
        <FieldError errors={fieldErrors.confirmPassword} />
        <button disabled={pending} className="rounded bg-primary p-3 font-semibold text-on-primary">
          Create Applicant account
        </button>
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
