"use client";

import { useActionState } from "react";
import {
  type ProfileNameState,
  saveCustomerName,
} from "@/app/(site)/(protected)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <NameField
        error={state.fieldErrors?.middleName?.[0]}
        id="middleName"
        label="Middle name (optional)"
        defaultValue={middleName ?? ""}
      />
      <div className="flex items-end sm:col-start-1">
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save name"}
        </Button>
      </div>
      {state.saved ? (
        <p className="text-sm text-green-700 sm:col-span-2" role="status">
          Your name has been saved.
        </p>
      ) : null}
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
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
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
        defaultValue={defaultValue}
        id={id}
        name={id}
        required={required}
      />
      {error ? (
        <p className="text-sm text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
