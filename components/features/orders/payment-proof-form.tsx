"use client";

import { useActionState } from "react";

import { submitPaymentProof, type PaymentProofState } from "@/app/(site)/(protected)/profile/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PaymentProofState = {};

export function PaymentProofForm({ orderId }: { orderId: number }) {
  const [state, action, pending] = useActionState(submitPaymentProof.bind(null, orderId), initialState);
  const referenceError = state.fieldErrors?.gcashReferenceNumber?.[0];

  return (
    <form action={action} className="mt-4 rounded-md border border-outline-variant/60 p-5">
      <p className="font-semibold text-on-surface">Submit your GCash payment</p>
      <p className="mt-1 text-sm text-on-surface-variant">
        Pay via GCash, then enter the reference number from your receipt.
      </p>
      <div className="mt-3">
        <Label htmlFor={`gcash-reference-${orderId}`} required>GCash reference number</Label>
        <Input
          aria-describedby={referenceError ? `gcash-reference-${orderId}-error` : undefined}
          aria-invalid={Boolean(referenceError)}
          id={`gcash-reference-${orderId}`}
          inputMode="numeric"
          maxLength={20}
          name="gcashReferenceNumber"
          required
        />
        {referenceError ? (
          <p className="mt-1 text-sm text-red-700" id={`gcash-reference-${orderId}-error`} role="alert">{referenceError}</p>
        ) : null}
      </div>
      <div className="mt-3">
        <Label htmlFor={`gcash-screenshot-${orderId}`}>Screenshot (optional)</Label>
        <Input accept="image/jpeg,image/png" id={`gcash-screenshot-${orderId}`} name="screenshot" type="file" />
      </div>
      {state.message ? <p className="mt-3 text-sm font-semibold text-secondary" role="alert">{state.message}</p> : null}
      <Button className="mt-4" disabled={pending} type="submit">
        {pending ? "Submitting…" : "Submit payment proof"}
      </Button>
    </form>
  );
}
