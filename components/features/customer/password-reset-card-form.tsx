"use client";

import { useActionState } from "react";

import {
  requestPasswordResetEmail,
  type PasswordResetEmailState,
} from "@/app/(site)/(protected)/profile/password-actions";
import { Button } from "@/components/ui/button";

const initialState: PasswordResetEmailState = {};

/** Sends the Customer a reset link; the new password itself is chosen on the reset page. */
export function PasswordResetCardForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(requestPasswordResetEmail, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm leading-[1.6] tracking-[0.35px] text-body">
        We&apos;ll email a secure link to <strong className="font-medium text-ink">{email}</strong> where you can choose a new password.
      </p>
      <div className="flex items-center justify-end gap-4">
        {state.sent ? (
          <p className="mr-auto text-sm text-green-700" role="status">
            Check your email for the reset link.
          </p>
        ) : null}
        <Button disabled={pending} size="pill-sm" type="submit" variant="pill-outline">
          {pending ? "Sending…" : "Email me a reset link"}
        </Button>
      </div>
    </form>
  );
}
