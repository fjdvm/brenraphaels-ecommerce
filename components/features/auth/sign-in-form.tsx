"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { submitSignIn, type SignInFormState } from "@/app/(auth)/(signed-out)/signin/actions";
import {
  AuthCard,
  AuthError,
  AuthHeading,
  authLinkClass,
} from "@/components/features/auth/auth-card";
import { ResendVerificationForm } from "@/components/features/auth/resend-verification-form";
import { Button } from "@/components/ui/button";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { emailMaximumLength, passwordMaximumLength } from "@/lib/validators/fields";

const initialSignInFormState: SignInFormState = {};

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(
    submitSignIn,
    initialSignInFormState,
  );

  if (state.unverifiedEmail) {
    return (
      <AuthCard>
        <AuthHeading title="Confirm your email" />
        <p className="leading-[1.6] tracking-[0.35px] text-body" role="alert">
          You need to confirm <strong>{state.unverifiedEmail}</strong> before you
          can sign in. Use the link we emailed you, or ask for a new one.
        </p>
        <ResendVerificationForm defaultEmail={state.unverifiedEmail} />
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthHeading eyebrow="Welcome back" title="Sign in">
        Good to see you again at Bren Raphael&apos;s.
      </AuthHeading>
      <form action={action} className="flex flex-col gap-[22px]">
        {next ? <input type="hidden" name="next" value={next} /> : null}
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="password" required className={fieldLabelClass}>
            Password
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            maxLength={passwordMaximumLength}
            className={fieldClass}
            required
          />
          <p className="text-right text-sm tracking-[0.35px]">
            <Link className={authLinkClass} href="/forgot-password">
              Forgot password?
            </Link>
          </p>
        </div>
        {state.message ? <AuthError>{state.message}</AuthError> : null}
        <Button variant="pill" size="pill-lg" className="w-full" disabled={pending} type="submit">
          {pending ? "Signing in…" : "Sign in"}
          {pending ? null : <ArrowRight aria-hidden className="size-5" />}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs tracking-[0.35px] text-muted">
        <span aria-hidden className="h-px flex-1 bg-line" />
        New to Bren Raphael&apos;s?
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      <Button asChild variant="pill-outline" size="pill-lg" className="w-full">
        <Link href="/signup">Become a customer</Link>
      </Button>
    </AuthCard>
  );
}
