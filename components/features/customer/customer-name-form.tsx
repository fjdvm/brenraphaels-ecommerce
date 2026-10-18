"use client";

import { useActionState } from "react";
import {
  type ProfileNameState,
  saveCustomerName,
} from "@/app/(site)/(protected)/profile/actions";
import { SettingsField } from "@/components/features/customer/settings-card";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";

const initialState: ProfileNameState = {};

export function CustomerNameForm({
  firstName,
  middleName,
  lastName,
}: {
  firstName: string;
  middleName: string | null;
  lastName: string;
}) {
  const [state, action, pending] = useActionState(
    saveCustomerName,
    initialState,
  );
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <NameField
        error={state.fieldErrors?.firstName?.[0]}
        id="firstName"
        label="First name"
        defaultValue={firstName}
        required
      />
      <NameField
        error={state.fieldErrors?.lastName?.[0]}
        id="lastName"
        label="Last name"
        defaultValue={lastName}
        required
      />
      <div className="sm:col-span-2">
        <NameField
          error={state.fieldErrors?.middleName?.[0]}
          id="middleName"
          label="Middle name (optional)"
          defaultValue={middleName ?? ""}
        />
      </div>
      <div className="flex items-center justify-end gap-4 sm:col-span-2">
        {state.saved ? (
          <p className="mr-auto text-sm text-green-700" role="status">
            Your name has been saved.
          </p>
        ) : null}
        <Button disabled={pending} size="pill-sm" type="submit" variant="pill">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function NameField({
  defaultValue,
  error,
  id,
  label,
  required = false,
}: {
  defaultValue: string;
  error?: string;
  id: "firstName" | "middleName" | "lastName";
  label: string;
  required?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <SettingsField error={error} errorId={errorId} htmlFor={id} label={label} required={required}>
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={
          id === "firstName"
            ? "given-name"
            : id === "lastName"
              ? "family-name"
              : "additional-name"
        }
        className={fieldClass}
        defaultValue={defaultValue}
        id={id}
        name={id}
        required={required}
      />
    </SettingsField>
  );
}
