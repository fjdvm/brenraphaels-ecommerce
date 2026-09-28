"use client";

import { useActionState } from "react";

import { submitOrderFeedback, type OrderFeedbackState } from "@/app/(site)/(protected)/profile/orders/actions";
import { Button } from "@/components/ui/button";

const initialState: OrderFeedbackState = {};

/** Collects an optional, one-time response on a delivered Order. */
export function OrderFeedbackForm({ orderId }: { orderId: number }) {
  const [state, action, pending] = useActionState(submitOrderFeedback, initialState);
  if (state.submitted) {
    return <p className="mt-5 text-sm font-semibold text-secondary" role="status">Thank you for your Feedback.</p>;
  }

  return (
    <form action={action} className="mt-5 rounded-md border border-outline-variant/60 bg-surface-container p-4">
      <input name="orderId" type="hidden" value={orderId} />
      <fieldset className="grid gap-2">
        <legend className="font-semibold text-primary">How was your Order?</legend>
        <p className="text-sm text-on-surface-variant">Your Feedback is private and cannot be changed after submission.</p>
        <label className="grid gap-1 text-sm font-semibold text-on-surface" htmlFor={`order-${orderId}-rating`}>
          Order feedback score
          <select aria-invalid={Boolean(state.fieldErrors?.rating)} className="h-10 w-32 border border-input bg-white px-2" defaultValue="" id={`order-${orderId}-rating`} name="rating" required>
            <option disabled value="">Choose</option>
            {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
          </select>
          {state.fieldErrors?.rating?.[0] ? <p className="text-sm text-red-700" role="alert">{state.fieldErrors.rating[0]}</p> : null}
        </label>
        <label className="grid gap-1 text-sm font-semibold text-on-surface" htmlFor={`order-${orderId}-comment`}>
          Your Order feedback
          <textarea aria-invalid={Boolean(state.fieldErrors?.comment)} className="min-h-24 border border-input bg-white px-3 py-2" id={`order-${orderId}-comment`} maxLength={2_000} name="comment" required />
          {state.fieldErrors?.comment?.[0] ? <p className="text-sm text-red-700" role="alert">{state.fieldErrors.comment[0]}</p> : null}
        </label>
      </fieldset>
      {state.message ? <p className="mt-3 text-sm text-red-700" role="alert">{state.message}</p> : null}
      <Button className="mt-4" disabled={pending} type="submit">{pending ? "Submitting…" : "Submit Feedback"}</Button>
    </form>
  );
}
