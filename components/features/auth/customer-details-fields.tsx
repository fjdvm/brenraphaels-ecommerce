import Link from "next/link";
import type { FormEventHandler } from "react";

import { LocationFields } from "@/components/features/auth/location-fields";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizePhoneInput,
  sanitizePostalCodeInput,
  sanitizeStreetInput,
} from "@/components/features/customer/input-sanitizers";

export type FieldErrors = Record<string, string[] | undefined>;

type FieldProps = {
  name: string;
  label: string;
  type?: "date" | "email" | "password" | "tel" | "text";
  autoComplete?: string;
  maxLength: number;
  optional?: boolean;
  defaultValue?: string;
  error?: string;
  onInput?: FormEventHandler<HTMLInputElement>;
};

export function Field({
  name,
  label,
  type = "text",
  autoComplete,
  maxLength,
  optional,
  defaultValue,
  error,
  onInput,
}: FieldProps) {
  const errorId = `${name}-error`;
  const Control = type === "password" ? PasswordInput : Input;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name} required={!optional} className={fieldLabelClass}>
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-muted">(optional)</span>
        ) : null}
      </Label>
      <Control
        id={name}
        name={name}
        className={fieldClass}
        {...(type === "password" ? {} : { type })}
        autoComplete={autoComplete}
        maxLength={maxLength}
        defaultValue={defaultValue}
        inputMode={type === "tel" ? "tel" : undefined}
        autoCapitalize={type === "email" ? "none" : undefined}
        spellCheck={type === "text" ? undefined : false}
        onInput={onInput}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        required={!optional}
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FieldError({ error }: { error?: string }) {
  return error ? (
    <p className="text-sm text-red-700" role="alert">
      {error}
    </p>
  ) : null;
}

type NameFieldsProps = {
  errors: FieldErrors;
  defaults?: { firstName?: string; middleName?: string; lastName?: string };
};

export function NameFields({ errors, defaults }: NameFieldsProps) {
  return (
    <>
      <Field
        name="firstName"
        label="First name"
        autoComplete="given-name"
        maxLength={50}
        defaultValue={defaults?.firstName}
        error={errors.firstName?.[0]}
        onInput={sanitizeNameInput}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="middleName"
          label="Middle name"
          autoComplete="additional-name"
          maxLength={50}
          optional
          defaultValue={defaults?.middleName}
          error={errors.middleName?.[0]}
          onInput={sanitizeNameInput}
        />
        <Field
          name="lastName"
          label="Last name"
          autoComplete="family-name"
          maxLength={50}
          defaultValue={defaults?.lastName}
          error={errors.lastName?.[0]}
          onInput={sanitizeNameInput}
        />
      </div>
    </>
  );
}

export function DeliveryFields({
  errors,
  provinces,
}: {
  errors: FieldErrors;
  provinces: string[];
}) {
  return (
    <>
      <Field
        name="contactNumber"
        label="Contact number"
        type="tel"
        autoComplete="tel"
        maxLength={30}
        error={errors.contactNumber?.[0]}
        onInput={sanitizePhoneInput}
      />
      <Field
        name="street"
        label="Street"
        autoComplete="street-address"
        maxLength={100}
        error={errors.street?.[0]}
        onInput={sanitizeStreetInput}
      />
      <LocationFields provinces={provinces} errors={errors} />
      <Field
        name="postalCode"
        label="Postal code"
        autoComplete="postal-code"
        maxLength={4}
        error={errors.postalCode?.[0]}
        onInput={sanitizePostalCodeInput}
      />
      <p className="text-sm text-on-surface-variant">
        This becomes your Home Address and your Default address.
      </p>
    </>
  );
}

const newTab = { target: "_blank", rel: "noopener noreferrer" } as const;

/** The Marketing opt-in question (never pre-selected) and the terms checkbox. */
export function PreferenceFields({ errors }: { errors: FieldErrors }) {
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="font-medium">
          Would you like marketing emails?
          <span aria-hidden="true" className="ml-0.5 text-red-700">
            *
          </span>
        </legend>
        <div className="flex gap-6">
          <Label className="flex min-h-11 items-center gap-2 font-normal" htmlFor="marketing-yes">
            <input
              id="marketing-yes"
              type="radio"
              name="marketingOptIn"
              value="yes"
              className="size-5"
              required
            />
            Yes
          </Label>
          <Label className="flex min-h-11 items-center gap-2 font-normal" htmlFor="marketing-no">
            <input
              id="marketing-no"
              type="radio"
              name="marketingOptIn"
              value="no"
              className="size-5"
              required
            />
            No
          </Label>
        </div>
        <FieldError error={errors.marketingOptIn?.[0]} />
      </fieldset>

      <div className="space-y-2">
        <Label className="flex min-h-11 items-start gap-3 font-normal" htmlFor="terms">
          <input id="terms" type="checkbox" name="terms" className="mt-0.5 size-5 shrink-0" required />
          <span>
            I accept the{" "}
            <Link className="text-primary underline" href="/terms" {...newTab}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link className="text-primary underline" href="/privacy" {...newTab}>
              Privacy Policy
            </Link>
            .
            <span aria-hidden="true" className="ml-0.5 text-red-700">
              *
            </span>
          </span>
        </Label>
        <FieldError error={errors.terms?.[0]} />
      </div>
    </>
  );
}
