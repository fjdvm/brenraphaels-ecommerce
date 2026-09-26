"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  initialSignInFormState,
  submitSignIn,
} from "@/app/(auth)/(signed-out)/signin/actions";
import { ResendVerificationForm } from "@/components/features/auth/resend-verification-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailMaximumLength, passwordMaximumLength } from "@/lib/validators/fields";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(
    submitSignIn,
    initialSignInFormState,
  );

  if (state.unverifiedEmail) {
    return (
      <Card className="mx-auto w-full max-w-xl rounded-2xl p-8 text-center shadow-sm">
        <h1 className="font-serif text-4xl text-primary">Confirm your email</h1>
        <p className="mt-4 text-on-surface-variant" role="alert">
          You need to confirm <strong>{state.unverifiedEmail}</strong> before you
          can sign in. Use the link we emailed you, or ask for a new one.
        </p>
        <ResendVerificationForm defaultEmail={state.unverifiedEmail} />
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl p-6 shadow-sm sm:p-8">
      <div className="mb-7 text-center">
        <h1 className="font-serif text-4xl text-primary">Sign in</h1>
        <p className="mt-2 text-on-surface-variant">Welcome back to Bren Raphael&apos;s.</p>
      </div>
      <form action={action} className="space-y-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}
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
        <div className="space-y-1.5">
          <Label htmlFor="password" required>
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={passwordMaximumLength}
            required
          />
        </div>
        {state.message ? (
          <p className="text-sm text-red-700" role="alert">
            {state.message}
          </p>
        ) : null}
        <Button className="w-full" size="lg" disabled={pending} type="submit">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-on-surface-variant">
        New here?{" "}
        <Link className="text-primary underline" href="/signup">
          Become a Customer
        </Link>
      </p>
    </Card>
  );
}
