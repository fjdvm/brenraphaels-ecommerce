"use client";

import { TurnstileWidget } from "@/components/features/auth/turnstile-widget";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { submitSignUp } from "@/app/(auth)/(signed-out)/signup/actions";
import {
  AuthCard,
  AuthError,
  AuthHeading,
  authLinkClass,
} from "@/components/features/auth/auth-card";
import { Button } from "@/components/ui/button";
import {
  DeliveryFields,
  Field,
  NameFields,
  PreferenceFields,
  type FieldErrors,
} from "@/components/features/auth/customer-details-fields";
import { metPasswordRules, passwordRules } from "@/lib/validators/password-rules";
import { signUpFormValues, signUpSteps } from "@/lib/customer/sign-up-schema";
import { emailMaximumLength, passwordMaximumLength } from "@/lib/validators/fields";
import { cn } from "@/lib/utils";

/** Live checklist of the password rules; each chip turns green once its rule is met. */
function PasswordRules({ password }: { password: string }) {
  const met = metPasswordRules(password);
  return (
    <ul aria-label="Password rules" className="flex flex-wrap gap-2">
      {passwordRules.map((rule, index) => (
        <li
          key={rule.label}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs tracking-[0.35px]",
            met[index] ? "bg-success-soft text-success" : "bg-surface-container-low text-muted",
          )}
        >
          <Check aria-hidden className="size-3.5" />
          {rule.label}
          <span className="sr-only">{met[index] ? " (met)" : " (not met)"}</span>
        </li>
      ))}
    </ul>
  );
}

const newTab = { target: "_blank", rel: "noopener noreferrer" } as const;

export function SignUpForm({ provinces }: { provinces: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [email, setEmail] = useState<string>();
  const [password, setPassword] = useState("");
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
      const outcome = await submitSignUp(formData).finally(() => setChallengeAttempt((attempt) => attempt + 1));
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
      <AuthCard>
        <AuthHeading title="Check your email">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>.
          Please use it to verify your email before signing in.
        </AuthHeading>
        <Button asChild variant="pill" size="pill-lg" className="w-full">
          <Link href="/signin">Go to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthHeading
        eyebrow={`Step ${step + 1} of ${signUpSteps.length} · ${signUpSteps[step].title}`}
        title="Become a customer"
      />
      <ol className="flex gap-2" aria-label="Sign-up progress">
        {signUpSteps.map((candidate, index) => (
          <li
            key={candidate.title}
            aria-current={index === step ? "step" : undefined}
            className={cn("h-1 flex-1", index <= step ? "bg-primary" : "bg-line")}
          >
            <span className="sr-only">{candidate.title}</span>
          </li>
        ))}
      </ol>

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-[22px]" noValidate>
        <div data-step="0" hidden={step !== 0} className="flex flex-col gap-[22px]">
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
              onInput={(event) => setPassword(event.currentTarget.value)}
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
          <PasswordRules password={password} />
        </div>

        <div data-step="1" hidden={step !== 1} className="flex flex-col gap-[22px]">
          <DeliveryFields errors={errors} provinces={provinces} />
        </div>

        <div data-step="2" hidden={step !== 2} className="flex flex-col gap-[22px]">
          <PreferenceFields errors={errors} />
        </div>

        {step === lastStep ? <TurnstileWidget resetKey={challengeAttempt} /> : null}

        {formError ? <AuthError>{formError}</AuthError> : null}

        <div className="flex gap-3">
          {step > 0 ? (
            <Button
              type="button"
              variant="pill-outline"
              size="pill-lg"
              disabled={pending}
              onClick={() => {
                setErrors({});
                goToStep(step - 1);
              }}
            >
              Back
            </Button>
          ) : null}
          <Button variant="pill" size="pill-lg" className="flex-1" disabled={pending} type="submit">
            {step < lastStep ? "Continue" : pending ? "Creating your login…" : "Sign up"}
            {pending ? null : <ArrowRight aria-hidden className="size-5" />}
          </Button>
        </div>
      </form>

      <div className="flex flex-col items-center gap-2.5 text-center">
        <p className="text-sm tracking-[0.35px] text-body">
          Already a customer?{" "}
          <Link className={authLinkClass} href="/signin">
            Sign in
          </Link>
        </p>
        <p className="text-xs text-muted">
          By continuing you agree to our{" "}
          <Link className="underline" href="/terms" {...newTab}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link className="underline" href="/privacy" {...newTab}>
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </AuthCard>
  );
}
