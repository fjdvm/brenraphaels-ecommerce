"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { AuthCard, AuthError, AuthHeading, authLinkClass } from "@/components/features/auth/auth-card";
import { buttonVariants } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import { submitApplicantSignIn } from "./actions";
import { Field, fieldProps } from "@/app/(careers)/careers/_components/field";
import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";

export default function ApplicantSignInPage() {
  const [state, action] = useActionState(submitApplicantSignIn, {});
  const errors = state.fieldErrors ?? {};
  return (
    <AuthCard className="max-w-[540px]">
      <AuthHeading eyebrow="Careers portal" title="Applicant sign in">
        Welcome back — pick up where you left off.
      </AuthHeading>
      <form action={action} className="flex flex-col gap-[22px]" noValidate>
        <Field id="signin-email" label="Email address" required error={errors.email?.[0]}>
          <Input {...fieldProps("signin-email", errors.email?.[0])} required name="email" type="email" defaultValue={state.values?.email} autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={256} placeholder="you@example.com" className={fieldClass} />
        </Field>
        <Field id="signin-password" label="Password" required error={errors.password?.[0]}>
          <PasswordInput {...fieldProps("signin-password", errors.password?.[0])} required name="password" autoComplete="current-password" maxLength={128} className={fieldClass} />
        </Field>
        <p className="text-right text-sm tracking-[0.35px]">
          <Link className={authLinkClass} href="/careers/forgot-password">Forgot your password?</Link>
        </p>
        {state.message ? <AuthError>{state.message}</AuthError> : null}
        <SubmitButton pendingLabel="Signing in…" className={cn(buttonVariants({ variant: "pill", size: "pill-lg" }), "w-full")}>
          Sign in
          <ArrowRight aria-hidden className="size-5" />
        </SubmitButton>
      </form>
      <div className="flex items-center gap-3 text-xs tracking-[0.35px] text-muted">
        <span aria-hidden className="h-px flex-1 bg-line" />
        First time applying?
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      <Link href="/careers/signup" className={cn(buttonVariants({ variant: "pill-outline", size: "pill-lg" }), "w-full")}>
        Become an applicant
      </Link>
    </AuthCard>
  );
}
