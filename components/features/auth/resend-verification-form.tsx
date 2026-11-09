"use client";

import { TurnstileWidget } from "@/components/features/auth/turnstile-widget";

import { useActionState } from "react";

import { resendVerificationEmail, type ResendVerificationState } from "@/app/(site)/verify-email/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailMaximumLength } from "@/lib/validators/fields";

const initialResendVerificationState: ResendVerificationState = {};

export function ResendVerificationForm({
  defaultEmail,
}: {
  defaultEmail?: string;
}) {
  const [state, action, pending] = useActionState(
    resendVerificationEmail,
    initialResendVerificationState,
  );

  return (
    <form action={action} className="mt-6 space-y-3 text-left">
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
        defaultValue={defaultEmail}
        required
      />
      <TurnstileWidget resetKey={state} />
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Sending…" : "Send a new verification email"}
      </Button>
      {state.message ? (
        <p className="text-sm text-on-surface-variant" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
