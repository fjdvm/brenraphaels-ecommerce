"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { submitSignUp } from "@/app/(auth)/(signed-out)/signup/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { signUpFormValues, signUpSteps } from "@/lib/customer/sign-up-schema";
import { emailMaximumLength, passwordMaximumLength } from "@/lib/validators/fields";
import { cn } from "@/lib/utils";

type FieldErrors = Record<string, string[] | undefined>;

type FieldProps = {
  name: string;
  label: string;
  type?: "email" | "password" | "tel" | "text";
  autoComplete?: string;
  maxLength: number;
  optional?: boolean;
  error?: string;
};

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  maxLength,
  optional,
  error,
}: FieldProps) {
  const errorId = `${name}-error`;
  const Control = type === "password" ? PasswordInput : Input;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} required={!optional}>
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-on-surface-variant">(optional)</span>
        ) : null}
      </Label>
      <Control
        id={name}
        name={name}
        {...(type === "password" ? {} : { type })}
        autoComplete={autoComplete}
        maxLength={maxLength}
        inputMode={type === "tel" ? "tel" : undefined}
        autoCapitalize={type === "email" ? "none" : undefined}
        spellCheck={type === "text" ? undefined : false}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        required={!optional}
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

const newTab = { target: "_blank", rel: "noopener noreferrer" } as const;

export function SignUpForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [email, setEmail] = useState<string>();
  const [pending, startTransition] = useTransition();
  const lastStep = signUpSteps.length - 1;

  function goToStep(next: number) {
    setStep(next);
    // Hidden steps stay mounted so their values are kept; move focus to the new one.
    requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLElement>(`[data-step="${next}"] input`)
        ?.focus(),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = signUpSteps[step].schema.safeParse(signUpFormValues(formData));
    const stepErrors = result.success ? {} : z.flattenError(result.error).fieldErrors;
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      return;
    }
    if (step < lastStep) {
      goToStep(step + 1);
      return;
    }

    startTransition(async () => {
      const outcome = await submitSignUp(formData);
      if (outcome.email) {
        setEmail(outcome.email);
        return;
      }

      const fieldErrors = outcome.fieldErrors ?? {};
      setErrors(fieldErrors);
      const failedStep = signUpSteps.findIndex((candidate) =>
        candidate.fields.some((field) => fieldErrors[field]),
      );
      if (failedStep >= 0) {
        goToStep(failedStep);
      }
    });
  }

  if (email) {
    return (
      <Card className="mx-auto w-full max-w-xl rounded-2xl p-8 text-center shadow-sm">
        <h1 className="font-serif text-4xl text-primary">Check your email</h1>
        <p className="mt-4 text-on-surface-variant">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>.
          Please use it to verify your email before signing in.
        </p>
        <Button asChild className="mt-7">
          <Link href="/signin">Go to sign in</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-lg rounded-2xl p-6 shadow-sm sm:p-8">
      <div className="mb-5">
        <h1 className="font-serif text-3xl text-primary">Become a Customer</h1>
        <p className="sr-only" aria-live="polite">
          Step {step + 1} of {signUpSteps.length}: {signUpSteps[step].title}
        </p>
        <ol className="mt-4 flex gap-2" aria-label="Sign-up progress">
          {signUpSteps.map((candidate, index) => (
            <li
              key={candidate.title}
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                index <= step ? "bg-primary" : "bg-outline-variant",
              )}
            >
              <span className="sr-only">{candidate.title}</span>
            </li>
          ))}
        </ol>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div data-step="0" hidden={step !== 0} className="space-y-4">
          <Field
            name="firstName"
            label="First name"
            autoComplete="given-name"
            maxLength={50}
            error={errors.firstName?.[0]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="middleName"
              label="Middle name"
              autoComplete="additional-name"
              maxLength={50}
              optional
              error={errors.middleName?.[0]}
            />
            <Field
              name="lastName"
              label="Last name"
              autoComplete="family-name"
              maxLength={50}
              error={errors.lastName?.[0]}
            />
          </div>
          <Field
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            maxLength={emailMaximumLength}
            error={errors.email?.[0]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              maxLength={passwordMaximumLength}
              error={errors.password?.[0]}
            />
            <Field
              name="confirmPassword"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              maxLength={passwordMaximumLength}
              error={errors.confirmPassword?.[0]}
            />
          </div>
          <p className="text-sm text-on-surface-variant">
            Use at least 8 characters, including an uppercase letter, a number and
            a special character (such as ! or #).
          </p>
        </div>

        <div data-step="1" hidden={step !== 1} className="space-y-4">
          <Field
            name="contactNumber"
            label="Contact number"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            error={errors.contactNumber?.[0]}
          />
          <Field
            name="street"
            label="Street"
            autoComplete="street-address"
            maxLength={100}
            error={errors.street?.[0]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="barangay" label="Barangay" maxLength={100} error={errors.barangay?.[0]} />
            <Field
              name="city"
              label="City or municipality"
              autoComplete="address-level2"
              maxLength={100}
              error={errors.city?.[0]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="province"
              label="Province"
              autoComplete="address-level1"
              maxLength={100}
              error={errors.province?.[0]}
            />
            <Field
              name="postalCode"
              label="Postal code"
              autoComplete="postal-code"
              maxLength={100}
              error={errors.postalCode?.[0]}
            />
          </div>
          <p className="text-sm text-on-surface-variant">
            This becomes your Home Address and your Default address.
          </p>
        </div>

        <div data-step="2" hidden={step !== 2} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="font-medium">
              Would you like marketing emails?
              <span aria-hidden="true" className="ml-0.5 text-red-700">
                *
              </span>
            </legend>
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
            <FieldError error={errors.marketingOptIn?.[0]} />
          </fieldset>

          <div className="space-y-2">
            <Label className="flex items-start gap-2 font-normal" htmlFor="terms">
              <input id="terms" type="checkbox" name="terms" className="mt-1" required />
              <span>
                I accept the{" "}
                <Link className="text-primary underline" href="/terms" {...newTab}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link className="text-primary underline" href="/privacy" {...newTab}>
                  Privacy Policy
                </Link>
                .
                <span aria-hidden="true" className="ml-0.5 text-red-700">
                  *
                </span>
              </span>
            </Label>
            <FieldError error={errors.terms?.[0]} />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => {
                setErrors({});
                goToStep(step - 1);
              }}
            >
              Back
            </Button>
          ) : null}
          <Button className="flex-1" size="lg" disabled={pending} type="submit">
            {step < lastStep ? "Next page" : pending ? "Creating your login…" : "Sign up"}
          </Button>
        </div>
      </form>

      <p className="mt-5 text-center text-sm text-on-surface-variant">
        Already a Customer?{" "}
        <Link className="font-semibold text-primary underline" href="/signin">
          Sign in
        </Link>
      </p>
      <p className="mt-3 flex justify-center gap-4 text-xs text-on-surface-variant">
        <Link className="underline" href="/terms" {...newTab}>
          Terms of Service
        </Link>
        <Link className="underline" href="/privacy" {...newTab}>
          Privacy Policy
        </Link>
      </p>
    </Card>
  );
}
