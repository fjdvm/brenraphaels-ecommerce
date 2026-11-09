"use client";

import { TurnstileWidget } from "@/components/features/auth/turnstile-widget";

import { ArrowRight, Store } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { submitForgotPassword, type ForgotPasswordFormState } from "@/app/(auth)/(signed-out)/forgot-password/actions";
import {
  AuthCard,
  AuthError,
  AuthHeading,
  authLinkClass,
} from "@/components/features/auth/auth-card";
import { Button } from "@/components/ui/button";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailMaximumLength } from "@/lib/validators/fields";

const initialForgotPasswordFormState: ForgotPasswordFormState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    submitForgotPassword,
    initialForgotPasswordFormState,
  );

  if (state.requestedEmail) {
    return (
      <AuthCard>
        <AuthHeading title="Check your email" />
        <p className="leading-[1.6] tracking-[0.35px] text-body" role="status">
          If <strong>{state.requestedEmail}</strong> belongs to a Customer,
          we&apos;ve sent a link to reset the password.
        </p>
        <p className="text-center text-sm tracking-[0.35px]">
          <Link className={authLinkClass} href="/signin">
            Back to sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-full bg-lavender text-primary"
      >
        <Store className="size-6" strokeWidth={1.5} />
      </span>
      <AuthHeading title="Forgot password">
        Enter the email you signed up with and we&apos;ll send you a link to
        reset your password.
      </AuthHeading>
      <form action={action} className="flex flex-col gap-[22px]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" required className={fieldLabelClass}>
            Email address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={emailMaximumLength}
            placeholder="you@example.com"
            className={fieldClass}
            required
          />
        </div>
        <TurnstileWidget resetKey={state} />
        {state.message ? <AuthError>{state.message}</AuthError> : null}
        <Button variant="pill" size="pill-lg" className="w-full" disabled={pending} type="submit">
          {pending ? "Sending…" : "Send reset link"}
          {pending ? null : <ArrowRight aria-hidden className="size-5" />}
        </Button>
      </form>
      <p className="text-center text-sm tracking-[0.35px] text-body">
        Remembered it?{" "}
        <Link className={authLinkClass} href="/signin">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
