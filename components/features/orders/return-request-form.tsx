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
  open,
  onOpenChange,
  onRequested,
}: {
  orderId: number;
  lines: ReturnOfferLine[];
  paymentMethod: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: (number: string) => void;
}) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [lineIds, setLineIds] = useState<number[]>([]);
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [resolution, setResolution] = useState<PreferredResolution | "">("");
  const [showErrors, setShowErrors] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string>();

  const errors = validateReturnForm({ orderLineIds: lineIds, reason, note, photos, video, preferredResolution: resolution });
  // A wrong or oversized file is called out as soon as it is chosen; the rest waits for a submit attempt.
  const photoFileError = photos.map((photo) => evidenceFileError(photo, "photo")).find(Boolean)
    ?? (photos.length > maxPhotos ? errors.photos : undefined);
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
    if (Object.keys(errors).length === 0) {
      setMessage(undefined);
      setStep("confirm");
    }
  }

  async function send() {
    setSending(true);
    const result = await submitReturn({
      orderId, orderLineIds: lineIds, reason: reason as ReturnReason, note: note.trim(),
      preferredResolution: resolution as PreferredResolution, photos, video,
    });
    setSending(false);
    if (result.ok) {
      onRequested(result.number);
      return;
    }
    setMessage(result.message);
    setStep("form");
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

const refundMethods: Record<string, string> = { gcash: "GCash", maya: "Maya", "bank-transfer": "bank account" };
const refundMethodLabel = (method: string) => refundMethods[method];

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
