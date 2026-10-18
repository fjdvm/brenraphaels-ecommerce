"use client";

import { Upload, Wallet } from "lucide-react";
import { useActionState, useState } from "react";

import { submitPaymentProof, type PaymentProofState } from "@/app/(site)/(protected)/profile/orders/actions";
import { Button } from "@/components/ui/button";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPeso } from "@/lib/catalog/currency";

const initialState: PaymentProofState = {};

/** The warning panel where a Customer sends their GCash reference number and optional receipt. */
export function PaymentProofForm({ orderId, amountInCentavos }: { orderId: number; amountInCentavos: number }) {
  const [state, action, pending] = useActionState(submitPaymentProof.bind(null, orderId), initialState);
  const [fileName, setFileName] = useState<string>();
  const referenceError = state.fieldErrors?.gcashReferenceNumber?.[0];

  return (
    <form action={action} className="flex flex-col gap-[18px] rounded-[3px] bg-warning-soft p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <Wallet aria-hidden className="size-[22px] shrink-0 text-warning" strokeWidth={1.5} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-serif text-lg leading-[1.35] text-ink">Submit your GCash payment</p>
          <p className="text-sm tracking-[0.35px] text-body">
            Send {formatPeso(amountInCentavos)} via GCash, then enter the reference number from your receipt.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label className={fieldLabelClass} htmlFor={`gcash-reference-${orderId}`} required>GCash reference number</Label>
          <Input
            aria-describedby={referenceError ? `gcash-reference-${orderId}-error` : undefined}
            aria-invalid={Boolean(referenceError)}
            className={fieldClass}
            id={`gcash-reference-${orderId}`}
            inputMode="numeric"
            maxLength={20}
            name="gcashReferenceNumber"
            placeholder="e.g. 1234 567 890123"
            required
          />
          {referenceError ? (
            <p className="text-sm text-red-700" id={`gcash-reference-${orderId}-error`} role="alert">{referenceError}</p>
          ) : null}
        </div>
        <label
          className="flex cursor-pointer items-center gap-2.5 rounded-[3px] border border-dashed border-primary bg-white px-5 py-3.5 text-sm font-medium tracking-[0.35px] text-primary focus-within:ring-2 focus-within:ring-ring"
          htmlFor={`gcash-screenshot-${orderId}`}
        >
          <Upload aria-hidden className="size-[18px]" strokeWidth={1.5} />
          <span className="max-w-48 truncate">{fileName ?? "Add screenshot (optional)"}</span>
          <input
            accept="image/jpeg,image/png"
            className="sr-only"
            id={`gcash-screenshot-${orderId}`}
            name="screenshot"
            onChange={(event) => setFileName(event.target.files?.[0]?.name)}
            type="file"
          />
        </label>
        <Button disabled={pending} size="pill-lg" type="submit" variant="pill">
          {pending ? "Submitting…" : "Submit payment"}
        </Button>
      </div>
      {state.message ? <p className="text-sm font-medium text-primary" role="alert">{state.message}</p> : null}
    </form>
  );
}
