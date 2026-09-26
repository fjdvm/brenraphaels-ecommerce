"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  initialSignUpFormState,
  submitSignUp,
} from "@/app/(auth)/signup/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = {
  name: string;
  label: string;
  type?: "email" | "password" | "tel" | "text";
  autoComplete?: string;
  error?: string;
};

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  error,
}: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        required
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FieldError({ error }: { error?: string }) {
  return error ? (
    <p className="text-sm text-red-700" role="alert">
      {error}
    </p>
  ) : null;
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(
    submitSignUp,
    initialSignUpFormState,
  );
  const errors = state.fieldErrors;

  if (state.email) {
    return (
      <Card className="mx-auto max-w-xl rounded-2xl p-8 text-center shadow-sm">
        <h1 className="font-serif text-4xl text-primary">Check your email</h1>
        <p className="mt-4 text-on-surface-variant">
          We&apos;ve sent a confirmation link to <strong>{state.email}</strong>.
          Please use it to verify your email before signing in.
        </p>
        <Button asChild className="mt-7">
          <Link href="/signin">Go to sign in</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl rounded-2xl p-6 shadow-sm sm:p-8">
      <div className="mb-7 text-center">
        <h1 className="font-serif text-4xl text-primary">Become a Customer</h1>
        <p className="mt-2 text-on-surface-variant">
          Create your login and save your first delivery Address.
        </p>
      </div>
      <form action={action} className="space-y-5" noValidate>
        <Field
          name="fullName"
          label="Full name"
          autoComplete="name"
          error={errors?.fullName?.[0]}
        />
        <Field
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          error={errors?.email?.[0]}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors?.password?.[0]}
          />
          <Field
            name="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors?.confirmPassword?.[0]}
          />
        </div>
        <p className="-mt-3 text-sm text-on-surface-variant">
          Use at least 8 characters, including an uppercase letter and a number.
        </p>
        <Field
          name="contactNumber"
          label="Contact number"
          type="tel"
          autoComplete="tel"
          error={errors?.contactNumber?.[0]}
        />

        <fieldset className="space-y-5 border-t border-outline-variant/60 pt-5">
          <legend className="font-serif text-2xl text-primary">Home Address</legend>
          <Field name="street" label="Street" autoComplete="street-address" error={errors?.street?.[0]} />
          <Field name="barangay" label="Barangay" error={errors?.barangay?.[0]} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="city" label="City or municipality" autoComplete="address-level2" error={errors?.city?.[0]} />
            <Field name="province" label="Province" autoComplete="address-level1" error={errors?.province?.[0]} />
          </div>
          <Field name="postalCode" label="Postal code" autoComplete="postal-code" error={errors?.postalCode?.[0]} />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-medium">Would you like marketing emails?</legend>
          <div className="flex gap-5">
            <Label className="flex items-center gap-2 font-normal" htmlFor="marketing-yes">
              <input id="marketing-yes" type="radio" name="marketingOptIn" value="yes" required />
              Yes
            </Label>
            <Label className="flex items-center gap-2 font-normal" htmlFor="marketing-no">
              <input id="marketing-no" type="radio" name="marketingOptIn" value="no" required />
              No
            </Label>
          </div>
          <FieldError error={errors?.marketingOptIn?.[0]} />
        </fieldset>

        <div className="space-y-2">
          <Label className="flex items-start gap-2 font-normal" htmlFor="terms">
            <input id="terms" type="checkbox" name="terms" className="mt-1" required />
            <span>
              I accept the <Link className="text-primary underline" href="/terms">Terms</Link> and{" "}
              <Link className="text-primary underline" href="/privacy">Privacy Policy</Link>.
            </span>
          </Label>
          <FieldError error={errors?.terms?.[0]} />
        </div>
        <Button className="w-full" size="lg" disabled={pending}>
          {pending ? "Creating your login…" : "Sign up"}
        </Button>
      </form>
    </Card>
  );
}
