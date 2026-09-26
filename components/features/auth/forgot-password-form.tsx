"use client";

import Link from "next/link";
import { useActionState } from "react";

import { submitForgotPassword, type ForgotPasswordFormState } from "@/app/(auth)/(signed-out)/forgot-password/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <Card className="mx-auto w-full max-w-md p-6 text-center shadow-sm sm:p-8">
        <h1 className="font-serif text-4xl text-primary">Check your email</h1>
        <p className="mt-4 text-on-surface-variant" role="status">
          If <strong>{state.requestedEmail}</strong> belongs to a Customer,
          we&apos;ve sent a link to reset the password.
        </p>
        <p className="mt-6 text-sm text-on-surface-variant">
          <Link className="text-primary underline" href="/signin">
            Back to sign in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md p-6 shadow-sm sm:p-8">
      <div className="mb-7 text-center">
        <h1 className="font-serif text-4xl text-primary">Forgot password</h1>
        <p className="mt-2 text-on-surface-variant">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
      </div>
      <form action={action} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" required>
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
            required
          />
        </div>
        {state.message ? (
          <p className="text-sm text-red-700" role="alert">
            {state.message}
          </p>
        ) : null}
        <Button className="w-full" size="lg" disabled={pending} type="submit">
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Remembered it?{" "}
        <Link className="text-primary underline" href="/signin">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
