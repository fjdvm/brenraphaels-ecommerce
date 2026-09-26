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
import { addressLabels } from "@/lib/customer/address-fields";
import type { CustomerAddress } from "@/lib/customer/visitor";

const initialProfileAddressState: ProfileAddressState = {};

const addressFields = [
  { name: "street", label: "Street address", autoComplete: "street-address" },
  { name: "barangay", label: "Barangay", autoComplete: "address-level3" },
  { name: "city", label: "City or municipality", autoComplete: "address-level2" },
  { name: "province", label: "Province", autoComplete: "address-level1" },
  { name: "postalCode", label: "Postal code", autoComplete: "postal-code" },
] as const;

export function AddressForms({ addresses }: { addresses: CustomerAddress[] }) {
  const [notice, setNotice] = useState<ProfileAddressState>({});

  return (
    <div className="mt-4 space-y-4">
      <div aria-live="polite">
        {notice.message ? <Status state={notice} /> : null}
      </div>
      {addresses.map((address) => (
        <AddressEditor key={address.id} address={address} onNotice={setNotice} />
      ))}
      <AddAddressForm />
    </div>
  );
}

function AddressEditor({
  address,
  onNotice,
}: {
  address: CustomerAddress;
  onNotice: (result: ProfileAddressState) => void;
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
    <article className="rounded-xl border border-outline-variant/60 p-4 text-on-surface">
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
        <AddressFieldValues address={address} errors={state.fieldErrors} />
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

function AddAddressForm() {
  const [state, action, pending] = useActionState(addAddress, initialProfileAddressState);

  return (
    <form action={action} className="rounded-xl border border-outline-variant/60 p-4">
      <h3 className="font-semibold text-on-surface">Add an Address</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <LabelSelect defaultValue="Home" id="new-label" />
        <AddressFieldValues errors={state.fieldErrors} />
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
}: {
  address?: CustomerAddress;
  errors?: Record<string, string[] | undefined>;
}) {
  return addressFields.map((field) => {
    const id = address ? `${field.name}-${address.id}` : `new-${field.name}`;
    const error = errors?.[field.name]?.[0];
    const errorId = `${id}-error`;
    return (
      <div className={field.name === "street" ? "sm:col-span-2" : ""} key={field.name}>
        <Label htmlFor={id} required>
          {field.label}
        </Label>
        <Input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          autoComplete={field.autoComplete}
          defaultValue={address?.[field.name]}
          id={id}
          name={field.name}
          required
        />
        {error ? (
          <p className="mt-1 text-sm text-red-700" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  });
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
