"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { submitResetPassword, type ResetPasswordFormState } from "@/app/(auth)/(signed-out)/reset-password/actions";
import { AuthCard, AuthError, AuthHeading } from "@/components/features/auth/auth-card";
import { Button } from "@/components/ui/button";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { passwordMaximumLength } from "@/lib/validators/fields";

function InvalidLink() {
  return (
    <AuthCard>
      <AuthHeading title="Link not valid">
        This reset link has expired or has already been used. Request a new one
        and we&apos;ll email you another.
      </AuthHeading>
      <Button asChild variant="pill" size="pill-lg" className="w-full">
        <Link href="/forgot-password">Request a new link</Link>
      </Button>
    </AuthCard>
  );
}

const initialResetPasswordFormState: ResetPasswordFormState = {};

export function ResetPasswordForm({ token }: { token?: string }) {
  const [state, action, pending] = useActionState(
    submitResetPassword,
    initialResetPasswordFormState,
  );

  if (!token || state.status === "invalid-link") {
    return <InvalidLink />;
  }

  if (state.status === "reset") {
    return (
      <AuthCard>
        <AuthHeading title="Password updated">
          Your password has been changed. You can now sign in with it.
        </AuthHeading>
        <Button asChild variant="pill" size="pill-lg" className="w-full">
          <Link href="/signin">Sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <AuthCard>
      <AuthHeading title="Reset password">Choose a new password.</AuthHeading>
      <form action={action} className="flex flex-col gap-[22px]">
        <input type="hidden" name="token" value={token} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="password" required className={fieldLabelClass}>
            New password
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            maxLength={passwordMaximumLength}
            aria-describedby="password-hint"
            className={fieldClass}
            required
          />
          <p id="password-hint" className="text-xs tracking-[0.35px] text-muted">
            At least 8 characters, with an uppercase letter, a number and a
            special character.
          </p>
          {errors.password?.[0] ? <AuthError>{errors.password[0]}</AuthError> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword" required className={fieldLabelClass}>
            Confirm new password
          </Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            maxLength={passwordMaximumLength}
            className={fieldClass}
            required
          />
          {errors.confirmPassword?.[0] ? (
            <AuthError>{errors.confirmPassword[0]}</AuthError>
          ) : null}
        </div>
        {state.status === "failed" ? (
          <AuthError>Something went wrong on our side. Please try again.</AuthError>
        ) : null}
        <Button variant="pill" size="pill-lg" className="w-full" disabled={pending} type="submit">
          {pending ? "Saving…" : "Set new password"}
          {pending ? null : <ArrowRight aria-hidden className="size-5" />}
        </Button>
      </form>
    </AuthCard>
  );
}
