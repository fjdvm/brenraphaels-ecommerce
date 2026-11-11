"use client";

import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { authLinkClass } from "@/components/features/auth/auth-card";
import { ApplicantAuthCard, ApplicantAuthHeading } from "@/components/features/careers/applicant-auth-card";
import { buttonVariants } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { submitApplicantForgotPassword } from "./actions";
import { Field, fieldProps } from "@/app/(careers)/careers/_components/field";
import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";

export default function ApplicantForgotPasswordPage() {
  const [state, action] = useActionState(submitApplicantForgotPassword, {});
  return (
    <ApplicantAuthCard>
      <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-lavender text-primary">
        <Mail className="size-6" strokeWidth={1.5} />
      </span>
      <ApplicantAuthHeading title="Reset password">
        Enter your applicant email and we&apos;ll send you a reset link.
      </ApplicantAuthHeading>
      <form action={action} className="flex flex-col gap-[18px] sm:gap-[22px]" noValidate>
        <Field id="forgot-email" label="Email address" required error={state.fieldErrors?.email?.[0]}>
          <Input {...fieldProps("forgot-email", state.fieldErrors?.email?.[0])} required name="email" type="email" defaultValue={state.values?.email} autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={256} placeholder="you@example.com" className={fieldClass} />
        </Field>
        {state.message && !state.fieldErrors ? <p className="text-sm tracking-[0.35px] text-body" role="alert">{state.message}</p> : null}
        <SubmitButton pendingLabel="Sending reset link…" className={cn(buttonVariants({ variant: "pill", size: "pill-lg" }), "w-full")}>
          Email reset link
          <ArrowRight aria-hidden className="size-5" />
        </SubmitButton>
      </form>
      <p className="text-center text-sm tracking-[0.35px] text-body">
        Remembered it?{" "}
        <Link className={authLinkClass} href="/careers/signin">Back to sign in</Link>
      </p>
    </ApplicantAuthCard>
  );
}
