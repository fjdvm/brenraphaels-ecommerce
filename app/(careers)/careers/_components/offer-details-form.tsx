"use client";

import { useState, type FormEvent } from "react";

import { saveOfferDetailsAction } from "@/app/(careers)/careers/(portal)/applications/actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fieldClass } from "@/components/ui/field-styles";
import { civilStatusOptions, sexOptions, type OfferDetails } from "@/lib/careers/offer-details";
import { manilaToday } from "@/lib/careers/application-offer";

import { Field, fieldProps } from "./field";

type Errors = Partial<Record<keyof OfferDetails, string>>;

/**
 * "Your details": what HR needs before the first day. Optional, never required to be hired, saved through HRMS,
 * and editable until the Offer is hired. The saved answers are shown again on return.
 */
export function OfferDetailsForm({ referenceNumber, initial }: { referenceNumber: string; initial: OfferDetails }) {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<{ kind: "saved" | "error"; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus(null);
    try {
      const outcome = await saveOfferDetailsAction(new FormData(event.currentTarget));
      if (outcome.ok) {
        setErrors({});
        setStatus({ kind: "saved", message: "Your details are saved. You can change them until you're hired." });
      } else {
        setErrors(outcome.errors ?? {});
        setStatus({ kind: "error", message: outcome.message });
      }
    } catch {
      setStatus({ kind: "error", message: "We couldn't save your details. Try again." });
    } finally {
      setPending(false);
    }
  }

  const text = (name: keyof OfferDetails, label: string, extra: { hint?: string; inputMode?: "numeric" | "tel"; autoComplete?: string; maxLength?: number } = {}) => (
    <Field id={`details-${name}`} label={label} error={errors[name]} hint={extra.hint}>
      <Input {...fieldProps(`details-${name}`, errors[name])} name={name} defaultValue={initial[name]} inputMode={extra.inputMode} autoComplete={extra.autoComplete ?? "off"} maxLength={extra.maxLength ?? 100} className={fieldClass} />
    </Field>
  );
  const choice = (name: "sex" | "civilStatus", label: string, options: readonly string[]) => (
    <Field id={`details-${name}`} label={label} error={errors[name]}>
      <Select {...fieldProps(`details-${name}`, errors[name])} name={name} defaultValue={initial[name]} className={fieldClass}>
        <option value="">Prefer not to say</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
    </Field>
  );

  return (
    <section aria-labelledby="details-heading" className="flex flex-col gap-5 border border-line bg-white px-5 pb-[22px] pt-6 sm:gap-6 sm:px-11 sm:pb-10 sm:pt-11">
      <div className="flex flex-col gap-1.5">
        <h2 id="details-heading" className="font-serif text-lg leading-[1.35] text-primary sm:text-[28px] sm:leading-[1.25]">Your details</h2>
        <p className="text-sm tracking-[0.35px] text-body">
          Optional, and you can still be hired without them. Sharing them now helps HR prepare your records before your first day. You can change them until you&apos;re hired.
        </p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <input type="hidden" name="referenceNumber" value={referenceNumber} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="details-birthday" label="Birthday" error={errors.birthday}>
            <Input {...fieldProps("details-birthday", errors.birthday)} type="date" name="birthday" defaultValue={initial.birthday} max={manilaToday()} autoComplete="bday" className={fieldClass} />
          </Field>
          {choice("sex", "Sex", sexOptions)}
          {choice("civilStatus", "Civil status", civilStatusOptions)}
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-medium tracking-[0.35px] text-ink">Government ID numbers</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("sss", "SSS number", { inputMode: "numeric", hint: "10 digits", maxLength: 30 })}
            {text("philhealth", "PhilHealth number", { inputMode: "numeric", hint: "12 digits", maxLength: 30 })}
            {text("pagibigMid", "Pag-IBIG MID", { inputMode: "numeric", hint: "12 digits", maxLength: 30 })}
            {text("tin", "TIN", { inputMode: "numeric", hint: "9 or 12 digits", maxLength: 30 })}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-medium tracking-[0.35px] text-ink">Emergency contact</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {text("emergencyName", "Name", { autoComplete: "off" })}
            {text("emergencyRelationship", "Relationship", { maxLength: 50 })}
            {text("emergencyMobile", "Mobile number", { inputMode: "tel", maxLength: 20 })}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} aria-busy={pending} className="rounded-full bg-primary px-9 py-3.5 text-base tracking-[0.45px] text-white disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? "Saving…" : "Save details"}
          </button>
          {status ? <p role="status" className={`text-sm tracking-[0.35px] ${status.kind === "error" ? "text-red-700" : "text-success"}`}>{status.message}</p> : null}
        </div>
      </form>
    </section>
  );
}
