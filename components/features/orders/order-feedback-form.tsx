"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";

import { submitOrderFeedback, type OrderFeedbackState } from "@/app/(site)/(protected)/profile/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const initialState: OrderFeedbackState = {};

export type GivenFeedback = { rating: number; comment: string; createdAt: Date };

const givenOn = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

/** Pick 1–5 stars; submits as the `rating` field. Native radios keep it keyboard- and screen-reader-friendly. */
function StarRating({ labelledBy, invalid }: { labelledBy: string; invalid: boolean }) {
  const [value, setValue] = useState(0);
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div aria-invalid={invalid} aria-labelledby={labelledBy} className="flex gap-1" onMouseLeave={() => setHovered(0)} role="radiogroup">
      {[1, 2, 3, 4, 5].map((rating) => (
        <label className="cursor-pointer" key={rating} onMouseEnter={() => setHovered(rating)}>
          <input
            aria-label={`${rating} out of 5 stars`}
            checked={value === rating}
            className="peer sr-only"
            name="rating"
            onChange={() => setValue(rating)}
            required
            type="radio"
            value={rating}
          />
          <span aria-hidden className={`block text-3xl leading-none peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${rating <= shown ? "text-amber-500" : "text-outline-variant"}`}>★</span>
        </label>
      ))}
    </div>
  );
}

/**
 * A delivered Order's Feedback: a one-time form, then the Customer's stars, comment and date.
 * It stays mounted across the refresh that follows a submit, so the thank-you survives it.
 */
export function OrderFeedbackForm({ orderId, feedback }: { orderId: number; feedback?: GivenFeedback | null }) {
  const [state, action, pending] = useActionState(submitOrderFeedback, initialState);
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  if (feedback || state.submitted) {
    return (
      <section className="rounded-[3px] bg-surface-soft p-5" id={`order-${orderId}-feedback`}>
        <h3 className="font-serif text-lg text-primary">Your feedback</h3>
        {state.submitted ? <p className="mt-2 text-sm font-semibold text-secondary" role="status">Thank you for your Feedback.</p> : null}
        {feedback ? (
          <>
            <p aria-label={`${feedback.rating} out of 5 stars`} className="mt-2 text-sm text-ink">
              <span aria-hidden>{"★".repeat(feedback.rating)}{"☆".repeat(5 - feedback.rating)}</span> Order feedback score: {feedback.rating} / 5
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{feedback.comment}</p>
            <p className="mt-1 text-xs text-muted">{givenOn.format(feedback.createdAt)}</p>
          </>
        ) : null}
      </section>
    );
  }

  /** Every submit (button or Enter) asks first; only the dialog's confirm lets it through. */
  function askToConfirm(event: FormEvent<HTMLFormElement>) {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    event.preventDefault();
    setConfirming(true);
  }

  function confirm() {
    confirmed.current = true;
    setConfirming(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form action={action} id={`order-${orderId}-feedback`} onSubmit={askToConfirm} className="mt-5 rounded-md border border-outline-variant/60 bg-surface-container p-4" ref={formRef}>
      <input name="orderId" type="hidden" value={orderId} />
      <fieldset className="grid gap-2">
        <legend className="font-semibold text-primary">How was your Order?</legend>
        <p className="text-sm text-on-surface-variant">Your Feedback is private and cannot be changed after submission.</p>
        <div className="grid gap-1 text-sm font-semibold text-on-surface">
          <span id={`order-${orderId}-rating-label`}>Order feedback score</span>
          <StarRating labelledBy={`order-${orderId}-rating-label`} invalid={Boolean(state.fieldErrors?.rating)} />
          {state.fieldErrors?.rating?.[0] ? <p className="text-sm text-red-700" role="alert">{state.fieldErrors.rating[0]}</p> : null}
        </div>
        <label className="grid gap-1 text-sm font-semibold text-on-surface" htmlFor={`order-${orderId}-comment`}>
          Your Order feedback
          <textarea aria-invalid={Boolean(state.fieldErrors?.comment)} className="min-h-24 border border-input bg-white px-3 py-2" id={`order-${orderId}-comment`} maxLength={2_000} name="comment" required />
          {state.fieldErrors?.comment?.[0] ? <p className="text-sm text-red-700" role="alert">{state.fieldErrors.comment[0]}</p> : null}
        </label>
      </fieldset>
      {state.message ? <p className="mt-3 text-sm text-red-700" role="alert">{state.message}</p> : null}
      <Button className="mt-4" disabled={pending} type="submit">{pending ? "Submitting…" : "Submit Feedback"}</Button>

      <Dialog onOpenChange={setConfirming} open={confirming}>
        <DialogContent className="text-center">
          <DialogTitle className="font-serif text-3xl leading-tight text-primary">Submit your Feedback?</DialogTitle>
          <DialogDescription className="mt-4 leading-7 text-on-surface-variant">
            Once submitted, your Feedback cannot be changed.
          </DialogDescription>
          <div className="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row">
            <Button onClick={() => setConfirming(false)} size="lg" type="button" variant="outline">Go back</Button>
            <Button onClick={confirm} size="lg" type="button">Confirm and submit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
