"use client";

import { useActionState, useState } from "react";

import { cancelOrder, type OrderCancellationState } from "@/app/(site)/(protected)/profile/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const initialState: OrderCancellationState = {};
export const CANCEL_REASONS = ["I entered the wrong address", "I ordered by mistake", "I want to change my order", "Other reason"] as const;

/**
 * The Order card's footer: a way to message us and "Cancel order", which opens a dialog asking why. A Customer may cancel
 * until the shop starts preparing the Order; `defaultOpen` lets the "Cancel order" link in the confirmation email open it.
 */
export function CancelOrderForm({ orderId, defaultOpen = false }: { orderId: number; defaultOpen?: boolean }) {
  const [state, action, pending] = useActionState(cancelOrder, initialState);
  const [open, setOpen] = useState(defaultOpen);
  const [choice, setChoice] = useState<(typeof CANCEL_REASONS)[number]>(CANCEL_REASONS[0]);
  const [other, setOther] = useState("");
  const reason = choice === "Other reason" ? other.trim() : choice;
  const cancelled = state.cancelled === true;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="mr-auto text-xs tracking-[0.35px] text-muted">You can cancel this order until the shop starts preparing it.</p>
        <Button disabled={cancelled} onClick={() => setOpen(true)} size="pill-sm" type="button" variant="pill-outline">Cancel order</Button>
      </div>
      <Dialog onOpenChange={(next) => !pending && setOpen(next)} open={open && !cancelled}>
        <DialogContent>
          <form action={action}>
            <input name="orderId" type="hidden" value={orderId} />
            <input name="reason" type="hidden" value={reason} />
            <DialogTitle className="font-serif text-3xl leading-tight text-primary">Cancel order #{orderId}?</DialogTitle>
            <DialogDescription className="mt-3 leading-7 text-on-surface-variant">Tell us why you need to cancel. This helps us improve.</DialogDescription>
            <fieldset className="mt-5 flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-ink">Why do you want to cancel?</legend>
              {CANCEL_REASONS.map((value) => (
                <label className={`flex items-center gap-3 border px-4 py-3 text-sm ${choice === value ? "border-primary bg-surface" : "border-outline-variant"}`} key={value}>
                  <input checked={choice === value} name="cancel-reason" onChange={() => setChoice(value)} type="radio" />
                  {value}
                </label>
              ))}
            </fieldset>
            {choice === "Other reason" ? (
              <textarea aria-label="Tell us why" className="mt-3 w-full border border-outline-variant p-3 text-sm" maxLength={1000} onChange={(e) => setOther(e.target.value)} value={other} />
            ) : null}
            {state.message ? <p className="mt-3 text-sm text-red-700" role="alert">{state.message}</p> : null}
            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <Button disabled={pending} onClick={() => setOpen(false)} size="lg" type="button" variant="outline">Keep my order</Button>
              <Button aria-busy={pending} disabled={pending || !reason} size="lg" type="submit">{pending ? "Cancelling…" : "Cancel order"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {cancelled ? <p className="text-sm font-medium text-primary" role="status">Order cancelled.</p> : null}
      {state.emailWarning ? <p className="text-sm text-body" role="status">{state.emailWarning}</p> : null}
    </div>
  );
}
