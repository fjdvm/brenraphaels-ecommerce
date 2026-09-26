"use client";

import Link from "next/link";
import { useActionState } from "react";

import { submitResetPassword, type ResetPasswordFormState } from "@/app/(auth)/(signed-out)/reset-password/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { passwordMaximumLength } from "@/lib/validators/fields";

function InvalidLink() {
  return (
    <Card className="mx-auto w-full max-w-md p-6 text-center shadow-sm sm:p-8">
      <h1 className="font-serif text-4xl text-primary">Link not valid</h1>
      <p className="mt-4 text-on-surface-variant" role="alert">
        This reset link has expired or has already been used. Request a new one
        and we&apos;ll email you another.
      </p>
      <Button asChild className="mt-6 w-full" size="lg">
        <Link href="/forgot-password">Request a new link</Link>
      </Button>
    </Card>
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
      <Card className="mx-auto w-full max-w-md p-6 text-center shadow-sm sm:p-8">
        <h1 className="font-serif text-4xl text-primary">Password updated</h1>
        <p className="mt-4 text-on-surface-variant" role="status">
          Your password has been changed. You can now sign in with it.
        </p>
        <Button asChild className="mt-6 w-full" size="lg">
          <Link href="/signin">Sign in</Link>
        </Button>
      </Card>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <Card className="mx-auto w-full max-w-md p-6 shadow-sm sm:p-8">
      <div className="mb-7 text-center">
        <h1 className="font-serif text-4xl text-primary">Reset password</h1>
        <p className="mt-2 text-on-surface-variant">Choose a new password.</p>
      </div>
      <form action={action} className="space-y-5">
        <input type="hidden" name="token" value={token} />
        <div className="space-y-1.5">
          <Label htmlFor="password" required>
            New password
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            maxLength={passwordMaximumLength}
            aria-describedby="password-hint"
            required
          />
          <p id="password-hint" className="text-xs text-on-surface-variant">
            At least 8 characters, with an uppercase letter, a number and a
            special character.
          </p>
          {errors.password?.[0] ? (
            <p className="text-sm text-red-700" role="alert">
              {errors.password[0]}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" required>
            Confirm new password
          </Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            maxLength={passwordMaximumLength}
            required
          />
          {errors.confirmPassword?.[0] ? (
            <p className="text-sm text-red-700" role="alert">
              {errors.confirmPassword[0]}
            </p>
          ) : null}
        </div>
        {state.status === "failed" ? (
          <p className="text-sm text-red-700" role="alert">
            Something went wrong on our side. Please try again.
          </p>
        ) : null}
        <Button className="w-full" size="lg" disabled={pending} type="submit">
          {pending ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </Card>
  );
}
