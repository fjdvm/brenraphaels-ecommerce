"use client";

import { useActionState } from "react";

import {
  type ProfileContactNumberState,
  saveContactNumber,
} from "@/app/(site)/(protected)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizePhoneInput } from "@/components/features/customer/input-sanitizers";

const initialProfileContactNumberState: ProfileContactNumberState = {};

export function ContactNumberForm({
  email,
  contactNumber,
}: {
  email: string;
  contactNumber: string;
}) {
  const [state, action, pending] = useActionState(
    saveContactNumber,
    initialProfileContactNumberState,
  );
  const error = state.fieldErrors?.contactNumber?.[0];
  const errorId = "contact-number-error";

  return (
    <form action={action} className="mt-6 space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} readOnly aria-readonly="true" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contactNumber" required>
          Contact number
        </Label>
        <Input
          id="contactNumber"
          name="contactNumber"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          defaultValue={contactNumber}
          onInput={sanitizePhoneInput}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          required
        />
        {error ? (
          <p id={errorId} className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {state.saved ? (
        <p className="text-sm text-green-700" role="status">
          Your Contact number has been saved.
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Saving…" : "Save Contact number"}
      </Button>
    </form>
  );
}
