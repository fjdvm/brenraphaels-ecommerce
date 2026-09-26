"use client";

import { useActionState } from "react";

import {
  initialResendVerificationState,
  resendVerificationEmail,
} from "@/app/(auth)/verify-email/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(
    resendVerificationEmail,
    initialResendVerificationState,
  );

  return (
    <form action={action} className="mt-6 space-y-3 text-left">
      <Label htmlFor="email">Email address</Label>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
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
