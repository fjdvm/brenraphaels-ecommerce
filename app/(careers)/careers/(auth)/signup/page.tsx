"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { AuthError, authLinkClass } from "@/components/features/auth/auth-card";
import { ApplicantAuthCard, ApplicantAuthHeading } from "@/components/features/careers/applicant-auth-card";
import { buttonVariants } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import { submitApplicantSignUp } from "./actions";
import { Field, fieldProps } from "@/app/(careers)/careers/_components/field";
import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";

const passwordRules = [
  { label: "8+ characters", met: (password: string) => password.length >= 8 },
  { label: "Uppercase letter", met: (password: string) => /[A-Z]/.test(password) },
  { label: "Number", met: (password: string) => /\d/.test(password) },
  { label: "Special character", met: (password: string) => /[^A-Za-z0-9]/.test(password) },
];

export default function ApplicantSignUpPage() {
  const [state, action] = useActionState(submitApplicantSignUp, {});
  const [password, setPassword] = useState("");
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <ApplicantAuthCard>
      <ApplicantAuthHeading title="Become an applicant">
        It takes a minute. You only need to do this once.
      </ApplicantAuthHeading>
      <form action={action} className="flex flex-col gap-[18px] sm:gap-[22px]" noValidate>
        <div className="grid gap-[22px] sm:grid-cols-2 sm:gap-4">
          <Field id="signup-first-name" label="First name" required error={errors.firstName?.[0]}>
            <Input {...fieldProps("signup-first-name", errors.firstName?.[0])} required name="firstName" defaultValue={values.firstName} autoComplete="given-name" maxLength={100} className={fieldClass} />
          </Field>
          <Field id="signup-last-name" label="Last name" required error={errors.lastName?.[0]}>
            <Input {...fieldProps("signup-last-name", errors.lastName?.[0])} required name="lastName" defaultValue={values.lastName} autoComplete="family-name" maxLength={100} className={fieldClass} />
          </Field>
        </div>
        <Field id="signup-middle-name" label="Middle name (optional)" error={errors.middleName?.[0]}>
          <Input {...fieldProps("signup-middle-name", errors.middleName?.[0])} name="middleName" defaultValue={values.middleName} autoComplete="additional-name" maxLength={100} className={fieldClass} />
        </Field>
        <Field id="signup-email" label="Email address" required error={errors.email?.[0]}>
          <Input {...fieldProps("signup-email", errors.email?.[0])} required name="email" type="email" defaultValue={values.email} autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={256} placeholder="you@example.com" className={fieldClass} />
        </Field>
        <div className="grid gap-[22px] sm:grid-cols-2 sm:gap-4">
          <Field id="signup-password" label="Password" required error={errors.password?.[0]}>
            <PasswordInput {...fieldProps("signup-password", errors.password?.[0])} required name="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} />
          </Field>
          <Field id="signup-confirm-password" label="Confirm password" required error={errors.confirmPassword?.[0]}>
            <PasswordInput {...fieldProps("signup-confirm-password", errors.confirmPassword?.[0])} required name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={128} className={fieldClass} />
          </Field>
        </div>
        <ul aria-label="Password rules" className="flex flex-wrap gap-2">
          {passwordRules.map((rule) => {
            const met = rule.met(password);
            return (
              <li key={rule.label} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs tracking-[0.35px]", met ? "bg-green-100 text-green-700" : "bg-surface-soft text-muted")}>
                <Check aria-hidden className="size-3.5 shrink-0" />
                {rule.label}
                <span className="sr-only">{met ? " (met)" : " (not met yet)"}</span>
              </li>
            );
          })}
        </ul>
        {state.message ? <AuthError>{state.message}</AuthError> : null}
        <SubmitButton pendingLabel="Creating your account…" className={cn(buttonVariants({ variant: "pill", size: "pill-lg" }), "w-full")}>
          Create applicant account
          <ArrowRight aria-hidden className="size-5" />
        </SubmitButton>
      </form>
      <p className="text-center text-sm tracking-[0.35px] text-body">
        Already an applicant?{" "}
        <Link className={authLinkClass} href="/careers/signin">Sign in</Link>
      </p>
    </ApplicantAuthCard>
  );
}
