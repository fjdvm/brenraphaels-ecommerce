"use client";

import { Upload, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";

import type { PaymentProofState } from "@/lib/orders/process-payment-proof";
import { Button } from "@/components/ui/button";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentAccountsCard } from "@/components/features/orders/payment-accounts-card";
import { formatPeso } from "@/lib/catalog/currency";
import { PAYMENT_LABELS } from "@/lib/orders/payment-details";
import { paymentOffer, type PaymentAccountOption } from "@/lib/orders/payment-offer";
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
/** Sends the form to the server and reports how much of the upload has gone, which a Form Action cannot do. */
function sendPaymentProof(orderId: number, formData: FormData, onProgress: (percent: number) => void) {
  return new Promise<PaymentProofState>((resolve) => {
    const failed = { message: "We couldn't upload that screenshot. Please check your connection and try again." };
    const request = new XMLHttpRequest();
    request.open("POST", `/api/orders/${orderId}/payment-proof`);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => resolve(request.response && typeof request.response === "object" ? request.response : failed);
    request.onerror = () => resolve(failed);
    request.onabort = () => resolve(failed);
    request.send(formData);
  });
}

/** Keeps only digits and one decimal point, with at most two decimal places. */
function digitsOnly(value: string) {
  const [whole = "", ...rest] = value.replace(/[^0-9.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

export function PaymentProofForm({ orderId, amountInCentavos, method = "gcash", accounts, showAccounts = true, rejection, deadline, placedAt }: {
  orderId: number;
  amountInCentavos: number;
  method?: PaymentMethod;
  /** The shop's active accounts: the Customer picks the one they paid. */
  accounts?: PaymentAccountOption[];
  /** False where the page already lists the accounts above the form. */
  showAccounts?: boolean;
  /** Why the last proof was not accepted; set when the Customer is uploading again. */
  rejection?: { reason: string } | null;
  /** When the Order is cancelled if still unpaid. */
  deadline?: string;
  /** When the Order was placed; a receipt dated before it fails the date check. */
  placedAt?: Date;
}) {
  const label = PAYMENT_LABELS[method];
  const router = useRouter();
  const [uploadPercent, setUploadPercent] = useState<number>();
  const [state, action, pending] = useActionState(async (_previous: PaymentProofState, formData: FormData) => {
    setUploadPercent(0);
    try {
      const result = await sendPaymentProof(orderId, formData, setUploadPercent);
      if (result.submitted) router.refresh();
      return result;
    } finally {
      setUploadPercent(undefined);
    }
  }, initialState);
  const [fileName, setFileName] = useState<string>();
  const [values, setValues] = useState<Values>(emptyValues);
  // Fields still holding exactly what the screenshot reading filled in; typing over one clears its label.
  const [read, setRead] = useState<ReadonlySet<Field>>(new Set());
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [readNote, setReadNote] = useState<string>();
  const latestRead = useRef(0);
  const referenceError = state.fieldErrors?.gcashReferenceNumber?.[0];
  const offered = accounts ? paymentOffer(method, accounts) : undefined;
  const choices = offered?.kind === "accounts" ? offered.accounts : [];
  const [accountId, setAccountId] = useState("");
  const chosen = choices.find((account) => account.id === accountId);
  const formRef = useRef<HTMLFormElement>(null);
  const [confirming, setConfirming] = useState(false);
  // One key per submission, so a retried submit never saves a second proof; a new one once this one is saved.
  const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID());
  const [handled, setHandled] = useState(state);
  if (handled !== state) {
    setHandled(state);
    if (state.submitted) setSubmissionKey(crypto.randomUUID());
    if (state.submitted || state.message || state.fieldErrors) setConfirming(false);
  }
  // Submit waits for every required field: the account (when there is a choice), amount, date, reference and screenshot.
  const requiredFilled = Boolean(fileName) && values.amount.trim() !== "" && values.paidAt !== "" && values.reference.trim() !== "" && (choices.length === 0 || accountId !== "");
  const accountError = state.fieldErrors?.accountId?.[0];
  const screenshotError = state.fieldErrors?.screenshot?.[0];

  /** The confirm dialog comes first; the form is only sent once the Customer confirms. */
  function review() {
    if (formRef.current?.reportValidity()) setConfirming(true);
  }

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
    setProgress(0);
    setReading(true);
    try {
      const receipt = readReceiptText(await readScreenshotText(file, (percent) => { if (attempt === latestRead.current) setProgress((current) => Math.max(current, percent)); }));
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
      if (attempt === latestRead.current) { setProgress(100); setReading(false); }
    }
  }

  const sentInCentavos = values.amount.trim() !== "" && Number.isFinite(Number(values.amount)) ? Math.round(Number(values.amount) * 100) : undefined;
  const amountMatches = sentInCentavos === undefined ? undefined : sentInCentavos === amountInCentavos;

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
    <form action={action} ref={formRef} className="flex flex-col gap-[18px] bg-warning-soft p-5 sm:p-7">
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
      {accounts && showAccounts ? <PaymentAccountsCard accounts={accounts} amountInCentavos={amountInCentavos} deadline={deadline ?? ""} method={method} /> : null}
      {choices.length > 0 ? (
        <fieldset className="flex flex-col gap-2" data-testid="account-choice">
          <legend className="mb-2 text-sm font-medium text-ink">Which account did you pay?</legend>
          {choices.map((account) => (
            <label className="flex cursor-pointer items-start gap-3 border border-line bg-white p-3 text-sm tracking-[0.35px] has-[:checked]:border-primary" key={account.id}>
              <input checked={accountId === account.id} className="mt-1 accent-primary" name="accountId" onChange={() => setAccountId(account.id)} required type="radio" value={account.id} />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-ink">{account.label} · {PAYMENT_LABELS[account.method]}{account.bankName ? ` · ${account.bankName}` : ""}</span>
                <span className="text-body">{account.accountName} · {account.accountNumber}</span>
              </span>
            </label>
          ))}
          {accountError ? <p className="text-sm text-red-700" role="alert">{accountError}</p> : null}
        </fieldset>
      ) : null}
      <input name="submissionKey" type="hidden" value={submissionKey} />
      {Object.entries(state.fieldErrors ?? {}).filter(([field]) => !["gcashReferenceNumber", "accountId", "screenshot"].includes(field)).map(([field, errors]) =>
        errors?.map(error => <p key={`${field}-${error}`} role="alert" className="text-sm text-red-700">{error}</p>))}
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium text-ink">Confirm the values on your receipt</legend>
        <div className="flex flex-col gap-2">
          <Label className={fieldLabelClass} htmlFor={`proof-amount-${orderId}`} required>Amount paid (₱)</Label>
          <Input className={fieldClass} id={`proof-amount-${orderId}`} name="confirmedAmount" required onChange={event => type("amount")({ target: { value: digitsOnly(event.target.value) } })} type="text" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" title="Numbers only, for example 1250.00" autoComplete="off" value={values.amount} />
          {note("amount", checks.amount)}
          {amountMatches === false ? <p className="text-xs text-red-700" role="alert">The amount paid must equal your order total of {formatPeso(amountInCentavos)} before you can submit.</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label className={fieldLabelClass} htmlFor={`proof-date-${orderId}`} required>Payment date and time (Philippine time)</Label>
          <Input className={fieldClass} id={`proof-date-${orderId}`} name="confirmedPaidAt" required min={placedAt ? new Date(placedAt.getTime() + 8 * 3_600_000).toISOString().slice(0, 16) : undefined} onChange={type("paidAt")} type="datetime-local" value={values.paidAt} />
          {note("paidAt", checks.date)}
        </div>
        <div className="flex flex-col gap-2">
          <Label className={fieldLabelClass} htmlFor={`proof-recipient-${orderId}`}>Recipient account number (optional)</Label>
          <Input className={fieldClass} id={`proof-recipient-${orderId}`} name="confirmedRecipient" maxLength={160} />
        </div>
      </fieldset>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
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
        {/* Centred on the input row (label height + gap = mt-7, input height = h-12), so the notes under the input never push them off line. */}
        <div className="flex flex-col gap-4 lg:mt-7 lg:h-12 lg:flex-row lg:items-center">
        <label
          className="flex cursor-pointer items-center gap-2.5 border border-dashed border-primary bg-white px-5 py-3.5 text-sm font-medium tracking-[0.35px] text-primary focus-within:ring-2 focus-within:ring-ring"
          htmlFor={`gcash-screenshot-${orderId}`}
        >
          <Upload aria-hidden className="size-[18px]" strokeWidth={1.5} />
          <span className="max-w-48 truncate">{fileName ?? (rejection ? "Upload new screenshot" : "Add screenshot")}</span>
          <input
            accept="image/jpeg,image/png"
            className="sr-only"
            id={`gcash-screenshot-${orderId}`}
            name="screenshot"
            onChange={(event) => void readFile(event.target.files?.[0])}
            required
            type="file"
          />
        </label>
        <Button disabled={pending || choices.length === 0 || amountMatches === false || !requiredFilled} onClick={review} size="pill-lg" type="button" variant="pill">
          {pending ? (uploadPercent === undefined ? "Submitting…" : uploadPercent >= 99 ? "Saving…" : `Uploading ${uploadPercent}%`) : rejection ? "Send new proof" : "Submit payment"}
        </Button>
        </div>
      </div>
      <p className="text-xs text-body">A JPG or PNG screenshot up to 5 MB is required.</p>
      {screenshotError ? <p className="text-sm text-red-700" role="alert">{screenshotError}</p> : null}
      {pending && uploadPercent !== undefined ? (
        <div className="flex flex-col gap-1.5" role="status">
          <p className="text-sm text-body">Uploading your screenshot… <span data-testid="upload-percent">{uploadPercent}%</span></p>
          <div aria-hidden className="h-1.5 w-full max-w-xs overflow-hidden bg-primary/15">
            <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${uploadPercent}%` }} />
          </div>
        </div>
      ) : null}
      {reading ? (
        <div className="flex flex-col gap-1.5" role="status">
          <p className="text-sm text-body">Reading your screenshot in this browser… <span data-testid="reading-percent">{progress}%</span></p>
          <div aria-label="Screenshot reading progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} className="h-1.5 w-full max-w-xs overflow-hidden bg-primary/15" role="progressbar">
            <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}
      {readNote ? <p className="text-sm text-body" role="status">{readNote}</p> : null}
      {read.size > 0 ? <p className="text-xs text-body">Wrong number? Just type over it. Our team still checks the payment before marking your order paid. Your screenshot was read in this browser and not sent anywhere to be read.</p> : null}
      {deadline ? <p className="text-xs tracking-[0.35px] text-ink">Send it by {deadline}, or the order will be cancelled.</p> : null}
      {state.message ? <p className="text-sm font-medium text-primary" role="alert">{state.message}</p> : null}
      <Dialog onOpenChange={(open) => !pending && setConfirming(open)} open={confirming}>
        <DialogContent>
          <DialogTitle className="font-serif text-2xl leading-tight text-primary">Submit this payment?</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-on-surface-variant">Order #{orderId} · {chosen ? PAYMENT_LABELS[chosen.method] : label}</DialogDescription>
          <dl className="mt-6 flex flex-col gap-3 text-sm" data-testid="submit-summary">
            <div className="flex justify-between gap-4"><dt className="text-body">Account paid</dt><dd className="text-right text-ink">{chosen ? `${chosen.label} · ${chosen.accountNumber}` : "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-body">Reference number</dt><dd className="text-right text-ink">{values.reference || "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-body">Amount you sent</dt><dd className="text-right text-ink" data-testid="submit-amount-sent">{sentInCentavos === undefined ? "—" : formatPeso(sentInCentavos)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-body">Amount to send</dt><dd className="text-right text-ink" data-testid="submit-amount-due">{formatPeso(amountInCentavos)}</dd></div>
            <p className={amountMatches === false ? "text-xs text-red-700" : amountMatches ? "text-xs text-green-700" : "text-xs text-body"} data-testid="submit-amount-compare" role={amountMatches === false ? "alert" : undefined}>
              {amountMatches === undefined
                ? "Add the amount from your receipt so we can compare it with what you owe."
                : amountMatches
                  ? "Matches the amount to send."
                  : `${formatPeso(Math.abs(sentInCentavos! - amountInCentavos))} ${sentInCentavos! < amountInCentavos ? "short of" : "over"} the amount to send.`}
            </p>
            <div className="flex justify-between gap-4"><dt className="text-body">Screenshot</dt><dd className="max-w-48 truncate text-right text-ink">{fileName ?? "—"}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-body">Make sure the reference matches your receipt. We&apos;ll email you once it&apos;s verified.</p>
          {pending && uploadPercent !== undefined ? (
            <div aria-label="Screenshot upload progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={uploadPercent} className="mt-4 h-1.5 w-full overflow-hidden bg-primary/15" role="progressbar">
              <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${uploadPercent}%` }} />
            </div>
          ) : null}
          <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <Button disabled={pending} onClick={() => setConfirming(false)} size="pill-lg" type="button" variant="pill-outline">Go back</Button>
            <Button disabled={pending || amountMatches !== true} onClick={() => formRef.current?.requestSubmit()} size="pill-lg" type="button" variant="pill">{pending ? (uploadPercent === undefined ? "Submitting…" : uploadPercent >= 99 ? "Saving…" : `Uploading ${uploadPercent}%`) : "Submit payment"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
