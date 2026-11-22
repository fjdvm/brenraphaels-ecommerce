"use client";

import { Check, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Field, type FieldErrors } from "@/components/features/auth/customer-details-fields";
import { Label } from "@/components/ui/label";
import { idTypes, type IdType } from "@/lib/senior-pwd/id-fields";
import { findIdNumber, readIdPhotoText } from "@/lib/senior-pwd/id-photo-reading";

const typeLabels: Record<IdType, string> = { senior: "Senior Citizen ID", pwd: "PWD ID" };

function Radio({ id, name, value, label, onChange }: { id: string; name: string; value: string; label: string; onChange?: () => void }) {
  return (
    <Label className="flex min-h-11 items-center gap-2 font-normal" htmlFor={id}>
      <input className="size-5" id={id} name={name} onChange={onChange} type="radio" value={value} />
      {label}
    </Label>
  );
}

function PhotoPicker({ name, label, hint, required, error, onPick }: {
  name: string; label: string; hint: string; required?: boolean; error?: string; onPick?: (file: File) => void;
}) {
  const [fileName, setFileName] = useState<string>();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex min-h-[113px] cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-primary bg-white px-4 py-4 text-center text-sm font-medium text-ink focus-within:ring-2 focus-within:ring-ring">
        {fileName ? <Check aria-hidden className="size-5 text-success" /> : <Upload aria-hidden className="size-5 text-primary" />}
        <span>{fileName ? `${fileName} · chosen` : label}</span>
        <span className="text-xs font-normal text-body">{fileName ? "Tap to replace" : hint}</span>
        <input
          accept="image/jpeg,image/png"
          aria-invalid={Boolean(error)}
          aria-label={`${label}${required ? " (required)" : ""}`}
          className="sr-only"
          name={name}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setFileName(file?.name);
            if (file) onPick?.(file);
          }}
          type="file"
        />
      </label>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

/**
 * "Are you a Senior Citizen or PWD?" and, for a yes, the ID's type, number and photo(s). The discount is then applied
 * automatically on every Order once Staff approve the ID, so checkout never asks. `askFirst` is false where the Customer has
 * already said yes (Account settings), which shows the ID fields straight away.
 */
type Reading = { state: "idle" } | { state: "reading" } | { state: "read"; number: string } | { state: "unread" };

/**
 * Reads the ID number off a chosen photo in the browser and fills the ID number field when it is still empty, so the
 * Customer only checks it. The number read also goes to the server as `idNumberRead`, where it is only compared with the
 * number sent (Staff see "differs"); it is never kept.
 */
function useIdNumberReading() {
  const container = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState<Reading>({ state: "idle" });
  const latest = useRef(0);

  async function read(file: File) {
    const attempt = ++latest.current;
    setReading((current) => (current.state === "read" ? current : { state: "reading" }));
    let number: string | undefined;
    try {
      number = findIdNumber(await readIdPhotoText(file));
    } catch {
      number = undefined;
    }
    if (attempt !== latest.current) return;
    if (!number) {
      setReading((current) => (current.state === "read" ? current : { state: "unread" }));
      return;
    }
    setReading({ state: "read", number });
    const input = container.current?.querySelector<HTMLInputElement>('input[name="idNumber"]');
    if (input && !input.value.trim()) input.value = number;
  }

  return { container, reading, read };
}

export function SeniorPwdFields({ errors, askFirst = true }: { errors: FieldErrors; askFirst?: boolean }) {
  const [yes, setYes] = useState(!askFirst);
  const { container, reading, read } = useIdNumberReading();
  return (
    <>
      {askFirst ? (
        <fieldset className="space-y-2">
          <legend className="font-medium">
            Are you a Senior Citizen or PWD?
            <span aria-hidden="true" className="ml-0.5 text-red-700">*</span>
          </legend>
          <p className="text-sm text-on-surface-variant">Verified Senior Citizens and PWDs get a discount on every order, applied automatically.</p>
          <div className="flex gap-6">
            <Radio id="senior-pwd-yes" label="Yes" name="seniorPwd" onChange={() => setYes(true)} value="yes" />
            <Radio id="senior-pwd-no" label="No" name="seniorPwd" onChange={() => setYes(false)} value="no" />
          </div>
          {errors.seniorPwd?.[0] ? <p className="text-sm text-red-700" role="alert">{errors.seniorPwd[0]}</p> : null}
        </fieldset>
      ) : null}
      {yes ? (
        <>
          <fieldset className="space-y-2">
            <legend className="font-medium">ID type<span aria-hidden="true" className="ml-0.5 text-red-700">*</span></legend>
            <div className="flex flex-wrap gap-6">
              {idTypes.map((type) => <Radio id={`senior-pwd-type-${type}`} key={type} label={typeLabels[type]} name="idType" value={type} />)}
            </div>
            {errors.idType?.[0] ? <p className="text-sm text-red-700" role="alert">{errors.idType[0]}</p> : null}
          </fieldset>
          <div className="flex flex-col gap-2" ref={container}>
            <Field autoComplete="off" error={errors.idNumber?.[0]} label="ID number" maxLength={30} name="idNumber" />
            <input name="idNumberRead" type="hidden" value={reading.state === "read" ? reading.number : ""} />
            <p aria-live="polite" className="text-xs text-body">
              {reading.state === "reading" ? "Reading the number from your ID…"
                : reading.state === "read" ? "Read from your ID: check it matches the number on the card."
                  : reading.state === "unread" ? "We couldn't read the number from the photo; please type it."
                    : "Choose a photo of your ID and we'll fill in the number for you to check."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoPicker error={errors.idFront?.[0]} hint="JPEG or PNG up to 5 MB" label="Front of ID" name="idFront" onPick={(file) => void read(file)} required />
            <PhotoPicker
              error={errors.idBack?.[0]}
              hint="JPEG or PNG up to 5 MB"
              label="Back of ID (if the number is there)"
              name="idBack"
              onPick={(file) => { if (reading.state !== "read") void read(file); }}
            />
          </div>
          <p className="flex items-start gap-3 bg-lavender-soft p-4 text-xs leading-normal tracking-wide text-ink">
            <ShieldCheck aria-hidden className="size-[18px] shrink-0 text-primary" />
            Our team checks your ID (usually within 2 hours). We delete the photo after checking and keep only that you&apos;re verified. Until then your orders are at full price. Bring the ID if you pick up in store.
          </p>
        </>
      ) : null}
    </>
  );
}
