"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { submitSignUp } from "@/app/(auth)/(signed-out)/signup/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DeliveryFields,
  Field,
  NameFields,
  PreferenceFields,
  type FieldErrors,
} from "@/components/features/auth/customer-details-fields";
import { signUpFormValues, signUpSteps } from "@/lib/customer/sign-up-schema";
import { emailMaximumLength, passwordMaximumLength } from "@/lib/validators/fields";
import { cn } from "@/lib/utils";

const newTab = { target: "_blank", rel: "noopener noreferrer" } as const;

export function SignUpForm({ provinces }: { provinces: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [email, setEmail] = useState<string>();
  const [formError, setFormError] = useState<string>();
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

    setFormError(undefined);
    startTransition(async () => {
      const outcome = await submitSignUp(formData);
      if (outcome.formError) {
        setFormError(outcome.formError);
        return;
      }
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
      <Card className="mx-auto w-full max-w-xl p-8 text-center shadow-sm">
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
    <Card className="mx-auto w-full max-w-lg p-6 shadow-sm sm:p-8">
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
          <NameFields errors={errors} />
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
          <DeliveryFields errors={errors} provinces={provinces} />
        </div>

        <div data-step="2" hidden={step !== 2} className="space-y-5">
          <PreferenceFields errors={errors} />
        </div>

        {formError ? (
          <p className="text-sm text-red-700" role="alert">
            {formError}
          </p>
        ) : null}

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
