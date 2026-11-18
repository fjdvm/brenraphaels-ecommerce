"use client";

import { useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatPeso } from "@/lib/catalog/currency";
import { evidenceFileError, maxPhotos } from "@/lib/returns/evidence-rules";
import { submitReturn } from "@/lib/returns/return-client";
import {
  returnReasons,
  validateReturnForm,
  type PreferredResolution,
  type ReturnReason,
} from "@/lib/returns/return-form";
import {
  maskAccountNumber, refundMethodLabels, refundMethods, validateRefundDestination,
  type RefundDestination, type RefundDestinationValues, type RefundMethod,
} from "@/lib/returns/refund-destination";
import type { ReturnOfferLine } from "@/lib/returns/return-offers";

const fieldClass = "w-full border border-line bg-white px-4 py-3 text-sm tracking-[0.35px] outline-none focus:ring-2 focus:ring-ring";
const labelClass = "text-[13px] font-medium tracking-[0.35px] text-ink";
const errorClass = "text-sm text-red-700";

/**
 * The Return request: pick whole line items, a reason, a note, photos, an optional video and a preferred
 * Resolution, then confirm before anything uploads. The dialog stays fixed and its body scrolls.
 */
export function ReturnRequestForm({
  orderId,
  lines,
  paymentMethod,
  refundable,
  savedRefundDestination,
  open,
  onOpenChange,
  onSending,
  onRequested,
  onFailed,
}: {
  orderId: number;
  lines: ReturnOfferLine[];
  paymentMethod: string;
  /** False when there is nothing to refund (an uncollected Cash on Delivery Order): no refund details are asked. */
  refundable: boolean;
  /** Details the Customer confirmed on an earlier Return; they pre-fill the fields but are confirmed again every time. */
  savedRefundDestination: RefundDestination | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called the moment the Customer confirms, so the page can show the Return as requested at once. */
  onSending: () => void;
  onRequested: (number: string) => void;
  /** The server refused or the connection failed: the page rolls the optimistic state back and reopens this form. */
  onFailed: (message: string) => void;
}) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [lineIds, setLineIds] = useState<number[]>([]);
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [resolution, setResolution] = useState<PreferredResolution | "">("");
  const [destination, setDestination] = useState<RefundDestinationValues>({
    method: savedRefundDestination?.method ?? "", accountName: savedRefundDestination?.accountName ?? "",
    accountNumber: savedRefundDestination?.accountNumber ?? "", bankName: savedRefundDestination?.bankName ?? "",
  });
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string>();

  const errors = validateReturnForm({ orderLineIds: lineIds, reason, note, photos, video, preferredResolution: resolution });
  // A wrong or oversized file is called out as soon as it is chosen; the rest waits for a submit attempt.
  const photoFileError = photos.map((photo) => evidenceFileError(photo, "photo")).find(Boolean)
    ?? (photos.length > maxPhotos ? errors.photos : undefined);
  const asksForRefundDestination = refundable && resolution === "refund";
  const destinationErrors = asksForRefundDestination ? validateRefundDestination(destination) : {};
  const confirmError = asksForRefundDestination && !destinationConfirmed ? "Confirm your refund details before continuing." : undefined;
  const shown = {
    orderLineIds: showErrors ? errors.orderLineIds : undefined,
    reason: showErrors ? errors.reason : undefined,
    note: errors.note,
    photos: photoFileError ?? (showErrors ? errors.photos : undefined),
    video: errors.video,
    preferredResolution: showErrors ? errors.preferredResolution : undefined,
  };

  function toggleLine(id: number) {
    setLineIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    setPhotos((current) => [...current, ...chosen]);
  }

  function review() {
    setShowErrors(true);
    if (Object.keys(errors).length === 0 && Object.keys(destinationErrors).length === 0 && !confirmError) {
      setMessage(undefined);
      setStep("confirm");
    }
  }

  async function send() {
    setSending(true);
    // Cancelling a Return is easy, so the page shows it as requested straight away and rolls back if refused.
    onSending();
    const result = await submitReturn({
      orderId, orderLineIds: lineIds, reason: reason as ReturnReason, note: note.trim(),
      preferredResolution: resolution as PreferredResolution, photos, video,
      ...(asksForRefundDestination ? { refundDestination: { ...destination, confirmed: destinationConfirmed } } : {}),
    });
    setSending(false);
    if (result.ok) {
      onRequested(result.number);
      return;
    }
    setMessage(result.message);
    setStep("form");
    onFailed(result.message);
  }

  const selected = lines.filter((line) => lineIds.includes(line.id));

  return (
    <Dialog onOpenChange={(next) => !sending && onOpenChange(next)} open={open}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:p-0">
        {step === "confirm" ? (
          <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-8 text-center sm:p-12">
            <DialogTitle className="font-serif text-3xl leading-tight text-primary">Send this Return request?</DialogTitle>
            <DialogDescription className="leading-7 text-on-surface-variant">
              You are asking to return {selected.map((line) => `${line.productName} (${line.sizeLabel})`).join(", ")}
              {resolution === "refund" ? " for a refund" : " for a replacement"}. We will review it and email you.
            </DialogDescription>
            {asksForRefundDestination ? (
              <dl className="flex flex-col gap-1 border border-line p-4 text-left text-sm text-ink" aria-label="Refund destination">
                <dt className="text-xs text-muted">Your refund goes to</dt>
                <dd>{refundMethodLabels[destination.method as RefundMethod]}{destination.method === "bank-transfer" ? ` · ${destination.bankName.trim()}` : ""}</dd>
                <dd>{destination.accountName.trim()}</dd>
                <dd>{destination.accountNumber.replace(/[\s-]/g, "")}</dd>
              </dl>
            ) : null}
            {message ? <p className={errorClass} role="alert">{message}</p> : null}
            <div className="flex flex-col-reverse justify-center gap-3 sm:flex-row">
              <Button disabled={sending} onClick={() => setStep("form")} size="lg" type="button" variant="outline">Go back</Button>
              <Button disabled={sending} onClick={send} size="lg" type="button">{sending ? "Sending…" : "Yes, send request"}</Button>
            </div>
          </div>
        ) : (
          <form
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              review();
            }}
          >
            <div className="flex flex-col gap-1 border-b border-line p-6 pr-12 sm:px-10">
              <DialogTitle className="font-serif text-2xl leading-tight text-primary">Return items</DialogTitle>
              <DialogDescription className="text-sm text-on-surface-variant">
                Tell us what went wrong. Returns are for damaged, defective or wrong items.
              </DialogDescription>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 sm:px-10">
              {message ? <p className={errorClass} role="alert">{message}</p> : null}

              <fieldset className="flex flex-col gap-3">
                <legend className={labelClass}>Items to return</legend>
                <p className="text-xs text-muted">Each item is returned whole, in the quantity you bought.</p>
                {lines.map((line) => (
                  <label className="flex items-center gap-3 text-sm text-ink" key={line.id}>
                    <input
                      checked={lineIds.includes(line.id)}
                      className="size-4 accent-primary"
                      disabled={!line.returnable}
                      onChange={() => toggleLine(line.id)}
                      type="checkbox"
                    />
                    <span className="flex-1">
                      {line.productName} · {line.sizeLabel} × {line.quantity}
                      {line.returnable ? null : <span className="block text-xs text-muted">Already in a Return</span>}
                    </span>
                    <span className="text-muted">{formatPeso(line.priceInCentavos * line.quantity)}</span>
                  </label>
                ))}
                {shown.orderLineIds ? <p className={errorClass} role="alert">{shown.orderLineIds}</p> : null}
              </fieldset>

              <div className="flex flex-col gap-2">
                <label className={labelClass} htmlFor={`return-${orderId}-reason`}>Reason</label>
                <select
                  className={fieldClass}
                  id={`return-${orderId}-reason`}
                  onChange={(event) => setReason(event.target.value as ReturnReason | "")}
                  value={reason}
                >
                  <option value="">Choose a reason</option>
                  {returnReasons.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
                {shown.reason ? <p className={errorClass} role="alert">{shown.reason}</p> : null}
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass} htmlFor={`return-${orderId}-note`}>Note (optional)</label>
                <textarea
                  className={`${fieldClass} min-h-24`}
                  id={`return-${orderId}-note`}
                  onChange={(event) => setNote(event.target.value)}
                  value={note}
                />
                {shown.note ? <p className={errorClass} role="alert">{shown.note}</p> : null}
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass} htmlFor={`return-${orderId}-photos`}>Photos (1 to 3, JPG or PNG, up to 5 MB each)</label>
                <input
                  accept="image/jpeg,image/png"
                  className="text-sm"
                  id={`return-${orderId}-photos`}
                  multiple
                  onChange={addPhotos}
                  type="file"
                />
                <FileList files={photos} onRemove={(index) => setPhotos((current) => current.filter((_, i) => i !== index))} />
                {shown.photos ? <p className={errorClass} role="alert">{shown.photos}</p> : null}
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass} htmlFor={`return-${orderId}-video`}>Video (optional, MP4 or MOV, up to 25 MB)</label>
                <input
                  accept="video/mp4,video/quicktime"
                  className="text-sm"
                  id={`return-${orderId}-video`}
                  onChange={(event) => {
                    setVideo(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                  type="file"
                />
                <FileList files={video ? [video] : []} onRemove={() => setVideo(null)} />
                {shown.video ? <p className={errorClass} role="alert">{shown.video}</p> : null}
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className={labelClass}>What would you prefer?</legend>
                {(["refund", "replacement"] as const).map((value) => (
                  <label className="flex items-center gap-3 text-sm text-ink" key={value}>
                    <input
                      checked={resolution === value}
                      className="size-4 accent-primary"
                      name={`return-${orderId}-resolution`}
                      onChange={() => setResolution(value)}
                      type="radio"
                    />
                    {value === "refund" ? refundLabel(paymentMethod, lines.filter((line) => lineIds.includes(line.id))) : "Replacement"}
                  </label>
                ))}
                {refundMethodLabel(paymentMethod) ? (
                  <p className="text-xs text-muted">A refund is sent to your {refundMethodLabel(paymentMethod)} within 3 working days of approval.</p>
                ) : (
                  <p className="text-xs text-muted">Cash on Delivery has no payment to send back; we will arrange your refund with you.</p>
                )}
                <p className="text-xs text-muted">This is your preference. Our team makes the final decision.</p>
                {shown.preferredResolution ? <p className={errorClass} role="alert">{shown.preferredResolution}</p> : null}
              </fieldset>

              {asksForRefundDestination ? (
                <fieldset className="flex flex-col gap-4 border border-line p-4">
                  <legend className={`${labelClass} px-1`}>Where should we send your refund?</legend>
                  <p className="text-xs text-muted">
                    Enter the account that is yours. This is never taken from your payment proof. We only use it for this refund.
                    {savedRefundDestination ? " We filled in the details you confirmed last time; check them." : ""}
                  </p>
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor={`return-${orderId}-refund-method`}>Refund method</label>
                    <select
                      className={fieldClass}
                      id={`return-${orderId}-refund-method`}
                      onChange={(event) => { setDestination((current) => ({ ...current, method: event.target.value as RefundMethod | "" })); setDestinationConfirmed(false); }}
                      value={destination.method}
                    >
                      <option value="">Choose a method</option>
                      {refundMethods.map((value) => <option key={value} value={value}>{refundMethodLabels[value]}</option>)}
                    </select>
                    {showErrors && destinationErrors.method ? <p className={errorClass} role="alert">{destinationErrors.method}</p> : null}
                  </div>
                  {destination.method === "bank-transfer" ? (
                    <div className="flex flex-col gap-2">
                      <label className={labelClass} htmlFor={`return-${orderId}-refund-bank`}>Bank name</label>
                      <input className={fieldClass} id={`return-${orderId}-refund-bank`} maxLength={100}
                        onChange={(event) => { setDestination((current) => ({ ...current, bankName: event.target.value })); setDestinationConfirmed(false); }}
                        value={destination.bankName} />
                      {showErrors && destinationErrors.bankName ? <p className={errorClass} role="alert">{destinationErrors.bankName}</p> : null}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor={`return-${orderId}-refund-name`}>Account name</label>
                    <input autoComplete="name" className={fieldClass} id={`return-${orderId}-refund-name`} maxLength={100}
                      onChange={(event) => { setDestination((current) => ({ ...current, accountName: event.target.value })); setDestinationConfirmed(false); }}
                      value={destination.accountName} />
                    {showErrors && destinationErrors.accountName ? <p className={errorClass} role="alert">{destinationErrors.accountName}</p> : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor={`return-${orderId}-refund-number`}>Account number</label>
                    <input autoComplete="off" className={fieldClass} id={`return-${orderId}-refund-number`} inputMode="numeric" maxLength={30}
                      onChange={(event) => { setDestination((current) => ({ ...current, accountNumber: event.target.value })); setDestinationConfirmed(false); }}
                      value={destination.accountNumber} />
                    {showErrors && destinationErrors.accountNumber ? <p className={errorClass} role="alert">{destinationErrors.accountNumber}</p> : null}
                  </div>
                  <label className="flex items-start gap-3 text-sm text-ink">
                    <input checked={destinationConfirmed} className="mt-0.5 size-4 accent-primary"
                      onChange={(event) => setDestinationConfirmed(event.target.checked)} type="checkbox" />
                    <span>I confirm these refund details are mine and correct. We cannot send a refund to the wrong account.</span>
                  </label>
                  {showErrors && confirmError ? <p className={errorClass} role="alert">{confirmError}</p> : null}
                </fieldset>
              ) : resolution === "refund" ? (
                <p className="text-xs text-muted">No cash was collected on this Cash on Delivery Order, so there is nothing to refund. Choose a replacement.</p>
              ) : null}
            </div>

            <div className="flex flex-col-reverse justify-end gap-3 border-t border-line p-6 sm:flex-row sm:px-10">
              <Button onClick={() => onOpenChange(false)} size="lg" type="button" variant="outline">Cancel</Button>
              <Button size="lg" type="submit">Review request</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

const paidWithLabels: Record<string, string> = { gcash: "GCash", maya: "Maya", "bank-transfer": "bank account" };
const refundMethodLabel = (method: string) => paidWithLabels[method];

/** "Refund to GCash · ₱219": the way the Customer paid and the amount for the items chosen so far. */
function refundLabel(method: string, chosen: ReturnOfferLine[]) {
  const where = refundMethodLabel(method);
  const amount = chosen.length ? ` · ${formatPeso(chosen.reduce((sum, line) => sum + line.priceInCentavos * line.quantity, 0))}` : "";
  return where ? `Refund to ${where}${amount}` : "Refund";
}

function FileList({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  if (files.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-xs text-body">
      {files.map((file, index) => (
        <li className="flex items-center justify-between gap-3" key={`${file.name}-${index}`}>
          <span className="truncate">{file.name}</span>
          <button className="text-primary underline" onClick={() => onRemove(index)} type="button">Remove</button>
        </li>
      ))}
    </ul>
  );
}
