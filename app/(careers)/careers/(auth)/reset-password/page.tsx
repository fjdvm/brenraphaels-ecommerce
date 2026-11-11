"use client";

import { ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { AuthError } from "@/components/features/auth/auth-card";
import { ApplicantAuthCard, ApplicantAuthHeading } from "@/components/features/careers/applicant-auth-card";
import { buttonVariants } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field-styles";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { submitApplicantResetPassword } from "./actions";
import { Field, fieldProps } from "@/app/(careers)/careers/_components/field";
import { SubmitButton } from "@/app/(careers)/careers/_components/submit-button";

export default function ApplicantResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <ApplicantAuthCard aria-hidden="true">
          <Skeleton className="h-[88px] w-full" />
          <Skeleton className="h-[77px] w-full" />
          <Skeleton className="h-[77px] w-full" />
          <Skeleton className="h-[59px] w-full rounded-full" />
        </ApplicantAuthCard>
      }
    >
      <ApplicantResetPasswordForm />
    </Suspense>
  );
}

function ApplicantResetPasswordForm() {
  const [state, action] = useActionState(submitApplicantResetPassword, {});
  const token = useSearchParams().get("token") ?? "";
  const errors = state.fieldErrors ?? {};
  return (
    <ApplicantAuthCard>
      <ApplicantAuthHeading title="Choose a new password">
        At least 8 characters with an uppercase letter, a number, and a special character.
      </ApplicantAuthHeading>
      <form action={action} className="flex flex-col gap-[18px] sm:gap-[22px]" noValidate>
        <input name="token" type="hidden" value={token} />
        <Field id="reset-password" label="New password" required error={errors.password?.[0]}>
          <PasswordInput {...fieldProps("reset-password", errors.password?.[0])} required name="password" autoComplete="new-password" minLength={8} maxLength={128} className={fieldClass} />
        </Field>
        <Field id="reset-confirm-password" label="Confirm new password" required error={errors.confirmPassword?.[0]}>
          <PasswordInput {...fieldProps("reset-confirm-password", errors.confirmPassword?.[0])} required name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={128} className={fieldClass} />
        </Field>
        {state.message ? <AuthError>{state.message}</AuthError> : null}
        <SubmitButton pendingLabel="Resetting password…" className={cn(buttonVariants({ variant: "pill", size: "pill-lg" }), "w-full")}>
          Reset password
          <ArrowRight aria-hidden className="size-5" />
        </SubmitButton>
      </form>
    </ApplicantAuthCard>
  );
}
