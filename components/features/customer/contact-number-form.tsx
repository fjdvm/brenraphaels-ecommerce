"use client";

import { useActionState } from "react";

import {
  type ProfileContactNumberState,
  saveContactNumber,
} from "@/app/(site)/(protected)/profile/actions";
import { SettingsField } from "@/components/features/customer/settings-card";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
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
    <form action={action} className="flex flex-col gap-5">
      <SettingsField htmlFor="email" label="Email">
        <Input
          aria-readonly="true"
          className={`${fieldClass} bg-surface-soft text-body`}
          id="email"
          readOnly
          type="email"
          value={email}
        />
      </SettingsField>
      <SettingsField error={error} errorId={errorId} htmlFor="contactNumber" label="Contact number" required>
        <Input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="tel"
          className={fieldClass}
          defaultValue={contactNumber}
          id="contactNumber"
          inputMode="tel"
          name="contactNumber"
          onInput={sanitizePhoneInput}
          required
          type="tel"
        />
      </SettingsField>
      <div className="flex items-center justify-end gap-4">
        {state.saved ? (
          <p className="mr-auto text-sm text-green-700" role="status">
            Your contact number has been saved.
          </p>
        ) : null}
        <Button disabled={pending} size="pill-sm" type="submit" variant="pill">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
