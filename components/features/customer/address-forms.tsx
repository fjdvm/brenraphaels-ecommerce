"use client";

import { MapPin, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useRef, useState, type ReactNode } from "react";

import {
  addAddress,
  makeDefaultAddress,
  type ProfileAddressState,
  removeAddress,
  updateAddress,
} from "@/app/(site)/(protected)/profile/actions";
import { LocationFields } from "@/components/features/auth/location-fields";
import { Button } from "@/components/ui/button";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addressLabels } from "@/lib/customer/address-fields";
import type { CustomerAddress } from "@/lib/customer/visitor";
import { cn } from "@/lib/utils";
import { sanitizePostalCodeInput, sanitizeStreetInput } from "./input-sanitizers";

const initialProfileAddressState: ProfileAddressState = {};

type Editing = number | "new" | null;

/** The Address book: saved Address cards, and one form that edits an Address or adds a new one. */
export function AddressForms({
  addresses,
  provinces,
  recipient,
  initialEditing = null,
}: {
  addresses: CustomerAddress[];
  provinces: string[];
  recipient: { name: string; contactNumber: string };
  initialEditing?: Editing;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // The heading's "Add address" button links here with ?add=1.
  const addRequested = useSearchParams().get("add") === "1";
  const [chosen, setEditing] = useState<Editing>(initialEditing);
  const editing: Editing = addRequested ? "new" : chosen;
  const [notice, setNotice] = useState<ProfileAddressState>({});
  const formRef = useRef<HTMLDivElement>(null);
  const editedAddress = typeof editing === "number" ? addresses.find((address) => address.id === editing) : undefined;

  function open(next: Editing) {
    setNotice({});
    setEditing(next);
    if (addRequested) router.replace(pathname, { scroll: false });
    // The form sits below the cards, so bring it into view once it has rendered.
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function close() {
    setEditing(null);
    if (addRequested) router.replace(pathname, { scroll: false });
  }

  function finished(result: ProfileAddressState) {
    setNotice(result);
    if (!result.failed) close();
  }

  return (
    <div className="flex flex-col gap-[30px]" id="address-book">
      <div aria-live="polite">{notice.message ? <Status state={notice} /> : null}</div>
      <div className="grid gap-5 md:grid-cols-2">
        {addresses.map((address) => (
          <AddressCard
            address={address}
            key={address.id}
            onEdit={() => open(address.id)}
            onNotice={finished}
            recipient={recipient}
            selected={editing === address.id}
          />
        ))}
        <button
          className={cn(
            "flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-[40px] border border-dashed border-primary p-8 text-center transition-colors hover:bg-lavender-soft",
            editing === "new" && "bg-lavender-soft",
          )}
          onClick={() => open("new")}
          type="button"
        >
          <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-lavender text-primary">
            <Plus className="size-5" strokeWidth={1.5} />
          </span>
          <span className="text-sm font-medium tracking-[0.35px] text-primary">Add a new address</span>
          <span className="text-xs tracking-[0.35px] text-muted">Work, parents&apos; house, and more</span>
        </button>
      </div>
      {editing !== null ? (
        <div ref={formRef}>
          <AddressForm
            address={editedAddress}
            key={editing}
            onCancel={close}
            onSaved={finished}
            provinces={provinces}
          />
        </div>
      ) : null}
    </div>
  );
}

function AddressCard({
  address,
  recipient,
  selected,
  onEdit,
  onNotice,
}: {
  address: CustomerAddress;
  recipient: { name: string; contactNumber: string };
  selected: boolean;
  onEdit: () => void;
  onNotice: (result: ProfileAddressState) => void;
}) {
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
    <article
      className={cn(
        "flex flex-col gap-3.5 rounded-[40px] bg-white p-8",
        selected ? "border-2 border-primary" : "border border-line",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <MapPin aria-hidden className="size-[18px] text-primary" strokeWidth={1.5} />
        <h2 className="font-serif text-[22px] leading-[1.3] text-primary">{address.label}</h2>
        {address.isDefault ? (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium tracking-[0.35px] text-white">Default</span>
        ) : null}
      </div>
      <p className="text-sm font-medium tracking-[0.35px] text-ink">
        {recipient.name} · {recipient.contactNumber}
      </p>
      <p className="text-sm leading-[1.6] tracking-[0.35px] text-body">
        {address.street}, {address.barangay}, {address.city}, {address.province} {address.postalCode}
        <br />
        {address.country}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm tracking-[0.35px]">
        <button className="font-medium text-primary hover:underline" onClick={onEdit} type="button">
          Edit
        </button>
        <form action={deleteAction}>
          <input name="addressId" type="hidden" value={address.id} />
          <button className="font-medium text-primary hover:underline disabled:opacity-50" disabled={deletePending} type="submit">
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </form>
        {address.isDefault ? null : (
          <form action={defaultAction}>
            <input name="addressId" type="hidden" value={address.id} />
            <button className="font-medium text-primary hover:underline disabled:opacity-50" disabled={defaultPending} type="submit">
              {defaultPending ? "Setting…" : "Set as default"}
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

function AddressForm({
  address,
  provinces,
  onCancel,
  onSaved,
}: {
  address?: CustomerAddress;
  provinces: string[];
  onCancel: () => void;
  onSaved: (result: ProfileAddressState) => void;
}) {
  const [state, action, pending] = useActionState(
    async (previousState: ProfileAddressState, formData: FormData) => {
      const result = await (address ? updateAddress : addAddress)(previousState, formData);
      if (result.message) onSaved(result);
      return result;
    },
    initialProfileAddressState,
  );
  const suffix = address ? `-${address.id}` : "-new";
  const streetError = state.fieldErrors?.street?.[0];
  const postalError = state.fieldErrors?.postalCode?.[0];

  return (
    <form action={action} className="flex flex-col gap-5 rounded-[40px] border border-line bg-white p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-[28px] leading-[1.25] text-primary">{address ? "Edit address" : "Add address"}</h2>
        {address ? (
          <span className="rounded-full bg-lavender px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary">Editing: {address.label}</span>
        ) : null}
      </div>
      {address ? <input name="addressId" type="hidden" value={address.id} /> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className={cn(fieldLabelClass, "mb-2")}>
          Label<span aria-hidden className="ml-0.5 text-red-700">*</span>
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {addressLabels.map((label) => (
            <label className="cursor-pointer" key={label}>
              <input
                className="peer sr-only"
                defaultChecked={label === (address?.label ?? "Home")}
                name="label"
                type="radio"
                value={label}
              />
              <span className="block rounded-full border border-line bg-white px-[18px] py-2.5 text-sm font-medium tracking-[0.35px] text-ink transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormField error={streetError} id={`street${suffix}`} label="Street address" required>
        <Input
          aria-describedby={streetError ? `street${suffix}-error` : undefined}
          aria-invalid={Boolean(streetError)}
          autoComplete="street-address"
          className={fieldClass}
          defaultValue={address?.street}
          id={`street${suffix}`}
          name="street"
          onInput={sanitizeStreetInput}
          required
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <LocationFields defaults={address} errors={state.fieldErrors ?? {}} idSuffix={suffix} inline provinces={provinces} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField error={postalError} id={`postalCode${suffix}`} label="Postal code" required>
          <Input
            aria-describedby={postalError ? `postalCode${suffix}-error` : undefined}
            aria-invalid={Boolean(postalError)}
            autoComplete="postal-code"
            className={fieldClass}
            defaultValue={address?.postalCode}
            id={`postalCode${suffix}`}
            inputMode="numeric"
            maxLength={4}
            name="postalCode"
            onInput={sanitizePostalCodeInput}
            required
          />
        </FormField>
        <FormField id={`country${suffix}`} label="Country">
          <Input
            aria-readonly="true"
            className={`${fieldClass} bg-surface-soft`}
            id={`country${suffix}`}
            readOnly
            value="Philippines"
          />
        </FormField>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-3 text-sm tracking-[0.35px] text-ink">
        <input
          className="peer sr-only"
          defaultChecked={address?.isDefault ?? false}
          disabled={address?.isDefault}
          name="isDefault"
          type="checkbox"
        />
        <span
          aria-hidden
          className="relative h-5 w-9 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-60"
        />
        Set as default address
      </label>
      {state.message && state.failed ? <Status state={state} /> : null}
      <div className="flex items-center justify-end gap-3">
        <Button onClick={onCancel} size="pill-sm" type="button" variant="link">
          Cancel
        </Button>
        <Button disabled={pending} size="pill-lg" type="submit" variant="pill">
          {pending ? "Saving…" : "Save address"}
        </Button>
      </div>
    </form>
  );
}

function FormField({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className={fieldLabelClass} htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-sm text-red-700" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Status({ state }: { state: ProfileAddressState }) {
  return (
    <p className={state.failed ? "text-sm text-red-700" : "text-sm text-green-700"} role={state.failed ? "alert" : "status"}>
      {state.message}
    </p>
  );
}
