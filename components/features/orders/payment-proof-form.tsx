"use client";

import { Upload, Wallet } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { submitPaymentProof, type PaymentProofState } from "@/app/(site)/(protected)/profile/orders/actions";
import { Button } from "@/components/ui/button";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentAccountsCard } from "@/components/features/orders/payment-accounts-card";
import { formatPeso } from "@/lib/catalog/currency";
import { PAYMENT_LABELS } from "@/lib/orders/payment-details";
import type { PaymentAccountOption } from "@/lib/orders/payment-offer";
import type { PaymentMethod } from "@/lib/orders/orders";
import { checkReceipt, readReceiptText, readScreenshotText } from "@/lib/orders/screenshot-reading";

const initialState: PaymentProofState = {};

type Field = "reference" | "amount" | "paidAt";
type Values = Record<Field, string>;
const emptyValues: Values = { reference: "", amount: "", paidAt: "" };

/**
 * The warning panel where a Customer sends their reference number and optional receipt, with where to pay.
 * After staff turn a proof down it says why and asks again.
 */
export function PaymentProofForm({ orderId, amountInCentavos, method = "gcash", accounts, rejection, deadline, placedAt }: {
  orderId: number;
  amountInCentavos: number;
  method?: PaymentMethod;
  /** The shop's active accounts; left out where the page already shows them. */
  accounts?: PaymentAccountOption[];
  /** Why the last proof was not accepted; set when the Customer is uploading again. */
  rejection?: { reason: string } | null;
  /** When the Order is cancelled if still unpaid. */
  deadline?: string;
  /** When the Order was placed; a receipt dated before it fails the date check. */
  placedAt?: Date;
}) {
  const label = PAYMENT_LABELS[method];
  const [state, action, pending] = useActionState(submitPaymentProof.bind(null, orderId), initialState);
  const [fileName, setFileName] = useState<string>();
  const [values, setValues] = useState<Values>(emptyValues);
  // Fields still holding exactly what the screenshot reading filled in; typing over one clears its label.
  const [read, setRead] = useState<ReadonlySet<Field>>(new Set());
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string>();
  const latestRead = useRef(0);
  const referenceError = state.fieldErrors?.gcashReferenceNumber?.[0];

  const type = (field: Field) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setRead((current) => { const next = new Set(current); next.delete(field); return next; });
  };

  // Runs once per picked file, in this browser; the screenshot is only uploaded when the Customer submits.
  async function readFile(file: File | undefined) {
    setFileName(file?.name);
    setReadNote(undefined);
    const attempt = ++latestRead.current;
    if (!file) { setRead(new Set()); return; }
    setReading(true);
    try {
      const receipt = readReceiptText(await readScreenshotText(file));
      if (attempt !== latestRead.current) return;
      const next: Partial<Values> = {};
      if (receipt.reference) next.reference = receipt.reference;
      if (receipt.amountInCentavos !== undefined) next.amount = (receipt.amountInCentavos / 100).toFixed(2);
      if (receipt.paidAt) next.paidAt = receipt.paidAt;
      setValues((current) => ({ ...current, ...next }));
      setRead(new Set(Object.keys(next) as Field[]));
      if (Object.keys(next).length === 0) setReadNote("We couldn't read this screenshot. Type the details from your receipt instead.");
    } catch {
      if (attempt !== latestRead.current) return;
      setRead(new Set());
      setReadNote("We couldn't read this screenshot. Type the details from your receipt instead.");
    } finally {
      if (attempt === latestRead.current) setReading(false);
    }
  }

  const checks = placedAt
    ? checkReceipt(
        { amountInCentavos: read.has("amount") && values.amount ? Math.round(Number(values.amount) * 100) : undefined, paidAt: read.has("paidAt") ? values.paidAt : undefined },
        { totalInCentavos: amountInCentavos, placedAt },
      )
    : {};
  const note = (field: Field, check?: { passed: boolean; note: string }) =>
    read.has(field) ? (
      <p className={check && !check.passed ? "text-xs text-red-700" : "text-xs text-green-700"} data-testid={`read-note-${field}`}>
        Read from your screenshot{check ? ` · ${check.note}` : ""}
      </p>
    ) : null;

  return (
    <form action={action} className="flex flex-col gap-[18px] bg-warning-soft p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <Wallet aria-hidden className="size-[22px] shrink-0 text-warning" strokeWidth={1.5} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-serif text-lg leading-[1.35] text-ink">{rejection ? `We couldn't accept your ${label} payment proof` : `Submit your ${label} payment`}</p>
          <p className="text-sm tracking-[0.35px] text-body">
            Send {formatPeso(amountInCentavos)} via {label}, then enter the reference number from your receipt.
          </p>
        </div>
      </div>
      {rejection ? <p className="text-sm font-medium text-red-700" role="status">Reason: {rejection.reason}. Please send a new screenshot and its reference number.</p> : null}
      {accounts ? <PaymentAccountsCard accounts={accounts} amountInCentavos={amountInCentavos} deadline={deadline ?? ""} method={method} /> : null}
      {Object.entries(state.fieldErrors ?? {}).filter(([field]) => field !== "gcashReferenceNumber").map(([field, errors]) =>
        errors?.map(error => <p key={`${field}-${error}`} role="alert" className="text-sm text-red-700">{error}</p>))}
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium text-ink">Confirm the values on your receipt</legend>
        <div className="flex flex-col gap-2">
          <Label className={fieldLabelClass} htmlFor={`proof-amount-${orderId}`}>Amount paid (₱)</Label>
          <Input className={fieldClass} id={`proof-amount-${orderId}`} name="confirmedAmount" onChange={type("amount")} type="number" min="0" max="21474836.47" step="0.01" value={values.amount} />
          {note("amount", checks.amount)}
        </div>
        <div className="flex flex-col gap-2">
          <Label className={fieldLabelClass} htmlFor={`proof-date-${orderId}`}>Payment date and time (Philippine time)</Label>
          <Input className={fieldClass} id={`proof-date-${orderId}`} name="confirmedPaidAt" onChange={type("paidAt")} type="datetime-local" value={values.paidAt} />
          {note("paidAt", checks.date)}
        </div>
        <div className="flex flex-col gap-2">
          <Label className={fieldLabelClass} htmlFor={`proof-recipient-${orderId}`}>Recipient account number</Label>
          <Input className={fieldClass} id={`proof-recipient-${orderId}`} name="confirmedRecipient" maxLength={160} />
        </div>
      </fieldset>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label className={fieldLabelClass} htmlFor={`gcash-reference-${orderId}`} required>{label} reference number</Label>
          <Input
            aria-describedby={referenceError ? `gcash-reference-${orderId}-error` : undefined}
            aria-invalid={Boolean(referenceError)}
            className={fieldClass}
            id={`gcash-reference-${orderId}`}
            inputMode={method === "bank-transfer" ? "text" : "numeric"}
            maxLength={method === "bank-transfer" ? 30 : 20}
            name="gcashReferenceNumber"
            onChange={type("reference")}
            value={values.reference}
            placeholder="e.g. 1234 567 890123"
            required
          />
          {note("reference")}
          {referenceError ? (
            <p className="text-sm text-red-700" id={`gcash-reference-${orderId}-error`} role="alert">{referenceError}</p>
          ) : null}
        </div>
        <label
          className="flex cursor-pointer items-center gap-2.5 border border-dashed border-primary bg-white px-5 py-3.5 text-sm font-medium tracking-[0.35px] text-primary focus-within:ring-2 focus-within:ring-ring"
          htmlFor={`gcash-screenshot-${orderId}`}
        >
          <Upload aria-hidden className="size-[18px]" strokeWidth={1.5} />
          <span className="max-w-48 truncate">{fileName ?? (rejection ? "Upload new screenshot" : "Add screenshot (optional)")}</span>
          <input
            accept="image/jpeg,image/png"
            className="sr-only"
            id={`gcash-screenshot-${orderId}`}
            name="screenshot"
            onChange={(event) => void readFile(event.target.files?.[0])}
            type="file"
          />
        </label>
        <Button disabled={pending} size="pill-lg" type="submit" variant="pill">
          {pending ? "Submitting…" : rejection ? "Send new proof" : "Submit payment"}
        </Button>
      </div>
      {reading ? <p className="text-sm text-body" role="status">Reading your screenshot in this browser…</p> : null}
      {readNote ? <p className="text-sm text-body" role="status">{readNote}</p> : null}
      {read.size > 0 ? <p className="text-xs text-body">Wrong number? Just type over it. Our team still checks the payment before marking your order paid. Your screenshot was read in this browser and not sent anywhere to be read.</p> : null}
      {deadline ? <p className="text-xs tracking-[0.35px] text-ink">Send it by {deadline}, or the order will be cancelled.</p> : null}
      {state.message ? <p className="text-sm font-medium text-primary" role="alert">{state.message}</p> : null}
    </form>
  );
}
