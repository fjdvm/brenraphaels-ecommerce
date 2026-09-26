"use client";

import { useActionState, useState } from "react";

import {
  addAddress,
  makeDefaultAddress,
  type ProfileAddressState,
  removeAddress,
  updateAddress,
} from "@/app/(site)/(protected)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationFields } from "@/components/features/auth/location-fields";
import { addressLabels } from "@/lib/customer/address-fields";
import type { CustomerAddress } from "@/lib/customer/visitor";
import { sanitizePostalCodeInput, sanitizeStreetInput } from "./input-sanitizers";

const initialProfileAddressState: ProfileAddressState = {};

export function AddressForms({
  addresses,
  provinces,
}: {
  addresses: CustomerAddress[];
  provinces: string[];
}) {
  const [notice, setNotice] = useState<ProfileAddressState>({});

  return (
    <div className="mt-4 space-y-4">
      <div aria-live="polite">
        {notice.message ? <Status state={notice} /> : null}
      </div>
      {addresses.map((address) => (
        <AddressEditor key={address.id} address={address} onNotice={setNotice} provinces={provinces} />
      ))}
      <AddAddressForm provinces={provinces} />
    </div>
  );
}

function AddressEditor({
  address,
  onNotice,
  provinces,
}: {
  address: CustomerAddress;
  onNotice: (result: ProfileAddressState) => void;
  provinces: string[];
}) {
  const [state, action, pending] = useActionState(
    updateAddress,
    initialProfileAddressState,
  );
  // The card unmounts when its Address is deleted, so these confirmations are
  // reported to the parent, which outlives it.
  const [, defaultAction, defaultPending] = useActionState(
    async (previousState: ProfileAddressState, formData: FormData) => {
      const result = await makeDefaultAddress(previousState, formData);
      onNotice(result);
      return result;
    },
    initialProfileAddressState,
  );
  const [, deleteAction, deletePending] = useActionState(
    async (previousState: ProfileAddressState, formData: FormData) => {
      const result = await removeAddress(previousState, formData);
      onNotice(result);
      return result;
    },
    initialProfileAddressState,
  );

  return (
    <article className="border border-outline-variant/60 p-4 text-on-surface">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          {address.label}
          {address.isDefault ? (
            <span className="ml-2 rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-secondary">
              Default address
            </span>
          ) : null}
        </h3>
        <form action={defaultAction}>
          <input name="addressId" type="hidden" value={address.id} />
          <Button
            disabled={address.isDefault || defaultPending}
            type="submit"
            variant="outline"
          >
            {defaultPending ? "Setting…" : "Set as default"}
          </Button>
        </form>
      </div>
      <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
        <input name="addressId" type="hidden" value={address.id} />
        <LabelSelect defaultValue={address.label} id={`label-${address.id}`} />
        <AddressFieldValues address={address} errors={state.fieldErrors} provinces={provinces} />
        <p className="text-sm text-on-surface-variant sm:col-span-2">Philippines</p>
        {state.message ? <Status state={state} /> : null}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button disabled={pending} type="submit">
            {pending ? "Saving…" : "Save Address"}
          </Button>
        </div>
      </form>
      <form action={deleteAction} className="mt-3">
        <input name="addressId" type="hidden" value={address.id} />
        <Button disabled={deletePending} type="submit" variant="ghost">
          {deletePending ? "Deleting…" : "Delete Address"}
        </Button>
      </form>
    </article>
  );
}

function AddAddressForm({ provinces }: { provinces: string[] }) {
  const [state, action, pending] = useActionState(addAddress, initialProfileAddressState);

  return (
    <form action={action} className="border border-outline-variant/60 p-4">
      <h3 className="font-semibold text-on-surface">Add an Address</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <LabelSelect defaultValue="Home" id="new-label" />
        <AddressFieldValues errors={state.fieldErrors} provinces={provinces} />
        <p className="text-sm text-on-surface-variant sm:col-span-2">Country: Philippines</p>
        {state.message ? <Status state={state} /> : null}
        <Button disabled={pending} type="submit">
          {pending ? "Adding…" : "Add Address"}
        </Button>
      </div>
    </form>
  );
}

function AddressFieldValues({
  address,
  errors,
  provinces,
}: {
  address?: CustomerAddress;
  errors?: Record<string, string[] | undefined>;
  provinces: string[];
}) {
  const streetError = errors?.street?.[0];
  const postalError = errors?.postalCode?.[0];
  const suffix = address ? `-${address.id}` : "-new";
  return (
    <>
      <div className="sm:col-span-2">
        <Label htmlFor={`street${suffix}`} required>
          Street address
        </Label>
        <Input
          aria-describedby={streetError ? `street${suffix}-error` : undefined}
          aria-invalid={Boolean(streetError)}
          autoComplete="street-address"
          defaultValue={address?.street}
          id={`street${suffix}`}
          name="street"
          onInput={sanitizeStreetInput}
          required
        />
        {streetError ? <FieldError id={`street${suffix}-error`} error={streetError} /> : null}
      </div>
      <LocationFields
        defaults={address}
        errors={errors ?? {}}
        idSuffix={suffix}
        provinces={provinces}
      />
      <div>
        <Label htmlFor={`postalCode${suffix}`} required>
          Postal code
        </Label>
        <Input
          aria-describedby={postalError ? `postalCode${suffix}-error` : undefined}
          aria-invalid={Boolean(postalError)}
          autoComplete="postal-code"
          defaultValue={address?.postalCode}
          id={`postalCode${suffix}`}
          inputMode="numeric"
          maxLength={4}
          name="postalCode"
          onInput={sanitizePostalCodeInput}
          required
        />
        {postalError ? <FieldError id={`postalCode${suffix}-error`} error={postalError} /> : null}
      </div>
    </>
  );
}

function FieldError({ id, error }: { id: string; error: string }) {
  return <p className="mt-1 text-sm text-red-700" id={id} role="alert">{error}</p>;
}

function LabelSelect({ defaultValue, id }: { defaultValue: string; id: string }) {
  return (
    <>
      <Label className="sm:col-span-2" htmlFor={id} required>
        Label
      </Label>
      <select
        className="h-10 border border-input bg-white px-3 text-sm focus:ring-2 focus:ring-ring sm:col-span-2"
        defaultValue={defaultValue}
        id={id}
        name="label"
      >
        {addressLabels.map((label) => (
          <option key={label}>{label}</option>
        ))}
      </select>
    </>
  );
}

function Status({ state }: { state: ProfileAddressState }) {
  return (
    <p
      className={`text-sm sm:col-span-2 ${state.failed ? "text-red-700" : "text-green-700"}`}
      role={state.failed ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}
