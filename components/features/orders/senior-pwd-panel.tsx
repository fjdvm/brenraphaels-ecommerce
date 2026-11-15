"use client";

import { Check, ShieldCheck, Upload } from "lucide-react";
import { useState, useTransition } from "react";

import { uploadSeniorPwdPhoto } from "@/app/(site)/(protected)/checkout/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPeso } from "@/lib/catalog/currency";
import type { Cart } from "@/lib/orders/cart";
import { seniorPwdDiscount, type IdType } from "@/lib/senior-pwd/id-number";

export type SeniorPwdDraft = {
  enabled: boolean;
  idType: IdType;
  idNumber: string;
  front: { fileId: string; name: string } | null;
  back: { fileId: string; name: string } | null;
  lineId: number | undefined;
};

export const emptySeniorPwdDraft: SeniorPwdDraft = { enabled: false, idType: "senior", idNumber: "", front: null, back: null, lineId: undefined };

/** What the Customer already has: an approved ID needs no new upload. */
export type SeniorPwdStanding = { verified: boolean; expiresOn: string | null };

/** True when the checkout has everything the discount needs, or the discount is off. */
export function seniorPwdReady(draft: SeniorPwdDraft, standing: SeniorPwdStanding): boolean {
  if (!draft.enabled) return true;
  if (draft.lineId === undefined) return false;
  return standing.verified || (draft.idNumber.trim().length >= 4 && draft.front !== null);
}

/** The 5% for the chosen item, or 0. */
export function seniorPwdDiscountFor(cart: Cart, draft: SeniorPwdDraft): number {
  const line = draft.enabled ? cart.lines.find((candidate) => candidate.id === draft.lineId) : undefined;
  return line ? seniorPwdDiscount(line.priceInCentavos) : 0;
}

const TYPES: { value: IdType; label: string }[] = [{ value: "senior", label: "Senior Citizen ID" }, { value: "pwd", label: "PWD ID" }];

function PhotoBox({ label, hint, side, value, onChange, required }: {
  label: string; hint: string; side: "front" | "back"; required?: boolean;
  value: { fileId: string; name: string } | null; onChange: (value: { fileId: string; name: string } | null) => void;
}) {
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string>();
  function pick(file: File | undefined) {
    if (!file) return;
    setProblem(undefined);
    start(async () => {
      const form = new FormData();
      form.set("photo", file);
      try {
        const result = await uploadSeniorPwdPhoto(form);
        if (result.fileId) onChange({ fileId: result.fileId, name: file.name });
        else setProblem(result.message ?? "We couldn't upload that photo.");
      } catch {
        setProblem("We couldn't upload that photo. Please try again.");
      }
    });
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex min-h-[113px] cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-primary bg-white px-4 py-4 text-center text-sm font-medium text-ink focus-within:ring-2 focus-within:ring-ring">
        {value ? <Check aria-hidden className="size-5 text-success" /> : <Upload aria-hidden className="size-5 text-primary" />}
        <span>{pending ? "Uploading…" : value ? `${value.name} · uploaded` : label}</span>
        <span className="text-xs font-normal text-body">{value ? "Tap to replace" : hint}</span>
        <input accept="image/jpeg,image/png" aria-label={`${side === "front" ? "Front" : "Back"} of ID photo${required ? " (required)" : ""}`} className="sr-only" disabled={pending} onChange={(event) => pick(event.target.files?.[0])} type="file" />
      </label>
      {problem ? <p role="alert" className="text-sm text-warning">{problem}</p> : null}
    </div>
  );
}

/** Checkout step 4 (Figma "Store · Checkout · Senior Citizen / PWD discount"). Collects only the ID photo(s), type and number. */
export function SeniorPwdPanel({ cart, draft, onChange, standing }: {
  cart: Cart; draft: SeniorPwdDraft; onChange: (draft: SeniorPwdDraft) => void; standing: SeniorPwdStanding;
}) {
  const set = (patch: Partial<SeniorPwdDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="flex flex-col gap-5">
      <label className="flex cursor-pointer items-start gap-4 border border-line bg-white px-6 py-5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
        <input checked={draft.enabled} className="mt-1 size-[18px] accent-primary" onChange={(event) => set({ enabled: event.target.checked, lineId: event.target.checked ? (draft.lineId ?? cart.lines[0]?.id) : draft.lineId })} type="checkbox" />
        <span className="flex flex-col gap-1 leading-normal tracking-wide">
          <span className="text-sm font-medium text-ink">I&apos;m a Senior Citizen or PWD</span>
          <span className="text-xs text-body">5% off 1 item per valid ID · for personal use</span>
        </span>
      </label>
      {draft.enabled ? (
        <>
          {standing.verified ? (
            <p className="flex items-start gap-2.5 bg-success-soft p-4 text-xs leading-normal tracking-wide text-ink">
              <Check aria-hidden className="size-[18px] shrink-0 text-success" />
              You&apos;re already verified until {standing.expiresOn}. No need to upload your ID again.
            </p>
          ) : (
            <>
              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="sr-only">ID type</legend>
                {TYPES.map(({ value, label }) => (
                  <label key={value} className={`flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-medium text-ink ${draft.idType === value ? "border-2 border-primary bg-lavender-soft" : "border border-line bg-white"}`}>
                    <input checked={draft.idType === value} className="size-[18px] accent-primary" name="senior-pwd-type" onChange={() => set({ idType: value })} type="radio" value={value} />
                    {label}
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senior-pwd-number" required>ID number</Label>
                <Input autoComplete="off" id="senior-pwd-number" maxLength={30} onChange={(event) => set({ idNumber: event.target.value })} placeholder="e.g. ANT-SC-0458721" value={draft.idNumber} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <PhotoBox hint="JPEG or PNG up to 5 MB" label="Front of ID" required side="front" value={draft.front} onChange={(front) => set({ front })} />
                <PhotoBox hint="JPEG or PNG up to 5 MB" label="Back of ID (if the number is there)" side="back" value={draft.back} onChange={(back) => set({ back })} />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senior-pwd-line" required>Apply the discount to</Label>
            <select className="h-[51px] w-full border border-input bg-white px-4 text-sm" id="senior-pwd-line" onChange={(event) => set({ lineId: Number(event.target.value) })} value={draft.lineId ?? ""}>
              {cart.lines.map((line) => (
                <option key={line.id} value={line.id}>1 × {line.productName} · {line.sizeLabel} ({formatPeso(line.priceInCentavos)})</option>
              ))}
            </select>
          </div>
          <p className="flex items-start gap-3 bg-lavender-soft p-4 text-xs leading-normal tracking-wide text-ink">
            <ShieldCheck aria-hidden className="size-[18px] shrink-0 text-primary" />
            Our team checks your ID before confirming your order (usually within 2 hours). We delete the photo after checking and keep only that you&apos;re verified — you won&apos;t need to upload it again. Bring the ID if you pick up in store.
          </p>
        </>
      ) : null}
    </div>
  );
}
